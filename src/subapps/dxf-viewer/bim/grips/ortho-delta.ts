/**
 * ORTHO (F8) delta constraint — SSoT.
 *
 * A drag delta, when ORTHO / rectilinear is active, is quantized to its dominant
 * axis: the axis with the larger absolute component wins, the other is zeroed.
 *
 * This single helper replaces the byte-identical private `quantizeToDominantAxis`
 * copies that had accreted across the parametric polygon-grip transforms
 * (floor-finish / slab / slab-opening / hatch) and the `applyOrtho` copy in
 * `rect-grip-engine`. One math, one place (ADR-294 SSoT ratchet).
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Quantize a delta to its dominant axis (ORTHO / F8 / Shift-rectilinear).
 * `|dx| >= |dy|` → keep X, zero Y; otherwise keep Y, zero X. Frame-agnostic:
 * pass a world delta for world-ortho, a local-frame delta for local-ortho.
 */
export function constrainDeltaToDominantAxis(delta: Point2D): Point2D {
  return Math.abs(delta.x) >= Math.abs(delta.y)
    ? { x: delta.x, y: 0 }
    : { x: 0, y: delta.y };
}
