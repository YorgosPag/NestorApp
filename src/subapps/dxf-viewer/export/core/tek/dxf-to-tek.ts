/**
 * ADR-512 ΦΑΣΗ D — DXF primitives (γραμμές/τόξα/κύκλοι) → Tekton `<line>`/`<arc>`.
 *
 * Ο TEK exporter εξάγει τις BIM οντότητες ως native records (τοίχοι/κουφώματα/έπιπλα/
 * στέγες). Οι «καθαρές» DXF οντότητες του καμβά (line/polyline/circle/arc) ΔΕΝ είναι BIM —
 * ζουν αυτούσιες στο scene. Εδώ μετατρέπονται στα αντίστοιχα Tekton elements:
 *   line / polyline / lwpolyline → `<line>` (type 4) — μία εγγραφή ανά ευθύγραμμο τμήμα.
 *   circle                       → `<arc>` (type 5, `<circle>1`) — p0 = σημείο περιφέρειας.
 *   arc                          → `<arc>` (type 5, `<circle>0`) — p0/p1 = αρχή/τέλος.
 *
 * FULL SSoT: γωνίες→σημεία μέσω του υπάρχοντος `pointOnCircle` (ADR-074) + `degToRad`·
 * scene→μέτρα μέσω `metersPerSceneUnit` (ίδιο convention με τους τοίχους — καμία Y-flip,
 * browser-verified). Καμπύλες polyline (bulges) τμηματοποιούνται ως ευθείες (DEFER: bulge→arc).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-512-tekton-tek-export.md
 */

import type { Entity } from '../../../types/entities';
import type {
  ArcEntity, CircleEntity, LineEntity, LWPolylineEntity, PolylineEntity,
} from '../../../types/entities';
import { pointOnCircle } from '../../../rendering/entities/shared/geometry-vector-utils';
import { degToRad } from '../../../rendering/entities/shared/geometry-angle-utils';
import { isAnnotationSymbolEntity } from '../../../types/annotation-symbol';
import {
  buildLineRecordXml, buildArcRecordXml, buildObjectRecordXml, buildSymbolObjectXMatrix,
} from './tek-xml-writer';
import { sceneXYToTekMeters } from './tek-geometry';
import { tekSymbolTypeRes } from './tek-symbol-catalog';
import type { TekArc, TekLine } from './tek-types';

/** Default χρώμα DXF primitive (Τέκτων line/arc) όταν λείπει — από το δείγμα. */
const DEFAULT_PRIMITIVE_COLOR = 'FC8000';

interface Pt { readonly x: number; readonly y: number }

export interface TekLineCollectResult {
  readonly linesXml: string;
  readonly lineCount: number;
  /** ADR-608 — distinct tag/ετικέτα ονόματα που χρησιμοποιήθηκαν (για το `<tag_visibility>` registry). */
  readonly tags: readonly string[];
}
export interface TekArcCollectResult {
  readonly arcsXml: string;
  readonly arcCount: number;
  /** ADR-608 — distinct tag/ετικέτα ονόματα (για το registry). */
  readonly tags: readonly string[];
}

/** Χρώμα entity (hex/«#hex») ή default. Ο writer (`colorHex6`) κανονικοποιεί/fallback. */
function entityColor(e: Entity): string {
  return (e as { color?: string }).color ?? DEFAULT_PRIMITIVE_COLOR;
}

/**
 * ADR-608 — grouping tag ενός primitive = το `groupId` provenance (source σύμβολο id).
 * Absent ⇒ `undefined` (αταξινόμητο· κενό `<taglist>`).
 */
function entityTag(e: Entity): string | undefined {
  return (e as { groupId?: string }).groupId;
}

/** Ένα ευθύγραμμο τμήμα (scene units) → `TekLine` (μέτρα). Y-flip μέσω του SSoT `sceneXYToTekMeters`. */
function toTekLine(a: Pt, b: Pt, colorHex: string, id: number, f: number, tag?: string): TekLine {
  return {
    id,
    v0: sceneXYToTekMeters(a.x, a.y, f),
    v1: sceneXYToTekMeters(b.x, b.y, f),
    elevation0: 0,
    elevation1: 0,
    colorHex,
    tag,
  };
}

/** Διαδοχικά τμήματα ενός polyline (closed → +κλείσιμο). Καμπύλες (bulges) ως ευθείες (DEFER). */
function polylineSegments(
  vertices: readonly Pt[], closed: boolean,
): Array<readonly [Pt, Pt]> {
  const segs: Array<readonly [Pt, Pt]> = [];
  for (let i = 0; i < vertices.length - 1; i++) segs.push([vertices[i], vertices[i + 1]]);
  if (closed && vertices.length > 2) segs.push([vertices[vertices.length - 1], vertices[0]]);
  return segs;
}

/**
 * Συλλέγει τα γραμμικά DXF primitives (line/polyline/lwpolyline) ως `<line>` records.
 * `f` = μέτρα ανά scene unit (`sceneUnitsToMeters(scene.units)`).
 */
