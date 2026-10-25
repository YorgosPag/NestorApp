/**
 * ADR-920 Β4.8 Τ — the uniform grid `tin-breakline-resolve` uses to find, in near-linear time, which breakline segments
 * may cross and which vertices may lie on a segment. Testing every pair is O(n²) — on a survey with a few thousand
 * breakline segments and 10⁴ points that is the ~10⁸ tests the TIN sampler's grid exists to avoid (`tin-sampler.ts`).
 *
 * A segment is registered in every cell it passes through **dilated by one cell**: two segments that cross, or a vertex
 * that lies on a segment, always share a cell — also when the meeting point sits exactly on a cell border. The grid
 * only proposes candidates; the exact predicates in the resolver decide.
 */

import type { TinPosition } from './terrain-types';
import { planarBoundsOf } from './tin-vertex-accumulator';

/** Cap the grid so a pathological survey cannot allocate a huge index (same policy as `tin-sampler.ts`). */
const MAX_CELLS_PER_AXIS = 1024;

/** Degenerate extent guard (all points on one vertical/horizontal line). */
const MIN_CELL_SPAN = 1e-9;

export interface SegmentGrid {
  readonly minX: number;
  readonly minY: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly axis: number;
}

/** A grid sized to the vertex density (~1 vertex per cell). */
export function createSegmentGrid(positions: readonly TinPosition[]): SegmentGrid {
  const { minX, minY, maxX, maxY } = planarBoundsOf(positions);
  const axis = Math.min(MAX_CELLS_PER_AXIS, Math.max(1, Math.ceil(Math.sqrt(positions.length))));
  return {
    minX,
    minY,
    cellW: Math.max(maxX - minX, MIN_CELL_SPAN) / axis,
    cellH: Math.max(maxY - minY, MIN_CELL_SPAN) / axis,
    axis,
  };
}

function clampAxis(grid: SegmentGrid, value: number): number {
  return Math.min(grid.axis - 1, Math.max(0, value));
}

/** The cell index of a LOCAL position. */
export function cellOf(grid: SegmentGrid, x: number, y: number): number {
  const col = clampAxis(grid, Math.floor((x - grid.minX) / grid.cellW));
  const row = clampAxis(grid, Math.floor((y - grid.minY) / grid.cellH));
  return row * grid.axis + col;
}

function addDilated(grid: SegmentGrid, cell: number, out: Set<number>): void {
  const row = Math.floor(cell / grid.axis);
  const col = cell % grid.axis;
  for (let r = Math.max(0, row - 1); r <= Math.min(grid.axis - 1, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(grid.axis - 1, col + 1); c++) out.add(r * grid.axis + c);
  }
}

/**
 * Every cell the segment `p → q` passes through, dilated by one cell. Sampled at half-cell steps: a skipped corner cell
 * is always adjacent to a sampled one, so the dilation covers it.
 */
export function cellsAlongSegment(grid: SegmentGrid, p: TinPosition, q: TinPosition): number[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const steps = Math.ceil(2 * Math.max(Math.abs(dx) / grid.cellW, Math.abs(dy) / grid.cellH)) + 1;
  const cells = new Set<number>();
  let last = -1;
  for (let i = 0; i <= steps; i++) {
    const cell = cellOf(grid, p[0] + (dx * i) / steps, p[1] + (dy * i) / steps);
    if (cell !== last) addDilated(grid, cell, cells);
    last = cell;
  }
  return [...cells];
}
