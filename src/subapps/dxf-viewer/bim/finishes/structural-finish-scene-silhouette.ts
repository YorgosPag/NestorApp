/**
 * ADR-449 Slice 7 — Merged structural silhouette (scene adapter).
 *
 * Εξάχθηκε από το `structural-finish-scene.ts` (Google file-size SSoT, N.7.1):
 * το adapter που μετατρέπει κολόνες + δοκάρια ενός ορόφου σε `SilhouetteMember[]`
 * (building-relative z) + wall obstacles + classifier και delegate-άρει στον pure
 * `computeStructuralSilhouetteBands`. Το διαβάζει ο 3D builder.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { ColumnParams } from '../types/column-types';
import type { BeamParams } from '../types/beam-types';
import {
  isFinishActive,
  createDefaultStructuralFinishSpec,
  type StructuralFinishSpec,
} from './structural-finish-types';
import { wallToSilhouetteMembers, wallIsFinishMember, wallFinishZExtent } from './wall-finish-source';
import { slabIsFinishMember, slabFinishZExtent } from './slab-finish-source';
import { isSlabTilted } from '../geometry/slab-tilt';
import type { SlabParams } from '../types/slab-types';
import type { SilhouetteOpeningSource } from './wall-finish-opening-bands';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  computeStructuralSilhouetteBands,
  type SilhouetteBand,
  type SilhouetteMember,
  type WallObstacle,
} from './structural-finish-silhouette';
import { finishFaceRef } from './structural-finish-face-ref';
import type { FinishOverrideEdge } from './structural-finish-attribution';
import {
  toPt2,
  wallFootprintPolygon,
  buildStructuralFinishClassifier,
  EXTERIOR_EDGE_TOL_MM,
  MM_TO_M,
  type WallFinishObstacle,
} from './structural-finish-scene';
import { segOffsetVec } from './structural-finish-outline-geometry';
import type { FinishFaceSegment } from './structural-finish-types';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
// ADR-449/493/458 — reuse των pure primitives που παράγουν το ΟΡΑΤΟ ΣΩΜΑ δοκαριού (deep seat-fill
// επέκταση + cutback στην παρειά κολόνας + sliver-reject), ΤΑ ΙΔΙΑ SSoT με το μπετόν (BeamRenderer).
import { extendBeamOutlineIntoFramingColumns, computeBeamCutbackOutline } from '../geometry/beam-column-cutback';

/** Ray-cast point-in-polygon (Pt2 ring, ανοιχτό ή κλειστό). */
function pointInRing(px: number, py: number, ring: readonly Pt2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i].y;
    const yj = ring[j].y;
    if ((yi > py) !== (yj > py) && px < ((ring[j].x - ring[i].x) * (py - yi)) / (yj - yi) + ring[i].x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * ADR-449/458 (2Δ κάτοψη μόνο) — μια εκτεθειμένη όψη είναι **κρυμμένη junction-όψη** όταν η
 * outward πλευρά της (εκεί που θα πήγαινε ο σοβάς) πέφτει ΜΕΣΑ σε ΑΛΛΟ δομικό member. Σε
 * plan top-down η όψη αυτή κρύβεται πίσω από το member που βρίσκεται από πάνω (π.χ. η όψη
 * κολόνας προς το δοκάρι, ορατή ΜΟΝΟ κάτω από το δοκάρι σε z<beamBot) → ΔΕΝ σχεδιάζεται.
 *
 * Γιατί 2Δ-only: στο 3Δ η ίδια όψη ΠΑΡΑΜΕΝΕΙ (είναι γνήσια εκτεθειμένη κάτω από το δοκάρι,
 * στη δική της z-band)· μόνο η plan-προβολή την κρύβει. Χωρίς το φίλτρο, το 2Δ ζωγράφιζε
 * επικαλυπτόμενες z-bands → λοξές γραμμούλες/«κοπή» στη συμβολή κολόνας↔δοκαριού.
 */
function isPlanHiddenJunctionFace(
  seg: FinishFaceSegment,
  memberFootprints: readonly (readonly Pt2[])[],
  s: number,
): boolean {
  const off = segOffsetVec(seg, Math.max(seg.thickness * s, 1e-6));
  if (!off) return false;
  const px = (seg.a.x + seg.b.x) / 2 + off.x;
  const py = (seg.a.y + seg.b.y) / 2 + off.y;
  return memberFootprints.some((fp) => fp.length >= 3 && pointInRing(px, py, fp));
}

/** Δύο σημεία ταυτίζονται (σχετική ανοχή, ίδια με `computeMiteredOuter`). */
function samePoint(p: { x: number; y: number }, q: { x: number; y: number }): boolean {
  const tol = 1e-6 * (1 + Math.hypot(q.x, q.y));
  return Math.hypot(p.x - q.x, p.y - q.y) <= tol;
}

/**
 * ADR-449/458 — 2Δ-only φίλτρο κάτοψης. Δύο βήματα ανά band:
 *  1. **Αφαιρεί** τις κρυμμένες junction-όψεις (βλ. {@link isPlanHiddenJunctionFace}).
 *  2. **Μαρκάρει** τα άκρα των ΕΝΑΠΟΜΕΙΝΑΝΤΩΝ όψεων που ακουμπούσαν αφαιρεθείσα όψη ως
 *     `aJunction`/`bJunction` → ο `computeMiteredOuter` κάνει **ορθογώνια EXTEND** (Slice 10
 *     corner-fill, κάθετο end-cap που κλείνει flush με τον σοβά του δοκαριού) αντί για **chamfer
 *     45°** (= οι «λοξές γραμμούλες» που έμεναν στις γωνίες εκατέρωθεν του δοκαριού).
 * Έτσι η κάτοψη δείχνει ΕΝΑ συνεπές, κλειστό outline. Κενά bands απορρίπτονται.
 */
export function dropPlanHiddenJunctionFaces(
  bands: readonly SilhouetteBand[],
  memberFootprints: readonly (readonly Pt2[])[],
  s: number,
): SilhouetteBand[] {
  const out: SilhouetteBand[] = [];
  for (const band of bands) {
    const dropped: FinishFaceSegment[] = [];
    const kept: FinishFaceSegment[] = [];
    for (const seg of band.faces.segments) {
      (isPlanHiddenJunctionFace(seg, memberFootprints, s) ? dropped : kept).push(seg);
    }
    if (dropped.length === 0) { out.push(band); continue; }
    if (kept.length === 0) continue;
    // Τα άκρα των αφαιρεθεισών όψεων → τα γειτονικά kept άκρα γίνονται structural junctions.
    const droppedEnds = dropped.flatMap((d) => [d.a, d.b]);
    const segments = kept.map((seg) => {
      const aJ = seg.aJunction || droppedEnds.some((p) => samePoint(p, seg.a));
      const bJ = seg.bJunction || droppedEnds.some((p) => samePoint(p, seg.b));
      return aJ === !!seg.aJunction && bJ === !!seg.bJunction ? seg : { ...seg, aJunction: aJ, bJunction: bJ };
    });
    out.push({ ...band, faces: { ...band.faces, segments } });
  }
  return out;
}

/**
 * ADR-449 Slice X2 μέρος Β — minimal source interfaces ώστε η ΙΔΙΑ silhouette SSoT να
 * τροφοδοτεί ΚΑΙ το 3Δ (`ColumnEntity`/`BeamEntity`) ΚΑΙ το 2Δ (`DxfColumn`/`DxfBeam`)
 * **χωρίς cast** (ίδιο pattern με τα `ColumnFinishSource`/`BeamFinishSource` του scene).
 */
export interface SilhouetteColumnSource {
  /** ADR-449 — id για lookup του pre-resolved (storey-aware) zExtent. Προαιρετικό: το 2Δ plan path & tests το παραλείπουν → legacy `params.height`. */
  readonly id?: string;
  readonly params: Pick<ColumnParams, 'finish' | 'sceneUnits' | 'baseOffset' | 'height'>;
  readonly geometry?: { readonly footprint?: { readonly vertices?: readonly { x: number; y: number }[] } };
}

/** ADR-449 — Pre-resolved κατακόρυφη έκταση κολώνας (building-relative mm), ΙΔΙΑ SSoT με τον πυρήνα. */
export type ColumnVerticalExtentLookup = ReadonlyMap<string, { readonly zBotMm: number; readonly zTopMm: number }>;

/**
 * N.0.2 boy-scout (2026-07-17): το `geometry` shape ήταν **αυτολεξεί διπλό** με το
 * {@link BeamFinishOutlineSource} — που το ίδιο του το doc δηλώνει «το ΙΔΙΟ primitive τρέφει ΚΑΙ τον
 * κάθετο silhouette ΚΑΙ το οριζόντιο top-cap». Τώρα το λέει και ο τύπος (`extends`) αντί να το
 * επαναλαμβάνει: ΕΝΑ σημείο αλήθειας για το «τι γεωμετρία δοκαριού διαβάζει ο σοβάς».
 */
export interface SilhouetteBeamSource extends BeamFinishOutlineSource {
  readonly id: string;
  readonly params: Pick<BeamParams, 'finish' | 'sceneUnits' | 'topElevation' | 'zOffset' | 'depth'>;
}

/**
 * ADR-534 Φ5c — minimal source μιας πλάκας-finish-member (mirror `SilhouetteColumnSource`/
 * `SilhouetteBeamSource`, χωρίς cast): ό,τι διαβάζουν τα ΥΠΑΡΧΟΝΤΑ SSoT predicates —
 * `slabIsFinishMember` (kind/finish/dna), `slabFinishZExtent` (levelElevation/heightOffsetFromLevel/
 * thickness), `isSlabTilted` (geometryType/slope) — συν το `outline` για το footprint και
 * `sceneUnits` για το scene-units fallback (Ρίσκο Δ: όροφος με ΜΟΝΟ πλάκα).
 */
export interface SlabFinishMemberSource {
  readonly params: Pick<
    SlabParams,
    'kind' | 'finish' | 'dna' | 'outline' | 'levelElevation' | 'heightOffsetFromLevel' | 'thickness' | 'geometryType' | 'slope' | 'sceneUnits'
  >;
}

/**
 * Κατακόρυφη έκταση κολόνας (building-relative mm). ADR-449: όταν δίνεται pre-resolved
 * extent (ΙΔΙΑ SSoT με τον rendered πυρήνα, storey-aware) → χρησιμοποιείται· αλλιώς
 * legacy fallback `floor + baseOffset (+height)` (2Δ plan path & tests).
 */
function columnZExtent(
  column: SilhouetteColumnSource,
  floorElevationMm: number,
  extents?: ColumnVerticalExtentLookup,
): { zBotMm: number; zTopMm: number } {
  const resolved = column.id ? extents?.get(column.id) : undefined;
  if (resolved) return resolved;
  const zBotMm = floorElevationMm + (column.params.baseOffset ?? 0);
  return { zBotMm, zTopMm: zBotMm + column.params.height };
}

/**
 * Κατακόρυφη έκταση δοκαριού (building-relative mm): κρέμεται depth κάτω από topElevation.
 *
 * ADR-534 Φ3c-B3b — `topClipMm` (soffit καλύπτουσας πλάκας): η **κορυφή** του σοβά κόβεται
 * στο soffit (ίδια τιμή με το ορατό στερεό/B3a → ο σοβάς δεν προεξέχει στην πλάκα). Η κάτω
 * παρειά (downstand) μένει αγκυρωμένη στο πλήρες βάθος. `undefined` → πλήρες ύψος (byte-for-byte).
 */
function beamZExtent(beam: SilhouetteBeamSource, topClipMm?: number): { zBotMm: number; zTopMm: number } {
  const zTopRawMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  const zTopMm = topClipMm !== undefined ? Math.min(zTopRawMm, topClipMm) : zTopRawMm;
  return { zBotMm: zTopRawMm - beam.params.depth, zTopMm };
}

/** Δομικό μέλος → `SilhouetteMember` όταν έχει ενεργό σοβά + έγκυρο footprint. */
function toMember(
  finish: StructuralFinishSpec | undefined,
  vertices: readonly { x: number; y: number }[] | undefined,
  z: { zBotMm: number; zTopMm: number },
): SilhouetteMember | null {
  if (!isFinishActive(finish) || !vertices || vertices.length < 3) return null;
  return { footprint: vertices.map(toPt2), zBotMm: z.zBotMm, zTopMm: z.zTopMm };
}

/**
 * ADR-449 PART B Slice B — per-face overrides ενός στοιχείου → `FinishOverrideEdge[]`
 * (canvas units, ίδιος χώρος με τα members). Για κάθε ακμή a→b του footprint με entry
 * στο `spec.faceOverrides` (matched μέσω {@link finishFaceRef} — element-owned Revit
 * «Paint»), push `{a, b, override}`. Ανενεργό spec / χωρίς overrides → κενό. Το `push`
 * σε shared `out` (ΕΝΑ pass πάνω σε columns + beams) αποφεύγει intermediate arrays.
 */
function pushFinishOverrideEdges(
  out: FinishOverrideEdge[],
  finish: StructuralFinishSpec | undefined,
  vertices: readonly { x: number; y: number }[] | undefined,
): void {
  const overrides = finish?.faceOverrides;
  if (!isFinishActive(finish) || !overrides || !vertices || vertices.length < 3) return;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const a = toPt2(vertices[i]);
    const b = toPt2(vertices[(i + 1) % n]);
    const override = overrides[finishFaceRef(a, b)];
    if (override) out.push({ a, b, override });
  }
}

