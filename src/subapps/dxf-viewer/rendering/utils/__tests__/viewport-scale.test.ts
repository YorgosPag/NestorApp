/**
 * ADR-508 — viewport-scale SSoT (worldPerPixel / pixelsToWorld + degenerate clamp).
 */

import { worldPerPixel, pixelsToWorld, MIN_VIEW_SCALE } from '../viewport-scale';

describe('worldPerPixel', () => {
  it('returns 1/scale for a normal scale', () => {
    expect(worldPerPixel(1)).toBeCloseTo(1);
    expect(worldPerPixel(2)).toBeCloseTo(0.5);
    expect(worldPerPixel(0.25)).toBeCloseTo(4);
  });
  it('clamps a zero / degenerate scale to MIN_VIEW_SCALE (no Infinity)', () => {
    expect(worldPerPixel(0)).toBeCloseTo(1 / MIN_VIEW_SCALE);
    expect(Number.isFinite(worldPerPixel(0))).toBe(true);
    expect(worldPerPixel(-5)).toBeCloseTo(1 / MIN_VIEW_SCALE); // negative also clamped
  });
});

describe('pixelsToWorld', () => {
  it('converts a screen-pixel length to world units', () => {
    expect(pixelsToWorld(3, 1)).toBeCloseTo(3);
    expect(pixelsToWorld(400, 2)).toBeCloseTo(200);
    expect(pixelsToWorld(25, 0.25)).toBeCloseTo(100);
  });
  it('worldPerPixel(s) === pixelsToWorld(1, s) (same SSoT clamp)', () => {
    for (const s of [0.001, 0.5, 1, 7.3, 0]) {
      expect(pixelsToWorld(1, s)).toBeCloseTo(worldPerPixel(s));
    }
  });
});
