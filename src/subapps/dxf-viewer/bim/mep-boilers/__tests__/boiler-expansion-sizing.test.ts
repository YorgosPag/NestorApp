/**
 * ADR-408 Εύρος Β #2 — Boiler expansion-vessel sizing (pure SSoT) unit tests.
 *
 * Pins `resolveRecommendedExpansionVesselL`: a present positive water content yields a
 * standard vessel rating snapped UP from the documented estimate; an absent / non-positive
 * value yields `null`; and an estimate above the largest rating clamps to the largest. The
 * figure is an indicative engineering estimate (NOT code-exact) — see the SSoT module.
 */

import {
  resolveRecommendedExpansionVesselL,
  SYSTEM_VOLUME_MULTIPLIER,
  EXPANSION_ACCEPTANCE_FACTOR,
} from '../boiler-expansion-sizing';
import { BOILER_EXPANSION_VESSEL_VOLUMES_L } from '../../types/mep-boiler-types';

describe('resolveRecommendedExpansionVesselL', () => {
  it('returns null for an absent / undefined water content', () => {
    expect(resolveRecommendedExpansionVesselL(undefined)).toBeNull();
  });

  it('returns null for a non-positive water content (≤ 0 treated as unspecified)', () => {
    expect(resolveRecommendedExpansionVesselL(0)).toBeNull();
    expect(resolveRecommendedExpansionVesselL(-5)).toBeNull();
  });

  it('snaps a small wall-hung boiler (2.5 L) up to the smallest standard rating (8 L)', () => {
    // raw = 2.5 × 5 × 0.06 = 0.75 L → first rating ≥ 0.75 is 8.
    expect(resolveRecommendedExpansionVesselL(2.5)).toBe(8);
  });

  it('snaps a floor-standing oil boiler (28 / 38 L) up to 12 L', () => {
    // raw(28) = 8.4 → 12 ; raw(38) = 11.4 → 12.
    expect(resolveRecommendedExpansionVesselL(28)).toBe(12);
    expect(resolveRecommendedExpansionVesselL(38)).toBe(12);
  });

  it('clamps an estimate above the largest rating to the largest available size', () => {
    const max = BOILER_EXPANSION_VESSEL_VOLUMES_L[BOILER_EXPANSION_VESSEL_VOLUMES_L.length - 1];
    // raw = 500 × 5 × 0.06 = 150 L ≫ 35 → clamps to the largest rating.
    expect(resolveRecommendedExpansionVesselL(500)).toBe(max);
  });

  it('always returns one of the standard ratings (never an arbitrary number)', () => {
    [1, 2.5, 5, 12, 28, 38, 60, 120].forEach((wc) => {
      const result = resolveRecommendedExpansionVesselL(wc);
      expect(result).not.toBeNull();
      expect(BOILER_EXPANSION_VESSEL_VOLUMES_L).toContain(result!);
    });
  });

  it('is monotonic — more water content never recommends a smaller vessel', () => {
    let prev = 0;
    [2.5, 12, 28, 38, 80, 200].forEach((wc) => {
      const result = resolveRecommendedExpansionVesselL(wc)!;
      expect(result).toBeGreaterThanOrEqual(prev);
      prev = result;
    });
  });

  it('exposes the documented engineering factors as positive constants', () => {
    // The estimate is the product of these two documented assumptions (see HONESTY note).
    expect(SYSTEM_VOLUME_MULTIPLIER).toBeGreaterThan(0);
    expect(EXPANSION_ACCEPTANCE_FACTOR).toBeGreaterThan(0);
  });
});
