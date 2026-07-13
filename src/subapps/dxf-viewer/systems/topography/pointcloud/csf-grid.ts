/**
 * ADR-650 M8α — CSF cloth grid + terrain height map (the «IHV» of Zhang et al. 2016).
 *
 * Split out of `csf-cloth.ts` purely for the 500-line rule: this file owns the STATIC side of the
 * Cloth Simulation Filter (where the particles sit, what terrain height each of them will collide
 * against, how to sample the settled cloth), while `csf-cloth.ts` owns the DYNAMIC side (the
 * simulation loop). Nothing here mutates the point cloud.
 *
 * ⚠️ FRAME — everything in this file is in the CLOTH frame:
 *   - planimetric x/y are LOCAL mm (same frame as `PointCloudData.x/y`),
 *   - heights are INVERTED world mm (`z' = −z`). The CSF paper turns the cloud upside-down and
 *     drops the cloth onto it from above; every height in this file already lives in that
 *     inverted space. Callers convert back with `realZ = −z'`.
 *
 * PERFORMANCE — the grid is `bounds / clothResolutionMm`, NOT `count`. A 2 km site at a 0.5 m
 * cloth is 4000² = 16M... which is why `CSF_MAX_CLOTH_PARTICLES` exists and this file throws.
 * Point count only ever costs us ONE linear pass (the rasterisation below). No k-d tree, no
 * per-point allocation — exactly the property that makes CSF usable on 30M points.
 */

import { clamp01 } from '../../../utils/scalar-math';
import { CSF_MAX_CLOTH_PARTICLES } from './pointcloud-defaults';
import type { PointCloudData } from './pointcloud-types';

/** i18n KEY (N.11) — the cloth resolution asks for more particles than we allow. */
export const CSF_ERROR_CLOTH_TOO_FINE = 'topography.pointcloud.error.clothTooFine';
/** i18n KEY (N.11) — a non-positive cloth resolution (programming / bad wizard input). */
export const CSF_ERROR_INVALID_RESOLUTION = 'topography.pointcloud.error.invalidClothResolution';

/**
 * Empty margin (in cells) added around the cloud on every side. The cloth must overhang the data,
 * otherwise the border particles have no terrain to collide with on one side and the springs drag
 * the whole edge of the cloth downwards.
 */
const CLOTH_PADDING_CELLS = 2;

/** The settled-cloth lattice. Immutable: the simulation writes into its OWN height array. */
export interface ClothGrid {
  readonly cols: number;
  readonly rows: number;
  /** LOCAL mm of column 0 / row 0. */
  readonly x0: number;
  readonly y0: number;
  readonly resolutionMm: number;
  /**
   * Intersection Height Value per particle, INVERTED mm — the height of the nearest cloud point.
   * The cloth may never fall below this: it is the terrain, seen upside-down.
   */
  readonly ihv: Float32Array;
  /** Highest INVERTED height in the cloud (= −minZ). The cloth starts above this. */
  readonly maxInvertedZ: number;
}

/**
 * Build the cloth lattice and its height map.
 *
 * The height map is a nearest-neighbour lookup done the cheap way: every point is rasterised onto
 * the particle it rounds to, keeping the planimetrically CLOSEST point per particle (ties resolved
 * by lower index → deterministic). Particles that no point rounds to are then filled by a BFS from
 * their filled neighbours, so the map is total even over gaps in the cloud.
 *
 * @throws Error with an i18n KEY (never a message) when the cloth would be too fine.
 */
export function buildClothGrid(data: PointCloudData, resolutionMm: number): ClothGrid {
  if (!(resolutionMm > 0)) throw new Error(CSF_ERROR_INVALID_RESOLUTION);

  const pad = CLOTH_PADDING_CELLS * resolutionMm;
  const minX = data.bounds.minX - data.origin.x - pad;
  const minY = data.bounds.minY - data.origin.y - pad;
  const spanX = data.bounds.maxX - data.bounds.minX + 2 * pad;
  const spanY = data.bounds.maxY - data.bounds.minY + 2 * pad;

  const cols = Math.floor(spanX / resolutionMm) + 1;
  const rows = Math.floor(spanY / resolutionMm) + 1;
  if (cols * rows > CSF_MAX_CLOTH_PARTICLES) throw new Error(CSF_ERROR_CLOTH_TOO_FINE);

  const ihv = new Float32Array(cols * rows);
  const filled = rasterizeNearest(data, { cols, rows, x0: minX, y0: minY, res: resolutionMm }, ihv);
  fillGaps(cols, rows, ihv, filled);

  return { cols, rows, x0: minX, y0: minY, resolutionMm, ihv, maxInvertedZ: -data.bounds.minZ };
}

