/**
 * ADR-359 Phase 11 — Ray grip computation + drag transform.
 *
 * Two grips per RayEntity:
 *   - base (center, gripIndex 0): translate basePoint (origin of the ray)
 *   - dir  (vertex, gripIndex 1): rotate direction around basePoint
 *
 * Consumer of ADR-357 Phase 11/12 grip infrastructure (no new GripStore).
 */
import type { Point2D } from '../../rendering/types/Types';
import type { RayEntity } from '../../types/entities';
import type { GripInfo, RayGripKind } from '../../hooks/useGripMovement';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

/** Fixed world-space offset for the direction handle. Normalized dir × OFFSET. */
const DIR_HANDLE_OFFSET = 100;

/** Compute grip points for a Ray (semi-infinite line from basePoint). */
export function getRayGrips(entity: RayEntity): GripInfo[] {
  const { x: dx, y: dy } = entity.direction;
  return [
    {
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: entity.basePoint,
      movesEntity: false,
      rayGripKind: 'ray-base',
    },
    {
      entityId: entity.id,
      gripIndex: 1,
      type: 'vertex',
      position: {
        x: entity.basePoint.x + dx * DIR_HANDLE_OFFSET,
        y: entity.basePoint.y + dy * DIR_HANDLE_OFFSET,
      },
      movesEntity: false,
      rayGripKind: 'ray-dir',
    },
  ];
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
  const { entity, delta, currentPos } = input;
  if (kind === 'ray-base') {
    return {
      basePoint: translatePoint(entity.basePoint, delta),
    };
  }
  const vx = currentPos.x - entity.basePoint.x;
  const vy = currentPos.y - entity.basePoint.y;
  const len = Math.sqrt(vx * vx + vy * vy);
  if (len < 1e-9) return {};
  return { direction: { x: vx / len, y: vy / len } };
}
