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
  ArcEntity, CircleEntity, HatchEntity, LineEntity, LWPolylineEntity, PolylineEntity,
  RectangleEntity, RectEntity,
} from '../../../types/entities';
import { rectangleEntityVertices } from '../dxf-ascii-writer';
import { pointOnCircle } from '../../../rendering/entities/shared/geometry-vector-utils';
import { degToRad } from '../../../rendering/entities/shared/geometry-angle-utils';
import { isAnnotationSymbolEntity } from '../../../types/annotation-symbol';
import { isSolidHatch } from '../../../bim/hatch/hatch-properties';
import {
  resolveTektonHatchNumber, TEKTON_SOLID_HATCH_NUM,
} from '../../../data/tekton-hatch-catalog';
import {
  buildLineRecordXml, buildArcRecordXml, buildObjectRecordXml, buildSymbolObjectXMatrix,
  buildTextRecordXml, buildHatchRecordXml,
} from './tek-xml-writer';
import { sceneXYToTekMeters } from './tek-geometry';
import { tekSymbolTypeRes } from './tek-symbol-catalog';
import type { TekArc, TekHatch, TekHatchEdge, TekLine, TekText } from './tek-types';

/** Default κλίμακα μοτίβου γραμμοσκίασης (`<scaleX>`/`<scaleY>`) — verified δείγμα Τέκτονα. */
const DEFAULT_HATCH_SCALE = 0.15;

/** Default χρώμα DXF primitive (Τέκτων line/arc) όταν λείπει — από το δείγμα. */
const DEFAULT_PRIMITIVE_COLOR = 'FC8000';

// ── ADR-512 Φ-areas — native Tekton «εμβαδό» (area measurement) ────────────────
// Ground-truth (ΕΜΒΑΔΟ.tek / ΕΜΒΑΔΟ-1.tek): ο Τέκτων σώζει κάθε εμβαδό ως **2 records**
// (ΟΧΙ στον `<area>` container — μένει κενός): (1) ΕΝΑ `<hatch>` (type 6) με το κλειστό
// πολύγωνο ως `<vector>` ακμών, `boundary=1`, `raster_type=22`, σταθερό ανοιχτό-πράσινο
// γέμισμα σε λευκό φόντο· (2) ΕΝΑ `<text>` (type 3) ετικέτα «Ε = {εμβαδόν} τμ». Τα
// αναπαράγουμε πιστά μέσω των υπαρχόντων SSoT writers (`buildHatchRecordXml`+`buildTextRecordXml`).
/** Χρώμα γεμίσματος area hatch (`<color>`) — σταθερό από τα δείγματα. */
const AREA_FILL_COLOR = 'C0DCC0';
/** Λευκό φόντο μοτίβου (`<raster_bgcolor>`) — ώστε να φαίνεται το γέμισμα (ground-truth). */
const AREA_FILL_BG_COLOR = 'FFFFFF';
/** Αριθμός μοτίβου area hatch (inner `<type>`) — από το φρέσκο δείγμα ΕΜΒΑΔΟ.tek. */
const AREA_HATCH_PATTERN = 4;
/** Χρώμα ετικέτας εμβαδού (`<color>`) — κυανό, σταθερό από τα δείγματα. */
const AREA_LABEL_COLOR = '00FFFF';
/** Μέγεθος ετικέτας (`<ttfont><ptsize>`) — σταθερό 11 από τα δείγματα. */
const AREA_LABEL_PT = 11;
/** Label alignment (hallign=left / vallign=middle) — from the samples. */
const AREA_LABEL_HALIGN = 0;
const AREA_LABEL_VALIGN = 1;
/**
 * Μορφή ετικέτας εμβαδού — ΑΚΡΙΒΩΣ όπως ο Τέκτων: «Ε = {value} τμ» (2 δεκαδικά). ΔΕΝ είναι
 * UI/i18n label — είναι export-format token του `.tek` (πρέπει να ταιριάζει byte-faithful στη
 * native μορφή του Τέκτονα, όπως τα χρώματα/`tekNum`). N.11 εξαίρεση: format αρχείου, όχι `t()`.
 */
