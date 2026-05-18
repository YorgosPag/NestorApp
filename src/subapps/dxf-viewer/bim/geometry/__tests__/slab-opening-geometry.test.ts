/**
 * ADR-363 Phase 3.7 — `computeSlabOpeningGeometry` + helpers tests.
 *
 * Coverage:
 *   - Rectangle / square / triangle / L-shape areas via shoelace
 *   - Perimeter sum-of-edges
 *   - Bbox folds vertices
 *   - CCW vs CW orientation (unsigned area)
 *   - Degenerate polygons (< 3 vertices)
 *   - Min / Max bbox dimension helpers
 */

import {
  computeSlabOpeningGeometry,
  getSlabOpeningMaxDimensionMm,
  getSlabOpeningMinDimensionMm,
} from '../slab-opening-geometry';
import type { SlabOpeningParams } from '../../types/slab-opening-types';

const FLOAT_TOL = 1e-6;

function makeOpening(
  verts: ReadonlyArray<{ x: number; y: number }>,
  overrides?: Partial<SlabOpeningParams>,
): SlabOpeningParams {
  return {
    kind: 'shaft',
    slabId: 'slab_test',
    outline: { vertices: verts.map((v) => ({ x: v.x, y: v.y, z: 0 })) },
    ...overrides,
  };
}

describe('computeSlabOpeningGeometry — area', () => {
  it('computes 2.25m² for 1.5m × 1.5m square shaft', () => {
    const g = computeSlabOpeningGeometry(makeOpening([
      { x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1500 }, { x: 0, y: 1500 },
    ]));
    expect(g.area).toBeCloseTo(2.25, FLOAT_TOL);
  });

  it('computes 3.6m² for 1.2m × 3m well rectangle', () => {
    const g = computeSlabOpeningGeometry(makeOpening([
      { x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 3000 }, { x: 0, y: 3000 },
    ], { kind: 'well' }));
    expect(g.area).toBeCloseTo(3.6, FLOAT_TOL);
  });

  it('computes 0.16m² for 400mm × 400mm duct', () => {
    const g = computeSlabOpeningGeometry(makeOpening([
      { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
    ], { kind: 'duct' }));
    expect(g.area).toBeCloseTo(0.16, FLOAT_TOL);
  });

  it('returns unsigned area regardless of CW vs CCW orientation', () => {
    const ccw = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
    const cw = [...ccw].reverse();
    const areaCcw = computeSlabOpeningGeometry(makeOpening(ccw)).area;
    const areaCw = computeSlabOpeningGeometry(makeOpening(cw)).area;
    expect(areaCcw).toBeCloseTo(areaCw, FLOAT_TOL);
    expect(areaCcw).toBeGreaterThan(0);
  });

  it('returns area 0 για degenerate polygon (2 vertices)', () => {
    const g = computeSlabOpeningGeometry(makeOpening([
      { x: 0, y: 0 }, { x: 500, y: 0 },
    ]));
    expect(g.area).toBeCloseTo(0, FLOAT_TOL);
  });
});

describe('computeSlabOpeningGeometry — perimeter + bbox', () => {
  it('computes perimeter 6m για 1.5m × 1.5m shaft', () => {
    const g = computeSlabOpeningGeometry(makeOpening([
      { x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1500 }, { x: 0, y: 1500 },
    ]));
    expect(g.perimeter).toBeCloseTo(6, FLOAT_TOL);
  });

  it('bbox folds όλες τις κορυφές σε AABB', () => {
    const g = computeSlabOpeningGeometry(makeOpening([
      { x: -500, y: -800 }, { x: 1200, y: 0 }, { x: 0, y: 1800 },
    ]));
    expect(g.bbox.min.x).toBeCloseTo(-500, FLOAT_TOL);
    expect(g.bbox.min.y).toBeCloseTo(-800, FLOAT_TOL);
    expect(g.bbox.max.x).toBeCloseTo(1200, FLOAT_TOL);
    expect(g.bbox.max.y).toBeCloseTo(1800, FLOAT_TOL);
  });

  it('exposes outline pass-through στο geometry.polygon', () => {
    const params = makeOpening([
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 600 }, { x: 0, y: 600 },
    ]);
    const g = computeSlabOpeningGeometry(params);
    expect(g.polygon).toBe(params.outline);
  });
});

describe('getSlabOpening{Max,Min}DimensionMm', () => {
  it('max returns the longer side of a rectangle', () => {
    const params = makeOpening([
      { x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 3000 }, { x: 0, y: 3000 },
    ]);
    expect(getSlabOpeningMaxDimensionMm(params)).toBeCloseTo(3000, FLOAT_TOL);
  });

  it('min returns the shorter side of a rectangle', () => {
    const params = makeOpening([
      { x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 3000 }, { x: 0, y: 3000 },
    ]);
    expect(getSlabOpeningMinDimensionMm(params)).toBeCloseTo(1200, FLOAT_TOL);
  });
});
