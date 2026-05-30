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

import { computeWallGeometry, type OpeningFootprintForDeduction } from '../wall-geometry';
import type { WallParams } from '../../types/wall-types';
import type { Point3D } from '../../types/bim-base';
import type { WallTopProfile, WallTopSegment } from '../wall-top-profile';

const FLOAT_TOL = 1e-9;
const EDGE_TOL = 1e-6;

function makeParams(overrides?: Partial<WallParams>): WallParams {
  return {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
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

  it('bbox z in metres: baseOffset=0 → [0, height/1000] (ADR-369 Phase B)', () => {
    const g = computeWallGeometry(makeParams({ height: 3000 }));
    expect(g.bbox.min.z).toBeCloseTo(0, FLOAT_TOL);
    expect(g.bbox.max.z).toBeCloseTo(3, FLOAT_TOL); // 3000mm = 3m
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

// ─── ADR-395 G6 — net area (openings subtraction) ────────────────────────────

describe('computeWallGeometry — net area (ADR-395 G6)', () => {
  // 5 m × 3 m wall → gross area 15 m², thickness 200 mm.
  function grossWall(overrides?: Partial<WallParams>): WallParams {
    return makeParams({ end: { x: 5000, y: 0, z: 0 }, height: 3000, thickness: 200, ...overrides });
  }

  it('omitted openings → gross area (back-compat, render/3D path)', () => {
    const g = computeWallGeometry(grossWall());
    expect(g.area).toBeCloseTo(15, FLOAT_TOL);
  });

  it('empty openings list → gross area (no subtraction)', () => {
    const g = computeWallGeometry(grossWall(), 'straight', []);
    expect(g.area).toBeCloseTo(15, FLOAT_TOL);
  });

  it('net area = gross − single opening face area', () => {
    // door 1000 × 2000 mm = 2 m² → 15 − 2 = 13 m²
    const openings: OpeningFootprintForDeduction[] = [{ width: 1000, height: 2000 }];
    const g = computeWallGeometry(grossWall(), 'straight', openings);
    expect(g.area).toBeCloseTo(13, FLOAT_TOL);
  });

  it('net area subtracts the sum of multiple openings', () => {
    // 1000×2000 (2 m²) + 1200×1400 (1.68 m²) = 3.68 m² → 15 − 3.68 = 11.32
    const openings: OpeningFootprintForDeduction[] = [
      { width: 1000, height: 2000 },
      { width: 1200, height: 1400 },
    ];
    const g = computeWallGeometry(grossWall(), 'straight', openings);
    expect(g.area).toBeCloseTo(11.32, FLOAT_TOL);
  });

  it('volume follows the net area (window void removes wall material)', () => {
    const openings: OpeningFootprintForDeduction[] = [{ width: 1000, height: 2000 }];
    const g = computeWallGeometry(grossWall(), 'straight', openings);
    // net 13 m² × 0.2 m = 2.6 m³
    expect(g.volume).toBeCloseTo(2.6, FLOAT_TOL);
  });

  it('clamps net area to ≥ 0 when openings exceed gross', () => {
    // one 6000×4000 mm opening = 24 m² > 15 m² gross → clamp 0 (area + volume)
    const openings: OpeningFootprintForDeduction[] = [{ width: 6000, height: 4000 }];
    const g = computeWallGeometry(grossWall(), 'straight', openings);
    expect(g.area).toBe(0);
    expect(g.volume).toBe(0);
  });

  it('ignores non-positive / non-finite opening dimensions defensively', () => {
    const openings: OpeningFootprintForDeduction[] = [
      { width: 0, height: 2000 },
      { width: 1000, height: -1 },
      { width: Number.NaN, height: 2000 },
      { width: 1000, height: 2000 }, // only this one counts → 2 m²
    ];
    const g = computeWallGeometry(grossWall(), 'straight', openings);
    expect(g.area).toBeCloseTo(13, FLOAT_TOL);
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

// ─── ADR-363 Phase 1C — curved kind ──────────────────────────────────────────

describe('computeWallGeometry — curved kind (Phase 1C)', () => {
  function makeCurvedParams(curveControl: Point3D | undefined = { x: 500, y: 300, z: 0 }): WallParams {
    return makeParams({ curveControl });
  }

  it('subdivides axis into N+1 vertices when curveControl set', () => {
    const g = computeWallGeometry(makeCurvedParams(), 'curved');
    // CURVED_SUBDIVISIONS = 16 → 17 axis points.
    expect(g.axisPolyline.points).toHaveLength(17);
  });

  it('axis first/last vertex pin to params.start/end', () => {
    const g = computeWallGeometry(makeCurvedParams(), 'curved');
    const first = g.axisPolyline.points[0];
    const last = g.axisPolyline.points[g.axisPolyline.points.length - 1];
    expect(first.x).toBeCloseTo(0, EDGE_TOL);
    expect(first.y).toBeCloseTo(0, EDGE_TOL);
    expect(last.x).toBeCloseTo(1000, EDGE_TOL);
    expect(last.y).toBeCloseTo(0, EDGE_TOL);
  });

  it('quadratic Bezier midpoint matches analytic value', () => {
    const g = computeWallGeometry(makeCurvedParams({ x: 500, y: 400, z: 0 }), 'curved');
    // P(0.5) = 0.25·P0 + 0.5·P1 + 0.25·P2 → (0.25·0 + 0.5·500 + 0.25·1000, 0.25·0 + 0.5·400 + 0.25·0)
    //                                      = (500, 200)
    const mid = g.axisPolyline.points[8];
    expect(mid.x).toBeCloseTo(500, EDGE_TOL);
    expect(mid.y).toBeCloseTo(200, EDGE_TOL);
  });

  it('falls back to straight 2-point axis when curveControl missing on curved kind', () => {
    const g = computeWallGeometry(makeParams(), 'curved');
    expect(g.axisPolyline.points).toHaveLength(2);
  });

  it('outer/inner edges have the same vertex count as the subdivided axis', () => {
    const g = computeWallGeometry(makeCurvedParams(), 'curved');
    expect(g.outerEdge.points.length).toBe(g.axisPolyline.points.length);
    expect(g.innerEdge.points.length).toBe(g.axisPolyline.points.length);
  });

  it('arc-length (curved) ≥ straight chord length 1.0 m', () => {
    const g = computeWallGeometry(makeCurvedParams({ x: 500, y: 500, z: 0 }), 'curved');
    // For control well off-axis, axis polyline length exceeds 1.0 m chord.
    expect(g.length).toBeGreaterThan(1.0);
  });
});

// ─── ADR-401 B3a — profile-aware area / volume / bbox ────────────────────────

describe('computeWallGeometry — profile-aware (ADR-401 B3a)', () => {
  // 5 m horizontal wall, thickness 200 mm (so volume = area × 0.2).
  function wall5m(overrides?: Partial<WallParams>): WallParams {
    return makeParams({ end: { x: 5000, y: 0, z: 0 }, height: 3000, thickness: 200, ...overrides });
  }
  function profileOf(
    segments: readonly WallTopSegment[],
    baseZmm = 0,
    hasAttach = true,
  ): WallTopProfile {
    let maxTopZmm = -Infinity;
    let minTopZmm = Infinity;
    for (const s of segments) {
      maxTopZmm = Math.max(maxTopZmm, s.z0mm, s.z1mm);
      minTopZmm = Math.min(minTopZmm, s.z0mm, s.z1mm);
    }
    return { baseZmm, segments, maxTopZmm, minTopZmm, hasAttach, missingHostIds: [] };
  }

  it('single lowered segment (attached under beam) → area = length × resolved height', () => {
    // top 2500 mm (vs nominal 3000) → 5 m × 2.5 m = 12.5 m².
    const profile = profileOf([{ t0: 0, t1: 1, z0mm: 2500, z1mm: 2500, source: 'attached' }]);
    const g = computeWallGeometry(wall5m(), 'straight', undefined, profile);
    expect(g.area).toBeCloseTo(12.5, FLOAT_TOL);
    expect(g.volume).toBeCloseTo(12.5 * 0.2, FLOAT_TOL);
    expect(g.bbox.max.z).toBeCloseTo(2.5, FLOAT_TOL); // maxTop − base = 2500 mm
  });

  it('stepped profile (50% @3.0 m, 50% @2.5 m) → Σ segment areas', () => {
    const profile = profileOf([
      { t0: 0, t1: 0.5, z0mm: 3000, z1mm: 3000, source: 'storey-ceiling' },
      { t0: 0.5, t1: 1, z0mm: 2500, z1mm: 2500, source: 'attached' },
    ]);
    const g = computeWallGeometry(wall5m(), 'straight', undefined, profile);
    // 5 × (0.5×3.0 + 0.5×2.5) = 5 × 2.75 = 13.75 m².
    expect(g.area).toBeCloseTo(13.75, FLOAT_TOL);
    expect(g.bbox.max.z).toBeCloseTo(3.0, FLOAT_TOL); // bbox top = max segment top
  });

  it('sloped segment (z0 ≠ z1) → average height over the span', () => {
    const profile = profileOf([{ t0: 0, t1: 1, z0mm: 2000, z1mm: 3000, source: 'attached' }]);
    const g = computeWallGeometry(wall5m(), 'straight', undefined, profile);
    // avg height = (2000+3000)/2 = 2500 mm → 5 × 2.5 = 12.5 m².
    expect(g.area).toBeCloseTo(12.5, FLOAT_TOL);
    expect(g.bbox.max.z).toBeCloseTo(3.0, FLOAT_TOL); // maxTop
  });

  it('flat profile at nominal top === no-profile flat path (back-compat)', () => {
    const profile = profileOf(
      [{ t0: 0, t1: 1, z0mm: 3000, z1mm: 3000, source: 'storey-ceiling' }],
      0,
      false,
    );
    const withProfile = computeWallGeometry(wall5m(), 'straight', undefined, profile);
    const flat = computeWallGeometry(wall5m());
    expect(withProfile.area).toBeCloseTo(flat.area, FLOAT_TOL);
    expect(withProfile.volume).toBeCloseTo(flat.volume, FLOAT_TOL);
    expect(withProfile.bbox.max.z).toBeCloseTo(flat.bbox.max.z, FLOAT_TOL);
  });

  it('profile + openings → net = profile gross − Σ openings, clamped', () => {
    const profile = profileOf([{ t0: 0, t1: 1, z0mm: 2500, z1mm: 2500, source: 'attached' }]);
    const openings: OpeningFootprintForDeduction[] = [{ width: 1000, height: 2000 }]; // 2 m²
    const g = computeWallGeometry(wall5m(), 'straight', openings, profile);
    expect(g.area).toBeCloseTo(12.5 - 2, FLOAT_TOL); // 10.5 m²
    expect(g.volume).toBeCloseTo(10.5 * 0.2, FLOAT_TOL);
  });

  it('bbox base follows params.baseOffset; top extent = maxTop − profile base', () => {
    const profile = profileOf(
      [{ t0: 0, t1: 1, z0mm: 3000, z1mm: 3000, source: 'attached' }],
      500, // profile baseZmm = floorElev(0) + baseOffset 500
    );
    const g = computeWallGeometry(wall5m({ baseOffset: 500 }), 'straight', undefined, profile);
    expect(g.bbox.min.z).toBeCloseTo(0.5, FLOAT_TOL); // baseOffset/1000
    expect(g.bbox.max.z).toBeCloseTo(0.5 + 2.5, FLOAT_TOL); // base + (3000−500)/1000
  });
});