/**
 * ADR-449/493 — minimal geometry-only source του `beamFinishOutline`: το ΙΔΙΟ primitive τρέφει
 * ΚΑΙ τον κάθετο silhouette (`SilhouetteBeamSource`) ΚΑΙ το οριζόντιο merged top-cap
 * (`HorizontalBeamSource`) χωρίς cast — και οι δύο εκθέτουν `geometry.outline`/`axisPolyline`.
 */
export interface BeamFinishOutlineSource {
  readonly geometry?: {
    readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] };
    /** ADR-449/493 — άξονας (start/end) για επέκταση του outline μέσα στις πλαισιωμένες κολόνες (plaster union). */
    readonly axisPolyline?: { readonly points?: readonly { x: number; y: number }[] };
  };
}

/**
 * ADR-449/493/458 — outline(s) δοκαριού για το **plaster union**: **ΤΟ ΙΔΙΟ ΟΡΑΤΟ ΣΩΜΑ** που
 * σχεδιάζει το μπετόν (`buildBeamCutbackDisplay` → `BeamRenderer`). Δηλαδή:
 *   1. **deep seat-fill** επέκταση των πλαισιωμένων άκρων ΜΕΣΑ στις κολόνες
 *      (`extendBeamOutlineIntoFramingColumns(..., deep=true)`) — ΟΣΟ ώστε ΚΑΙ οι δύο γωνίες της
 *      απόληξης να μπουν (λοξό δοκάρι σε γωνιακή/επίπεδη παρειά → η diagonal «μύτη» miter),
 *   2. **cutback** στην παρειά της κολόνας (`computeBeamCutbackOutline` = `safeDifference` + **2%
 *      sliver-reject**) → το ορατό στερεό, κομμένο ακριβώς στην παρειά.
 *
 * **Γιατί άλλαξε από «center» (ADR-458 §diagonal-corner-seat, deep=false):** το ρηχό center-extend
 * σταματούσε ~ένα πάχος πριν τη μύτη → ο σοβάς άφηνε **γυμνό μπετόν** στη διαγώνια ακμή της μύτης
 * (Giorgio 2026-07-02: L-κολόνα, λοξό δοκάρι — ο σοβάς της ΝΑ παρειάς έκανε miter, η ΒΑ ακμή όχι).
 * Τυλίγοντας το ΙΔΙΟ ορατό σώμα, η μύτη καλύπτεται· το **sliver-reject** κόβει το «πράσινο poke»
 * στην ΚΟΙΛΗ εγκοπή L/Γ (ίδιο 2% φίλτρο με το σώμα) → μηδέν προεξοχή στην εγκοπή. Το ορατό σώμα
 * κόβεται στην παρειά αλλά ακουμπά edge-to-edge την κολόνα → το `safeUnion` (+ grid-weld) τα ενώνει
 * σε ΕΝΑ καπάκι (browser/probe-verified, ίδιο και στην ορθή framing περίπτωση — μηδέν ADR-493 regression).
 *
 * Επιστρέφει **ένα ring ανά ορατό κομμάτι** (mid-span κολόνα → 2 κομμάτια). Καμία τομή → `[raw]`
 * (μηδέν regression). Δοκάρι εξ ολοκλήρου μέσα σε κολόνα → `[]` (θαμμένο, κανένα member). Straight
 * (2-σημείων) άξονας μόνο· curved/απών άξονας ή καμία κολόνα → `[raw]`. Το χρησιμοποιεί ΚΑΙ ο κάθετος
 * silhouette ΚΑΙ το οριζόντιο merged top-cap. Η κοινή orchestration (deep+cutback) με το
 * `buildBeamCutbackDisplay` προορίζεται για κεντρικοποίηση (Giorgio 2026-07-02: «πρώτα φτιάξ' το, μετά κεντρικοποιούμε»).
 */
