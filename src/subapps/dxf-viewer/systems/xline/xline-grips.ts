/**
 * ADR-359 Phase 11 — XLine grip computation + drag transform.
 *
 * Two grips per XLineEntity:
 *   - base (center, gripIndex 0): translate basePoint
 *   - dir  (vertex, gripIndex 1): rotate direction around basePoint
 *
 * Consumer of ADR-357 Phase 11/12 grip infrastructure (no new GripStore).
 */
import type { Point2D } from '../../rendering/types/Types';
import type { XLineEntity } from '../../types/entities';
import type { GripInfo, XLineGripKind } from '../../hooks/useGripMovement';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

/** Fixed world-space offset for the direction handle. Normalized dir × OFFSET. */
const DIR_HANDLE_OFFSET = 100;

/** Compute grip points for an XLine (infinite construction line). */
export function getXLineGrips(entity: XLineEntity): GripInfo[] {
  const { x: dx, y: dy } = entity.direction;
  return [
    {
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: entity.basePoint,
      movesEntity: false,
      gripKind: { on: 'xline', kind: 'xline-base' },
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
      gripKind: { on: 'xline', kind: 'xline-dir' },
    },
  ];
}

export interface XLineGripDragInput {
  entity: XLineEntity;
  delta: Point2D;
  currentPos: Point2D;
}

/**
 * Apply a grip drag to XLineEntity fields.
 *   - xline-base: translate basePoint by delta (direction invariant).
 *   - xline-dir:  rotate — recompute direction = normalize(currentPos − basePoint).
 */
export function applyXLineGripDrag(
  kind: XLineGripKind,
  input: XLineGripDragInput,
): Partial<XLineEntity> {
  const { entity, delta, currentPos } = input;
  if (kind === 'xline-base') {
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
