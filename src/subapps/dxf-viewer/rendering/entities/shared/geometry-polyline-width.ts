/**
 * GEOMETRY POLYLINE WIDTH UTILITIES — SSoT for wide / tapered polylines (ADR-510 Φ3d)
 *
 * AutoCAD LWPOLYLINE segments carry a per-vertex **width** (DXF groups 40/41):
 *   startWidths[i] = width at vertices[i]   of the outgoing segment i → i+1
 *   endWidths[i]   = width at vertices[i+1] of that same segment
 * A `constantWidth` (DXF group 43) applies one width to every segment. Width is
 * edge-to-edge and **model-space** (drawing units) — so it scales with zoom,
 * unlike the display-space `lineweight`. When start ≠ end the segment tapers
 * (the classic arrow / leader head).
 *
 * This is the ONE geometry source feeding the canvas renderer (filled band) and
 * — later — the DXF writer (ADR-510 §4.1 «μία γεωμετρία → canvas + DXF + μέτρηση»).
 * Each segment is emitted as its OWN filled polygon (AutoCAD per-segment model),
 * so tapers and arcs are exact and corners need no global join solve.
 *
 * The centerline tessellation REUSES {@link bulgeToPolyline} so an arc segment
 * (non-zero bulge) yields a curved band for free; the constant-distance
 * `offsetPolyline` (ADR-358) does NOT apply here — it cannot vary width per point.
 *
 * @see geometry-bulge-utils.ts — the arc-segment geometry SSoT this builds on
 */

import type { Point2D } from '../../types/Types';
import { bulgeToPolyline } from './geometry-bulge-utils';
// 🏢 Reuse vector/scalar SSoT — no inline perpendicular / offset / distance / lerp.
// ADR-090 (point ops), ADR-072/070 (vector), centralized lerp.
import {
  calculateDistance,
  getPerpendicularUnitVector,
  offsetPoint,
} from './geometry-vector-utils';
import { lerp } from './geometry-utils';

/** Below this width (mm) a segment is treated as a hairline (no band). */
export const WIDTH_HAIRLINE_EPS = 1e-9;

/**
 * Resolve the start/end width (mm) of the outgoing segment at `index`.
 * Per-segment `startWidths`/`endWidths` win; otherwise `constantWidth`; else 0.
 */
export function resolveSegmentWidth(
  index: number,
  startWidths: readonly number[] | undefined,
  endWidths: readonly number[] | undefined,
  constantWidth: number | undefined,
): { readonly start: number; readonly end: number } {
  const c = constantWidth && constantWidth > WIDTH_HAIRLINE_EPS ? constantWidth : 0;
  const s = startWidths?.[index];
  const e = endWidths?.[index];
  return {
    start: s != null && s > WIDTH_HAIRLINE_EPS ? s : c,
    end: e != null && e > WIDTH_HAIRLINE_EPS ? e : c,
  };
}

/** True when any segment carries a real (paintable) width. */
export function hasAnyWidth(
  startWidths: readonly number[] | undefined,
  endWidths: readonly number[] | undefined,
  constantWidth: number | undefined,
): boolean {
  if (constantWidth != null && constantWidth > WIDTH_HAIRLINE_EPS) return true;
  if (startWidths?.some(w => w > WIDTH_HAIRLINE_EPS)) return true;
  if (endWidths?.some(w => w > WIDTH_HAIRLINE_EPS)) return true;
  return false;
}

/**
 * Build the filled-band polygon for a single (possibly bulged, possibly tapered)
 * segment `p0 → p1`. The centerline is tessellated via {@link bulgeToPolyline};
 * at each point the half-width is linearly interpolated from `startWidth` to
 * `endWidth` and offset along the local perpendicular. The returned ring walks
 * the left side forward then the right side backward (a closed fillable loop).
 *
 * Returns `[]` for a degenerate (zero-length) or width-less segment.
 */
export function buildSegmentWidthBand(
  p0: Point2D,
  p1: Point2D,
  bulge: number,
  startWidth: number,
  endWidth: number,
  maxSegDeg = 12,
): Point2D[] {
  if (startWidth <= WIDTH_HAIRLINE_EPS && endWidth <= WIDTH_HAIRLINE_EPS) return [];
  const center = bulgeToPolyline(p0, p1, bulge ?? 0, maxSegDeg);
  const n = center.length;
  if (n < 2) return [];

  // Cumulative chord length → width interpolation parameter t ∈ [0, 1].
  const cum: number[] = new Array(n);
  cum[0] = 0;
  for (let i = 1; i < n; i += 1) {
    cum[i] = cum[i - 1] + calculateDistance(center[i - 1], center[i]);
  }
  const total = cum[n - 1] || 1;

  const left: Point2D[] = new Array(n);
  const right: Point2D[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    // Local perpendicular from the neighbouring tessellation points.
    const prev = center[Math.max(0, i - 1)];
    const next = center[Math.min(n - 1, i + 1)];
    const perp = getPerpendicularUnitVector(prev, next);
    const half = lerp(startWidth, endWidth, cum[i] / total) / 2;
    left[i] = offsetPoint(center[i], perp, half);
    right[i] = offsetPoint(center[i], perp, -half);
  }

  const ring: Point2D[] = left;
  for (let i = n - 1; i >= 0; i -= 1) ring.push(right[i]);
  return ring;
}
