/**
 * OVERLAY DRAW PRIMITIVES — Cluster #16 SSoT (ADR-625)
 *
 * Low-level canvas draw helpers shared by the ghost-overlay paint primitives
 * (edit-fence / corner / transform). Each helper does ONE screen-space paint
 * operation; the caller owns colour/dash/alpha state (save/restore/beginPath).
 *
 * @module hooks/tools/overlay-draw-primitives
 */

import type { Point2D } from '../../rendering/types/Types';

/**
 * Trace a world-space polyline into the current path in screen space:
 * `moveTo` the first projected point, then `lineTo` the rest. Caller owns
 * `ctx.save()` / `beginPath()` / stroke / dash / `restore()`.
 */
export function tracePolyline(
  ctx: CanvasRenderingContext2D,
  path: ReadonlyArray<Point2D>,
  toScreen: (p: Point2D) => Point2D,
): void {
  if (path.length === 0) return;
  const first = toScreen(path[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i++) {
    const p = toScreen(path[i]);
    ctx.lineTo(p.x, p.y);
  }
}
