/**
 * ADR-429 — MEP Routing Brain: orthogonal A* pathfinder (pure, SSoT).
 *
 * Finds the shortest **axis-aligned** path from `start` to `end` that does not pass through
 * the interior of any wall obstacle. Used by `route-wall-aware.ts` to detour a single Manhattan
 * run around walls; the returned polyline starts EXACTLY at `start`, ends EXACTLY at `end`, and
 * every edge is horizontal or vertical (Revit MEP convention — 4-way, no diagonals).
 *
 * The grid is a lightweight **Hanan grid**: candidate x/y lines = the two endpoints' coords +
 * every inflated-obstacle edge inside the local window + uniform `cell` steps across that window.
 * Because both endpoints and all obstacle faces are grid lines, the search threads gaps between
 * walls that a fixed uniform grid would miss, while staying small (a few dozen lines per axis).
 *
 * Returns `null` when no path fits the local window or a performance guard trips — the caller
 * then keeps the run straight (Manhattan fallback ⇒ zero behavioural change). Pure + deterministic.
 *
 * @see ./route-wall-aware.ts (consumer) · ./wall-obstacles.ts (segmentHitsObstacles, pointInRect)
 * @see ./routing-constants.ts (cell size, margins, perf caps)
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  ASTAR_CELL_SCENE,
  ASTAR_LOCAL_MARGIN_SCENE,
  ASTAR_MAX_CELLS,
  ASTAR_MAX_ITERATIONS,
  type Rect2D,
} from './routing-constants';
import { pointInRect, segmentHitsObstacles } from './wall-obstacles';

export interface AStarOptions {
  readonly cell?: number;
  readonly localMargin?: number;
  readonly maxCells?: number;
  readonly maxIterations?: number;
}

const COORD_EPS = 1e-6;

/** Sorted unique coordinate lines: the two anchors + uniform steps across [lo,hi] + extras. */
function buildLines(
  anchorA: number,
  anchorB: number,
  lo: number,
  hi: number,
  cell: number,
  extras: readonly number[],
): number[] {
  const set = new Set<number>([anchorA, anchorB]);
  for (let x = lo; x <= hi + COORD_EPS; x += cell) set.add(Math.round(x * 1e3) / 1e3);
  for (const e of extras) if (e >= lo - COORD_EPS && e <= hi + COORD_EPS) set.add(e);
  return [...set].sort((a, b) => a - b);
}

/** Index of the line equal to `value` (anchors are always present ⇒ found). */
function lineIndex(lines: readonly number[], value: number): number {
  for (let i = 0; i < lines.length; i++) if (Math.abs(lines[i] - value) < COORD_EPS) return i;
  return -1;
}

/** Obstacle edges (within the local window) seed Hanan grid lines so paths hug wall faces. */
function obstacleEdges(obstacles: readonly Rect2D[], axis: 'x' | 'y'): number[] {
  const out: number[] = [];
  for (const r of obstacles) {
    if (axis === 'x') out.push(r.minX, r.maxX);
    else out.push(r.minY, r.maxY);
  }
  return out;
}

// ─── Binary min-heap keyed by f-score (Google-level: O(log n) pops, not O(n) scans) ─────────
class MinHeap {
  private readonly nodes: number[] = [];
  private readonly fs: number[] = [];
  get size(): number {
    return this.nodes.length;
  }
  push(node: number, f: number): void {
    this.nodes.push(node);
    this.fs.push(f);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.fs[p] <= this.fs[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.nodes[0];
    const lastNode = this.nodes.pop() as number;
    const lastF = this.fs.pop() as number;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.fs[0] = lastF;
      this.sinkDown(0);
    }
    return top;
  }
  private sinkDown(start: number): void {
    const n = this.nodes.length;
    let i = start;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let small = i;
      if (l < n && this.fs[l] < this.fs[small]) small = l;
      if (r < n && this.fs[r] < this.fs[small]) small = r;
      if (small === i) break;
      this.swap(i, small);
      i = small;
    }
  }
  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    [this.fs[a], this.fs[b]] = [this.fs[b], this.fs[a]];
  }
}

/** Drop redundant interior points of a polyline: keep endpoints + turn vertices only. */
function simplifyCollinear(pts: readonly Point2D[]): Point2D[] {
  if (pts.length <= 2) return [...pts];
  const out: Point2D[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) > COORD_EPS) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

