/**
 * ADR-650 M8α — Voxel decimation: millions of ground points → a survey-grade point set.
 *
 * The TIN must never see the raw cloud. `cdt2d` on 20M points is not a slow triangulation, it is a
 * dead tab — and it would be pointless: a 0.5 m DTM does not get more accurate from 200 returns
 * per square metre, it just gets 200× heavier. So we do exactly what Civil 3D's «Point Cloud to
 * Surface» and PDAL's `filters.sample` do: bucket the ground points on a planimetric grid and keep
 * ONE representative per occupied cell.
 *
 *   `lowest` (default) — the minimum-Z point of the cell. Conservative and survey-defensible:
 *                        whatever noise survived the ground filter is almost always ABOVE the true
 *                        surface (a missed shrub, a kerb, a parked car), essentially never below.
 *   `mean`             — the cell centroid. Smoother, better on genuinely noisy photogrammetry.
 *
 * OUTPUT FRAME: `TopoPoint[]` in WORLD mm (x/y re-projected through `origin`, z untouched) —
 * because these go straight into `setTopoPoints`, and the store's contract is world (topo-types).
 */

import type { TopoPoint } from '../topo-types';
import type { DecimateResult, PointCloudData, VoxelDecimateOptions } from './pointcloud-types';

/** i18n KEY (N.11) — a non-positive voxel cell size. */
export const VOXEL_ERROR_INVALID_CELL_SIZE = 'topography.pointcloud.error.invalidCellSize';

/** Running sum of one cell, for the `mean` representative. One object per CELL, never per point. */
interface CellSum {
  sumX: number;
  sumY: number;
  sumZ: number;
  count: number;
}

/**
 * Thin `groundIndices` of `data` down to one point per voxel cell.
 *
 * Deterministic: cells are emitted in ascending key order (row-major), and `lowest` breaks Z ties
 * on the lower point index. Same cloud in ⇒ byte-identical point list out, every time.
 *
 * @throws Error with an i18n KEY when `cellSizeMm` is not positive.
 */
export function voxelDecimate(
  data: PointCloudData,
  groundIndices: Uint32Array,
  opts: VoxelDecimateOptions,
): DecimateResult {
  if (!(opts.cellSizeMm > 0)) throw new Error(VOXEL_ERROR_INVALID_CELL_SIZE);
  if (groundIndices.length === 0) {
    return { points: [], inputCount: 0, cellsOccupied: 0 };
  }

  const grid = makeGridSpec(data, opts.cellSizeMm);
  const points =
    opts.representative === 'mean'
      ? decimateMean(data, groundIndices, grid)
      : decimateLowest(data, groundIndices, grid);

  return { points, inputCount: groundIndices.length, cellsOccupied: points.length };
}

interface GridSpec {
  /** LOCAL mm of the grid's lower-left corner. */
  readonly x0: number;
  readonly y0: number;
  readonly cellSizeMm: number;
  readonly cols: number;
  readonly origin: PointCloudData['origin'];
}

function makeGridSpec(data: PointCloudData, cellSizeMm: number): GridSpec {
  const x0 = data.bounds.minX - data.origin.x;
  const y0 = data.bounds.minY - data.origin.y;
  const spanX = data.bounds.maxX - data.bounds.minX;
  const cols = Math.floor(spanX / cellSizeMm) + 1;
  return { x0, y0, cellSizeMm, cols, origin: data.origin };
}

/**
 * Integer cell key — `row * cols + col`, NOT a template string. A string key on 20M points costs
 * 20M string allocations plus hashing; the numeric key is a plain double and the Map stays fast.
 * Ascending key order is row-major order, which is what gives us the deterministic output order.
 */
function cellKey(data: PointCloudData, i: number, grid: GridSpec): number {
  const col = Math.max(0, Math.floor((data.x[i] - grid.x0) / grid.cellSizeMm));
  const row = Math.max(0, Math.floor((data.y[i] - grid.y0) / grid.cellSizeMm));
  return row * grid.cols + col;
}

function decimateLowest(
  data: PointCloudData,
  groundIndices: Uint32Array,
  grid: GridSpec,
): TopoPoint[] {
  const winners = new Map<number, number>(); // cellKey → point index with the lowest Z
  for (let k = 0; k < groundIndices.length; k++) {
    const i = groundIndices[k];
    const key = cellKey(data, i, grid);
    const held = winners.get(key);
    if (held === undefined || data.z[i] < data.z[held]) winners.set(key, i);
  }

  return sortedEntries(winners).map(([, i]) =>
    toWorldPoint(data.x[i], data.y[i], data.z[i], grid.origin),
  );
}

function decimateMean(
  data: PointCloudData,
  groundIndices: Uint32Array,
  grid: GridSpec,
): TopoPoint[] {
  const sums = new Map<number, CellSum>();
  for (let k = 0; k < groundIndices.length; k++) {
    const i = groundIndices[k];
    const key = cellKey(data, i, grid);
    const held = sums.get(key);
    if (held === undefined) {
      sums.set(key, { sumX: data.x[i], sumY: data.y[i], sumZ: data.z[i], count: 1 });
    } else {
      held.sumX += data.x[i];
      held.sumY += data.y[i];
      held.sumZ += data.z[i];
      held.count += 1;
    }
  }

  return sortedEntries(sums).map(([, cell]) => {
    const n = cell.count;
    return toWorldPoint(cell.sumX / n, cell.sumY / n, cell.sumZ / n, grid.origin);
  });
}

/** Sorted numerically — `Array.sort()`'s default is LEXICOGRAPHIC and would scramble the order. */
function sortedEntries<T>(cells: ReadonlyMap<number, T>): Array<[number, T]> {
  return [...cells.entries()].sort((a, b) => a[0] - b[0]);
}

/** LOCAL → WORLD. Elevation is already world (mirrors `TinSurface.elevations`) — never offset it. */
function toWorldPoint(
  xLocal: number,
  yLocal: number,
  zWorld: number,
  origin: PointCloudData['origin'],
): TopoPoint {
  return { x: xLocal + origin.x, y: yLocal + origin.y, z: zWorld };
}