interface RasterSpec {
  readonly cols: number;
  readonly rows: number;
  readonly x0: number;
  readonly y0: number;
  readonly res: number;
}

/** One linear pass over the cloud. Writes the nearest point's inverted height into `ihv`. */
function rasterizeNearest(data: PointCloudData, spec: RasterSpec, ihv: Float32Array): Uint8Array {
  const filled = new Uint8Array(spec.cols * spec.rows);
  const bestDistSq = new Float32Array(spec.cols * spec.rows).fill(Number.POSITIVE_INFINITY);

  for (let i = 0; i < data.count; i++) {
    const px = data.x[i];
    const py = data.y[i];
    const cx = clampInt(Math.round((px - spec.x0) / spec.res), spec.cols);
    const cy = clampInt(Math.round((py - spec.y0) / spec.res), spec.rows);
    const cell = cy * spec.cols + cx;

    const dx = px - (spec.x0 + cx * spec.res);
    const dy = py - (spec.y0 + cy * spec.res);
    const distSq = dx * dx + dy * dy;
    if (distSq < bestDistSq[cell]) {
      bestDistSq[cell] = distSq;
      ihv[cell] = -data.z[i]; // invert: the cloth falls onto an upside-down world
      filled[cell] = 1;
    }
  }
  return filled;
}

function clampInt(value: number, size: number): number {
  if (value < 0) return 0;
  if (value > size - 1) return size - 1;
  return value;
}

/**
 * Breadth-first flood of the height map into particles no point rounded to (padding ring, holes,
 * water). Each empty particle inherits the height of the first filled particle that reaches it,
 * which is the discrete equivalent of «nearest neighbour» — and O(cells), not O(cells × points).
 */
function fillGaps(cols: number, rows: number, ihv: Float32Array, filled: Uint8Array): void {
  const total = cols * rows;
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (let cell = 0; cell < total; cell++) if (filled[cell] === 1) queue[tail++] = cell;
  if (tail === 0) return; // empty cloud — caller guards against this

  while (head < tail) {
    const cell = queue[head++];
    const cx = cell % cols;
    const cy = (cell - cx) / cols;
    if (cx > 0) tail = visit(cell - 1, cell, ihv, filled, queue, tail);
    if (cx < cols - 1) tail = visit(cell + 1, cell, ihv, filled, queue, tail);
    if (cy > 0) tail = visit(cell - cols, cell, ihv, filled, queue, tail);
    if (cy < rows - 1) tail = visit(cell + cols, cell, ihv, filled, queue, tail);
  }
}

function visit(
  target: number,
  from: number,
  ihv: Float32Array,
  filled: Uint8Array,
  queue: Int32Array,
  tail: number,
): number {
  if (filled[target] === 1) return tail;
  filled[target] = 1;
  ihv[target] = ihv[from];
  queue[tail] = target;
  return tail + 1;
}

/**
 * Bilinear sample of a per-particle height field at a LOCAL x/y. Used to ask the settled cloth
 * «how high are you under this point?» — the last step of the CSF classification.
 */
export function sampleClothBilinear(
  grid: ClothGrid,
  heights: Float32Array,
  xLocal: number,
  yLocal: number,
): number {
  const u = (xLocal - grid.x0) / grid.resolutionMm;
  const v = (yLocal - grid.y0) / grid.resolutionMm;
  const cx = clampInt(Math.floor(u), Math.max(grid.cols - 1, 1));
  const cy = clampInt(Math.floor(v), Math.max(grid.rows - 1, 1));
  const fx = clamp01(u - cx);
  const fy = clamp01(v - cy);

  const x1 = Math.min(cx + 1, grid.cols - 1);
  const y1 = Math.min(cy + 1, grid.rows - 1);
  const h00 = heights[cy * grid.cols + cx];
  const h10 = heights[cy * grid.cols + x1];
  const h01 = heights[y1 * grid.cols + cx];
  const h11 = heights[y1 * grid.cols + x1];

  const top = h00 + (h10 - h00) * fx;
  const bottom = h01 + (h11 - h01) * fx;
  return top + (bottom - top) * fy;
}

