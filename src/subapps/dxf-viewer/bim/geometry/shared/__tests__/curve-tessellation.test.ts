/**
 * ADR-565 — shared curve-tessellation SSoT tests.
 *
 * Coverage:
 *   - adaptiveArcSegDeg: monotonic in radius, MAX cap, MIN floor, degenerate radius
 *   - tessellateArcAxis: straight passthrough, pinned endpoints, on-circle points,
 *     segment-count bounds, linear z interpolation
 */

import { adaptiveArcSegDeg, tessellateArcAxis, subdivideQuadraticBezier } from '../curve-tessellation';
import { ADAPTIVE_ARC_TESSELLATION } from '../../../../config/tolerance-config';

const { MAX_SEGMENTS, MIN_SEGMENTS } = ADAPTIVE_ARC_TESSELLATION;

/** Segment count implied by a max-seg-degree over a sweep. */
function segCount(sweepDeg: number, segDeg: number): number {
  return Math.max(2, Math.ceil(sweepDeg / segDeg));
}

describe('adaptiveArcSegDeg', () => {
  it('is monotonic: a larger radius needs a finer (≤) segment angle', () => {
    const small = adaptiveArcSegDeg(1, 0.002, 90);
    const large = adaptiveArcSegDeg(100, 0.002, 90);
    expect(large).toBeLessThanOrEqual(small);
  });

  it('respects the MAX_SEGMENTS cap for a huge radius', () => {
    const segDeg = adaptiveArcSegDeg(1e6, 0.002, 90);
    expect(segCount(90, segDeg)).toBeLessThanOrEqual(MAX_SEGMENTS);
  });

  it('respects the MIN_SEGMENTS floor for a degenerate (tiny) radius', () => {
    const segDeg = adaptiveArcSegDeg(0.001, 0.002, 90);
    expect(segCount(90, segDeg)).toBe(MIN_SEGMENTS);
  });

  it('never returns a non-finite / non-positive angle', () => {
    for (const r of [0, -1, 0.5, 5, 5000]) {
      const d = adaptiveArcSegDeg(r, 0.002, 45);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }
  });
});

describe('tessellateArcAxis', () => {
  it('returns [start, end] for a (near-)zero bulge', () => {
    const pts = tessellateArcAxis({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 0);
    expect(pts).toHaveLength(2);
  });

  it('pins the exact endpoints for a semicircle', () => {
    const start = { x: -1000, y: 0, z: 0 };
    const end = { x: 1000, y: 0, z: 0 };
    const pts = tessellateArcAxis(start, end, 1); // bulge +1 = semicircle
    expect(pts[0]).toMatchObject({ x: -1000, y: 0 });
    expect(pts[pts.length - 1]).toMatchObject({ x: 1000, y: 0 });
  });

  it('places every vertex on the arc circle (radius from center)', () => {
    const start = { x: -1000, y: 0, z: 0 };
    const end = { x: 1000, y: 0, z: 0 };
    const pts = tessellateArcAxis(start, end, 1); // center (0,0), radius 1000
    for (const p of pts) {
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1000, 6);
    }
  });

  it('keeps the segment count within [MIN, MAX] bounds', () => {
    const pts = tessellateArcAxis({ x: -1000, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, 1);
    const segs = pts.length - 1;
    expect(segs).toBeGreaterThanOrEqual(MIN_SEGMENTS);
    expect(segs).toBeLessThanOrEqual(MAX_SEGMENTS);
  });

  it('interpolates z linearly between endpoints', () => {
    const pts = tessellateArcAxis({ x: -1000, y: 0, z: 0 }, { x: 1000, y: 0, z: 300 }, 1);
    expect(pts[0].z).toBeCloseTo(0, 6);
    expect(pts[pts.length - 1].z).toBeCloseTo(300, 6);
    // monotonically non-decreasing z across the path
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].z).toBeGreaterThanOrEqual(pts[i - 1].z - 1e-9);
    }
  });
});

describe('subdivideQuadraticBezier (centralized, unchanged behavior)', () => {
  it('returns segments+1 points including exact endpoints', () => {
    const pts = subdivideQuadraticBezier({ x: 0, y: 0, z: 0 }, { x: 5, y: 10, z: 0 }, { x: 10, y: 0, z: 0 }, 16);
    expect(pts).toHaveLength(17);
    expect(pts[0]).toMatchObject({ x: 0, y: 0 });
    expect(pts[16]).toMatchObject({ x: 10, y: 0 });
  });
});
