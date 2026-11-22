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
 * Index: the shared triangle locator (`triangle-locator.ts` — extracted from here by ADR-920 Β6.8
 * so the listing map locates points with the SAME index). One query per vertex stays O(1)
 * amortised instead of quadratic on a real survey (10⁴ points → 10⁸ tests).
 */

import type { TinSurface } from './terrain-types';
import { createTriangleLocator } from './triangle-locator';

/** Answers the elevation question in WORLD canonical mm; `null` outside the surface. */
export interface TinSampler {
  readonly zAtMm: (worldXMm: number, worldYMm: number) => number | null;
}

/**
 * Identity-keyed memo of the built index. ADR-713 added per-ELEMENT sampling (one query per
 * column, per scene sync), so rebuilding the bucket grid on every call would be O(triangles)
 * × O(columns) — on a real survey that is the whole index rebuilt a hundred times for a single
 * redraw. The surfaces themselves are already memoised by definition identity (`topo-surface`),
 * so keying on the object is exact: a re-triangulated surface is a NEW object and misses.
 * `WeakMap` → a discarded surface takes its index with it, no manual invalidation to get wrong.
 */
const samplerMemo = new WeakMap<TinSurface, TinSampler>();

/**
 * The shared, memoised sampler for a surface. Prefer this over {@link createTinSampler} in any
 * path that samples more than once per surface (per-element queries, grid cross-checks).
 */
export function getTinSampler(tin: TinSurface): TinSampler {
  const cached = samplerMemo.get(tin);
  if (cached) return cached;
  const sampler = createTinSampler(tin);
  samplerMemo.set(tin, sampler);
  return sampler;
}

export function createTinSampler(tin: TinSurface): TinSampler {
  const locator = createTriangleLocator(tin.positions, tin.triangles);
  const zAtMm = (worldXMm: number, worldYMm: number): number | null => {
    // LOCAL frame — `positions` are world − origin (the CDT runs near 0,0 for ΕΓΣΑ'87).
    const hit = locator.locate(worldXMm - tin.origin.x, worldYMm - tin.origin.y);
    if (hit === null) return null;
    const [i, j, k] = tin.triangles[hit.triangle]!;
    return hit.wa * tin.elevations[i]! + hit.wb * tin.elevations[j]! + hit.wc * tin.elevations[k]!;
  };
  return { zAtMm };
}