interface Grid {
  readonly xs: readonly number[];
  readonly ys: readonly number[];
  readonly obstacles: readonly Rect2D[];
}

/** World point of grid node (ix,iy). */
function nodePoint(grid: Grid, ix: number, iy: number): Point2D {
  return { x: grid.xs[ix], y: grid.ys[iy] };
}

/** Run A* over the Hanan grid; returns the node-index path (start→end) or null. */
function searchGrid(
  grid: Grid,
  startNode: number,
  endNode: number,
  cols: number,
  total: number,
  maxIterations: number,
): Int32Array | null {
  const g = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const endX = endNode % cols;
  const endY = (endNode / cols) | 0;
  const heur = (n: number): number =>
    Math.abs(grid.xs[n % cols] - grid.xs[endX]) + Math.abs(grid.ys[(n / cols) | 0] - grid.ys[endY]);
  g[startNode] = 0;
  const open = new MinHeap();
  open.push(startNode, heur(startNode));
  let iterations = 0;
  while (open.size > 0) {
    if (++iterations > maxIterations) return null;
    const current = open.pop();
    if (current === endNode) return cameFrom;
    if (closed[current]) continue;
    closed[current] = 1;
    const ix = current % cols;
    const iy = (current / cols) | 0;
    const here = nodePoint(grid, ix, iy);
    const neighbours: ReadonlyArray<readonly [number, number]> = [
      [ix - 1, iy], [ix + 1, iy], [ix, iy - 1], [ix, iy + 1],
    ];
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= grid.ys.length) continue;
      const next = ny * cols + nx;
      if (closed[next]) continue;
      const there = nodePoint(grid, nx, ny);
      if (segmentHitsObstacles(here, there, grid.obstacles)) continue;
      const tentative = g[current] + Math.abs(there.x - here.x) + Math.abs(there.y - here.y);
      if (tentative < g[next] - COORD_EPS) {
        g[next] = tentative;
        cameFrom[next] = current;
        open.push(next, tentative + heur(next));
      }
    }
  }
  return null;
}

/**
 * Shortest orthogonal path `start → end` avoiding wall interiors, or `null` to fall back to a
 * straight run. The wall hosting either endpoint is ignored (you don't route around the wall
 * your own fixture sits on — Revit behaviour, and it prevents an embedded connector from
 * blocking its own exit). All coordinates are scene units.
 */
export function findOrthogonalPath(
  start: Point2D,
  end: Point2D,
  obstacles: readonly Rect2D[],
  opts: AStarOptions = {},
): Point2D[] | null {
  const cell = opts.cell ?? ASTAR_CELL_SCENE;
  const margin = opts.localMargin ?? ASTAR_LOCAL_MARGIN_SCENE;
  const maxCells = opts.maxCells ?? ASTAR_MAX_CELLS;
  const maxIterations = opts.maxIterations ?? ASTAR_MAX_ITERATIONS;
  const active = obstacles.filter(
    (r) => !pointInRect(start.x, start.y, r) && !pointInRect(end.x, end.y, r),
  );
  if (active.length === 0) return [start, end];
  const loX = Math.min(start.x, end.x) - margin;
  const hiX = Math.max(start.x, end.x) + margin;
  const loY = Math.min(start.y, end.y) - margin;
  const hiY = Math.max(start.y, end.y) + margin;
  const xs = buildLines(start.x, end.x, loX, hiX, cell, obstacleEdges(active, 'x'));
  const ys = buildLines(start.y, end.y, loY, hiY, cell, obstacleEdges(active, 'y'));
  const cols = xs.length;
  const total = cols * ys.length;
  if (total > maxCells) return null;
  const grid: Grid = { xs, ys, obstacles: active };
  const startNode = lineIndex(ys, start.y) * cols + lineIndex(xs, start.x);
  const endNode = lineIndex(ys, end.y) * cols + lineIndex(xs, end.x);
  const cameFrom = searchGrid(grid, startNode, endNode, cols, total, maxIterations);
  if (!cameFrom) return null;
  const path: Point2D[] = [];
  for (let n = endNode; n !== -1; n = cameFrom[n]) {
    path.push(nodePoint(grid, n % cols, (n / cols) | 0));
    if (n === startNode) break;
  }
  path.reverse();
  return simplifyCollinear(path);
}
