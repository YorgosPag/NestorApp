/**
 * GEOMETRY SPLINE UTILITIES — SSoT for Catmull-Rom spline tessellation.
 *
 * Extracted from `systems/trim/trim-intersection-mapper` (ADR-350) so the ONE
 * spline→polyline approximation is shared by trim intersection mapping AND the
 * DXF export's `explode` (Tekton) fallback — no duplicated Catmull-Rom math
 * (N.18). First-order interpolation through the control points: sufficient for
 * trim picks and for a "dumb"-parser polyline, and matches AutoCAD industry
 * behaviour where a SPLINE-fit is converted to a CV polyline before trim.
 *
 * Pure functions — no DOM / React / DXF deps.
 */

import type { Point2D } from '../../types/Types';

/** Default segment budget for a whole-spline tessellation (matches the legacy trim value). */
export const SPLINE_TESSELLATION_SEGMENTS = 64;

/** Catmull-Rom interpolation of the four control points at local parameter `t ∈ [0,1]`. */
export function catmullRom(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * Tessellate a spline (given by its control points) into a polyline of ≈`segments` points via
 * Catmull-Rom interpolation. `< 2` control points → empty; exactly 2 → the raw segment. A `closed`
 * spline wraps the last→first span. Returns world-space `Point2D[]` (caller applies any scaling).
 */
export function tessellateSplinePoints(
  controlPoints: readonly Point2D[],
  closed: boolean,
  segments: number = SPLINE_TESSELLATION_SEGMENTS,
): Point2D[] {
  const cp = controlPoints;
  if (!cp || cp.length < 2) return [];
  if (cp.length === 2) return [cp[0], cp[1]];

  const out: Point2D[] = [];
  const n = cp.length;
  const last = closed ? n : n - 1;

  for (let i = 0; i < last; i += 1) {
    const p0 = cp[(i - 1 + n) % n] ?? cp[i];
    const p1 = cp[i];
    const p2 = cp[(i + 1) % n] ?? cp[i];
    const p3 = cp[(i + 2) % n] ?? p2;
    const steps = Math.max(1, Math.floor(segments / last));
    for (let sIdx = 0; sIdx < steps; sIdx += 1) {
      out.push(catmullRom(p0, p1, p2, p3, sIdx / steps));
    }
  }
  if (!closed) out.push(cp[n - 1]);
  return out;
}
