/**
 * ADR-920 Β2 — slope of a TIN: per triangle, classified, and summarised for the buyer. Pure.
 *
 * The gradient of a triangle is the plane through its three vertices — the SAME `fitDzPlane` the
 * cut/fill volumes and the boundary clip use, here on the elevation field itself (Δz = z). Its
 * `a`, `b` are mm/mm, so `hypot(a, b) · 100` is the slope in percent with no unit conversion.
 *
 * @module lib/terrain/publication/terrain-slope
 */

import { fitDzPlane, type DzPlane } from '@/lib/terrain/dz-plane';
import type { TinSurface } from '@/lib/terrain/terrain-types';
import { LISTING_TERRAIN_FLAT_GRADIENT_PCT } from './listing-terrain-config';

/** Plane + plan area of one triangle; `null` for a degenerate (zero-area) triangle. */
export interface TriangleGradient {
  readonly plane: DzPlane;
  readonly areaMm2: number;
}

/** Slope summary of a whole surface. */
export interface SurfaceSlopeSummary {
  readonly planAreaMm2: number;
  readonly meanSlopePct: number;
  readonly maxSlopePct: number;
  readonly downslopeAzimuthDeg: number | null;
}

/** Gradient of triangle `t` (LOCAL plan mm, WORLD z mm). */
export function triangleGradient(tin: TinSurface, t: number): TriangleGradient | null {
  const [i, j, k] = tin.triangles[t];
  const vertex = (n: number) => ({
    x: tin.positions[n][0],
    y: tin.positions[n][1],
    dz: tin.elevations[n],
  });
  const v0 = vertex(i);
  const v1 = vertex(j);
  const v2 = vertex(k);
  const plane = fitDzPlane(v0, v1, v2);
  if (!plane) return null;
  const areaMm2 = Math.abs((v1.x - v0.x) * (v2.y - v0.y) - (v2.x - v0.x) * (v1.y - v0.y)) / 2;
  return { plane, areaMm2 };
}

/** Slope of a plane, percent. */
export function slopePct(plane: DzPlane): number {
  return Math.hypot(plane.a, plane.b) * 100;
}

/** Index of the band `pct` falls in: `0` below the first bound, `bands.length` at or above the last. */
export function classifySlope(pct: number, bandsPct: readonly number[]): number {
  let cls = 0;
  while (cls < bandsPct.length && pct >= bandsPct[cls]) cls++;
  return cls;
}

/** Slope class of every triangle; degenerate triangles count as flattest (they carry no area). */
export function slopeClasses(tin: TinSurface, bandsPct: readonly number[]): number[] {
  return tin.triangles.map((_, t) => {
    const g = triangleGradient(tin, t);
    return g ? classifySlope(slopePct(g.plane), bandsPct) : 0;
  });
}

/**
 * Area-weighted mean slope, steepest slope, and the direction the ground falls towards.
 * The direction is that of the area-weighted MEAN gradient — on a plot that rises east it points
 * west — and is `null` when that mean is flatter than {@link LISTING_TERRAIN_FLAT_GRADIENT_PCT}.
 */
export function summariseSlope(tin: TinSurface): SurfaceSlopeSummary {
  let area = 0;
  let weightedSlope = 0;
  let maxSlope = 0;
  let gx = 0;
  let gy = 0;
  for (let t = 0; t < tin.triangles.length; t++) {
    const g = triangleGradient(tin, t);
    if (!g) continue;
    const s = slopePct(g.plane);
    area += g.areaMm2;
    weightedSlope += s * g.areaMm2;
    maxSlope = Math.max(maxSlope, s);
    gx += g.plane.a * g.areaMm2;
    gy += g.plane.b * g.areaMm2;
  }
  if (area === 0) return { planAreaMm2: 0, meanSlopePct: 0, maxSlopePct: 0, downslopeAzimuthDeg: null };
  return {
    planAreaMm2: area,
    meanSlopePct: weightedSlope / area,
    maxSlopePct: maxSlope,
    downslopeAzimuthDeg: downslopeAzimuth(gx / area, gy / area),
  };
}

/** Azimuth (clockwise from north) of the DOWNHILL direction `−∇z`; `null` on flat ground. */
function downslopeAzimuth(gradX: number, gradY: number): number | null {
  if (Math.hypot(gradX, gradY) * 100 < LISTING_TERRAIN_FLAT_GRADIENT_PCT) return null;
  const deg = (Math.atan2(-gradX, -gradY) * 180) / Math.PI;
  return (deg + 360) % 360;
}
