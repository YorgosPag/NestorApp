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

  return computeStructuralSilhouetteBands({
    members,
    wallObstacles,
    spec: createDefaultStructuralFinishSpec(),
    classify,
    unitToMeters: (1 / s) * MM_TO_M,
  });
}
