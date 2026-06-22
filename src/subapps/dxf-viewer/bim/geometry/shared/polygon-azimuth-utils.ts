/**
 * Compass-azimuth polygon helpers (ADR-422 L7.2, shared).
 *
 * Extracted from `polygon-utils.ts` (N.7.1 500-line cap). Pure functions that
 * derive a compass azimuth from a 2D direction or from the edge of a polygon
 * footprint. Consumed by the thermal heat-load space-boundary resolver
 * (orientation-aware solar gains).
 *
 * Compass convention: **0°=+Y ("North"), increasing clockwise toward +X
 * ("East")**: +Y→0, +X→90, −Y→180, −X→270.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import type { Point3D } from '../../types/bim-base';
import { segmentNormalX, segmentNormalY, isPolygonCCW } from './polygon-utils';

const RAD_TO_DEG = 180 / Math.PI;

/** Below this vector length a direction is treated as degenerate (zero). */
const DEGENERATE_LENGTH_EPS = 0.001;

/**
 * Azimuth (deg ∈ [0,360)) of the 2D direction `(dx,dy)` under the compass
 * convention **0°=+Y ("North"), increasing clockwise toward +X ("East")**:
 * +Y→0, +X→90, −Y→180, −X→270. Returns `null` for a (near-)zero vector.
 *
 * Frame note: callers that map this to a geographic compass treat scene **+Y as
 * project north (= true north, no rotation)** — a documented advisory
 * simplification (ADR-422 L7.2; a configurable north angle is future work).
 */
export function directionAzimuthDeg(dx: number, dy: number): number | null {
  if (Math.hypot(dx, dy) < DEGENERATE_LENGTH_EPS) return null;
  const deg = Math.atan2(dx, dy) * RAD_TO_DEG;
  return ((deg % 360) + 360) % 360;
}

/** Clamped distance² from point `(px,py)` to segment `a→b` (XY plane). */
function pointSegmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return (px - ax) ** 2 + (py - ay) ** 2;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * Outward-facing azimuth (deg — see {@link directionAzimuthDeg}) of polygon edge
 * `edgeIndex` (vertex i → i+1). **"Outward"** = the edge-normal side pointing
 * **away from the polygon interior**, resolved from the polygon **winding** (no
 * centroid → robust for concave rings). `segmentNormalX/Y` is the CCW (+90°)
 * normal, which points *inward* for a CCW ring, so it is flipped accordingly.
 *
 * Returns `null` for `<3` vertices or a degenerate edge. **SSoT** for «outward
 * azimuth of a specific edge» — consumed by {@link nearestEdgeOutwardAzimuthDeg}
 * (after picking the nearest index) and by the roof per-edge compass labels
 * (ADR-417 Φ-per-edge).
 */
export function edgeOutwardAzimuthDeg(
  polygon: readonly Point3D[],
  edgeIndex: number,
): number | null {
  const n = polygon.length;
  if (n < 3) return null;
  const a = polygon[edgeIndex % n];
  const b = polygon[(edgeIndex + 1) % n];
  const nx = segmentNormalX(a, b);
  const ny = segmentNormalY(a, b);
  if (nx === null || ny === null) return null;
  const outwardSign = isPolygonCCW(polygon) ? -1 : 1;
  return directionAzimuthDeg(outwardSign * nx, outwardSign * ny);
}

/**
 * Outward-facing azimuth (deg — see {@link directionAzimuthDeg}) of the polygon
 * edge nearest to `p`. Picks the nearest edge index, then delegates to the
 * {@link edgeOutwardAzimuthDeg} SSoT. Returns `null` for `<3` vertices or a
 * degenerate nearest edge. Used to derive an opening's orientation from its room
 * footprint (ADR-422 L7.2 orientation-aware solar gains).
 */
export function nearestEdgeOutwardAzimuthDeg(
  polygon: readonly Point3D[],
  p: { readonly x: number; readonly y: number },
): number | null {
  const n = polygon.length;
  if (n < 3) return null;

  let bestIndex = -1;
  let bestSq = Infinity;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const d = pointSegmentDistanceSq(p.x, p.y, a.x, a.y, b.x, b.y);
    if (d < bestSq) {
      bestSq = d;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return null;
  return edgeOutwardAzimuthDeg(polygon, bestIndex);
}
