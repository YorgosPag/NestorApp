/**
 * ADR-650 M6 — «what is the elevation of this surface at (x, y)?».
 *
 * The one primitive both new consumers need: the volume engine (to read the PROPOSED ground
 * at the existing ground's vertices) and the grid cross-check (to read either ground on a
 * regular lattice). Civil 3D exposes the same operation as «Surface → elevation at point».
 *
 * Exact, not approximate: a TIN is piecewise LINEAR, so the elevation inside a triangle is
 * the barycentric blend of its three vertex elevations. No smoothing, no IDW — sampling the
 * surface must return exactly what the surface IS, or the volumes stop matching the contours.
 *
 * Outside the triangulated area the answer is `null`, never 0 and never an extrapolation:
 * «I have no ground here» and «the ground is at zero» are different facts, and silently
 * conflating them is precisely how a volume report ends up wrong by a whole excavation.
 *
 * Index: a uniform grid of triangle buckets (~1 triangle per cell). A linear scan would be
 * O(triangles) per query and the engine issues one query per vertex — quadratic on a real
 * survey (10⁴ points → 10⁸ tests). The grid makes each query O(1) amortised.
 */

import type { TinSurface } from './topo-types';

/** Answers the elevation question in WORLD canonical mm; `null` outside the surface. */
export interface TinSampler {
  readonly zAtMm: (worldXMm: number, worldYMm: number) => number | null;
}

/** Barycentric tolerance — a point exactly on a shared edge must belong to SOME triangle. */
const EPSILON = 1e-9;

/** Cap the grid so a pathological survey cannot allocate a huge index. */
const MAX_CELLS_PER_AXIS = 512;

export function createTinSampler(tin: TinSurface): TinSampler {
  if (tin.triangles.length === 0) return { zAtMm: () => null };

  const { bounds, origin } = tin;
  const minX = bounds.minX;
  const minY = bounds.minY;
  const width = Math.max(bounds.maxX - minX, EPSILON);
  const height = Math.max(bounds.maxY - minY, EPSILON);

  const axis = Math.min(
    MAX_CELLS_PER_AXIS,
    Math.max(1, Math.ceil(Math.sqrt(tin.triangles.length))),
  );
  const cellW = width / axis;
  const cellH = height / axis;

  const buckets: number[][] = Array.from({ length: axis * axis }, () => []);
  const clampCol = (v: number): number => Math.min(axis - 1, Math.max(0, v));

  for (let t = 0; t < tin.triangles.length; t++) {
    const [i, j, k] = tin.triangles[t]!;
    const xs = [tin.positions[i]![0], tin.positions[j]![0], tin.positions[k]![0]];
    const ys = [tin.positions[i]![1], tin.positions[j]![1], tin.positions[k]![1]];
    const c0 = clampCol(Math.floor((Math.min(...xs) - minX) / cellW));
    const c1 = clampCol(Math.floor((Math.max(...xs) - minX) / cellW));
    const r0 = clampCol(Math.floor((Math.min(...ys) - minY) / cellH));
    const r1 = clampCol(Math.floor((Math.max(...ys) - minY) / cellH));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) buckets[r * axis + c]!.push(t);
    }
  }

  const zAtMm = (worldXMm: number, worldYMm: number): number | null => {
    // LOCAL frame — `positions` are world − origin (the CDT runs near 0,0 for ΕΓΣΑ'87).
    const x = worldXMm - origin.x;
    const y = worldYMm - origin.y;
    if (x < minX - EPSILON || x > bounds.maxX + EPSILON) return null;
    if (y < minY - EPSILON || y > bounds.maxY + EPSILON) return null;

    const col = clampCol(Math.floor((x - minX) / cellW));
    const row = clampCol(Math.floor((y - minY) / cellH));
    for (const t of buckets[row * axis + col]!) {
      const z = sampleTriangle(tin, t, x, y);
      if (z !== null) return z;
    }
    return null;
  };

  return { zAtMm };
}

/** Barycentric elevation inside triangle `t` at LOCAL (x, y), or `null` when outside it. */
function sampleTriangle(tin: TinSurface, t: number, x: number, y: number): number | null {
  const [i, j, k] = tin.triangles[t]!;
  const [ax, ay] = tin.positions[i]!;
  const [bx, by] = tin.positions[j]!;
  const [cx, cy] = tin.positions[k]!;

  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denominator) < EPSILON) return null; // degenerate sliver — let a neighbour answer

  const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
  const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
  const wc = 1 - wa - wb;
  if (wa < -EPSILON || wb < -EPSILON || wc < -EPSILON) return null;

  return wa * tin.elevations[i]! + wb * tin.elevations[j]! + wc * tin.elevations[k]!;
}
