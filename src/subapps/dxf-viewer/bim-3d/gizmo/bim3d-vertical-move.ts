/**
 * bim3d-vertical-move.ts — pure elevation-move math: gizmo axis-Y drag → new params.
 *
 * ADR-402 (3D Viewport BIM Element Editing) — vertical (axis-Y) MOVE.
 *
 * Sibling of `bim3d-resize-bridge` for the move path. Dragging the green vertical
 * gizmo arrow translates a BIM element UP/DOWN by editing its per-type elevation
 * field (NOT its dimensions). One drag → one field bump → the whole element shifts.
 *
 * Per-type vertical field (ADR-369 elevation convention — all positive-up):
 *   - wall   → `baseOffset`     (base face offset from storey FFL; wall grows up)
 *   - column → `baseOffset`     (same as wall)
 *   - beam   → `topElevation`   (top face; beam hangs down by `depth`)
 *   - slab   → `levelElevation` (top face / FFL; slab hangs down by `thickness`)
 *   - stair  → `basePoint.z`    (floor-start elevation)
 *
 * Units: `deltaUpMm` is millimetres (from `worldUpDeltaToMm`). wall/column/beam/slab
 * store raw mm → add directly. The stair stores `basePoint` in inferred DRAWING units
 * (ADR-358), so the mm delta is converted with the SAME factor the stair grips / resize
 * bridge use (`mmToEntityUnitFactor`). Pure — no three / no scene / no command dispatch
 * (the interaction handler wraps the result in the per-type `Update*ParamsCommand`).
 */

import type { WallParams } from '../../bim/types/wall-types';
import type { ColumnParams } from '../../bim/types/column-types';
import type { BeamParams } from '../../bim/types/beam-types';
import type { SlabParams } from '../../bim/types/slab-types';
import type { StairParams, StairEntity } from '../../bim/types/stair-types';
import { mmToEntityUnitFactor } from '../utils/bim3d-edit-math';

/** Wall vertical move → `baseOffset += Δ` (whole wall shifts; top follows). */
export function computeWallVerticalMove(params: WallParams, deltaUpMm: number): WallParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, baseOffset: params.baseOffset + deltaUpMm };
}

/** Column vertical move → `baseOffset += Δ` (mirror of wall). */
export function computeColumnVerticalMove(params: ColumnParams, deltaUpMm: number): ColumnParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, baseOffset: params.baseOffset + deltaUpMm };
}

/** Beam vertical move → `topElevation += Δ` (top face moves; depth fixed → whole beam shifts). */
export function computeBeamVerticalMove(params: BeamParams, deltaUpMm: number): BeamParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, topElevation: params.topElevation + deltaUpMm };
}

/** Slab vertical move → `levelElevation += Δ` (top face moves; thickness fixed → whole slab shifts). */
export function computeSlabVerticalMove(params: SlabParams, deltaUpMm: number): SlabParams | null {
  if (deltaUpMm === 0) return null;
  return { ...params, levelElevation: params.levelElevation + deltaUpMm };
}

/**
 * Stair vertical move → `basePoint.z += Δ`, with the mm delta converted into the
 * stair's drawing-unit space (the ONLY BIM type not stored in raw mm — ADR-358).
 */
export function computeStairVerticalMove(entity: StairEntity, deltaUpMm: number): StairParams | null {
  if (deltaUpMm === 0) return null;
  const params = entity.params;
  const deltaUnits = deltaUpMm * mmToEntityUnitFactor(entity);
  return {
    ...params,
    basePoint: { ...params.basePoint, z: params.basePoint.z + deltaUnits },
  };
}