export function beamFinishOutline(
  beam: BeamFinishOutlineSource,
  columnFootprints: readonly (readonly Pt2[])[],
): readonly (readonly Pt2[])[] {
  const raw = beam.geometry?.outline?.vertices;
  if (!raw || raw.length < 3) return [];
  const rawPts = raw.map(toPt2);
  const pts = beam.geometry?.axisPolyline?.points;
  if (!pts || pts.length !== 2 || columnFootprints.length === 0) return [rawPts];
  const deepExt = extendBeamOutlineIntoFramingColumns(rawPts, toPt2(pts[0]), toPt2(pts[1]), columnFootprints, true);
  const pieces = computeBeamCutbackOutline(deepExt ?? rawPts, columnFootprints);
  return pieces === null ? [rawPts] : pieces; // null = καμία τομή → raw· `[]` = θαμμένο· αλλιώς τα ορατά κομμάτια
}

/**
 * ADR-534 Φ5c — Είσοδος (options-object) της {@link computeStructuralFinishSilhouette}. Mirror του
 * `HorizontalFinishInput` (αδελφό module `structural-finish-scene-horizontal.ts`): named πεδία αντί
 * για μακρύ positional σερί 9 params (που ανάγκαζε σειρές `undefined` στους callers). Καθαρά
 * μηχανική αλλαγή — μηδέν διαφορά συμπεριφοράς από την προηγούμενη positional signature.
 */
