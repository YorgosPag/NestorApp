/**
 * ADR-359 Phase 11 — Ray grip computation + drag transform.
 *
 * Two grips per RayEntity:
 *   - base (center, gripIndex 0): translate basePoint (origin of the ray)
 *   - dir  (vertex, gripIndex 1): rotate direction around basePoint
 *
 * Consumer of ADR-357 Phase 11/12 grip infrastructure (no new GripStore).
 * Shared geometry with XLine (N.0.2, CHECK 3.28): `../directional-line-grips`.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { RayEntity } from '../../types/entities';
import type { GripInfo, RayGripKind } from '../../hooks/grip-types';
import {
  applyDirectionalLineGripDrag,
  getDirectionalLineGrips,
} from '../directional-line-grips';

/** Compute grip points for a Ray (semi-infinite line from basePoint). */
export function getRayGrips(entity: RayEntity): GripInfo[] {
  return getDirectionalLineGrips(
    entity,
    { on: 'ray', kind: 'ray-base' },
    { on: 'ray', kind: 'ray-dir' },
  );
}

export interface RayGripDragInput {
  entity: RayEntity;
  delta: Point2D;
  currentPos: Point2D;
}

/**
 * Apply a grip drag to RayEntity fields.
 *   - ray-base: translate basePoint by delta (direction invariant).
 *   - ray-dir:  rotate — recompute direction = normalize(currentPos − basePoint).
 */
export function applyRayGripDrag(
  kind: RayGripKind,
  input: RayGripDragInput,
): Partial<RayEntity> {
  return applyDirectionalLineGripDrag(kind === 'ray-base', input);
}
