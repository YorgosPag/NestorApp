/**
 * Grid snap — SSoT leaf for component-wise grid rounding.
 *
 * 🏢 ENTERPRISE (ADR-049): single source of truth for "round a 2D vector to the
 * nearest grid multiple". Previously copy-pasted as two identically-implemented
 * local helpers — `snapToGrid` (useEntityDrag) and `snapDeltaToGrid`
 * (useGripMovement) — both rounding a `Point2D` (a drag/grip DELTA) per component.
 *
 * Pure, zero-import-but-types leaf → safe to import from any movement path
 * (drag, grip, nudge) without cycles.
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Round each component of a 2D vector to the nearest multiple of `gridSize`.
 *
 * Works identically for a point OR a delta (component-wise rounding is the same
 * operation for both). Callers guard `gridSize > 0` before calling.
 */
export function snapToGrid(p: Point2D, gridSize: number): Point2D {
  return {
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize,
  };
}
