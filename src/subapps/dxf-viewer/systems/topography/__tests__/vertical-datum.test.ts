/**
 * ADR-650 M10c — the project vertical datum resolver. Ground truth by hand: the datum under a
 * point is exactly the barycentric ground elevation there (the value the surface IS), and off the
 * surface it is the mid-height, so an un-surveyed building origin centres the hill instead of
 * floating it.
 */

import { resolveVerticalDatumMm } from '../vertical-datum';
import type { TinSurface } from '../topo-types';

const SIDE_MM = 10_000;

/** 10 m × 10 m, two CCW triangles, elevations from `zAt` (WORLD mm). */
function squareTin(zAt: (x: number, y: number) => number): TinSurface {
  const positions: [number, number][] = [
    [0, 0],
    [SIDE_MM, 0],
    [SIDE_MM, SIDE_MM],
    [0, SIDE_MM],
  ];
  const elevations = positions.map(([x, y]) => zAt(x, y));
  return {
    positions,
    elevations,
    triangles: [
      [0, 1, 2],
      [0, 2, 3],
    ],
    origin: { x: 0, y: 0 },
    bounds: {
      minX: 0,
      minY: 0,
      maxX: SIDE_MM,
      maxY: SIDE_MM,
      minZ: Math.min(...elevations),
      maxZ: Math.max(...elevations),
    },
    flatTriangleCount: 0,
  };
}

const EMPTY_TIN: TinSurface = {
  positions: [],
  elevations: [],
  triangles: [],
  origin: { x: 0, y: 0 },
  bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, minZ: 0, maxZ: 0 },
  flatTriangleCount: 0,
};

describe('resolveVerticalDatumMm', () => {
  it('flat ground → datum is that constant elevation under the origin', () => {
    const tin = squareTin(() => 106_000); // +106.00 m everywhere (a floating ΕΓΣΑ survey)
    expect(resolveVerticalDatumMm(tin, 5000, 5000)).toBeCloseTo(106_000, 3);
  });

  it('sloping ground → datum is the exact barycentric elevation at the origin, not an average', () => {
    const tin = squareTin((x) => 100_000 + x); // +1 mm per mm of x: 100 000..110 000
    // At x = 2500 the ground is 102 500; the datum must read the ground THERE, not the mean.
    expect(resolveVerticalDatumMm(tin, 2500, 5000)).toBeCloseTo(102_500, 3);
  });

  it('origin OUTSIDE the surveyed area → mid-height (centre the hill, do not float it)', () => {
    const tin = squareTin((x) => 100_000 + x); // minZ 100 000, maxZ 110 000 → mid 105 000
    expect(resolveVerticalDatumMm(tin, -50_000, -50_000)).toBeCloseTo(105_000, 3);
  });

  it('empty surface → 0 (no datum to acquire)', () => {
    expect(resolveVerticalDatumMm(EMPTY_TIN, 0, 0)).toBe(0);
  });
});