function buildAreaLabelText(areaSquareMeters: number): string {
  return `Ε = ${areaSquareMeters.toFixed(2)} τμ`;
}

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

/**
 * Χρώμα entity (hex/«#hex») ή default. Ο writer (`colorHex6`) κανονικοποιεί/fallback.
 * Exported: το `tek-hatch-explode` (ADR-648 Στάδιο Ε) χτίζει `<line>` records με το ΙΔΙΟ
 * color/tag/Y-flip convention — reuse, όχι δεύτερος ορισμός.
 */
export function entityColor(e: Entity): string {
  return (e as { color?: string }).color ?? DEFAULT_PRIMITIVE_COLOR;
}

/**
 * ADR-608 — grouping tag ενός primitive = το `groupId` provenance (source σύμβολο id).
 * Absent ⇒ `undefined` (αταξινόμητο· κενό `<taglist>`).
 */
export function entityTag(e: Entity): string | undefined {
  return (e as { groupId?: string }).groupId;
}

/**
 * ADR-512 Φ-areas — `true` όταν το entity είναι **μέτρηση εμβαδού** (native Tekton area):
 * `polyline`/`lwpolyline` που ΦΕΡΕΙ `measurement === true`. Ο ΜΟΝΟΣ tool που παράγει τέτοιο
 * entity είναι το `measure-area` (`drawing-entity-builders.ts` → closed polyline + `measurement`).
 * Το `measure-distance` βάζει επίσης `measurement` αλλά σε `type:'line'` → ΔΕΝ ταιριάζει εδώ
 * (μένει κανονική γραμμή). Discriminator αναγνώσιμος χωρίς νέο πεδίο/σήμανση στο source.
 */
function isTekAreaEntity(e: Entity): boolean {
  if (e.type !== 'polyline' && e.type !== 'lwpolyline') return false;
  return (e as { measurement?: boolean }).measurement === true;
}