export interface SilhouetteFinishInput {
  readonly columns: readonly SilhouetteColumnSource[];
  readonly beams: readonly SilhouetteBeamSource[];
  readonly walls: readonly WallFinishObstacle[];
  readonly floorElevationMm: number;
  /** ADR-449 — pre-resolved (storey-aware) zExtents κολώνας ανά id, ΙΔΙΑ SSoT με τον πυρήνα. */
  readonly columnExtents?: ColumnVerticalExtentLookup;
  /**
   * ADR-449/458 — 2Δ κάτοψη ΜΟΝΟ: αφαιρεί τις κρυμμένες junction-όψεις (όψεις που η plan-προβολή
   * κρύβει πίσω από member από πάνω). Το 3Δ ΔΕΝ το περνά (false/absent) → οι όψεις παραμένουν στις
   * δικές τους z-bands. Default `false`.
   */
  readonly dropPlanHiddenFaces?: boolean;
  /**
   * ADR-534 Φ3c-B3b — pre-resolved soffit top-clip ανά δοκό (building-relative mm), ΙΔΙΑ SSoT με το
   * ορατό στερεό (`resolveMemberTopClipZmm`): όπου μονολιθική πλάκα καλύπτει τη δοκό, η κορυφή του
   * σοβά κόβεται στο soffit. Absent / χωρίς entry → πλήρες ύψος (2Δ plan & DXF export: undefined).
   */
  readonly beamTopClipById?: ReadonlyMap<string, number>;
  /**
   * ADR-449 §opening-bands — τα **ορατά, wall-hosted** ανοίγματα ανά `wallId` (pre-resolved από τον
   * caller· ίδιο pattern με το `beamTopClipById`). Ο σοβάς του τοίχου τρυπιέται στη ζώνη κάθε
   * κουφώματος → δεν τα σκεπάζει. **Absent / χωρίς entry → πλήρες footprint** (byte-for-byte).
   *
   * Γιατί map και όχι raw array: το `wallId` filtering + το **visibility gating** (ADR-615 self-hosted
   * guard + το ίδιο φίλτρο που ήδη περνά ο πυρήνας `wallToMesh` → 2Δ⟷3Δ parity) απαιτούν scene ctx →
   * μένουν στους callers· αυτή η συνάρτηση παραμένει pure.
   */
  readonly openingsByWallId?: ReadonlyMap<string, readonly SilhouetteOpeningSource[]>;
  /**
   * ADR-534 Φ3c-B3b (τοίχοι) — pre-resolved soffit top-clip ανά **τοίχο** (building-relative mm),
   * ΙΔΙΑ SSoT `resolveMemberTopClipZmm` με τα δοκάρια (`beamTopClipById`) και με το ορατό στερεό:
   * όπου μονολιθική πλάκα καλύπτει τον τοίχο, η κορυφή του σοβά κόβεται στο soffit → ο ροζ σοβάς
   * δεν διαπερνά πια την πλάκα (Giorgio 2026-07-17, C4D screenshots). Absent / χωρίς entry →
   * πλήρες ύψος (2Δ plan & DXF export: undefined → byte-for-byte).
   */
  readonly wallTopClipById?: ReadonlyMap<string, number>;
  /**
   * ADR-534 Φ5c — οι πλάκες ως silhouette members (η κατακόρυφη περιμετρική «φάσα»/fascia). Ίδιο
   * μοτίβο με τον τοίχο: κάθε **flat** finish-member πλάκα μπαίνει με το πλήρες footprint της +
   * z-band = thickness → το `safeUnion` ανά z-band τυλίγει το περίγραμμα + σβήνει μόνο του στις
   * επαφές (θαμμένη ακμή ενδιάμεσου δαπέδου) ή αφήνει σοβά στις εκτεθειμένες (μπαλκόνι/δώμα). ΜΗΔΕΝ
   * νέο math. Tilted → εξαιρείται (flat union μόνο, ADR-404). Absent → καμία πλάκα (byte-for-byte).
   */
  readonly slabs?: readonly SlabFinishMemberSource[];
}

