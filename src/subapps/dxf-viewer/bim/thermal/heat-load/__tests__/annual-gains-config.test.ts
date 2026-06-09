/**
 * ADR-422 L7.1 — tests για το config αξιοποίησης κερδών (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Καλύπτει: getters ανά χρήση/ζώνη (πίνακες) + τον συντελεστή αξιοποίησης
 * `computeGainUtilisation(γ)` (EN ISO 13790, a0=1 ⇒ η=1/(1+γ)): οριακές τιμές,
 * μονοτονία (φθίνουσα στο γ), clamp [0,1].
 */

import {
  HEATING_SEASON_HOURS,
  INTERNAL_GAIN_W_PER_M2,
  SEASONAL_SOLAR_IRRADIATION_KWHM2,
  computeGainUtilisation,
  getHeatingSeasonHours,
  getInternalGainWperM2,
  getSeasonalSolarIrradiation,
} from '../annual-gains-config';

describe('annual-gains-config getters', () => {
  it('επιστρέφει εσωτερικά κέρδη ανά χρήση από τον πίνακα', () => {
    expect(getInternalGainWperM2('living-room')).toBe(INTERNAL_GAIN_W_PER_M2['living-room']);
    expect(getInternalGainWperM2('wc')).toBe(2);
    expect(getInternalGainWperM2('kitchen')).toBeGreaterThan(getInternalGainWperM2('hallway'));
  });

  it('επιστρέφει ώρες περιόδου θέρμανσης ανά ζώνη (αύξουσες με την ψυχρότητα)', () => {
    expect(getHeatingSeasonHours('B')).toBe(HEATING_SEASON_HOURS.B);
    expect(getHeatingSeasonHours('A')).toBeLessThan(getHeatingSeasonHours('D'));
  });

  it('επιστρέφει ηλιακή ακτινοβολία ανά ζώνη (φθίνουσα με την ψυχρότητα)', () => {
    expect(getSeasonalSolarIrradiation('B')).toBe(SEASONAL_SOLAR_IRRADIATION_KWHM2.B);
    expect(getSeasonalSolarIrradiation('A')).toBeGreaterThan(getSeasonalSolarIrradiation('D'));
  });
});

describe('computeGainUtilisation', () => {
  it('γ ≤ 0 ⇒ η = 1 (μηδέν κέρδη/απώλειες → no-op, καθόλου μείωση)', () => {
    expect(computeGainUtilisation(0)).toBe(1);
    expect(computeGainUtilisation(-5)).toBe(1);
  });

  it('γ = 1 ⇒ η = a0/(a0+1) = 0.5', () => {
    expect(computeGainUtilisation(1)).toBeCloseTo(0.5);
  });

  it('γ < 1 ⇒ η = 1/(1+γ) (a0=1, simplified seasonal)', () => {
    expect(computeGainUtilisation(0.25)).toBeCloseTo(1 / 1.25); // 0.8
    expect(computeGainUtilisation(0.5)).toBeCloseTo(1 / 1.5); // ~0.667
  });

  it('είναι φθίνουσα στο γ (περισσότερα κέρδη → μικρότερο ποσοστό αξιοποίησης)', () => {
    const a = computeGainUtilisation(0.2);
    const b = computeGainUtilisation(0.8);
    const c = computeGainUtilisation(2);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });

  it('μεγάλο γ ⇒ μικρό η, εντός [0,1] (clamp)', () => {
    const eta = computeGainUtilisation(100);
    expect(eta).toBeGreaterThanOrEqual(0);
    expect(eta).toBeLessThanOrEqual(1);
    expect(eta).toBeLessThan(0.05);
  });
});
