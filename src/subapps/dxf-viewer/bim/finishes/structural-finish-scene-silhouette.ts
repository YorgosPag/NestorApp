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

import type { ColumnEntity } from '../types/column-types';
import type { BeamEntity } from '../types/beam-types';
import { isFinishActive, createDefaultStructuralFinishSpec } from './structural-finish-types';
import { mmToSceneUnits } from '../../utils/scene-units';
import {
  computeStructuralSilhouetteBands,
  type SilhouetteBand,
  type SilhouetteMember,
} from './structural-finish-silhouette';
import {
  toPt2,
  wallFootprintPolygon,
  buildStructuralFinishClassifier,
  EXTERIOR_EDGE_TOL_MM,
  MM_TO_M,
  type WallFinishObstacle,
} from './structural-finish-scene';

/** Κατακόρυφη έκταση κολόνας (building-relative mm): βάση = floor + baseOffset. */
function columnZExtent(column: ColumnEntity, floorElevationMm: number): { zBotMm: number; zTopMm: number } {
  const zBotMm = floorElevationMm + (column.params.baseOffset ?? 0);
  return { zBotMm, zTopMm: zBotMm + column.params.height };
}

/** Κατακόρυφη έκταση δοκαριού (building-relative mm): κρέμεται depth κάτω από topElevation. */
function beamZExtent(beam: BeamEntity): { zBotMm: number; zTopMm: number } {
  const zTopMm = beam.params.topElevation + (beam.params.zOffset ?? 0);
  return { zBotMm: zTopMm - beam.params.depth, zTopMm };
}

/** Δομικό μέλος → `SilhouetteMember` όταν έχει ενεργό σοβά + έγκυρο footprint. */
function toMember(
  finish: ColumnEntity['params']['finish'] | BeamEntity['params']['finish'],
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
  columns: readonly ColumnEntity[],
  beams: readonly BeamEntity[],
  walls: readonly WallFinishObstacle[],
  floorElevationMm: number,
): SilhouetteBand[] {
  const members: SilhouetteMember[] = [];
  for (const c of columns) {
    const m = toMember(c.params.finish, c.geometry?.footprint?.vertices, columnZExtent(c, floorElevationMm));
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
  // ADR-449 Slice 7 — οι τοίχοι ως obstacles **ΧΩΡΙΣ dilation** (browser-verified per-element
  // συμπεριφορά): ο **κάθετος** τοίχος που διασχίζει την όψη → καλύπτεται (μηδέν σοβάς εκεί)·
  // ο **collinear** τοίχος κάτω από δοκάρι (ίδιος άξονας, grid framing) → midpoint στο boundary,
  // ΟΧΙ strictly-inside → ο σοβάς της πλάγιας όψης ΕΜΦΑΝΙΖΕΤΑΙ. Dilation εδώ έκρυβε ΟΛΟ τον
  // σοβά δοκαριών πάνω σε τοίχους (grid model· Giorgio 2026-06-13). Η σύνδεση κολόνα↔δοκάρι
  // (Πρόβλημα Β) λύνεται από το ΕΝΙΑΙΟ union, ΟΧΙ από obstacle dilation.
  const wallObstacles = walls.map((w) => wallFootprintPolygon(w));

  return computeStructuralSilhouetteBands({
    members,
    wallObstacles,
    spec: createDefaultStructuralFinishSpec(),
    classify,
    unitToMeters: (1 / s) * MM_TO_M,
  });
}
