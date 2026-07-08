/**
 * Shared math for the path arc-length samplers (ADR-353 / ADR-583 / N.18).
 * The analytical circular samplers (arc, circle) and the tabulated samplers
 * (polyline, spline) shared byte-identical helpers; centralised here so each
 * strategy keeps only its own parameterisation.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PathSample } from '../path-arc-length-sampler';

/** Cumulative arc-length table from a point list (index 0 = 0). */
export function buildCumLengths(pts: readonly { x: number; y: number }[]): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return cum;
}

/**
 * PathSample for a degenerate point list — empty → origin, single point → that
 * point (tangent 0). Returns `null` when the list has ≥2 points so the caller
 * continues its normal sampling. Shared by the polyline & spline `sample()` guards.
 */
export function degeneratePointSample(pts: readonly { x: number; y: number }[]): PathSample | null {
  if (pts.length === 0) return { position: { x: 0, y: 0 }, tangentDeg: 0 };
  if (pts.length === 1) return { position: { x: pts[0].x, y: pts[0].y }, tangentDeg: 0 };
  return null;
}

/** First segment index `i` (≥1) whose cumulative length reaches `target`. */
export function findArcLengthSegment(cum: readonly number[], target: number): number {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  return i;
}

/**
 * Sample a point + tangent at fraction `cu` (0..1) of arc-length along the
 * polyline through `pts`. `tangentFlip` (±1) negates the tangent direction for
 * reversed traversal. SSoT tail shared by the polyline & spline strategies
 * (ADR-583 / N.18) — each only preps its own point list + reverse convention.
 */
export function sampleAlongPointList(
  pts: readonly Point2D[],
  cu: number,
  tangentFlip: number,
): PathSample {
  const cum = buildCumLengths(pts);
  const total = cum[cum.length - 1];
  if (total === 0) return { position: { x: pts[0].x, y: pts[0].y }, tangentDeg: 0 };

  const target = cu * total;
  const i = findArcLengthSegment(cum, target);
  const segLen = cum[i] - cum[i - 1];
  const t = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen;
  const p0 = pts[i - 1];
  const p1 = pts[i];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  return {
    position: { x: p0.x + t * dx, y: p0.y + t * dy },
    tangentDeg: Math.atan2(tangentFlip * dy, tangentFlip * dx) * (180 / Math.PI),
  };
}

/**
 * Analytical {@link PathSample} on a circle of `radius` about `center` at
 * `angleRad`. `angleDeg` is the same angle in degrees and `dir` (±1) the
 * traversal sign, so the tangent is `angleDeg + dir·90` (perpendicular).
 */
export function circularArcSample(
  center: Point2D,
  radius: number,
  angleRad: number,
  angleDeg: number,
  dir: number,
): PathSample {
  return {
    position: { x: center.x + radius * Math.cos(angleRad), y: center.y + radius * Math.sin(angleRad) },
    tangentDeg: angleDeg + dir * 90,
  };
}
