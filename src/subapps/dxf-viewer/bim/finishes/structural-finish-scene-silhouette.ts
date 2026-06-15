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
import { isFinishActive, createDefaultStructuralFinishSpec, type StructuralFinishSpec } from './structural-finish-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  computeStructuralSilhouetteBands,
  type SilhouetteBand,
  type SilhouetteMember,
  type WallObstacle,
} from './structural-finish-silhouette';
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

export interface SilhouetteBeamSource {
  readonly id: string;
  readonly params: Pick<BeamParams, 'finish' | 'sceneUnits' | 'topElevation' | 'zOffset' | 'depth'>;
  readonly geometry?: { readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] } };
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

/** Κατακόρυφη έκταση δοκαριού (building-relative mm): κρέμεται depth κάτω από topElevation. */
function beamZExtent(beam: SilhouetteBeamSource): { zBotMm: number; zTopMm: number } {
  const zTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  return { zBotMm: zTopMm - beam.params.depth, zTopMm };
}

/**
 * ADR-449 Slice X1 — κατακόρυφη έκταση ενός τοίχου-εμποδίου (building-relative mm) για
 * height-aware coverage. Ένας **attached-top** τοίχος-στήριγμα έχει resolved top = **κάτω
 * παρειά** του δοκαριού που κρατά (`attachTopToIds` → `beamZExtent(...).zBotMm`), ΟΧΙ το
 * nominal `baseOffset+height` (που το υπερεκτιμά). Έτσι ο τοίχος βρίσκεται κάτω από τη ζώνη
 * του δοκαριού → δεν καλύπτει την πλάγια όψη δοκαριού πάνω του (mirror `wallsOverlappingBeamBand`,
 * Slice 8b — η αιτία του «μία όψη μόνο» στους grid τοίχους που είναι ταυτόσημοι σε κάτοψη με δοκάρια).
 */
function wallObstacleZExtent(
  wall: WallFinishObstacle,
  beamUndersideById: ReadonlyMap<string, number>,
  floorElevationMm: number,
): { zBotMm: number; zTopMm: number } {
  const zBotMm = floorElevationMm + (wall.params.baseOffset ?? 0);
  if (wall.params.topBinding === 'attached' && wall.params.attachTopToIds?.length) {
    let top = Infinity;
    for (const id of wall.params.attachTopToIds) {
      const u = beamUndersideById.get(id);
      if (u !== undefined && u < top) top = u;
    }
    if (Number.isFinite(top)) return { zBotMm, zTopMm: top };
  }
  return { zBotMm, zTopMm: zBotMm + wall.params.height };
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
 * ADR-449 Slice 7 — SSoT για την ΕΝΙΑΙΑ σιλουέτα σοβά μιας δομικής ομάδας (κολόνες +
 * δοκάρια ενός κτιρίου/ορόφου). Χτίζει `SilhouetteMember[]` (building-relative z) +
 * wall obstacles (finished footprints dilated κατά join-tol ώστε flush διεπαφές να
 * μετράνε ως καλυμμένες — Πρόβλημα Α) + classifier, και delegate-άρει στον pure
 * `computeStructuralSilhouetteBands`. Το διαβάζει ο 3D builder. `[]` όταν κανένα μέλος.
 */
export function computeStructuralFinishSilhouette(
  columns: readonly SilhouetteColumnSource[],
  beams: readonly SilhouetteBeamSource[],
  walls: readonly WallFinishObstacle[],
  floorElevationMm: number,
  columnExtents?: ColumnVerticalExtentLookup,
  /**
   * ADR-449/458 — 2Δ κάτοψη ΜΟΝΟ: αφαιρεί τις κρυμμένες junction-όψεις (όψεις που η
   * plan-προβολή κρύβει πίσω από member από πάνω). Το 3Δ ΔΕΝ το περνά (false) → οι όψεις
   * παραμένουν στις δικές τους z-bands.
   */
  dropPlanHiddenFaces = false,
): SilhouetteBand[] {
  const members: SilhouetteMember[] = [];
  for (const c of columns) {
    const m = toMember(c.params.finish, c.geometry?.footprint?.vertices, columnZExtent(c, floorElevationMm, columnExtents));
    if (m) members.push(m);
  }
  for (const b of beams) {
    const m = toMember(b.params.finish, b.geometry?.outline?.vertices, beamZExtent(b));
    if (m) members.push(m);
  }
  if (members.length === 0) return [];

  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? 'mm';
  const s = mmToSceneUnits(sceneUnits);
  const tol = EXTERIOR_EDGE_TOL_MM * s;
  const classify = buildStructuralFinishClassifier(undefined, walls, tol);
  // ADR-449 Slice 7/X1 — οι τοίχοι ως obstacles **ΧΩΡΙΣ dilation** (browser-verified per-element
  // συμπεριφορά): ο **κάθετος** τοίχος που διασχίζει την όψη → καλύπτεται (μηδέν σοβάς εκεί). Η
  // σύνδεση κολόνα↔δοκάρι (Πρόβλημα Β) λύνεται από το ΕΝΙΑΙΟ union, ΟΧΙ από obstacle dilation.
  //
  // ADR-449 Slice X1 — **height-aware** z-extents (port Slice 8/8b): ένας collinear τοίχος-
  // στήριγμα κάτω από δοκάρι (ταυτόσημος σε κάτοψη, grid framing) είναι `topBinding:'attached'`
  // → resolved top = κάτω παρειά δοκαριού → ΕΚΤΟΣ της ζώνης ύψους του δοκαριού → δεν καλύπτει
  // την πλάγια όψη δοκαριού πάνω του (= η αληθινή αιτία του «μία όψη μόνο» bug — ΟΧΙ τοπολογική).
  const beamUndersideById = new Map<string, number>();
  for (const b of beams) beamUndersideById.set(b.id, beamZExtent(b).zBotMm);
  const wallObstacles: WallObstacle[] = walls.map((w) => {
    const z = wallObstacleZExtent(w, beamUndersideById, floorElevationMm);
    return { footprint: wallFootprintPolygon(w), zBotMm: z.zBotMm, zTopMm: z.zTopMm };
  });

  const bands = computeStructuralSilhouetteBands({
    members,
    wallObstacles,
    spec: createDefaultStructuralFinishSpec(),
    classify,
    unitToMeters: (1 / s) * MM_TO_M,
  });
  // ADR-449/458 — 2Δ κάτοψη: κρύψε junction-όψεις που η plan-προβολή σκεπάζει (δες
  // `dropPlanHiddenJunctionFaces`)· το 3Δ τις κρατά (δικές τους z-bands → ορατές κάτω από
  // το γειτονικό member). Default off → μηδέν αλλαγή στο 3Δ.
  if (!dropPlanHiddenFaces) return bands;
  return dropPlanHiddenJunctionFaces(bands, members.map((m) => m.footprint), s);
}
