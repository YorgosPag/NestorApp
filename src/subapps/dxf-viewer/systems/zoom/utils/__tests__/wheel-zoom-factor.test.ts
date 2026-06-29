/**
 * Tests for the AutoCAD-parity exponential wheel-zoom helpers (magnitude-aware).
 * @see ../calculations — computeWheelZoomFactor / wheelDeltaForFactor
 */

import { computeWheelZoomFactor, wheelDeltaForFactor } from '../calculations';
import { ZOOM_FACTORS } from '../../../../config/transform-config';

describe('computeWheelZoomFactor — AutoCAD-parity exponential zoom', () => {
  it('zooms IN (factor > 1) on scroll-up (deltaY < 0)', () => {
    expect(computeWheelZoomFactor(-100)).toBeGreaterThan(1);
  });

  it('zooms OUT (factor < 1) on scroll-down (deltaY > 0)', () => {
    expect(computeWheelZoomFactor(100)).toBeLessThan(1);
  });

  it('is symmetric: in × out = 1 for equal-magnitude deltas', () => {
    const inF = computeWheelZoomFactor(-100);
    const outF = computeWheelZoomFactor(100);
    expect(inF * outF).toBeCloseTo(1, 10);
  });

  it('a standard notch (|deltaY|=100) is much snappier than the legacy 10%', () => {
    // ≈ +22% in / −18% out with the default sensitivity (vs the old flat 1.1 / 0.9).
    expect(computeWheelZoomFactor(-100)).toBeGreaterThan(ZOOM_FACTORS.WHEEL_IN);
    expect(computeWheelZoomFactor(100)).toBeLessThan(ZOOM_FACTORS.WHEEL_OUT);
  });

  it('Ctrl doubles the sensitivity (bigger step for same delta)', () => {
    const plain = computeWheelZoomFactor(-100, false);
    const ctrl = computeWheelZoomFactor(-100, true);
    expect(ctrl).toBeGreaterThan(plain);
    // exp(2x) === exp(x)^2 — Ctrl factor is the square of the plain factor.
    expect(ctrl).toBeCloseTo(plain * plain, 10);
  });

  it('clamps a "fling" (huge deltaY) to WHEEL_MAX_DELTA so zoom never jumps unboundedly', () => {
    const atMax = computeWheelZoomFactor(ZOOM_FACTORS.WHEEL_MAX_DELTA);
    const beyond = computeWheelZoomFactor(ZOOM_FACTORS.WHEEL_MAX_DELTA * 10);
    expect(beyond).toBe(atMax);
  });

  it('a larger delta zooms more than a smaller one (magnitude-aware)', () => {
    expect(computeWheelZoomFactor(-200)).toBeGreaterThan(computeWheelZoomFactor(-100));
  });
});

describe('wheelDeltaForFactor — inverse (synthetic / button callers)', () => {
  it('round-trips for modest factors (robust to WHEEL_ZOOM_PER_NOTCH tuning)', () => {
    // Modest factors stay within the anti-fling clamp for any reasonable per-notch setting.
    for (const f of [1.2, 0.8, 1.5, 0.7]) {
      expect(computeWheelZoomFactor(wheelDeltaForFactor(f))).toBeCloseTo(f, 10);
    }
  });

  it('saturates (does NOT round-trip) for an extreme factor — anti-fling guard', () => {
    // f=10 needs |delta| far beyond WHEEL_MAX_DELTA for any sane sensitivity → clamped → result < 10.
    expect(computeWheelZoomFactor(wheelDeltaForFactor(10))).toBeLessThan(10);
  });

  it('honours the exact BUTTON_IN factor (fixes the old ±120 → 10% bug)', () => {
    const delta = wheelDeltaForFactor(ZOOM_FACTORS.BUTTON_IN);
    expect(computeWheelZoomFactor(delta)).toBeCloseTo(ZOOM_FACTORS.BUTTON_IN, 10);
  });

  it('round-trips under the Ctrl sensitivity too', () => {
    const delta = wheelDeltaForFactor(1.2, true);
    expect(computeWheelZoomFactor(delta, true)).toBeCloseTo(1.2, 10);
  });
});
