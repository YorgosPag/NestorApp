/**
 * Tests — shared I-shape profile SSoT (ADR-363 Φ2).
 */

import { buildIShapeProfile, iShapeCrossSectionAreaMm2 } from '../i-shape-profile';

describe('buildIShapeProfile', () => {
  it('emits a 12-vertex outline bounded by ±b/2 × ±h/2', () => {
    const verts = buildIShapeProfile(100, 200, 1, { flangeThickness: 20, webThickness: 15 });
    expect(verts).toHaveLength(12);
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    expect(Math.min(...xs)).toBeCloseTo(-50, 6);
    expect(Math.max(...xs)).toBeCloseTo(50, 6);
    expect(Math.min(...ys)).toBeCloseTo(-100, 6);
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
  });

  it('scales every vertex by `s` (mm → output units)', () => {
    const mm = buildIShapeProfile(100, 200, 1);
    const m = buildIShapeProfile(100, 200, 0.001);
    for (let i = 0; i < mm.length; i++) {
      expect(m[i].x).toBeCloseTo(mm[i].x * 0.001, 9);
      expect(m[i].y).toBeCloseTo(mm[i].y * 0.001, 9);
    }
  });

  it('falls back to default tf/tw when override absent', () => {
    const withDefaults = buildIShapeProfile(100, 200, 1);
    const explicit = buildIShapeProfile(100, 200, 1, { flangeThickness: 20, webThickness: 15 });
    expect(withDefaults).toEqual(explicit);
  });
});

describe('iShapeCrossSectionAreaMm2', () => {
  it('computes A = 2·b·tf + (h − 2·tf)·tw', () => {
    // 2·100·20 + (200 − 40)·15 = 4000 + 2400 = 6400
    expect(iShapeCrossSectionAreaMm2(100, 200, 20, 15)).toBeCloseTo(6400, 6);
  });

  it('clamps tw ≤ b so the web never exits the flange', () => {
    // b=10 → tw clamped from 15 to 10: 2·10·20 + (200−40)·10 = 400 + 1600 = 2000
    expect(iShapeCrossSectionAreaMm2(10, 200, 20, 15)).toBeCloseTo(2000, 6);
  });

  it('uses SSoT defaults when thicknesses omitted', () => {
    // tf=20, tw=15 → 6400 (same as explicit)
    expect(iShapeCrossSectionAreaMm2(100, 200)).toBeCloseTo(6400, 6);
  });

  it('returns 0 for degenerate dimensions', () => {
    expect(iShapeCrossSectionAreaMm2(0, 0)).toBe(0);
  });
});