/**
 * ADR-449 Slice 7 — SSoT για την ΕΝΙΑΙΑ σιλουέτα σοβά μιας δομικής ομάδας (κολόνες +
 * δοκάρια ενός κτιρίου/ορόφου). Χτίζει `SilhouetteMember[]` (building-relative z) +
 * wall obstacles (finished footprints dilated κατά join-tol ώστε flush διεπαφές να
 * μετράνε ως καλυμμένες — Πρόβλημα Α) + classifier, και delegate-άρει στον pure
 * `computeStructuralSilhouetteBands`. Το διαβάζει ο 3D builder. `[]` όταν κανένα μέλος.
 */
export function computeStructuralFinishSilhouette(input: SilhouetteFinishInput): SilhouetteBand[] {
  const {
    columns,
    beams,
    walls,
    floorElevationMm,
    columnExtents,
    dropPlanHiddenFaces = false,
    beamTopClipById,
    openingsByWallId,
    wallTopClipById,
    slabs = [],
  } = input;
  const members: SilhouetteMember[] = [];
  for (const c of columns) {
    const m = toMember(c.params.finish, c.geometry?.footprint?.vertices, columnZExtent(c, floorElevationMm, columnExtents));
    if (m) members.push(m);
  }
  // ADR-449/493 — footprints των finish-κολόνων· το δοκάρι που πλαισιώνεται στην παρειά τους επεκτείνεται
  // ΜΕΣΑ τους (μόνο για το union) ώστε να συγχωνευτεί σε ΕΝΑ καπάκι (βλ. `beamFinishOutline`).
  const columnFootprints: Pt2[][] = [];
  for (const c of columns) {
    const v = c.geometry?.footprint?.vertices;
    if (isFinishActive(c.params.finish) && v && v.length >= 3) columnFootprints.push(v.map(toPt2));
  }
  for (const b of beams) {
    // ADR-458 §diagonal-corner-seat — ένα member ανά ΟΡΑΤΟ κομμάτι σώματος (mid-span κολόνα → 2)·
    // ίδιο z-extent για όλα. Ο σοβάς τυλίγει το ΙΔΙΟ ορατό σώμα → η diagonal μύτη miter καλύπτεται.
    const bz = beamZExtent(b, beamTopClipById?.get(b.id));
    for (const ring of beamFinishOutline(b, columnFootprints)) {
      const m = toMember(b.params.finish, ring, bz);
      if (m) members.push(m);
    }
  }

  // ADR-449 Slice X1/X3 — beam undersides (height-aware z-extent των τοίχων): ένας
  // attached-top τοίχος-στήριγμα έχει resolved top = κάτω παρειά του δοκαριού που κρατά.
  const beamUndersideById = new Map<string, number>();
  for (const b of beams) beamUndersideById.set(b.id, beamZExtent(b).zBotMm);

  // ADR-449 Slice X3/X4 — Ο ΤΟΙΧΟΣ ως finish-member: νέος τοίχος με ενεργό `finish` spec →
  // **member** (core = **πλήρες** δομικό footprint, χωρίς inset → ο σοβάς προεξέχει· το core
  // ενώνεται με τα δομικά μέλη στο union → ο σοβάς τυλίγει το ενιαίο περίγραμμα + κάθε δωμάτιο
  // και **σβήνει αυτόματα στις συμβολές**). Legacy τοίχος (DNA σοβά, χωρίς `finish`) ή bare
  // (parapet/fence) → παραμένει coverage **obstacle** (κόβει όψη γειτόνων, δεν παίρνει δικό
  // του). Το πάχος/υλικό σοβά = το ΕΝΙΑΙΟ spec της σιλουέτας (ομοιόμορφο κέλυφος, εξωτ.25/εσωτ.15).
  // ADR-449 §opening-bands — ο σοβατισμένος τοίχος δίνει **N members** (ένα ανά z-band· τρυπημένο
  // footprint στη ζώνη κάθε κουφώματος) → μηδέν σοβάς πάνω από παράθυρα/πόρτες. Χωρίς ανοίγματα → 1
  // member με το πλήρες footprint (byte-for-byte). Legacy/bare → `[]` → μένει obstacle (ως πριν).
  const obstacleWalls: WallFinishObstacle[] = [];
  for (const w of walls) {
    // Ο διαχωρισμός member↔obstacle κρίνεται από ΤΟ predicate (`wallIsFinishMember`), ΟΧΙ από το
    // πλήθος των members: με τα opening-bands ένας σοβατισμένος τοίχος μπορεί θεωρητικά να δώσει `[]`
    // (άνοιγμα που τον καταναλώνει ολόκληρο) — αυτό είναι «μηδέν σοβάς», ΟΧΙ «obstacle». Αν γινόταν
    // obstacle θα έκοβε τον σοβά των γειτόνων του.
    if (!wallIsFinishMember(w)) {
      obstacleWalls.push(w);
      continue;
    }
    // ADR-534 Φ3c-B3b — ο **σοβάς** (member) κόβεται στο soffit της καλύπτουσας πλάκας.
    const z = wallFinishZExtent(w, beamUndersideById, floorElevationMm, wallTopClipById?.get(w.id));
    members.push(...wallToSilhouetteMembers(w, z, openingsByWallId?.get(w.id)));
  }

  // ADR-534 Φ5c — Η ΠΛΑΚΑ ως finish-member: η κατακόρυφη περιμετρική «φάσα». Ίδιο μοτίβο με τον
  // τοίχο — μπαίνει με το πλήρες footprint της + z-band = thickness → το `safeUnion` ανά z-band
  // τυλίγει το περίγραμμα + σβήνει μόνο του στις επαφές (θαμμένη ακμή σε ενδιάμεσο δάπεδο) ή αφήνει
  // σοβά στις εκτεθειμένες ακμές (μπαλκόνι/δώμα). ΜΗΔΕΝ νέο math — το `toMember` (`.map(toPt2)` πετά
  // το z του Polygon3D) + ο πυρήνας κάνουν όλη τη δουλειά. Tilted → εξαιρείται (flat union μόνο,
  // ADR-404· ο 3Δ caller τα φιλτράρει ήδη — ο έλεγχος εδώ είναι αμυντικός για 2Δ/export/tests).
  for (const sl of slabs) {
    if (!slabIsFinishMember(sl) || isSlabTilted(sl.params)) continue;
    const m = toMember(sl.params.finish, sl.params.outline.vertices, slabFinishZExtent(sl.params));
    if (m) members.push(m);
  }
  if (members.length === 0) return [];

  // sceneUnits: fallback σε τοίχο/πλάκα όταν ο όροφος δεν έχει κολόνα/δοκάρι (ADR-534 Φ5c Ρίσκο Δ:
  // όροφος με ΜΟΝΟ πλάκα — π.χ. δώμα χωρίς τοίχους — αλλιώς 'mm' default → λάθος scale σε 'm' scene).
  const sceneUnits =
    columns[0]?.params.sceneUnits ??
    beams[0]?.params.sceneUnits ??
    walls[0]?.params.sceneUnits ??
    slabs[0]?.params.sceneUnits ??
    'mm';
  const s = mmToSceneUnits(sceneUnits);
  const tol = EXTERIOR_EDGE_TOL_MM * s;
  // Classifier από ΟΛΟΥΣ τους τοίχους (building footprint = exterior/interior boundary),
  // ανεξαρτήτως αν είναι members ή obstacles.
  const classify = buildStructuralFinishClassifier(undefined, walls, tol);

  // ADR-449 Slice 7/X1/X3 — coverage obstacles = **μόνο** οι τοίχοι ΧΩΡΙΣ σοβά (οι members
  // ενώνονται ήδη στο union· να ήταν ΚΑΙ obstacles θα έκοβαν τον δικό τους σοβά). **ΧΩΡΙΣ
  // dilation** (browser-verified per-element)· height-aware z-extents (attached-top resolved).
  // ADR-534 Φ3c-B3b — **ΧΩΡΙΣ** top-clip εδώ (σκόπιμα): το clip είναι render-only σύμβαση για τον
  // ΣΟΒΑ. Ένα obstacle απαντά «καλύπτει το δομικό σώμα του τοίχου την όψη του γείτονα σε αυτή τη
  // ζώνη;» — το σώμα ΔΕΝ κόβεται στο soffit (T-beam· το δομικό ύψος μένει). Clip εδώ θα «ξεκάλυπτε»
  // ψευδώς τη ζώνη soffit→nominal top και θα ζωγράφιζε σοβά σε παρειά που ο τοίχος ακουμπά.
  const wallObstacles: WallObstacle[] = obstacleWalls.map((w) => {
    const z = wallFinishZExtent(w, beamUndersideById, floorElevationMm);
    return { footprint: wallFootprintPolygon(w), zBotMm: z.zBotMm, zTopMm: z.zTopMm };
  });

  // ADR-449 PART B Slice B — per-face overrides (Revit «Paint») όλων των στοιχείων → edges σε
  // canvas units. Το blanket τρέχει με ΕΝΑ default spec (ομοιόμορφο κέλυφος)· τα overrides
  // stamp-άρονται/σπάνε πάνω στα ενωμένα segments μετά (split στο σύνορο υλικού/χρώματος).
  const faceOverrideEdges: FinishOverrideEdge[] = [];
  for (const c of columns) pushFinishOverrideEdges(faceOverrideEdges, c.params.finish, c.geometry?.footprint?.vertices);
  for (const b of beams) pushFinishOverrideEdges(faceOverrideEdges, b.params.finish, b.geometry?.outline?.vertices);
  for (const w of walls) pushFinishOverrideEdges(faceOverrideEdges, w.params.finish, wallFootprintPolygon(w));
  // ADR-534 Φ6b — Paint on face ΚΑΙ στην πλάκα (Revit «Paint», mirror τοίχου/κολόνας/δοκαριού): τα
  // per-face overrides του outline της πλάκας σπάνε το ενιαίο δέρμα στο σύνορο υλικού/χρώματος. Το
  // seamless merge (Φ6a) ΔΕΝ συγκρούεται — το override ζει στο super-key → σπάει το cluster εκεί.
  for (const sl of slabs) pushFinishOverrideEdges(faceOverrideEdges, sl.params.finish, sl.params.outline?.vertices);

  const bands = computeStructuralSilhouetteBands({
    members,
    wallObstacles,
    spec: createDefaultStructuralFinishSpec(),
    classify,
    unitToMeters: (1 / s) * MM_TO_M,
    faceOverrideEdges,
  });
  // ADR-449/458 — 2Δ κάτοψη: κρύψε junction-όψεις που η plan-προβολή σκεπάζει (δες
  // `dropPlanHiddenJunctionFaces`)· το 3Δ τις κρατά (δικές τους z-bands → ορατές κάτω από
  // το γειτονικό member). Default off → μηδέν αλλαγή στο 3Δ.
  if (!dropPlanHiddenFaces) return bands;
  return dropPlanHiddenJunctionFaces(bands, members.map((m) => m.footprint), s);
}
