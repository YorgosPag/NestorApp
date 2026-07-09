/**
 * Opening axis walk/projection helpers (extracted from `opening-geometry.ts`,
 * ADR-615 file-size split — N.7.1, ≤500 lines/file).
 *
 * Pure polyline math shared by `computeOpeningGeometry`, `wallAxisPointAtOffsetMm`
 * and `projectPointToWallOffset`: "walk N mm along a polyline axis" and
 * "project a point onto a polyline axis, return arc-length offset". Works
 * identically for straight / curved / L-shaped host walls AND the synthetic
 * 2-vertex axis a self-hosted opening synthesizes (`selfOpeningHost`,
 * ADR-615) — both are just `readonly Point3D[]`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-615-free-standing-self-hosted-opening.md
 */

import type { Point3D } from '../types/bim-base';

/**
 * One non-degenerate polyline segment with its precomputed direction. SSoT for
 * "iterate a polyline's segments" — shared by `walkPolylineToDistance` and
 * `projectPointToPolylineOffset` so the per-segment `dx/dy/segLen/ux/uy` setup
 * (and the degenerate-segment skip) lives in ONE place, not two twins.
 */
interface PolylineSegment {
  readonly a: Point3D;
  readonly b: Point3D;
  readonly dx: number;
  readonly dy: number;
  readonly segLen: number;
  readonly ux: number;
  readonly uy: number;
}

/** Split `vertices` into its non-degenerate segments (skips `segLen < 1e-6`). */
function polylineSegments(vertices: readonly Point3D[]): PolylineSegment[] {
  const segs: PolylineSegment[] = [];
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    segs.push({ a, b, dx, dy, segLen, ux: dx / segLen, uy: dy / segLen });
  }
  return segs;
}

/**
 * Walk `vertices` from the start by `distanceMm` mm and return the world
 * position + local tangent direction at that point. Clamps past the end.
 */
export function walkPolylineToDistance(
  vertices: readonly Point3D[],
  distanceMm: number,
): { point: Point3D; ux: number; uy: number; rotation: number } {
  let remaining = distanceMm;
  for (const s of polylineSegments(vertices)) {
    if (remaining <= s.segLen) {
      const t = remaining / s.segLen;
      return {
        point: { x: s.a.x + s.dx * t, y: s.a.y + s.dy * t, z: 0 },
        ux: s.ux,
        uy: s.uy,
        rotation: Math.atan2(s.dy, s.dx),
      };
    }
    remaining -= s.segLen;
  }
  // Past end — clamp to last vertex, use last segment tangent.
  const n = vertices.length;
  const a = vertices[n - 2];
  const b = vertices[n - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segLen = Math.hypot(dx, dy) || 1;
  return {
    point: { x: b.x, y: b.y, z: b.z ?? 0 },
    ux: dx / segLen,
    uy: dy / segLen,
    rotation: Math.atan2(dy, dx),
  };
}

/**
 * Project `point` onto the polyline `vertices`, returning the cumulative arc
 * offset (mm) of the closest foot, clamped to `[0, totalArcLength]`.
 */
export function projectPointToPolylineOffset(
  point: { readonly x: number; readonly y: number },
  vertices: readonly Point3D[],
): number {
  let arcOffset = 0;
  let bestOffset = 0;
  let bestDist2 = Infinity;

  for (const s of polylineSegments(vertices)) {
    const vx = point.x - s.a.x;
    const vy = point.y - s.a.y;
    const t = Math.max(0, Math.min(vx * s.ux + vy * s.uy, s.segLen));
    const ex = point.x - (s.a.x + s.ux * t);
    const ey = point.y - (s.a.y + s.uy * t);
    const dist2 = ex * ex + ey * ey;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      bestOffset = arcOffset + t;
    }
    arcOffset += s.segLen;
  }

  return Math.max(0, Math.min(bestOffset, arcOffset));
}
