/**
 * ADR-363 Phase 3 — `computeSlabGeometry` + polygon-utils tests.
 *
 * Coverage:
 *   - Square / rectangle / L-shape / triangle areas via shoelace
 *   - Perimeter sum-of-edges
 *   - Bbox folds vertices
 *   - Volume = netArea × thickness (m³)
 *   - CCW vs CW orientation handling (unsigned area)
 *   - Degenerate polygons (< 3 vertices)
 *   - Phase 3 netArea === area (slab-openings deferred)
 */

import { computeSlabGeometry, getSlabMaxBboxDimensionM } from '../slab-geometry';
import {
  isPolygonSelfIntersecting,
  isPolygonCCW,
  shoelaceArea,
} from '../shared/polygon-utils';
import type { SlabParams } from '../../types/slab-types';

const FLOAT_TOL = 1e-6;

function makeSlab(verts: ReadonlyArray<{ x: number; y: number }>, overrides?: Partial<SlabParams>): SlabParams {
  return {
    kind: 'floor',
    outline: { vertices: verts.map((v) => ({ x: v.x, y: v.y, z: 0 })) },
    elevation: 0,
    thickness: 200,
    ...overrides,
  };
}

describe('computeSlabGeometry — area', () => {
  it('computes 100m² area for a 10m × 10m square (mm input)', () => {
    // 10000 × 10000 mm = 100 m² (CCW).
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ]));
    expect(g.area).toBeCloseTo(100, FLOAT_TOL);
  });

  it('computes 60m² for a 6m × 10m rectangle', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 10000 }, { x: 0, y: 10000 },
    ]));
    expect(g.area).toBeCloseTo(60, FLOAT_TOL);
  });

  it('computes 12.5m² for a triangle 5m × 5m', () => {
    // Right triangle base 5m height 5m → area = 12.5 m².
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 0, y: 5000 },
    ]));
    expect(g.area).toBeCloseTo(12.5, FLOAT_TOL);
  });

  it('computes correct area for an L-shape (75m²)', () => {
    // L-shape: 10×10 minus 5×5 corner = 100 - 25 = 75 m².
    const g = computeSlabGeometry(makeSlab([
      { x: 0,     y: 0 },
      { x: 10000, y: 0 },
      { x: 10000, y: 5000 },
      { x: 5000,  y: 5000 },
      { x: 5000,  y: 10000 },
      { x: 0,     y: 10000 },
    ]));
    expect(g.area).toBeCloseTo(75, FLOAT_TOL);
  });

  it('returns unsigned area regardless of CW vs CCW orientation', () => {
    const ccwVerts = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }];
    const cwVerts = [...ccwVerts].reverse();
    const ccwArea = computeSlabGeometry(makeSlab(ccwVerts)).area;
    const cwArea = computeSlabGeometry(makeSlab(cwVerts)).area;
    expect(ccwArea).toBeCloseTo(cwArea, FLOAT_TOL);
    expect(ccwArea).toBeGreaterThan(0);
  });

  it('returns area 0 for degenerate polygon (2 vertices)', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 1000, y: 0 },
    ]));
    expect(g.area).toBeCloseTo(0, FLOAT_TOL);
  });
});

describe('computeSlabGeometry — perimeter + bbox + volume', () => {
  it('computes perimeter as sum-of-edges (40m for 10m square)', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ]));
    expect(g.perimeter).toBeCloseTo(40, FLOAT_TOL);
  });

  it('bbox folds all vertices into AABB', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: -1000, y: -2000 }, { x: 5000, y: 0 }, { x: 0, y: 4000 },
    ]));
    expect(g.bbox.min.x).toBeCloseTo(-1000, FLOAT_TOL);
    expect(g.bbox.min.y).toBeCloseTo(-2000, FLOAT_TOL);
    expect(g.bbox.max.x).toBeCloseTo(5000, FLOAT_TOL);
    expect(g.bbox.max.y).toBeCloseTo(4000, FLOAT_TOL);
  });

  it('computes volume = netArea × thickness (m³)', () => {
    // 10m × 10m × 200mm thickness = 100 × 0.2 = 20 m³.
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ], { thickness: 200 }));
    expect(g.volume).toBeCloseTo(20, FLOAT_TOL);
  });

  it('Phase 3 netArea === area (slab-openings deferred Phase 3.5)', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
    ]));
    expect(g.netArea).toBeCloseTo(g.area, FLOAT_TOL);
  });

  it('getSlabMaxBboxDimensionM returns max(dx,dy) in meters', () => {
    const params = makeSlab([
      { x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 0, y: 3000 },
    ]);
    expect(getSlabMaxBboxDimensionM(params)).toBeCloseTo(8, FLOAT_TOL);
  });
});

describe('polygon-utils helpers', () => {
  it('shoelaceArea is positive for CCW orientation', () => {
    const verts = [
      { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 1000, y: 1000, z: 0 }, { x: 0, y: 1000, z: 0 },
    ];
    expect(shoelaceArea(verts)).toBeGreaterThan(0);
    expect(isPolygonCCW(verts)).toBe(true);
  });

  it('shoelaceArea is negative for CW orientation', () => {
    const verts = [
      { x: 0, y: 0, z: 0 }, { x: 0, y: 1000, z: 0 }, { x: 1000, y: 1000, z: 0 }, { x: 1000, y: 0, z: 0 },
    ];
    expect(shoelaceArea(verts)).toBeLessThan(0);
    expect(isPolygonCCW(verts)).toBe(false);
  });

  it('isPolygonSelfIntersecting detects classic bowtie quadrilateral', () => {
    // Bowtie: edges (0→1) and (2→3) cross.
    const bowtie = [
      { x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 0 },
      { x: 100, y: 0, z: 0 }, { x: 0, y: 100, z: 0 },
    ];
    expect(isPolygonSelfIntersecting(bowtie)).toBe(true);
  });

  it('isPolygonSelfIntersecting returns false for simple convex quad', () => {
    const square = [
      { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 },
      { x: 100, y: 100, z: 0 }, { x: 0, y: 100, z: 0 },
    ];
    expect(isPolygonSelfIntersecting(square)).toBe(false);
  });
});
