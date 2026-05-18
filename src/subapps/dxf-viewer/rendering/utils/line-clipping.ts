import type { Point2D } from '../types/Types';

export interface ClipResult {
  readonly start: Point2D;
  readonly end: Point2D;
}

const EPSILON = 1e-10;
const T_BOUND = 1e15;

/**
 * Liang-Barsky parametric clip.
 * Line: P(t) = base + t*dir, t ∈ [tRange.min, tRange.max].
 * XLine consumer: tRange = { min: -Infinity, max: +Infinity }
 * Ray   consumer: tRange = { min: 0,         max: +Infinity }
 * Returns clipped segment in world coords, or null if fully outside viewport.
 */
export function clipParametricLine(
  base: Point2D,
  dir: Point2D,
  tRange: { min: number; max: number },
  viewport: { minX: number; minY: number; maxX: number; maxY: number }
): ClipResult | null {
  const dx = dir.x;
  const dy = dir.y;

  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
    return null;
  }

  let tEnter = tRange.min === -Infinity ? -T_BOUND : tRange.min;
  let tExit  = tRange.max === +Infinity ?  T_BOUND : tRange.max;

  // 4 edge constraints: p_i * t <= q_i
  // Left:   p = -dx, q = base.x - minX
  // Right:  p =  dx, q = maxX - base.x
  // Bottom: p = -dy, q = base.y - minY
  // Top:    p =  dy, q = maxY - base.y

  const ps = [-dx, dx, -dy, dy];
  const qs = [
    base.x - viewport.minX,
    viewport.maxX - base.x,
    base.y - viewport.minY,
    viewport.maxY - base.y,
  ];

  for (let i = 0; i < 4; i++) {
    const p = ps[i];
    const q = qs[i];

    if (Math.abs(p) < EPSILON) {
      // Parallel to this edge
      if (q < 0) return null; // outside — no intersection possible
      // Inside — no constraint update
      continue;
    }

    const t = q / p;
    if (p < 0) {
      // entering edge
      if (t > tEnter) tEnter = t;
    } else {
      // exiting edge
      if (t < tExit) tExit = t;
    }
  }

  if (tEnter > tExit) return null;

  return {
    start: { x: base.x + tEnter * dx, y: base.y + tEnter * dy },
    end:   { x: base.x + tExit  * dx, y: base.y + tExit  * dy },
  };
}
