/**
 * ADR-358 Phase 2b — Tests for `offsetPolyline` (xy-plane parallel offset).
 * Tolerance 1e-9 vs analytical geometry. §8 testing strategy.
 */
import { offsetPolyline } from '../geometry-offset-utils';
import type { Point3D } from '../../../types/Types';

const P = (x: number, y: number, z = 0): Point3D => ({ x, y, z });

describe('offsetPolyline (ADR-358 Phase 2b)', () => {
  it('horizontal segment offset by +d shifts +y', () => {
    const d = 5;
    const out = offsetPolyline([P(0, 0), P(10, 0)], d);
    expect(out).toHaveLength(2);
    expect(out[0].x).toBeCloseTo(0, 9);
    expect(out[0].y).toBeCloseTo(d, 9);
    expect(out[1].x).toBeCloseTo(10, 9);
    expect(out[1].y).toBeCloseTo(d, 9);
  });

  it('vertical segment offset by +d shifts -x (CCW perpendicular)', () => {
    const d = 5;
    const out = offsetPolyline([P(0, 0), P(0, 10)], d);
    expect(out).toHaveLength(2);
    expect(out[0].x).toBeCloseTo(-d, 9);
    expect(out[0].y).toBeCloseTo(0, 9);
    expect(out[1].x).toBeCloseTo(-d, 9);
    expect(out[1].y).toBeCloseTo(10, 9);
  });

  it('negative distance reverses offset direction', () => {
    const d = 5;
    const pos = offsetPolyline([P(0, 0), P(10, 0)], d);
    const neg = offsetPolyline([P(0, 0), P(10, 0)], -d);
    for (let i = 0; i < pos.length; i++) {
      expect(neg[i].x).toBeCloseTo(pos[i].x, 9);
      expect(neg[i].y).toBeCloseTo(-pos[i].y, 9);
    }
  });

  it('90° L-corner miter join: vertex offset by d·√2 along bisector', () => {
    const d = 5;
    const out = offsetPolyline([P(0, 0), P(10, 0), P(10, 10)], d);
    expect(out).toHaveLength(3);
    // First vertex: shifted +y by d
    expect(out[0].x).toBeCloseTo(0, 9);
    expect(out[0].y).toBeCloseTo(d, 9);
    // Corner: miter at (10 - d, d) — intersection of y=d and x=10-d
    expect(out[1].x).toBeCloseTo(10 - d, 9);
    expect(out[1].y).toBeCloseTo(d, 9);
    // Miter magnitude from pivot = d·√2
    const miterMag = Math.hypot(out[1].x - 10, out[1].y - 0);
    expect(miterMag).toBeCloseTo(d * Math.SQRT2, 9);
    // Last vertex: shifted -x by d
    expect(out[2].x).toBeCloseTo(10 - d, 9);
    expect(out[2].y).toBeCloseTo(10, 9);
  });

  it('convex closed square offset outward by d expands uniformly', () => {
    const d = 2;
    const square = [P(0, 0), P(10, 0), P(10, 10), P(0, 10), P(0, 0)];
    const out = offsetPolyline(square, d);
    // CCW square + positive d = inward (left of travel CCW is interior). Verify:
    // segment 0→1 going +x, left = +y, so first vertex offsets to (0, +d) → +y is OUTSIDE the unit square going CCW? Actually CCW square (0,0)→(10,0)→(10,10)→(0,10)
    // segment (0,0)→(10,0) goes +x, CCW perp = +y → outside!
    // So +d = outward expansion for CCW polygons. Expanded square: (-d, -d) to (10+d, 10+d)
    // Wait: segment (0,0)→(10,0) offset +y by d. segment (10,0)→(10,10) offset -x by d.
    // Miter at vertex (10,0): intersection of y=d and x=10-d → (10-d, d). That's INSIDE the square (negative d effectively).
    // So for the standard CCW orientation our convention says +d = LEFT of travel, which for CCW polygon = INSIDE.
    // Result polygon corners should be (d, d), (10-d, d), (10-d, 10-d), (d, 10-d).
    expect(out[0].x).toBeCloseTo(d, 9);
    expect(out[0].y).toBeCloseTo(d, 9);
    expect(out[1].x).toBeCloseTo(10 - d, 9);
    expect(out[1].y).toBeCloseTo(d, 9);
    expect(out[2].x).toBeCloseTo(10 - d, 9);
    expect(out[2].y).toBeCloseTo(10 - d, 9);
    expect(out[3].x).toBeCloseTo(d, 9);
    expect(out[3].y).toBeCloseTo(10 - d, 9);
    // Closing duplicate
    expect(out).toHaveLength(5);
    expect(out[4].x).toBeCloseTo(out[0].x, 9);
    expect(out[4].y).toBeCloseTo(out[0].y, 9);
  });

  it('sharp acute corner exceeds default miterLimit → bevel fallback', () => {
    // Near-180° fold: p0=(0,0)→p1=(10,0)→p2=(0,0.1). Very acute angle at p1.
    const d = 5;
    const out = offsetPolyline([P(0, 0), P(10, 0), P(0, 0.1)], d);
    // Bevel should produce 4 vertices (vertex 1 splits into two), miter 3.
    expect(out).toHaveLength(4);
    // Both bevel endpoints lie at perpendicular distance d from p1=(10,0)
    expect(Math.hypot(out[1].x - 10, out[1].y - 0)).toBeCloseTo(d, 9);
    expect(Math.hypot(out[2].x - 10, out[2].y - 0)).toBeCloseTo(d, 9);
  });

  it('z values are copied verbatim from input vertices', () => {
    const out = offsetPolyline([P(0, 0, 5), P(10, 0, 7), P(10, 10, 11)], 2);
    expect(out[0].z).toBe(5);
    expect(out[1].z).toBe(7);
    expect(out[2].z).toBe(11);
  });

  it('closed polyline (first ≈ last) emits closing duplicate of new vertex 0', () => {
    const d = 1;
    const triangle = [P(0, 0), P(10, 0), P(5, 8.660254037844386), P(0, 0)];
    const out = offsetPolyline(triangle, d);
    // 3 unique vertices + 1 duplicate
    expect(out).toHaveLength(4);
    expect(out[3].x).toBeCloseTo(out[0].x, 9);
    expect(out[3].y).toBeCloseTo(out[0].y, 9);
    expect(out[3].z).toBeCloseTo(out[0].z, 9);
  });

  it('empty / single-point input returns []', () => {
    expect(offsetPolyline([], 5)).toEqual([]);
    expect(offsetPolyline([P(0, 0)], 5)).toEqual([]);
  });

  it('explicit bevel option always emits 2 vertices per interior corner', () => {
    const d = 5;
    const out = offsetPolyline([P(0, 0), P(10, 0), P(10, 10)], d, { join: 'bevel' });
    // 1 endpoint + 2 bevel + 1 endpoint = 4 vertices
    expect(out).toHaveLength(4);
    // Bevel endpoints both at distance d from corner (10,0)
    expect(Math.hypot(out[1].x - 10, out[1].y - 0)).toBeCloseTo(d, 9);
    expect(Math.hypot(out[2].x - 10, out[2].y - 0)).toBeCloseTo(d, 9);
  });
});
