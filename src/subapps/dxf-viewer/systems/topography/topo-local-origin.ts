/**
 * ADR-650 Milestone 1 — LOCAL-origin offset (Q3, ADR-635).
 *
 * ΕΓΣΑ'87 survey coordinates are huge in canonical mm (X,Y ~1e8–1e9 mm once metres
 * are converted). Triangulating / marching directly on those magnitudes risks
 * catastrophic float64 cancellation (the differences that matter are ~1e2–1e4 mm)
 * AND trips the ADR-635 ±1e6 culling fallback. So the geometric core runs in a LOCAL
 * frame: pick a survey base point (`LocalOrigin`) and subtract it. Output entities are
 * re-projected to WORLD by adding the origin back, so they stay geo-referenced and
 * align with any imported base map.
 *
 * The origin is the min planimetric corner (floored), so every local coordinate is
 * ≥ 0 and bounded by the site extent — the smallest magnitudes achievable.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { LocalOrigin, TopoPoint, Breakline } from './topo-types';

/** The neutral origin (no offset) — used when there are no points yet. */
export const ZERO_ORIGIN: LocalOrigin = { x: 0, y: 0 };

/**
 * Choose a LOCAL origin from all planimetric inputs: the floored min corner of the
 * points AND breakline vertices, so local coordinates are small and non-negative.
 * Returns {@link ZERO_ORIGIN} when there is nothing to offset.
 */
export function computeLocalOrigin(
  points: readonly TopoPoint[],
  breaklines: readonly Breakline[] = [],
): LocalOrigin {
  let minX = Infinity;
  let minY = Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  }
  for (const bl of breaklines) {
    for (const v of bl.vertices) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return ZERO_ORIGIN;
  return { x: Math.floor(minX), y: Math.floor(minY) };
}

/** WORLD → LOCAL: subtract the origin. */
export function worldToLocal(p: Point2D, origin: LocalOrigin): Point2D {
  return { x: p.x - origin.x, y: p.y - origin.y };
}

/** LOCAL → WORLD: add the origin back. */
export function localToWorld(p: Point2D, origin: LocalOrigin): Point2D {
  return { x: p.x + origin.x, y: p.y + origin.y };
}
