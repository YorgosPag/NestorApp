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
  SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION,
  SEASONAL_SOLAR_IRRADIATION_KWHM2,
  SOLAR_ORIENTATIONS,
  SOLAR_SHADING_LEVELS,
  SOLAR_SHADING_OBSTRUCTION_FACTOR,
  azimuthToOrientation,
  computeGainUtilisation,
  getHeatingSeasonHours,
  getInternalGainWperM2,
  getSeasonalSolarIrradiation,
  getSolarShadingObstructionFactor,
} from '../annual-gains-config';
import type { ClimateZone } from '../../kenak-thermal-config';

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

// ─── L7.2 — orientation-aware ηλιακά κέρδη ──────────────────────────────────────

const ALL_ZONES: readonly ClimateZone[] = ['A', 'B', 'C', 'D'];

describe('azimuthToOrientation (8-way, 45° τομείς με κέντρο κάθε σημείο πυξίδας)', () => {
  it('αντιστοιχίζει τα κέντρα των τομέων στα 8 σημεία πυξίδας', () => {
    expect(azimuthToOrientation(0)).toBe('N');
    expect(azimuthToOrientation(45)).toBe('NE');
    expect(azimuthToOrientation(90)).toBe('E');
    expect(azimuthToOrientation(135)).toBe('SE');
    expect(azimuthToOrientation(180)).toBe('S');
    expect(azimuthToOrientation(225)).toBe('SW');
    expect(azimuthToOrientation(270)).toBe('W');
    expect(azimuthToOrientation(315)).toBe('NW');
  });

  it('τα κατώφλια των τομέων ανήκουν στον επόμενο (lower-inclusive)', () => {
    expect(azimuthToOrientation(22.5)).toBe('NE'); // [22.5,67.5)→NE
    expect(azimuthToOrientation(67.5)).toBe('E');
    expect(azimuthToOrientation(337.5)).toBe('N'); // [337.5,22.5)→N
  });

  it('είναι wrap-safe (κανονικοποιεί 360°, αρνητικά, >360°)', () => {
    expect(azimuthToOrientation(360)).toBe('N');
    expect(azimuthToOrientation(-45)).toBe('NW'); // = 315
    expect(azimuthToOrientation(405)).toBe('NE'); // = 45
    expect(azimuthToOrientation(720 + 180)).toBe('S');
  });
});

describe('getSeasonalSolarIrradiation — orientation overload', () => {
  it('χωρίς orientation επιστρέφει την orientation-agnostic μέση (backward-compatible)', () => {
    for (const zone of ALL_ZONES) {
      expect(getSeasonalSolarIrradiation(zone)).toBe(SEASONAL_SOLAR_IRRADIATION_KWHM2[zone]);
    }
  });

  it('με orientation επιστρέφει την τιμή του πίνακα ανά προσανατολισμό', () => {
    expect(getSeasonalSolarIrradiation('B', 'S')).toBe(
      SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION.B.S,
    );
    expect(getSeasonalSolarIrradiation('B', 'N')).toBe(
      SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION.B.N,
    );
  });

  it('Ν μέγιστο, Β ελάχιστο σε κάθε ζώνη (φυσική χειμερινού ήλιου)', () => {
    for (const zone of ALL_ZONES) {
      const values = SOLAR_ORIENTATIONS.map((o) => getSeasonalSolarIrradiation(zone, o));
      expect(getSeasonalSolarIrradiation(zone, 'S')).toBe(Math.max(...values));
      expect(getSeasonalSolarIrradiation(zone, 'N')).toBe(Math.min(...values));
      expect(getSeasonalSolarIrradiation(zone, 'S')).toBeGreaterThan(
        getSeasonalSolarIrradiation(zone, 'N'),
      );
    }
  });

  it('είναι συμμετρικό Α↔Δ, ΒΑ↔ΒΔ, ΝΑ↔ΝΔ (ίδια ακτινοβολία ανατολή/δύση)', () => {
    for (const zone of ALL_ZONES) {
      expect(getSeasonalSolarIrradiation(zone, 'E')).toBe(getSeasonalSolarIrradiation(zone, 'W'));
      expect(getSeasonalSolarIrradiation(zone, 'NE')).toBe(getSeasonalSolarIrradiation(zone, 'NW'));
      expect(getSeasonalSolarIrradiation(zone, 'SE')).toBe(getSeasonalSolarIrradiation(zone, 'SW'));
    }
  });
});

// ─── L7.3 — συντελεστής σκίασης εξωτ. εμποδίων ──────────────────────────────────

describe('getSolarShadingObstructionFactor (EN ISO 13790 §11.4.3 / ΤΟΤΕΕ obstruction)', () => {
  it('none → 1.0 (ελεύθερος ορίζοντας, zero-regression)', () => {
    expect(getSolarShadingObstructionFactor('none')).toBe(1.0);
  });

  it('είναι φθίνον με την ένταση εμποδίων (none > light > moderate > heavy)', () => {
    const none = getSolarShadingObstructionFactor('none');
    const light = getSolarShadingObstructionFactor('light');
    const moderate = getSolarShadingObstructionFactor('moderate');
    const heavy = getSolarShadingObstructionFactor('heavy');
    expect(none).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(heavy);
  });

  it('όλες οι τιμές ∈ (0,1] (πολλαπλασιαστής μείωσης κερδών)', () => {
    for (const level of SOLAR_SHADING_LEVELS) {
      const factor = SOLAR_SHADING_OBSTRUCTION_FACTOR[level];
      expect(factor).toBeGreaterThan(0);
      expect(factor).toBeLessThanOrEqual(1);
    }
  });

  it('εξαντλητικό Record για κάθε επίπεδο (exhaustive)', () => {
    for (const level of SOLAR_SHADING_LEVELS) {
      expect(getSolarShadingObstructionFactor(level)).toBe(SOLAR_SHADING_OBSTRUCTION_FACTOR[level]);
    }
  });

  it('ο μέσος όρος των 8 προσανατολισμών ≈ orientation-agnostic τιμή (βαθμονόμηση D-B)', () => {
    for (const zone of ALL_ZONES) {
      const sum = SOLAR_ORIENTATIONS.reduce((s, o) => s + getSeasonalSolarIrradiation(zone, o), 0);
      const mean = sum / SOLAR_ORIENTATIONS.length;
      const agnostic = SEASONAL_SOLAR_IRRADIATION_KWHM2[zone];
      expect(mean).toBeGreaterThan(agnostic - 1);
      expect(mean).toBeLessThan(agnostic + 1);
    }
  });
});
