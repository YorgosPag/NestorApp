/**
 * ADR-359 Phase 11 — XLine grip computation + drag transform.
 *
 * Two grips per XLineEntity:
 *   - base (center, gripIndex 0): translate basePoint
 *   - dir  (vertex, gripIndex 1): rotate direction around basePoint
 *
 * Consumer of ADR-357 Phase 11/12 grip infrastructure (no new GripStore).
 * Shared geometry with Ray (N.0.2, CHECK 3.28): `../directional-line-grips`.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { XLineEntity } from '../../types/entities';
import type { GripInfo, XLineGripKind } from '../../hooks/grip-types';
import {
  applyDirectionalLineGripDrag,
  getDirectionalLineGrips,
} from '../directional-line-grips';

/** Compute grip points for an XLine (infinite construction line). */
export function getXLineGrips(entity: XLineEntity): GripInfo[] {
  return getDirectionalLineGrips(
    entity,
    { on: 'xline', kind: 'xline-base' },
    { on: 'xline', kind: 'xline-dir' },
  );
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
  return applyDirectionalLineGripDrag(kind === 'xline-base', input);
}
