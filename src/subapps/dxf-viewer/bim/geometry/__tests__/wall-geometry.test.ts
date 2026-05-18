/**
 * ADR-363 Phase 1 — `computeWallGeometry` tests.
 *
 * Coverage:
 *   - Straight wall axis polyline, edges, length/area/volume
 *   - Edge offset orientation (flip flips outer/inner)
 *   - Bbox extrusion (z range = [0, height])
 *   - Polyline kind selects custom vertices
 *   - Degenerate wall (zero length) returns sane numbers
 *   - Vertex normal averaging at corners (multi-segment polyline)
 */

import { computeWallGeometry } from '../wall-geometry';
import type { WallParams } from '../../types/wall-types';
import type { Point3D } from '../../types/bim-base';

const FLOAT_TOL = 1e-9;
const EDGE_TOL = 1e-6;

function makeParams(overrides?: Partial<WallParams>): WallParams {
  return {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    ...overrides,
  };
}

describe('computeWallGeometry — straight kind', () => {
  it('builds 2-point axis polyline', () => {
    const g = computeWallGeometry(makeParams());
    expect(g.axisPolyline.points).toHaveLength(2);
    expect(g.axisPolyline.points[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(g.axisPolyline.points[1]).toEqual({ x: 1000, y: 0, z: 0 });
    expect(g.axisPolyline.closed).toBe(false);
  });

  it('offsets outer edge +halfThickness along +Y for horizontal wall', () => {
    const g = computeWallGeometry(makeParams({ thickness: 200 }));
    const outerStart = g.outerEdge.points[0];
    const outerEnd = g.outerEdge.points[1];
    expect(outerStart.y).toBeCloseTo(100, 6);
    expect(outerEnd.y).toBeCloseTo(100, 6);
    expect(outerStart.x).toBeCloseTo(0, 6);
    expect(outerEnd.x).toBeCloseTo(1000, 6);
  });

  it('offsets inner edge −halfThickness for horizontal wall', () => {
    const g = computeWallGeometry(makeParams({ thickness: 200 }));
    expect(g.innerEdge.points[0].y).toBeCloseTo(-100, EDGE_TOL);
    expect(g.innerEdge.points[1].y).toBeCloseTo(-100, EDGE_TOL);
  });

  it('flips outer/inner orientation when flip=true', () => {
    const g = computeWallGeometry(makeParams({ thickness: 200, flip: true }));
    expect(g.outerEdge.points[0].y).toBeCloseTo(-100, EDGE_TOL);
    expect(g.innerEdge.points[0].y).toBeCloseTo(100, EDGE_TOL);
  });

  it('computes length in metres from mm endpoints', () => {
    const g = computeWallGeometry(makeParams({ end: { x: 3000, y: 4000, z: 0 } }));
    expect(g.length).toBeCloseTo(5.0, FLOAT_TOL); // 3-4-5 triangle, 5000 mm = 5 m
  });

  it('computes area = length × height in m²', () => {
    const g = computeWallGeometry(makeParams({ height: 2700, end: { x: 5000, y: 0, z: 0 } }));
    expect(g.area).toBeCloseTo(5 * 2.7, FLOAT_TOL);
  });

  it('computes volume = area × thickness in m³', () => {
    const g = computeWallGeometry(makeParams({ height: 3000, thickness: 200, end: { x: 2000, y: 0, z: 0 } }));
    expect(g.volume).toBeCloseTo(2 * 3 * 0.2, FLOAT_TOL);
  });

  it('bbox extrudes z from 0 to height', () => {
    const g = computeWallGeometry(makeParams({ height: 3000 }));
    expect(g.bbox.min.z).toBeCloseTo(0, FLOAT_TOL);
    expect(g.bbox.max.z).toBeCloseTo(3000, FLOAT_TOL);
  });

  it('bbox folds outer + inner edges into xy extents', () => {
    const g = computeWallGeometry(makeParams({ thickness: 250 }));
    expect(g.bbox.min.y).toBeCloseTo(-125, EDGE_TOL);
    expect(g.bbox.max.y).toBeCloseTo(125, EDGE_TOL);
    expect(g.bbox.min.x).toBeCloseTo(0, EDGE_TOL);
    expect(g.bbox.max.x).toBeCloseTo(1000, EDGE_TOL);
  });

  it('produces consistent outer/inner pair length (same number of vertices)', () => {
    const g = computeWallGeometry(makeParams());
    expect(g.outerEdge.points.length).toBe(g.innerEdge.points.length);
    expect(g.outerEdge.points.length).toBe(g.axisPolyline.points.length);
  });
});

describe('computeWallGeometry — degenerate input', () => {
  it('zero-length wall returns length 0 + zero area/volume', () => {
    const g = computeWallGeometry(makeParams({ end: { x: 0, y: 0, z: 0 } }));
    expect(g.length).toBeCloseTo(0, FLOAT_TOL);
    expect(g.area).toBeCloseTo(0, FLOAT_TOL);
    expect(g.volume).toBeCloseTo(0, FLOAT_TOL);
  });

  it('zero-thickness wall produces coincident outer/inner edges', () => {
    const g = computeWallGeometry(makeParams({ thickness: 0 }));
    for (let i = 0; i < g.outerEdge.points.length; i++) {
      expect(g.outerEdge.points[i].x).toBeCloseTo(g.innerEdge.points[i].x, EDGE_TOL);
      expect(g.outerEdge.points[i].y).toBeCloseTo(g.innerEdge.points[i].y, EDGE_TOL);
    }
  });
});

describe('computeWallGeometry — polyline kind', () => {
  it('uses polylineVertices when kind=polyline and 3+ vertices present', () => {
    const vertices: readonly Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 1000, z: 0 },
    ];
    const g = computeWallGeometry(
      makeParams({ polylineVertices: vertices, end: { x: 1000, y: 1000, z: 0 } }),
      'polyline',
    );
    expect(g.axisPolyline.points).toHaveLength(3);
    expect(g.outerEdge.points).toHaveLength(3);
    expect(g.innerEdge.points).toHaveLength(3);
  });

  it('polyline length is sum of segment lengths', () => {
    const vertices: readonly Point3D[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1000, y: 1000, z: 0 },
    ];
    const g = computeWallGeometry(
      makeParams({ polylineVertices: vertices }),
      'polyline',
    );
    expect(g.length).toBeCloseTo(2.0, FLOAT_TOL); // 1000 + 1000 = 2000 mm = 2 m
  });

  it('falls back to start/end when polylineVertices missing on polyline kind', () => {
    const g = computeWallGeometry(makeParams(), 'polyline');
    expect(g.axisPolyline.points).toHaveLength(2);
  });
});

describe('computeWallGeometry — geometry sanity', () => {
  it('vertical wall offsets edges along ±X', () => {
    const g = computeWallGeometry(
      makeParams({ end: { x: 0, y: 1000, z: 0 }, thickness: 200 }),
    );
    // axis is along +Y, so CCW normal is along −X (outer when flip=false).
    expect(g.outerEdge.points[0].x).toBeCloseTo(-100, EDGE_TOL);
    expect(g.innerEdge.points[0].x).toBeCloseTo(100, EDGE_TOL);
  });

  it('45° wall offsets edges along the perpendicular direction', () => {
    const g = computeWallGeometry(
      makeParams({ end: { x: 1000, y: 1000, z: 0 }, thickness: 200 }),
    );
    // axis tangent = (1,1)/√2; CCW normal = (-1,1)/√2; outer offset by 100·normal.
    const expectedDx = (-100) / Math.SQRT2;
    const expectedDy = 100 / Math.SQRT2;
    expect(g.outerEdge.points[0].x).toBeCloseTo(expectedDx, EDGE_TOL);
    expect(g.outerEdge.points[0].y).toBeCloseTo(expectedDy, EDGE_TOL);
  });
});
