/**
 * ADR-650 M6 / ADR-920 Β6.8 — «which triangle of this mesh holds (x, y)?», with its barycentric weights. Pure.
 *
 * Extracted from `tin-sampler.ts` (which now asks it) so that the listing's 2D map can locate a point on the PUBLISHED
 * mesh (metres, snapshot frame) with the SAME index the volume engine uses on the surveyor's TIN (mm, local frame).
 * Unit-agnostic: the caller's plan coordinates in, the caller's plan coordinates out.
 *
 * Index: a uniform grid of triangle buckets (~1 triangle per cell). A linear scan would be O(triangles) per query —
 * quadratic on a real survey. The grid makes each query O(1) amortised.
 *
 * @module lib/terrain/triangle-locator
 */

/** A triangle hit: its index and the barycentric weights of its three vertices (they sum to 1). */
export interface TriangleHit {
  readonly triangle: number;
  readonly wa: number;
  readonly wb: number;
  readonly wc: number;
}

export interface TriangleLocator {
  /** The triangle containing the point (edges included), or `null` outside the mesh. */
  readonly locate: (x: number, y: number) => TriangleHit | null;
}

/** Barycentric tolerance — a point exactly on a shared edge must belong to SOME triangle. */
const EPSILON = 1e-9;

/** Cap the grid so a pathological survey cannot allocate a huge index. */
const MAX_CELLS_PER_AXIS = 512;

type Plan = ReadonlyArray<readonly [number, number]>;
type Triangles = ReadonlyArray<readonly [number, number, number]>;

interface Grid {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly axis: number;
  readonly cellW: number;
  readonly cellH: number;
}

function gridOf(xy: Plan, triangleCount: number): Grid {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of xy) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const axis = Math.min(MAX_CELLS_PER_AXIS, Math.max(1, Math.ceil(Math.sqrt(triangleCount))));
  return {
    minX, minY, maxX, maxY, axis,
    cellW: Math.max(maxX - minX, EPSILON) / axis,
    cellH: Math.max(maxY - minY, EPSILON) / axis,
  };
}

function bucketsOf(xy: Plan, triangles: Triangles, grid: Grid): number[][] {
  const { axis, minX, minY, cellW, cellH } = grid;
  const clamp = (v: number): number => Math.min(axis - 1, Math.max(0, v));
  const buckets: number[][] = Array.from({ length: axis * axis }, () => []);
  for (let t = 0; t < triangles.length; t++) {
    const [i, j, k] = triangles[t]!;
    const xs = [xy[i]![0], xy[j]![0], xy[k]![0]];
    const ys = [xy[i]![1], xy[j]![1], xy[k]![1]];
    const c0 = clamp(Math.floor((Math.min(...xs) - minX) / cellW));
    const c1 = clamp(Math.floor((Math.max(...xs) - minX) / cellW));
    const r0 = clamp(Math.floor((Math.min(...ys) - minY) / cellH));
    const r1 = clamp(Math.floor((Math.max(...ys) - minY) / cellH));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) buckets[r * axis + c]!.push(t);
    }
  }
  return buckets;
}

/** Barycentric weights of (x, y) in triangle `t`, or `null` when outside it (or degenerate — a neighbour answers). */
function weightsIn(xy: Plan, triangles: Triangles, t: number, x: number, y: number): TriangleHit | null {
  const [i, j, k] = triangles[t]!;
  const [ax, ay] = xy[i]!;
  const [bx, by] = xy[j]!;
  const [cx, cy] = xy[k]!;
  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denominator) < EPSILON) return null;
  const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
  const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
  const wc = 1 - wa - wb;
  if (wa < -EPSILON || wb < -EPSILON || wc < -EPSILON) return null;
  return { triangle: t, wa, wb, wc };
}

/** The locator of a planar triangle mesh (`xy[i]` = vertex plan position, `triangles[t]` = vertex indices). */
export function createTriangleLocator(xy: Plan, triangles: Triangles): TriangleLocator {
  if (triangles.length === 0) return { locate: () => null };
  const grid = gridOf(xy, triangles.length);
  const buckets = bucketsOf(xy, triangles, grid);
  const clamp = (v: number): number => Math.min(grid.axis - 1, Math.max(0, v));
  const locate = (x: number, y: number): TriangleHit | null => {
    if (x < grid.minX - EPSILON || x > grid.maxX + EPSILON) return null;
    if (y < grid.minY - EPSILON || y > grid.maxY + EPSILON) return null;
    const col = clamp(Math.floor((x - grid.minX) / grid.cellW));
    const row = clamp(Math.floor((y - grid.minY) / grid.cellH));
    for (const t of buckets[row * grid.axis + col]!) {
      const hit = weightsIn(xy, triangles, t, x, y);
      if (hit !== null) return hit;
    }
    return null;
  };
  return { locate };
}
