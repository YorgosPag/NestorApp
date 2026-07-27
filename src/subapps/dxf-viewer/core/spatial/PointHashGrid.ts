/**
 * 🏢 POINT HASH GRID — uniform spatial hash over BARE 2D COORDINATES.
 *
 * ## Why this exists next to `ISpatialIndex` (they are NOT the same abstraction)
 * `GridSpatialIndex` / `QuadTreeSpatialIndex` index **items**: every entry needs an `id`
 * and a `bounds` box, and the shared query algebra in `BaseSpatialIndex` ranks, sorts and
 * slices `SpatialQueryResult[]`. That is exactly right for hit-testing and snapping, where
 * the answer is "which entity, and how close".
 *
 * This class indexes **coordinates**: no id, no box, no result objects. The question is
 * "is there a point within τ of (x, y), and which one" — asked hundreds of thousands of
 * times inside a matching loop. Forcing that through `SpatialItem` would mean inventing a
 * fake id and a degenerate bounds per point (2 allocations each), then paying a sort+slice
 * and two `performance.now()` calls per query for a single-nearest answer.
 *
 * ## Why it is centralized rather than local to its first caller
 * ADR-650 §M10e SSoT audit found the SAME tolerance-keyed uniform grid hand-rolled in
 * FIVE places (`check-duplicate-points`, `broad-phase`, `IntersectionSnapEngine`,
 * `pointcloud/csf-grid`, plus `GridSpatialIndex` itself). Writing a sixth for geo-matching
 * is precisely the sibling-clone that N.18/jscpd exists to stop — so the primitive lives
 * here, in the canonical spatial folder, where the next author will find it.
 *
 * ## Deterministic
 * Zero randomness, zero time, zero float accumulation: identical input ⇒ identical output,
 * ordering included. A matching result must never change between two clicks.
 *
 * @see ./ISpatialIndex.ts — the item-indexing abstraction (different question)
 * @see ../../systems/geo-referencing/geo-point-index.ts — the M10e scorer built on this
 */

import type { Point2D } from '../../rendering/types/Types';

/** Returned by {@link PointHashGrid.nearestWithin} when nothing is inside the radius. */
export const NO_POINT = -1;

/**
 * Uniform hash over 2D points at a caller-chosen cell size.
 *
 * Cell size should be the query radius (or a small multiple): each lookup then scans the
 * 3×3 cell neighbourhood, which is guaranteed to contain every point within that radius.
 * Much smaller ⇒ the 3×3 window no longer covers the radius (WRONG answers, not just slow);
 * much larger ⇒ each cell holds many points and the scan degrades toward linear.
 *
 * Keys are NESTED numeric maps (`col → row → indices`), not `\`${col}:${row}\`` strings:
 * the string form allocates a fresh key on every one of the nine probes per query, which is
 * the dominant cost once queries are in the 10⁵ range.
 */
export class PointHashGrid {
  private readonly cells = new Map<number, Map<number, number[]>>();
  private readonly points: readonly Point2D[];
  private readonly cellSize: number;

  /**
   * @param points    the indexed set; indices returned by queries refer to THIS array
   * @param cellSize  cell edge in the same units as `points` (must be > 0)
   */
  constructor(points: readonly Point2D[], cellSize: number) {
    this.points = points;
    // A non-positive cell size would make every coordinate hash to ±Infinity and silently
    // return "no neighbours ever". Fail loudly at construction instead.
    if (!(cellSize > 0) || !Number.isFinite(cellSize)) {
      throw new Error(`PointHashGrid: cellSize must be a positive finite number (got ${cellSize})`);
    }
    this.cellSize = cellSize;

    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      // Non-finite coordinates would poison the hash; skip them rather than corrupt the index.
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      this.add(Math.floor(p.x / cellSize), Math.floor(p.y / cellSize), i);
    }
  }

  /** How many points were actually indexed (excludes any non-finite input). */
  get size(): number {
    let n = 0;
    for (const row of this.cells.values()) for (const bucket of row.values()) n += bucket.length;
    return n;
  }

  private add(col: number, row: number, index: number): void {
    let rowMap = this.cells.get(col);
    if (!rowMap) {
      rowMap = new Map<number, number[]>();
      this.cells.set(col, rowMap);
    }
    const bucket = rowMap.get(row);
    if (bucket) bucket.push(index);
    else rowMap.set(row, [index]);
  }

  /**
   * Visit every indexed point within `radius` of `(x, y)`, in ascending index order per cell.
   * Allocation-free — the hot path. `visit` receives the index and its SQUARED distance
   * (squared so neither side needs a `sqrt` it may not use).
   */
  forEachWithin(x: number, y: number, radius: number, visit: (index: number, distSq: number) => void): void {
    const r2 = radius * radius;
    const span = Math.ceil(radius / this.cellSize);
    const col0 = Math.floor(x / this.cellSize);
    const row0 = Math.floor(y / this.cellSize);

    for (let dc = -span; dc <= span; dc++) {
      const rowMap = this.cells.get(col0 + dc);
      if (!rowMap) continue;
      for (let dr = -span; dr <= span; dr++) {
        const bucket = rowMap.get(row0 + dr);
        if (!bucket) continue;
        for (const i of bucket) {
          const p = this.points[i]!;
          const dx = p.x - x;
          const dy = p.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) visit(i, d2);
        }
      }
    }
  }

  /**
   * Index of the CLOSEST indexed point within `radius` of `(x, y)`, or {@link NO_POINT}.
   *
   * Ties (two points at the identical distance) resolve to the LOWER index — deterministic,
   * so a degenerate/symmetric input cannot flip the answer between runs.
   *
   * Returns only the index: the caller already holds the point array and can derive the
   * distance if it needs one, which keeps this allocation-free inside a matching loop.
   */
  nearestWithin(x: number, y: number, radius: number): number {
    let best = NO_POINT;
    let bestD2 = Infinity;
    this.forEachWithin(x, y, radius, (i, d2) => {
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    });
    return best;
  }

  /** Indices of every indexed point within `radius`, nearest first. Allocates — not for hot loops. */
  within(x: number, y: number, radius: number): number[] {
    const found: Array<{ i: number; d2: number }> = [];
    this.forEachWithin(x, y, radius, (i, d2) => found.push({ i, d2 }));
    // Index as the tie-breaker keeps the order deterministic for coincident points.
    found.sort((a, b) => (a.d2 - b.d2) || (a.i - b.i));
    return found.map((f) => f.i);
  }
}
