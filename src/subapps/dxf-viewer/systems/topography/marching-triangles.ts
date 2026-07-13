/**
 * ADR-650 Milestone 1 — marching (meandering) triangles.
 *
 * The contour extractor the big players use over a TIN (Civil 3D / CASS): intersect each
 * triangle with a set of horizontal planes. A triangle is a 3-vertex cell, so — unlike
 * marching SQUARES over a grid — there is NO saddle ambiguity: a level either misses the
 * triangle or crosses exactly two edges, giving one clean segment. Running this over our
 * CONSTRAINED triangulation is what makes the contours honour breaklines (Q6); `d3-tricontour`
 * cannot, because it re-triangulates unconstrained internally.
 *
 * Coordinates are LOCAL (the frame of `TinSurface.positions`); the chainer re-projects to world.
 *
 * Level nudging: each plane is offset by a tiny fraction of the interval so no vertex ever
 * lies exactly on a level. This removes the vertex-on-plane degeneracy (and neutralises
 * false-flat triangles, ADR-650 §5) while keeping the geometric error far below survey noise.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { TinSurface, ContourSegment } from './topo-types';
import type { ContourConfig } from './contour-config';

/** Fraction of the interval used to nudge planes off exact vertex elevations. */
const LEVEL_NUDGE_FRACTION = 1e-6;

/** Nominal contour levels (un-nudged) spanning the surface's Z range. */
export function generateLevels(minZ: number, maxZ: number, config: ContourConfig): number[] {
  const { intervalMm, baseElevationMm } = config;
  if (!(intervalMm > 0) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) return [];
  const kMin = Math.ceil((minZ - baseElevationMm) / intervalMm);
  const kMax = Math.floor((maxZ - baseElevationMm) / intervalMm);
  const levels: number[] = [];
  for (let k = kMin; k <= kMax; k++) levels.push(baseElevationMm + k * intervalMm);
  return levels;
}

/**
 * Linear crossing point where edge (pa,za)→(pb,zb) meets plane `level`.
 *
 * Exported since ADR-650 M6: the volume engine splits a triangle on the ZERO line of the Δz
 * field («daylight line») — the same linear-crossing question this contour extractor asks on
 * an elevation field, so it asks it through the same function instead of re-deriving the lerp.
 */
export function crossEdge(pa: Point2D, za: number, pb: Point2D, zb: number, level: number): Point2D {
  const t = (level - za) / (zb - za);
  return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
}

/** March ONE triangle at ONE nudged plane → 0 or 2 crossing points. */
function marchTriangle(
  p0: Point2D, z0: number,
  p1: Point2D, z1: number,
  p2: Point2D, z2: number,
  plane: number,
): [Point2D, Point2D] | null {
  const hits: Point2D[] = [];
  if ((z0 - plane) * (z1 - plane) < 0) hits.push(crossEdge(p0, z0, p1, z1, plane));
  if ((z1 - plane) * (z2 - plane) < 0) hits.push(crossEdge(p1, z1, p2, z2, plane));
  if ((z2 - plane) * (z0 - plane) < 0) hits.push(crossEdge(p2, z2, p0, z0, plane));
  return hits.length === 2 ? [hits[0], hits[1]] : null;
}

/**
 * Produce all contour segments (LOCAL frame) for a surface. Each segment carries its
 * NOMINAL level so the chainer can group + classify major/minor exactly.
 */
export function generateContourSegments(tin: TinSurface, config: ContourConfig): ContourSegment[] {
  const { positions, elevations, triangles, bounds } = tin;
  const levels = generateLevels(bounds.minZ, bounds.maxZ, config);
  if (!levels.length || !triangles.length) return [];

  const nudge = config.intervalMm * LEVEL_NUDGE_FRACTION;
  const segments: ContourSegment[] = [];

  for (const [i, j, k] of triangles) {
    const p0 = { x: positions[i][0], y: positions[i][1] };
    const p1 = { x: positions[j][0], y: positions[j][1] };
    const p2 = { x: positions[k][0], y: positions[k][1] };
    const z0 = elevations[i], z1 = elevations[j], z2 = elevations[k];
    const triMin = Math.min(z0, z1, z2);
    const triMax = Math.max(z0, z1, z2);
    for (const level of levels) {
      if (level < triMin || level > triMax) continue;
      const seg = marchTriangle(p0, z0, p1, z1, p2, z2, level + nudge);
      if (seg) segments.push({ level, a: seg[0], b: seg[1] });
    }
  }
  return segments;
}
