/**
 * Δύο λαβές (base + dir) μοιράζονται από **Ray** και **XLine**: μετάφραση του
 * `basePoint` και περιστροφή της `direction` γύρω από αυτό. Κεντρικοποιήθηκε
 * (N.0.2, CHECK 3.28) — `ray-grips.ts`/`xline-grips.ts` ήταν token-ταυτόσημα
 * εκτός ονόματος οντότητας.
 *
 * Οι δημόσιες συναρτήσεις `getRayGrips`/`applyRayGripDrag` κ.λπ. μένουν
 * αναλλοίωτες — απλώς αναθέτουν εδώ.
 */
import type { Point2D } from '../rendering/types/Types';
import type { GripInfo } from '../hooks/grip-types';
import type { EntityGripKind } from '../hooks/grip-kinds';
import { translatePoint } from '../rendering/entities/shared/geometry-vector-utils';

/** Fixed world-space offset for the direction handle. Normalized dir × OFFSET. */
const DIR_HANDLE_OFFSET = 100;

interface DirectionalLineEntity {
  id: string;
  basePoint: Point2D;
  direction: Point2D;
}

/** Compute the base + dir grip points for a Ray/XLine-shaped entity. */
export function getDirectionalLineGrips<E extends DirectionalLineEntity>(
  entity: E,
  baseGripKind: EntityGripKind,
  dirGripKind: EntityGripKind,
): GripInfo[] {
  const { x: dx, y: dy } = entity.direction;
  return [
    {
      entityId: entity.id,
      gripIndex: 0,
      type: 'center',
      position: entity.basePoint,
      movesEntity: false,
      gripKind: baseGripKind,
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
      gripKind: dirGripKind,
    },
  ];
}

export interface DirectionalLineGripDragInput<E extends DirectionalLineEntity> {
  entity: E;
  delta: Point2D;
  currentPos: Point2D;
}

/**
 * Apply a grip drag to a Ray/XLine-shaped entity.
 *   - base grip: translate basePoint by delta (direction invariant).
 *   - dir grip:  rotate — recompute direction = normalize(currentPos − basePoint).
 */
export function applyDirectionalLineGripDrag<E extends DirectionalLineEntity>(
  isBaseGrip: boolean,
  input: DirectionalLineGripDragInput<E>,
): Partial<E> {
  const { entity, delta, currentPos } = input;
  if (isBaseGrip) {
    return { basePoint: translatePoint(entity.basePoint, delta) } as Partial<E>;
  }
  const vx = currentPos.x - entity.basePoint.x;
  const vy = currentPos.y - entity.basePoint.y;
  const len = Math.sqrt(vx * vx + vy * vy);
  if (len < 1e-9) return {};
  return { direction: { x: vx / len, y: vy / len } } as Partial<E>;
}