/** Εμβαδόν κλειστού πολυγώνου (scene units²) μέσω shoelace — πάντα θετικό. */
function polygonAreaSceneUnits(vertices: readonly Pt[]): number {
  if (vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Κεντροειδές (area-weighted) κλειστού πολυγώνου· degenerate → μέσος όρος κορυφών. */
function polygonCentroid(vertices: readonly Pt[]): Pt {
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(signedArea) < 1e-9) {
    const n = vertices.length || 1;
    return {
      x: vertices.reduce((s, v) => s + v.x, 0) / n,
      y: vertices.reduce((s, v) => s + v.y, 0) / n,
    };
  }
  return { x: cx / (3 * signedArea), y: cy / (3 * signedArea) };
}

/**
 * Ένα ευθύγραμμο τμήμα (scene units) → `TekLine` (μέτρα). Y-flip μέσω του SSoT `sceneXYToTekMeters`.
 * Exported για το `tek-hatch-explode` (ADR-648 Στάδιο Ε) — ΕΝΑΣ ορισμός του scene→Tekton line.
 */
export function toTekLine(a: Pt, b: Pt, colorHex: string, id: number, f: number, tag?: string): TekLine {
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
    // ADR-512 Φ-areas — μέτρηση εμβαδού → native `<area>` (hatch+label μέσω `collectTekAreas`),
    // ΟΧΙ Ν ξεχωριστές `<line>`. Χωρίς αυτό το skip θα έβγαινε ΚΑΙ ως γραμμές (διπλό).
    if (isTekAreaEntity(e)) continue;
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
    } else if (e.type === 'rectangle' || e.type === 'rect') {
      // ADR-512 Φ-rect — το εργαλείο «Ορθογώνιο» παράγει `RectangleEntity` με `corner1/corner2`
      // (ΟΧΙ x/y/width/height, ΟΧΙ polyline)· ο Τέκτων δεν έχει native polyline/rectangle container
      // → βγαίνει ως 4 κλειστές `<line>` (ίδιο μονοπάτι με closed polyline). rect→4 κορυφές μέσω
      // του κοινού SSoT `rectangleEntityVertices` (χειρίζεται ΚΑΙ corner1/corner2 ΚΑΙ x/y/w/h).
      const r = e as RectangleEntity | RectEntity;
      const color = entityColor(e);
      for (const [a, b] of polylineSegments(rectangleEntityVertices(r), true)) {
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

export interface TekHatchCollectResult {
  readonly hatchesXml: string;
  readonly hatchCount: number;
  /** ADR-608 — distinct tag/ετικέτα ονόματα (για το `<tag_visibility>` registry). */
  readonly tags: readonly string[];
}

/** Ακμές ενός κλειστού boundaryPath (scene units) → `TekHatchEdge[]` (μέτρα, Y-flip SSoT). */
function hatchPathEdges(path: readonly Pt[], f: number): TekHatchEdge[] {
  const edges: TekHatchEdge[] = [];
  for (const [a, b] of polylineSegments(path, true)) {
    if (a.x === b.x && a.y === b.y) continue; // μηδενικού μήκους ακμή → skip
    edges.push({ v0: sceneXYToTekMeters(a.x, a.y, f), v1: sceneXYToTekMeters(b.x, b.y, f) });
  }
  return edges;
}

/**
 * ADR-512 — συλλέγει τις γραμμοσκιάσεις (`hatch`) ως Tekton `<hatch>` records (primitive
 * type 6). Κάθε κλειστό `boundaryPath` → ΕΝΑ record (μία ακμή ανά `<record>`, μέσω του SSoT
 * `polylineSegments(path, true)` + `sceneXYToTekMeters`). Ο αριθμός μοτίβου προκύπτει από το
 * `data/tekton-hatch-catalog` (solid → 22, αλλιώς `patternName` → native `pattern.inf` index).
 * Islands (τρύπες) βγαίνουν ως ξεχωριστά records (γεμιστά) — pixel-perfect even-odd = follow-up.
 * `f` = μέτρα ανά scene unit.
 *
 * ADR-648 Στάδιο Ε — αυτό είναι πλέον το **fallback** path: το native μοτίβο του Τέκτονα είναι
 * κατά προσέγγιση (άλλη βιβλιοθήκη — βλ. `tek-hatch-explode`). Όσες γραμμοσκιάσεις αποδομήθηκαν
 * σε `<line>` περνιούνται στο `skipIds` και ΔΕΝ ξαναβγαίνουν εδώ (αλλιώς: διπλό γέμισμα).
 * Μένουν native μόνο solid/gradient (δεν έχουν γραμμές) και όσες κόπηκαν από τον dense guard.
 */
export function collectTekHatches(
  entities: readonly Entity[], f: number, skipIds?: ReadonlySet<string>,
): TekHatchCollectResult {
  const records: string[] = [];
  const tags = new Set<string>();
  let id = 1;
  for (const e of entities) {
    if (e.type !== 'hatch') continue;
    if (skipIds?.has(e.id)) continue; // αποδομήθηκε σε `<line>` records (Στάδιο Ε)
    const h = e as HatchEntity;
    const tektonNum = isSolidHatch(h) ? TEKTON_SOLID_HATCH_NUM : resolveTektonHatchNumber(h.patternName);
    const colorHex = h.fillColor ?? entityColor(e);
    const tag = entityTag(e);
    for (const path of h.boundaryPaths ?? []) {
      if (path.length < 3) continue; // δεν σχηματίζει κλειστή επιφάνεια
      const edges = hatchPathEdges(path, f);
      if (edges.length < 3) continue;
      records.push(buildHatchRecordXml({
        id, tektonNum, scaleX: DEFAULT_HATCH_SCALE, scaleY: DEFAULT_HATCH_SCALE,
        colorHex, edges, tag,
      } satisfies TekHatch));
      if (tag) tags.add(tag);
      id += 1;
    }
  }
  return { hatchesXml: records.join('\n'), hatchCount: records.length, tags: [...tags] };
}

export interface TekAreaCollectResult {
  /** Area hatch records (go into the hatch container alongside user hatches). */
  readonly hatchesXml: string;
  /** Area labels as text records (go into the text container alongside texts). */
  readonly labelsXml: string;
  /** Πλήθος περιοχών (εμβαδών) που εξήχθησαν. */
  readonly areaCount: number;
  /** ADR-608 — distinct tags (για το `<tag_visibility>` registry). */
  readonly tags: readonly string[];
}

/**
 * ADR-512 Φ-areas — συλλέγει τις **μετρήσεις εμβαδού** (`measure-area` → κλειστό polyline με
 * `measurement===true`) ως native Tekton area: κάθε μία → ΕΝΑ `<hatch>` (γεμισμένη περιοχή,
 * boundary=1) + ΕΝΑ `<text>` ετικέτα «Ε = {εμβαδόν} τμ» στο κεντροειδές. FULL SSoT reuse:
 * `hatchPathEdges`/`sceneXYToTekMeters` (Y-flip) + `buildHatchRecordXml`/`buildTextRecordXml`
 * (μηδέν διπλότυπο με `collectTekHatches`/`collectTekTexts`). Το `startLabelId` συνεχίζει την
 * αρίθμηση `<n>` των ετικετών μετά τα κανονικά texts (κοινός `<text>` container → μοναδικά ids).
 * (Το hatch `<n>` = πλήθος ακμών εξ ορισμού του writer — δεν χρειάζεται offset.)
 * `f` = μέτρα ανά scene unit· εμβαδόν scene² → m² μέσω `f²`.
 */
export function collectTekAreas(
  entities: readonly Entity[], f: number, startLabelId = 1,
): TekAreaCollectResult {
  const hatchRecords: string[] = [];
  const labelRecords: string[] = [];
  const tags = new Set<string>();
  let labelId = startLabelId;
  for (const e of entities) {
    if (!isTekAreaEntity(e)) continue;
    const vertices = (e as PolylineEntity | LWPolylineEntity).vertices ?? [];
    if (vertices.length < 3) continue; // δεν σχηματίζει επιφάνεια
    const edges = hatchPathEdges(vertices, f); // polylineSegments(closed) + Y-flip (SSoT)
    if (edges.length < 3) continue;
    const tag = entityTag(e);
    // (1) Γεμισμένη περιοχή → `<hatch>` (type 6, boundary=1, ανοιχτό-πράσινο σε λευκό φόντο).
    // Το hatch `<n>` = πλήθος ακμών (σύμβαση writer)· το `id` δεν χρησιμοποιείται στο output.
    hatchRecords.push(buildHatchRecordXml({
      id: labelId, tektonNum: AREA_HATCH_PATTERN,
      scaleX: DEFAULT_HATCH_SCALE, scaleY: DEFAULT_HATCH_SCALE,
      colorHex: AREA_FILL_COLOR, bgColorHex: AREA_FILL_BG_COLOR, boundary: 1,
      edges, tag,
    } satisfies TekHatch));
    // (2) Ετικέτα «Ε = {εμβαδόν} τμ» στο κεντροειδές (scene² → m² μέσω f²· Y-flip SSoT).
    const areaSquareMeters = polygonAreaSceneUnits(vertices) * f * f;
    const centroid = polygonCentroid(vertices);
    const anchor = sceneXYToTekMeters(centroid.x, centroid.y, f);
    labelRecords.push(buildTextRecordXml({
      id: labelId, content: buildAreaLabelText(areaSquareMeters),
      hAlign: AREA_LABEL_HALIGN, vAlign: AREA_LABEL_VALIGN, ptSize: AREA_LABEL_PT,
      xmatrix: buildSymbolObjectXMatrix(anchor.x, anchor.y, 0, 1),
      colorHex: AREA_LABEL_COLOR, tag,
    } satisfies TekText));
    if (tag) tags.add(tag);
    labelId += 1;
  }
  return {
    hatchesXml: hatchRecords.join('\n'),
    labelsXml: labelRecords.join('\n'),
    areaCount: hatchRecords.length,
    tags: [...tags],
  };
}
