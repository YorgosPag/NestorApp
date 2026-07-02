/**
 * ADR-565 — `computeWallGeometry` circular-arc (bulge) kind tests.
 *
 * Coverage:
 *   - arc bulge selects a tessellated arc axis (not [start,end])
 *   - endpoints pinned; every axis vertex on the arc circle
 *   - length = arc length (R·|sweep|), NOT the chord
 *   - outer/inner edges are half-thickness offsets of the arc
 *   - `arc` takes precedence over legacy `curveControl`
 *   - segment count within [MIN, MAX] bounds
 */

import { computeWallGeometry } from '../wall-geometry';
import type { WallParams } from '../../types/wall-types';
import { ADAPTIVE_ARC_TESSELLATION } from '../../../config/tolerance-config';

const { MAX_SEGMENTS, MIN_SEGMENTS } = ADAPTIVE_ARC_TESSELLATION;

// Semicircle: start (−1000,0) → end (1000,0), bulge +1 ⇒ center (0,0), R = 1000mm.
function makeArcParams(overrides?: Partial<WallParams>): WallParams {
  return {
    category: 'exterior',
    start: { x: -1000, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    height: 3000,
    thickness: 200,
    arc: 1,
    flip: false, baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    ...overrides,
  };
}

describe('computeWallGeometry — curved (circular arc) kind', () => {
  it('tessellates the arc axis (more than 2 points)', () => {
    const g = computeWallGeometry(makeArcParams(), 'curved');
    expect(g.axisPolyline.points.length).toBeGreaterThan(2);
  });

  it('pins the exact start/end endpoints', () => {
    const g = computeWallGeometry(makeArcParams(), 'curved');
    const pts = g.axisPolyline.points;
    expect(pts[0]).toMatchObject({ x: -1000, y: 0 });
    expect(pts[pts.length - 1]).toMatchObject({ x: 1000, y: 0 });
  });

  it('places every axis vertex on the arc circle (radius 1000 from center)', () => {
    const g = computeWallGeometry(makeArcParams(), 'curved');
    for (const p of g.axisPolyline.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1000, 4);
    }
  });

  it('length is the arc length (π·R = π m), NOT the 2 m chord', () => {
    const g = computeWallGeometry(makeArcParams(), 'curved');
    expect(g.length).toBeCloseTo(Math.PI, 1); // ~3.14 m, chord would be 2 m
    expect(g.length).toBeGreaterThan(3); // strictly beyond the chord
  });

  it('offsets outer/inner edges by ±half-thickness of the arc', () => {
    const g = computeWallGeometry(makeArcParams({ thickness: 200 }), 'curved');
    // Each edge is half-thickness (100mm) off the R=1000 arc → radius 900 or 1100.
    // (Which concrete side is "outer" depends on axis winding — assert the offset
    // magnitude, not the side.)
    for (const p of g.outerEdge.points) {
      expect(Math.abs(Math.hypot(p.x, p.y) - 1000)).toBeCloseTo(100, 0);
    }
    for (const p of g.innerEdge.points) {
      expect(Math.abs(Math.hypot(p.x, p.y) - 1000)).toBeCloseTo(100, 0);
    }
    // The two edges sit on opposite sides of the arc (concentric, 200mm apart).
    const rOuter = Math.hypot(g.outerEdge.points[1].x, g.outerEdge.points[1].y);
    const rInner = Math.hypot(g.innerEdge.points[1].x, g.innerEdge.points[1].y);
    expect(Math.abs(rOuter - rInner)).toBeCloseTo(200, 0);
  });

  it('`arc` takes precedence over legacy `curveControl`', () => {
    const withBoth = computeWallGeometry(
      makeArcParams({ curveControl: { x: 0, y: 5000, z: 0 } }),
      'curved',
    );
    // If the Bézier control had won, points would not lie on the R=1000 circle.
    for (const p of withBoth.axisPolyline.points) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1000, 4);
    }
  });

  it('keeps segment count within [MIN, MAX] bounds', () => {
    const g = computeWallGeometry(makeArcParams(), 'curved');
    const segs = g.axisPolyline.points.length - 1;
    expect(segs).toBeGreaterThanOrEqual(MIN_SEGMENTS);
    expect(segs).toBeLessThanOrEqual(MAX_SEGMENTS);
  });

  it('falls back to a straight 2-point axis when arc is absent', () => {
    const g = computeWallGeometry(makeArcParams({ arc: undefined }), 'curved');
    expect(g.axisPolyline.points).toHaveLength(2);
  });
});
