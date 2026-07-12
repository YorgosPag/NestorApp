/**
 * ADR-510 Φ2H — per-scene auto-fit LTSCALE (linetype dash density).
 *
 * The bug: a DXF authored in METERS is baked to canonical mm at import (ADR-462,
 * geometry ×1000) while its dash pattern keeps its raw magnitude → an ISO linetype on
 * a 13 m line renders ~737 sub-pixel periods → looks SOLID. `computeAutoLinetypeScale`
 * resolves a per-scene LTSCALE that brings the density back to a visible band, while
 * staying a no-op for scenes that already render fine.
 */

import {
  computeAutoLinetypeScale,
  linetypePeriodMm,
  maxUsedLinetypePeriodMm,
  AUTO_LTSCALE_TARGET_PERIODS,
  AUTO_LTSCALE_CLAMP_MAX,
  AUTO_LTSCALE_CLAMP_MIN,
} from '../linetype-autoscale';
import { resolveLinetypeDef } from '../linetype-dash-resolver';

describe('linetypePeriodMm', () => {
  test('sums absolute values (dash + gap + dot)', () => {
    expect(linetypePeriodMm([12, -3, 0, -3])).toBe(18);
    expect(linetypePeriodMm([])).toBe(0); // solid
    expect(linetypePeriodMm([5, -5])).toBe(10);
  });
});

describe('computeAutoLinetypeScale', () => {
  test('degenerate inputs → neutral 1', () => {
    expect(computeAutoLinetypeScale({ diagonalMm: 0, representativePeriodMm: 18 })).toBe(1);
    expect(computeAutoLinetypeScale({ diagonalMm: 1000, representativePeriodMm: 0 })).toBe(1);
    expect(computeAutoLinetypeScale({ diagonalMm: NaN, representativePeriodMm: 18 })).toBe(1);
  });

  test('already-good density → neutral 1 (mm-native scene untouched)', () => {
    // natural = 1000 / 50 = 20 periods → inside [6, 80] → no change.
    expect(computeAutoLinetypeScale({ diagonalMm: 1000, representativePeriodMm: 50 })).toBe(1);
  });

  test('too dense (meter-scale ISO line) → scales UP to hit the target density', () => {
    // The reported file: 13 m line (13272 mm) with ACAD_ISO10W100 (period 18).
    const lt = computeAutoLinetypeScale({ diagonalMm: 13272.78, representativePeriodMm: 18 });
    expect(lt).toBeGreaterThan(1);
    // Resulting periods across the diagonal ≈ TARGET (visible dashes, not sub-pixel).
    const periods = 13272.78 / (18 * lt);
    expect(periods).toBeCloseTo(AUTO_LTSCALE_TARGET_PERIODS, 5);
  });

  test('too sparse (one long dash) → scales DOWN to the target density', () => {
    const lt = computeAutoLinetypeScale({ diagonalMm: 13.27, representativePeriodMm: 18 });
    expect(lt).toBeLessThan(1);
    const periods = 13.27 / (18 * lt);
    expect(periods).toBeCloseTo(AUTO_LTSCALE_TARGET_PERIODS, 5);
  });

  test('clamps guard against runaway values', () => {
    expect(computeAutoLinetypeScale({ diagonalMm: 1e12, representativePeriodMm: 1e-6 }))
      .toBe(AUTO_LTSCALE_CLAMP_MAX);
    expect(computeAutoLinetypeScale({ diagonalMm: 1e-6, representativePeriodMm: 1e12 }))
      .toBe(AUTO_LTSCALE_CLAMP_MIN);
  });
});

describe('maxUsedLinetypePeriodMm', () => {
  test('Continuous alone → 0 (no non-solid linetype)', () => {
    expect(maxUsedLinetypePeriodMm(['Continuous'])).toBe(0);
  });

  test('picks the coarsest (largest-period) non-solid linetype', () => {
    const dashed = linetypePeriodMm(resolveLinetypeDef('Dashed')?.pattern ?? []);
    expect(dashed).toBeGreaterThan(0);
    // Continuous (0) must not shadow a real dashed period.
    expect(maxUsedLinetypePeriodMm(['Continuous', 'Dashed'])).toBe(dashed);
  });

  test('unknown names are skipped', () => {
    expect(maxUsedLinetypePeriodMm(['NotARealLinetype'])).toBe(0);
  });
});
