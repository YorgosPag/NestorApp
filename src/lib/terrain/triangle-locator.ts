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
 * 🔑 **Flat arrays, and a road with no allocation** (ADR-920 §14.12 Β3.1). The vertices of every triangle sit in one
 * `Float64Array` and the buckets in CSR (`Int32Array`): the elevation mosaic asks a quarter of a million times per tile,
 * and the first form (arrays of tuples, destructured per candidate) was measured at 0,26–0,58 µs per query. The
 * arithmetic of the weights is unchanged, operation for operation — every reader gets the numbers it always got.
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

/** A reusable hit, for a caller that asks many times (one tile of the elevation mosaic: once per pixel). */
export type TriangleHitSink = { -readonly [K in keyof TriangleHit]: TriangleHit[K] };

export function createTriangleHitSink(): TriangleHitSink {
  return { triangle: -1, wa: 0, wb: 0, wc: 0 };
}

export interface TriangleLocator {
  /** The triangle containing the point (edges included), or `null` outside the mesh. */
  readonly locate: (x: number, y: number) => TriangleHit | null;
  /** The same question, written into `sink`: `false` (and `sink` untouched) where {@link locate} answers `null`. */
  readonly locateInto: (sink: TriangleHitSink, x: number, y: number) => boolean;
}

/** Barycentric tolerance — a point exactly on a shared edge must belong to SOME triangle. */
const EPSILON = 1e-9;

/** Cap the grid so a pathological survey cannot allocate a huge index. */
const MAX_CELLS_PER_AXIS = 512;

const COORDS_PER_TRIANGLE = 6;

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

/** The index proper: the grid, `[ax, ay, bx, by, cx, cy]` per triangle, and the buckets in CSR, in mesh order. */
interface LocatorIndex extends Grid {
  readonly coords: Float64Array;
  /** The triangles of cell `c` are `items[starts[c] … starts[c + 1])`. */
  readonly starts: Int32Array;
  readonly items: Int32Array;
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

function coordsOf(xy: Plan, triangles: Triangles): Float64Array {
  const coords = new Float64Array(triangles.length * COORDS_PER_TRIANGLE);
  for (let t = 0; t < triangles.length; t++) {
    const triangle = triangles[t]!;
    for (let corner = 0; corner < 3; corner++) {
      const vertex = xy[triangle[corner]!]!;
      coords[t * COORDS_PER_TRIANGLE + 2 * corner] = vertex[0];
      coords[t * COORDS_PER_TRIANGLE + 2 * corner + 1] = vertex[1];
    }
  }
  return coords;
}

function bucketsOf(coords: Float64Array, grid: Grid): number[][] {
  const { axis, minX, minY, cellW, cellH } = grid;
  const clamp = (v: number): number => Math.min(axis - 1, Math.max(0, v));
  const buckets: number[][] = Array.from({ length: axis * axis }, () => []);
  for (let t = 0; t * COORDS_PER_TRIANGLE < coords.length; t++) {
    const o = t * COORDS_PER_TRIANGLE;
    const c0 = clamp(Math.floor((Math.min(coords[o]!, coords[o + 2]!, coords[o + 4]!) - minX) / cellW));
    const c1 = clamp(Math.floor((Math.max(coords[o]!, coords[o + 2]!, coords[o + 4]!) - minX) / cellW));
    const r0 = clamp(Math.floor((Math.min(coords[o + 1]!, coords[o + 3]!, coords[o + 5]!) - minY) / cellH));
    const r1 = clamp(Math.floor((Math.max(coords[o + 1]!, coords[o + 3]!, coords[o + 5]!) - minY) / cellH));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) buckets[r * axis + c]!.push(t);
    }
  }
  return buckets;
}

function indexOf(xy: Plan, triangles: Triangles): LocatorIndex {
  const grid = gridOf(xy, triangles.length);
  const coords = coordsOf(xy, triangles);
  const buckets = bucketsOf(coords, grid);
  const starts = new Int32Array(buckets.length + 1);
  buckets.forEach((bucket, cell) => { starts[cell + 1] = starts[cell]! + bucket.length; });
  const items = new Int32Array(starts[buckets.length]!);
  buckets.forEach((bucket, cell) => items.set(bucket, starts[cell]!));
  return { ...grid, coords, starts, items };
}

/**
 * Writes the barycentric weights of (x, y) in triangle `t` into `sink`; `false` when the point is outside it (or the
 * triangle is degenerate — a neighbour answers).
 */
function weightsInto(sink: TriangleHitSink, coords: Float64Array, t: number, x: number, y: number): boolean {
  const o = t * COORDS_PER_TRIANGLE;
  const ax = coords[o]!; const ay = coords[o + 1]!;
  const bx = coords[o + 2]!; const by = coords[o + 3]!;
  const cx = coords[o + 4]!; const cy = coords[o + 5]!;
  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denominator) < EPSILON) return false;
  const wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
  const wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
  const wc = 1 - wa - wb;
  if (wa < -EPSILON || wb < -EPSILON || wc < -EPSILON) return false;
  sink.triangle = t; sink.wa = wa; sink.wb = wb; sink.wc = wc;
  return true;
}

/** The locator of a planar triangle mesh (`xy[i]` = vertex plan position, `triangles[t]` = vertex indices). */
export function createTriangleLocator(xy: Plan, triangles: Triangles): TriangleLocator {
  if (triangles.length === 0) return { locate: () => null, locateInto: () => false };
  const { minX, minY, maxX, maxY, axis, cellW, cellH, coords, starts, items } = indexOf(xy, triangles);
  const locateInto = (sink: TriangleHitSink, x: number, y: number): boolean => {
    if (x < minX - EPSILON || x > maxX + EPSILON) return false;
    if (y < minY - EPSILON || y > maxY + EPSILON) return false;
    const col = Math.min(axis - 1, Math.max(0, Math.floor((x - minX) / cellW)));
    const row = Math.min(axis - 1, Math.max(0, Math.floor((y - minY) / cellH)));
    const cell = row * axis + col;
    for (let at = starts[cell]!; at < starts[cell + 1]!; at++) {
      if (weightsInto(sink, coords, items[at]!, x, y)) return true;
    }
    return false;
  };
  const locate = (x: number, y: number): TriangleHit | null => {
    const sink = createTriangleHitSink();
    return locateInto(sink, x, y) ? sink : null;
  };
  return { locate, locateInto };
}
