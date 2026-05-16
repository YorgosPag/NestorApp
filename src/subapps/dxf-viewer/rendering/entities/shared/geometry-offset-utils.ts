/**
 * ADR-358 Phase 2b — Parallel offset of a 3D polyline in the xy plane.
 *
 * Pure function (no DOM / React / DXF deps). Used by Phase 4a `StairGeometryService`
 * to derive stair stringers as constant-distance offsets of the walkline.
 *
 * Conventions:
 *   - 2D xy offset only. z values are copied verbatim from each input vertex
 *     (segments treated as if projected to xy — stair walklines are planar
 *     per tread within `StairGeometryService`).
 *   - Positive `offsetDistance` = LEFT of travel direction (CCW perpendicular
 *     of segment direction). Negative = RIGHT.
 *   - Sharp interior corners that would explode the miter are clipped to a
 *     bevel using `miterLimit` (default 4 = standard SVG/CSS heuristic).
 *   - Closed polyline detection: `first ≈ last` within `CLOSE_EPS` (1e-9).
 *
 * Out-of-scope for Phase 2b (Clipper-class problems):
 *   - Self-intersection removal in concave regions
 *   - Hole / island handling
 *   - Non-planar (xyz) offset
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.3 §5.4
 */

import type { Point3D } from '../../types/Types';

const CLOSE_EPS = 1e-9;
const ANTIPARALLEL_EPS = 1e-9;
const DEFAULT_MITER_LIMIT = 4;

interface Vec2 { readonly x: number; readonly y: number; }

/** CCW perpendicular unit vector of (to - from) in xy plane. */
function perpUnit(from: Readonly<Point3D>, to: Readonly<Point3D>): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: -dy / len, y: dx / len };
}

/** True if two Point3D coincide within `CLOSE_EPS` in xyz. */
function pointsCoincide(a: Readonly<Point3D>, b: Readonly<Point3D>): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) < CLOSE_EPS;
}

/** Emit the two bevel endpoints at an interior vertex (incoming + outgoing perp). */
function emitBevel(
  out: Point3D[],
  pivot: Readonly<Point3D>,
  perpIn: Vec2,
  perpOut: Vec2,
  d: number,
): void {
  out.push({ x: pivot.x + d * perpIn.x, y: pivot.y + d * perpIn.y, z: pivot.z });
  out.push({ x: pivot.x + d * perpOut.x, y: pivot.y + d * perpOut.y, z: pivot.z });
}

/**
 * Emit either a single miter vertex or two bevel endpoints, depending on whether
 * the miter ratio exceeds `miterLimit` (or if the perpendiculars are antiparallel,
 * or the caller forced `'bevel'`).
 *
 * Miter formula: offset = pivot + d · (perpIn + perpOut) / (1 + perpIn·perpOut).
 * Derivation: projecting that offset onto either perpendicular yields exactly d,
 * which is the defining property of the miter join. |miter| / d = √(2 / (1 + dot)),
 * so the ratio explodes as the perpendiculars become antiparallel (≈180° turn).
 */
function emitJoin(
  out: Point3D[],
  pivot: Readonly<Point3D>,
  perpIn: Vec2,
  perpOut: Vec2,
  d: number,
  join: 'miter' | 'bevel',
  miterLimit: number,
): void {
  const dot = perpIn.x * perpOut.x + perpIn.y * perpOut.y;
  const denom = 1 + dot;
  if (join === 'bevel' || denom < ANTIPARALLEL_EPS) {
    emitBevel(out, pivot, perpIn, perpOut, d);
    return;
  }
  const miterRatio = Math.sqrt(2 / denom);
  if (miterRatio > miterLimit) {
    emitBevel(out, pivot, perpIn, perpOut, d);
    return;
  }
  const scale = d / denom;
  out.push({
    x: pivot.x + scale * (perpIn.x + perpOut.x),
    y: pivot.y + scale * (perpIn.y + perpOut.y),
    z: pivot.z,
  });
}

/**
 * Parallel offset of a 3D polyline by `offsetDistance` in its xy projection.
 * z values are preserved per-vertex (input z copied to output verbatim).
 *
 * @param polyline       Input vertices (≥ 2; otherwise returns `[]`).
 * @param offsetDistance Signed distance: + = left of travel, − = right.
 * @param options.join   `'miter'` (default) or `'bevel'`. Miter falls back to
 *                       bevel when ratio > `miterLimit`.
 * @param options.miterLimit Miter cap (default 4). When |miter| > miterLimit · |d|
 *                           the join falls back to bevel.
 */
export function offsetPolyline(
  polyline: readonly Readonly<Point3D>[],
  offsetDistance: number,
  options?: { readonly join?: 'miter' | 'bevel'; readonly miterLimit?: number },
): readonly Point3D[] {
  if (polyline.length < 2) return [];
  const join = options?.join ?? 'miter';
  const miterLimit = options?.miterLimit ?? DEFAULT_MITER_LIMIT;
  const n = polyline.length;
  const isClosed = n >= 3 && pointsCoincide(polyline[0], polyline[n - 1]);
  const uniqueCount = isClosed ? n - 1 : n;
  const segCount = isClosed ? uniqueCount : uniqueCount - 1;
  const perps: Vec2[] = new Array(segCount);
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % uniqueCount;
    perps[i] = perpUnit(polyline[i], polyline[j]);
  }
  const out: Point3D[] = [];
  for (let i = 0; i < uniqueCount; i++) {
    const pivot = polyline[i];
    const perpIn = isClosed ? perps[(i - 1 + segCount) % segCount] : (i === 0 ? null : perps[i - 1]);
    const perpOut = isClosed ? perps[i] : (i === segCount ? null : perps[i]);
    if (perpIn === null && perpOut !== null) {
      out.push({ x: pivot.x + offsetDistance * perpOut.x, y: pivot.y + offsetDistance * perpOut.y, z: pivot.z });
    } else if (perpOut === null && perpIn !== null) {
      out.push({ x: pivot.x + offsetDistance * perpIn.x, y: pivot.y + offsetDistance * perpIn.y, z: pivot.z });
    } else if (perpIn !== null && perpOut !== null) {
      emitJoin(out, pivot, perpIn, perpOut, offsetDistance, join, miterLimit);
    }
  }
  if (isClosed && out.length > 0) {
    out.push({ ...out[0] });
  }
  return out;
}