export function collectTekLines(entities: readonly Entity[], f: number): TekLineCollectResult {
  const records: string[] = [];
  const tags = new Set<string>();
  let id = 1;
  const pushSeg = (a: Pt, b: Pt, color: string, tag?: string): void => {
    if (a.x === b.x && a.y === b.y) return; // μηδενικού μήκους → skip
    records.push(buildLineRecordXml(toTekLine(a, b, color, id, f, tag)));
    if (tag) tags.add(tag);
    id += 1;
  };
  for (const e of entities) {
    const tag = entityTag(e);
    if (e.type === 'line') {
      const l = e as LineEntity;
      pushSeg(l.start, l.end, entityColor(e), tag);
    } else if (e.type === 'polyline' || e.type === 'lwpolyline') {
      const p = e as PolylineEntity | LWPolylineEntity;
      const color = entityColor(e);
      for (const [a, b] of polylineSegments(p.vertices ?? [], Boolean(p.closed))) {
        pushSeg(a, b, color, tag);
      }
    }
  }
  return { linesXml: records.join('\n'), lineCount: records.length, tags: [...tags] };
}

/**
 * Συλλέγει τα καμπύλα DXF primitives (circle/arc) ως `<arc>` records. `f` = μέτρα/scene unit.
 * Κύκλος → `<circle>1` (p0 = σημείο περιφέρειας, p1 = 0). Τόξο → `<circle>0` (p0/p1 = αρχή/τέλος
 * από `startAngle`/`endAngle` σε μοίρες, μέσω του SSoT `pointOnCircle`).
 */
export function collectTekArcs(entities: readonly Entity[], f: number): TekArcCollectResult {
  const records: string[] = [];
  const tags = new Set<string>();
  let id = 1;
  for (const e of entities) {
    const tag = entityTag(e);
    let arc: TekArc | null = null;
    if (e.type === 'circle') {
      const c = e as CircleEntity;
      const edge = pointOnCircle(c.center, c.radius, 0); // σημείο περιφέρειας → radius = |c−edge|
      // Y-flip (καμβάς Y-down → Τέκτων Y-up) μέσω του SSoT `sceneXYToTekMeters`.
      arc = {
        id, isCircle: true,
        centre: sceneXYToTekMeters(c.center.x, c.center.y, f),
        p0: sceneXYToTekMeters(edge.x, edge.y, f),
        p1: { x: 0, y: 0 },
        elevation: 0, colorHex: entityColor(e), tag,
      };
    } else if (e.type === 'arc') {
      const a = e as ArcEntity;
      const start = pointOnCircle(a.center, a.radius, degToRad(a.startAngle));
      const end = pointOnCircle(a.center, a.radius, degToRad(a.endAngle));
      // Y-flip (SSoT `sceneXYToTekMeters`) + swap αρχής/τέλους: η αναστροφή Y αντιστρέφει τη
      // φορά του τόξου (CW↔CCW), άρα εναλλάσσουμε p0↔p1 ώστε να μείνει το ίδιο οπτικό τόξο.
      arc = {
        id, isCircle: false,
        centre: sceneXYToTekMeters(a.center.x, a.center.y, f),
        p0: sceneXYToTekMeters(end.x, end.y, f),
        p1: sceneXYToTekMeters(start.x, start.y, f),
        elevation: 0, colorHex: entityColor(e), tag,
      };
    }
    if (arc) {
      records.push(buildArcRecordXml(arc));
      if (tag) tags.add(tag);
      id += 1;
    }
  }
  return { arcsXml: records.join('\n'), arcCount: records.length, tags: [...tags] };
}

export interface TekObjectCollectResult {
  readonly objectsXml: string;
  readonly objectCount: number;
  /** ADR-608 — ids των annotation-symbols που έγιναν type-7 objects (εξαιρούνται από την αποδόμηση). */
  readonly consumedIds: ReadonlySet<string>;
}

/**
 * ADR-608 «native» mode — annotation-symbols με built-in Tekton equivalent → **type-7
 * `<object>` records** (ΕΝΑ επιλέξιμο πακέτο ανά σύμβολο, ο Τέκτων ζωγραφίζει το native
 * σύμβολο). Επιστρέφει και τα `consumedIds` ώστε ο adapter να ΜΗΝ τα αποδομήσει ξανά σε
 * γεωμετρία. Σύμβολα χωρίς equivalent (grid-bubble/callout/revision/scale-bar) αγνοούνται
 * εδώ → μένουν στην αυτούσια-γεωμετρία διαδρομή. `f` = μέτρα ανά scene unit.
 */
export function collectTekObjects(entities: readonly Entity[], f: number): TekObjectCollectResult {
  const records: string[] = [];
  const consumedIds = new Set<string>();
  let id = 1;
  for (const e of entities) {
    if (!isAnnotationSymbolEntity(e)) continue;
    const typeRes = tekSymbolTypeRes(e.kind, e.symbolId);
    if (typeRes === undefined) continue; // χωρίς built-in → αυτούσια γεωμετρία
    const pos = sceneXYToTekMeters(e.position.x, e.position.y, f);
    // scale = 1 → native μέγεθος του Tekton συμβόλου (το δείγμα έδειξε scale 1)· ρύθμιση
    // μεγέθους από sizeMm = follow-up (άγνωστη η βάση μεγέθους του Tekton συμβόλου).
    const xmatrix = buildSymbolObjectXMatrix(pos.x, pos.y, degToRad(e.rotation ?? 0), 1);
    records.push(buildObjectRecordXml({ id, typeRes, xmatrix }));
    consumedIds.add(e.id);
    id += 1;
  }
  return { objectsXml: records.join('\n'), objectCount: records.length, consumedIds };
}
