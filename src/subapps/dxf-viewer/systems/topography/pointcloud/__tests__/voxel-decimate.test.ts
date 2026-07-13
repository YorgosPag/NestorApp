/**
 * ADR-650 M8α — voxel decimation (ground cloud → survey-grade `TopoPoint[]`).
 *
 * The three things that must never regress: the CELL count, the representative CHOICE, and the
 * LOCAL→WORLD re-projection (a bug there silently plants the whole survey 500 km away).
 */

import { voxelDecimate } from '../voxel-decimate';
import { VOXEL_DEFAULTS } from '../pointcloud-defaults';
import type { VoxelDecimateOptions } from '../pointcloud-types';
import { makeCloud, type FixturePoint } from './pointcloud-fixtures';

const ORIGIN = { x: 500_000, y: 4_200_000 };
const CELL = 1_000;
const OPTS: VoxelDecimateOptions = { ...VOXEL_DEFAULTS, cellSizeMm: CELL };

/** Two points per cell in three cells, plus one lone point — 4 occupied cells, 7 input points. */
const SCENE: readonly FixturePoint[] = [
  { x: 100, y: 100, z: 5_000 }, // cell (0,0) — high
  { x: 900, y: 900, z: 1_000 }, // cell (0,0) — LOW  ← the `lowest` winner
  { x: 1_200, y: 100, z: 2_000 }, // cell (1,0)
  { x: 1_800, y: 200, z: 2_400 }, // cell (1,0)
  { x: 100, y: 1_500, z: 3_000 }, // cell (0,1)
  { x: 200, y: 1_900, z: 3_200 }, // cell (0,1)
  { x: 2_500, y: 2_500, z: 9_000 }, // cell (2,2) — alone
];

const ALL_INDICES = new Uint32Array(SCENE.map((_, i) => i));

describe('voxelDecimate', () => {
  it('emits exactly one point per occupied cell', () => {
    const result = voxelDecimate(makeCloud(SCENE, ORIGIN), ALL_INDICES, OPTS);

    expect(result.inputCount).toBe(7);
    expect(result.cellsOccupied).toBe(4);
    expect(result.points).toHaveLength(4);
  });

  it('`lowest` keeps the minimum-Z point of each cell (the conservative DTM choice)', () => {
    const result = voxelDecimate(makeCloud(SCENE, ORIGIN), ALL_INDICES, OPTS);

    expect(result.points.map((p) => p.z)).toEqual([1_000, 2_000, 3_000, 9_000]);
  });

  it('re-projects LOCAL x/y back to WORLD and leaves Z alone', () => {
    const result = voxelDecimate(makeCloud(SCENE, ORIGIN), ALL_INDICES, OPTS);

    expect(result.points[0]).toEqual({ x: ORIGIN.x + 900, y: ORIGIN.y + 900, z: 1_000 });
  });

  it('emits cells in a deterministic (row-major) order', () => {
    const cloud = makeCloud(SCENE, ORIGIN);

    const first = voxelDecimate(cloud, ALL_INDICES, OPTS);
    const second = voxelDecimate(cloud, ALL_INDICES, OPTS);

    expect(first.points).toEqual(second.points);
    // row 0 before row 1 before row 2, columns ascending inside a row
    expect(first.points.map((p) => [p.x - ORIGIN.x, p.y - ORIGIN.y])).toEqual([
      [900, 900],
      [1_200, 100],
      [100, 1_500],
      [2_500, 2_500],
    ]);
  });

  it('`mean` averages the cell instead', () => {
    const result = voxelDecimate(makeCloud(SCENE, ORIGIN), ALL_INDICES, {
      ...OPTS,
      representative: 'mean',
    });

    expect(result.points[1]).toEqual({
      x: ORIGIN.x + 1_500, // (1200 + 1800) / 2
      y: ORIGIN.y + 150, // (100 + 200) / 2
      z: 2_200, // (2000 + 2400) / 2
    });
  });

  it('only decimates the points it was given (the ground subset)', () => {
    const groundOnly = new Uint32Array([1, 6]); // one point in cell (0,0), one in (2,2)

    const result = voxelDecimate(makeCloud(SCENE, ORIGIN), groundOnly, OPTS);

    expect(result.inputCount).toBe(2);
    expect(result.points.map((p) => p.z)).toEqual([1_000, 9_000]);
  });

  it('returns nothing when no point is ground', () => {
    const result = voxelDecimate(makeCloud(SCENE, ORIGIN), new Uint32Array(0), OPTS);

    expect(result).toEqual({ points: [], inputCount: 0, cellsOccupied: 0 });
  });

  it('throws the i18n key on a non-positive cell size', () => {
    expect(() =>
      voxelDecimate(makeCloud(SCENE, ORIGIN), ALL_INDICES, { ...OPTS, cellSizeMm: 0 }),
    ).toThrow('topography.pointcloud.error.invalidCellSize');
  });
});
