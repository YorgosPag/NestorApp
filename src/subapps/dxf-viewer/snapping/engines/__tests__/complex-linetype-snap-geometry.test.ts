/**
 * ADR-642 §6.8 — complex-linetype snap sampler + shared cycle walk.
 *
 * Drives the REAL railway compound preset (rails at ±753.5 mm, sleepers @650 mm,
 * 2600 mm tall) through the pure sampler, asserting the rendered pattern geometry the
 * OSNAP engine indexes: rail endpoints/midpoints, sleeper endpoints/midpoints, and
 * rail×sleeper intersections. Also unit-tests the SSoT `walkCyclePlacements` the sampler
 * shares with the stroker (N.18).
 */

import { walkCyclePlacements } from '../../../rendering/linetype/complex-stroke-geometry';
import { COMPOUND_PRESETS } from '../../../config/linetype-compound-presets';
import { layersToComplex } from '../../../config/line-pattern-segments';
import type { ComplexLinetypeDef } from '../../../config/complex-linetype-types';
import type { Point2D } from '../../../rendering/types/Types';
import {
  sampleComplexLinetypeSnapGeometry,
  hasSnappablePatternGeometry,
  patternHalfExtentMm,
} from '../complex-linetype-snap-geometry';

const RAIL_OFFSET = 753.5;
const TIE_SPACING = 650;
const TIE_HALF_HEIGHT = 1300; // 0.5 × 1040 × 2.5 mm

function railwayDef(): ComplexLinetypeDef {
  const railway = COMPOUND_PRESETS.find((p) => p.id === 'railway')!;
  return layersToComplex('TEST_RAILWAY', railway.build());
}

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const hasPoint = (pts: readonly Point2D[], x: number, y: number) =>
  pts.some((p) => near(p.x, x) && near(p.y, y));

describe('walkCyclePlacements (SSoT cycle walk)', () => {
  it('places a zero-length symbol after each gap at the tie period', () => {
    // Cycle [gap 650, symbol 0] over a 3000-long path → symbols at 650, 1300, 1950, 2600.
    const placements = walkCyclePlacements(3000, [650, 0], 650, 0);
    const symbolDists = placements.filter((p) => p.index === 1).map((p) => p.dist);
    expect(symbolDists).toEqual([650, 1300, 1950, 2600]);
  });

  it('shifts the first slot by the phase (negative start), and is empty for degenerate input', () => {
    expect(walkCyclePlacements(0, [650, 0], 650, 0)).toEqual([]);
    expect(walkCyclePlacements(1000, [], 0, 0)).toEqual([]);
    const phased = walkCyclePlacements(1000, [650, 0], 650, 100);
    expect(phased[0]!.dist).toBeCloseTo(-100, 6); // -posMod(100,650)
  });
});

describe('hasSnappablePatternGeometry', () => {
  it('is true for the railway compound (offset rails + tie symbols)', () => {
    expect(hasSnappablePatternGeometry(railwayDef())).toBe(true);
  });

  it('is false for a plain single-axis dash pattern', () => {
    const plain: ComplexLinetypeDef = {
      name: 'PLAIN',
      description: '',
      layers: [{ elements: [{ kind: 'dash', lengthMm: 5 }, { kind: 'gap', lengthMm: 3 }] }],
      origin: 'user-created',
    };
    expect(hasSnappablePatternGeometry(plain)).toBe(false);
  });
});

describe('sampleComplexLinetypeSnapGeometry — railway along a 10 000 mm horizontal axis', () => {
  const axis: Point2D[] = [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
  ];
  const AXIS_END = 10000;
  const geom = sampleComplexLinetypeSnapGeometry(railwayDef(), axis, false);

  // Sleeper midpoints sit on the axis (y≈0); rail midpoints are at ±753.5. Exclude the two
  // bounding-box side-midpoints (also y≈0, but at the axis ends x=0 / x=AXIS_END).
  const sleeperMids = geom.midpoints.filter(
    (p) => near(p.y, 0) && !near(p.x, 0) && !near(p.x, AXIS_END),
  );

  it('yields both rail endpoints at each axis end (±753.5 offset)', () => {
    expect(hasPoint(geom.endpoints, 0, RAIL_OFFSET)).toBe(true);
    expect(hasPoint(geom.endpoints, 0, -RAIL_OFFSET)).toBe(true);
    expect(hasPoint(geom.endpoints, 10000, RAIL_OFFSET)).toBe(true);
    expect(hasPoint(geom.endpoints, 10000, -RAIL_OFFSET)).toBe(true);
  });

  it('yields both rail midpoints at the axis centre', () => {
    expect(hasPoint(geom.midpoints, 5000, RAIL_OFFSET)).toBe(true);
    expect(hasPoint(geom.midpoints, 5000, -RAIL_OFFSET)).toBe(true);
  });

  it('spaces the sleepers at the real 650 mm period, first at 650', () => {
    const xs = sleeperMids.map((p) => p.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(TIE_SPACING, 6);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(TIE_SPACING, 6);
    expect(xs.length).toBe(15); // 650·k < 10000 → k = 1..15
    expect(xs[xs.length - 1]!).toBeLessThanOrEqual(10000);
  });

  it('makes each sleeper 2600 mm tall (±1300 perpendicular to the axis)', () => {
    // The tie at x=650: endpoints straddle the axis by ±1300 along the normal.
    expect(hasPoint(geom.endpoints, TIE_SPACING, TIE_HALF_HEIGHT)).toBe(true);
    expect(hasPoint(geom.endpoints, TIE_SPACING, -TIE_HALF_HEIGHT)).toBe(true);
  });

  it('yields a rail×sleeper intersection on each rail per sleeper', () => {
    expect(hasPoint(geom.intersections, TIE_SPACING, RAIL_OFFSET)).toBe(true);
    expect(hasPoint(geom.intersections, TIE_SPACING, -RAIL_OFFSET)).toBe(true);
    expect(geom.intersections.length).toBe(sleeperMids.length * 2);
  });

  it('caps the sleeper count for very long lines', () => {
    const END = 1_000_000;
    const long = sampleComplexLinetypeSnapGeometry(railwayDef(), [{ x: 0, y: 0 }, { x: END, y: 0 }], false, 50);
    const mids = long.midpoints.filter((p) => near(p.y, 0) && !near(p.x, 0) && !near(p.x, END));
    expect(mids.length).toBe(50);
  });

  // Giorgio 2026-07-13 — the pattern's selection frame (bounding box) is also snappable.
  it('yields the 4 bounding-box corners as endpoints (±1300 at each axis end)', () => {
    expect(hasPoint(geom.endpoints, 0, TIE_HALF_HEIGHT)).toBe(true);
    expect(hasPoint(geom.endpoints, 0, -TIE_HALF_HEIGHT)).toBe(true);
    expect(hasPoint(geom.endpoints, AXIS_END, TIE_HALF_HEIGHT)).toBe(true);
    expect(hasPoint(geom.endpoints, AXIS_END, -TIE_HALF_HEIGHT)).toBe(true);
  });

  it('yields the west + east side midpoints (middle of each short side, on the axis ends)', () => {
    expect(hasPoint(geom.midpoints, 0, 0)).toBe(true);
    expect(hasPoint(geom.midpoints, AXIS_END, 0)).toBe(true);
  });
});

describe('patternHalfExtentMm', () => {
  it('is the sleeper half-height (1300), which exceeds the rail offset (753.5)', () => {
    expect(patternHalfExtentMm(railwayDef())).toBeCloseTo(TIE_HALF_HEIGHT, 6);
  });
});
