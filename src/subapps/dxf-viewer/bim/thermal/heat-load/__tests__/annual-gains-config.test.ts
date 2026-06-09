/**
 * ADR-422 L7.1 — tests για το config αξιοποίησης κερδών (pure).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Καλύπτει: getters ανά χρήση/ζώνη (πίνακες) + τον συντελεστή αξιοποίησης
 * `computeGainUtilisation(γ)` (EN ISO 13790, a0=1 ⇒ η=1/(1+γ)): οριακές τιμές,
 * μονοτονία (φθίνουσα στο γ), clamp [0,1].
 */

import {
  DEFAULT_SURFACE_COLOR_LEVEL,
  HEATING_SEASON_HOURS,
  INTERNAL_GAIN_W_PER_M2,
  SEASONAL_SOLAR_IRRADIATION_BY_ORIENTATION,
  SEASONAL_SOLAR_IRRADIATION_HORIZONTAL_KWHM2,
  SEASONAL_SOLAR_IRRADIATION_KWHM2,
  SOLAR_ABSORPTANCE_BY_LEVEL,
  SOLAR_ORIENTATIONS,
  SOLAR_SHADING_LEVELS,
  SOLAR_SHADING_OBSTRUCTION_FACTOR,
  SURFACE_COLOR_LEVELS,
  azimuthToOrientation,
  computeGainUtilisation,
  getHeatingSeasonHours,
  getHorizontalSolarIrradiation,
  getInternalGainWperM2,
  getSeasonalSolarIrradiation,
  getSolarAbsorptance,
  getSolarShadingObstructionFactor,
  getOverhangShadingFactor,
  getSkyViewFactor,
  EXTERNAL_RADIATIVE_COEFFICIENT_H_R,
  SKY_TEMP_DIFFERENCE_DELTA_THETA_ER,
  SKY_VIEW_FACTOR_BY_KIND,
  OVERHANG_SHADING_FACTOR,
  THERMAL_MASS_CAPACITY_J_PER_K_M2,
  THERMAL_MASS_LEVELS,
  UTILISATION_REFERENCE_PARAM_A0,
  UTILISATION_REFERENCE_TIME_CONSTANT_H,
  computeNumericParam,
  computeTimeConstantHours,
  getThermalMassCapacity,
  HORIZON_SHADING_FACTOR,
  HORIZON_SHADING_LEVELS,
  FIN_SHADING_FACTOR,
  FIN_SHADING_LEVELS,
  FIN_GEOMETRY_SHADING_FACTOR,
  getHorizonShadingFactor,
  getFinShadingFactor,
  getFinGeometryShadingFactor,
} from '../annual-gains-config';
import type { ClimateZone } from '../../kenak-thermal-config';
import type { HeatLoadBoundaryKind } from '../heat-load-types';

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

// ─── L7.7 — οριζόντια ηλιακή ακτινοβολία στέγης (roof horizontal irradiation) ──────

describe('getHorizontalSolarIrradiation (L7.7 — EN ISO 13790 §11.3.4 / ΤΟΤΕΕ οριζόντια)', () => {
  it('επιστρέφει τις τιμές του πίνακα ανά ζώνη', () => {
    for (const zone of ALL_ZONES) {
      expect(getHorizontalSolarIrradiation(zone)).toBe(
        SEASONAL_SOLAR_IRRADIATION_HORIZONTAL_KWHM2[zone],
      );
    }
  });

  it('είναι φθίνον με την ψυχρότητα της ζώνης (A > B > C > D)', () => {
    expect(getHorizontalSolarIrradiation('A')).toBeGreaterThan(getHorizontalSolarIrradiation('B'));
    expect(getHorizontalSolarIrradiation('B')).toBeGreaterThan(getHorizontalSolarIrradiation('C'));
    expect(getHorizontalSolarIrradiation('C')).toBeGreaterThan(getHorizontalSolarIrradiation('D'));
  });

  it('βαθμονόμηση: mean(8 προσαν.) < οριζόντια < νότια κατακόρυφη (χειμερινή φυσική)', () => {
    for (const zone of ALL_ZONES) {
      const horizontal = getHorizontalSolarIrradiation(zone);
      const southVertical = getSeasonalSolarIrradiation(zone, 'S');
      const agnosticMean = SEASONAL_SOLAR_IRRADIATION_KWHM2[zone];
      expect(horizontal).toBeGreaterThan(agnosticMean);
      expect(horizontal).toBeLessThan(southVertical);
    }
  });

  it('εξαντλητικό Record για κάθε ζώνη (exhaustive)', () => {
    for (const zone of ALL_ZONES) {
      expect(SEASONAL_SOLAR_IRRADIATION_HORIZONTAL_KWHM2[zone]).toBeGreaterThan(0);
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

// ─── L7.6 — ηλιακή απορρόφηση αδιαφανών εξωτ. τοίχων (α_S ανά απόχρωση) ──────────

describe('getSolarAbsorptance (L7.6 — EN ISO 13790 §11.3.4 / ΤΟΤΕΕ α_S)', () => {
  it('επιστρέφει τις τιμές πίνακα: light 0.3 / medium 0.6 / dark 0.9', () => {
    expect(getSolarAbsorptance('light')).toBe(0.3);
    expect(getSolarAbsorptance('medium')).toBe(0.6);
    expect(getSolarAbsorptance('dark')).toBe(0.9);
  });

  it('default απόχρωση = medium (α_S=0.6, τυπικός σοβάς)', () => {
    expect(DEFAULT_SURFACE_COLOR_LEVEL).toBe('medium');
    expect(getSolarAbsorptance(DEFAULT_SURFACE_COLOR_LEVEL)).toBe(0.6);
  });

  it('είναι αύξον με τη σκουρότητα (dark > medium > light)', () => {
    expect(getSolarAbsorptance('dark')).toBeGreaterThan(getSolarAbsorptance('medium'));
    expect(getSolarAbsorptance('medium')).toBeGreaterThan(getSolarAbsorptance('light'));
  });

  it('όλες οι τιμές ∈ (0,1] (φυσικός συντελεστής απορρόφησης)', () => {
    for (const level of SURFACE_COLOR_LEVELS) {
      const alpha = SOLAR_ABSORPTANCE_BY_LEVEL[level];
      expect(alpha).toBeGreaterThan(0);
      expect(alpha).toBeLessThanOrEqual(1);
    }
  });

  it('εξαντλητικό Record για κάθε επίπεδο (exhaustive)', () => {
    for (const level of SURFACE_COLOR_LEVELS) {
      expect(getSolarAbsorptance(level)).toBe(SOLAR_ABSORPTANCE_BY_LEVEL[level]);
    }
  });
});

describe('getOverhangShadingFactor (L7.3 Slice B — EN ISO 13790 §11.4.4 / ΤΟΤΕΕ πρόβολοι)', () => {
  it('γωνία 0 (κανένας πρόβολος) → 1.0 για κάθε προσανατολισμό (zero-regression)', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      expect(getOverhangShadingFactor(0, o)).toBe(1);
    }
  });

  it('αρνητική/μηδενική γωνία → 1.0 (clamp κανενός προβόλου)', () => {
    expect(getOverhangShadingFactor(-10, 'S')).toBe(1);
  });

  it('είναι φθίνον με τη γωνία προβόλου (μεγαλύτερος πρόβολος → λιγότερο κέρδος)', () => {
    const f0 = getOverhangShadingFactor(0, 'S');
    const f30 = getOverhangShadingFactor(30, 'S');
    const f45 = getOverhangShadingFactor(45, 'S');
    const f60 = getOverhangShadingFactor(60, 'S');
    expect(f0).toBeGreaterThan(f30);
    expect(f30).toBeGreaterThan(f45);
    expect(f45).toBeGreaterThan(f60);
  });

  it('νότιος κόβει περισσότερο από βόρειο στην ίδια γωνία (χαμηλός χειμερινός ήλιος)', () => {
    expect(getOverhangShadingFactor(45, 'S')).toBeLessThan(getOverhangShadingFactor(45, 'N'));
    expect(getOverhangShadingFactor(60, 'S')).toBeLessThan(getOverhangShadingFactor(60, 'N'));
  });

  it('επιστρέφει τις ακριβείς τιμές πίνακα στις κομβικές γωνίες', () => {
    const s = OVERHANG_SHADING_FACTOR.S;
    expect(getOverhangShadingFactor(30, 'S')).toBeCloseTo(s[1].factor); // 0.88
    expect(getOverhangShadingFactor(45, 'S')).toBeCloseTo(s[2].factor); // 0.72
  });

  it('γραμμική interpolation ενδιάμεσης γωνίας (37.5° → μέσο 30°/45°)', () => {
    const mid = getOverhangShadingFactor(37.5, 'S'); // μεταξύ 0.88 (30°) και 0.72 (45°)
    expect(mid).toBeCloseTo((0.88 + 0.72) / 2); // 0.80
  });

  it('γωνία πέρα από την τελευταία (>60°) → clamp στον τελευταίο συντελεστή', () => {
    expect(getOverhangShadingFactor(80, 'S')).toBeCloseTo(OVERHANG_SHADING_FACTOR.S[3].factor); // 0.55
  });

  it('όλες οι τιμές πίνακα ∈ (0,1] και μονότονα φθίνουσες ανά προσανατολισμό', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      const bands = OVERHANG_SHADING_FACTOR[o];
      for (let i = 0; i < bands.length; i++) {
        expect(bands[i].factor).toBeGreaterThan(0);
        expect(bands[i].factor).toBeLessThanOrEqual(1);
        if (i > 0) expect(bands[i].factor).toBeLessThanOrEqual(bands[i - 1].factor);
      }
    }
  });
});

describe('getSkyViewFactor (L7.8 — EN ISO 13790 §11.3.5 form factor προς ουρανό)', () => {
  it('στέγη βλέπει όλο τον ουρανό → 1.0', () => {
    expect(getSkyViewFactor('roof')).toBe(1.0);
    expect(SKY_VIEW_FACTOR_BY_KIND.roof).toBe(1.0);
  });

  it('κατακόρυφος τοίχος βλέπει τον μισό ουρανό → 0.5', () => {
    expect(getSkyViewFactor('wall')).toBe(0.5);
    expect(SKY_VIEW_FACTOR_BY_KIND.wall).toBe(0.5);
  });

  it('κατακόρυφο παράθυρο (L7.8-B) βλέπει τον μισό ουρανό → 0.5 (ίδιο με τοίχο)', () => {
    expect(getSkyViewFactor('window')).toBe(0.5);
    expect(SKY_VIEW_FACTOR_BY_KIND.window).toBe(0.5);
    expect(getSkyViewFactor('window')).toBe(getSkyViewFactor('wall'));
  });

  it('η στέγη χάνει διπλάσιο F_r από τον τοίχο (1.0 = 2 × 0.5)', () => {
    expect(getSkyViewFactor('roof')).toBeCloseTo(2 * getSkyViewFactor('wall'));
  });

  it('τα υπόλοιπα kinds δεν μπαίνουν στο sky balance v1 → 0', () => {
    const others: readonly HeatLoadBoundaryKind[] = ['door', 'floor', 'ceiling'];
    for (const kind of others) {
      expect(getSkyViewFactor(kind)).toBe(0);
    }
  });
});

describe('Sky-radiation κλιματικές σταθερές (L7.8 — h_r / Δθ_er)', () => {
  it('h_r > 0 (εξωτ. radiative coefficient, ISO εύρος ~4.5–5.1 για ε≈0.9)', () => {
    expect(EXTERNAL_RADIATIVE_COEFFICIENT_H_R).toBeGreaterThan(0);
    expect(EXTERNAL_RADIATIVE_COEFFICIENT_H_R).toBeCloseTo(5);
  });

  it('Δθ_er > 0 (εξωτ. αέρας ↔ φαινόμενος ουρανός, ISO ~9–11 K)', () => {
    expect(SKY_TEMP_DIFFERENCE_DELTA_THETA_ER).toBeGreaterThan(0);
    expect(SKY_TEMP_DIFFERENCE_DELTA_THETA_ER).toBeCloseTo(11);
  });
});

// ─── L7.9 — δυναμικός a0 με θερμική μάζα (EN ISO 13790 §12.2.1.1 / §12.3.1) ────────

// ─── L7.3 Slice C — ορίζοντας (F_hor) + πλευρικά πτερύγια (F_fin) ──────────────────

describe('getHorizonShadingFactor (L7.3 Slice C — EN ISO 13790 §11.4.4 ορίζοντας)', () => {
  it('none → 1.0 σε κάθε προσανατολισμό (zero-regression)', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      expect(getHorizonShadingFactor('none', o)).toBe(1.0);
    }
  });

  it('είναι φθίνον με την ένταση (none > low > medium > high) στον Νότο', () => {
    expect(getHorizonShadingFactor('none', 'S')).toBeGreaterThan(getHorizonShadingFactor('low', 'S'));
    expect(getHorizonShadingFactor('low', 'S')).toBeGreaterThan(getHorizonShadingFactor('medium', 'S'));
    expect(getHorizonShadingFactor('medium', 'S')).toBeGreaterThan(getHorizonShadingFactor('high', 'S'));
  });

  it('ο Νότος επηρεάζεται περισσότερο από τον Βορρά (χαμηλός χειμερινός ήλιος)', () => {
    expect(getHorizonShadingFactor('high', 'S')).toBeLessThan(getHorizonShadingFactor('high', 'N'));
    expect(getHorizonShadingFactor('medium', 'S')).toBeLessThan(getHorizonShadingFactor('medium', 'N'));
  });

  it('είναι συμμετρικό Α↔Δ / ΝΑ↔ΝΔ / ΒΑ↔ΒΔ', () => {
    for (const level of HORIZON_SHADING_LEVELS) {
      expect(getHorizonShadingFactor(level, 'E')).toBe(getHorizonShadingFactor(level, 'W'));
      expect(getHorizonShadingFactor(level, 'SE')).toBe(getHorizonShadingFactor(level, 'SW'));
      expect(getHorizonShadingFactor(level, 'NE')).toBe(getHorizonShadingFactor(level, 'NW'));
    }
  });

  it('χωρίς orientation → orientation-agnostic μέσος των 8 (fallback)', () => {
    const mean = SOLAR_ORIENTATIONS.reduce((s, o) => s + HORIZON_SHADING_FACTOR.medium[o], 0) / 8;
    expect(getHorizonShadingFactor('medium')).toBeCloseTo(mean);
  });

  it('όλες οι τιμές ∈ (0,1] — exhaustive', () => {
    for (const level of HORIZON_SHADING_LEVELS) {
      for (const o of SOLAR_ORIENTATIONS) {
        const f = HORIZON_SHADING_FACTOR[level][o];
        expect(f).toBeGreaterThan(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('getFinShadingFactor (L7.3 Slice C — EN ISO 13790 §11.4.4 πλευρικά πτερύγια)', () => {
  it('none → 1.0 σε κάθε προσανατολισμό (zero-regression)', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      expect(getFinShadingFactor('none', o)).toBe(1.0);
    }
  });

  it('είναι φθίνον με την ένταση (none > light > moderate > heavy) στην Ανατολή', () => {
    expect(getFinShadingFactor('none', 'E')).toBeGreaterThan(getFinShadingFactor('light', 'E'));
    expect(getFinShadingFactor('light', 'E')).toBeGreaterThan(getFinShadingFactor('moderate', 'E'));
    expect(getFinShadingFactor('moderate', 'E')).toBeGreaterThan(getFinShadingFactor('heavy', 'E'));
  });

  it('Ανατολή/Δύση επηρεάζονται περισσότερο από Νότο & Βορρά (πλάγιος ήλιος)', () => {
    expect(getFinShadingFactor('heavy', 'E')).toBeLessThan(getFinShadingFactor('heavy', 'S'));
    expect(getFinShadingFactor('heavy', 'E')).toBeLessThan(getFinShadingFactor('heavy', 'N'));
  });

  it('είναι συμμετρικό Α↔Δ / ΝΑ↔ΝΔ / ΒΑ↔ΒΔ', () => {
    for (const level of FIN_SHADING_LEVELS) {
      expect(getFinShadingFactor(level, 'E')).toBe(getFinShadingFactor(level, 'W'));
      expect(getFinShadingFactor(level, 'SE')).toBe(getFinShadingFactor(level, 'SW'));
      expect(getFinShadingFactor(level, 'NE')).toBe(getFinShadingFactor(level, 'NW'));
    }
  });

  it('χωρίς orientation → orientation-agnostic μέσος των 8 (fallback)', () => {
    const mean = SOLAR_ORIENTATIONS.reduce((s, o) => s + FIN_SHADING_FACTOR.moderate[o], 0) / 8;
    expect(getFinShadingFactor('moderate')).toBeCloseTo(mean);
  });

  it('όλες οι τιμές ∈ (0,1] — exhaustive', () => {
    for (const level of FIN_SHADING_LEVELS) {
      for (const o of SOLAR_ORIENTATIONS) {
        const f = FIN_SHADING_FACTOR[level][o];
        expect(f).toBeGreaterThan(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('getFinGeometryShadingFactor (L7.3 Slice D — geometry-derived πλευρικό πτερύγιο)', () => {
  it('β=0 → 1.0 σε κάθε προσανατολισμό (κανένα πτερύγιο, zero-regression)', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      expect(getFinGeometryShadingFactor(0, o)).toBe(1);
    }
  });

  it('β ≤ 0 → 1.0 (clamp, αρνητική γωνία)', () => {
    expect(getFinGeometryShadingFactor(-10, 'E')).toBe(1);
  });

  it('φθίνον με τη γωνία (Ανατολή): 0° > 30° > 45° > 60°', () => {
    const f0 = getFinGeometryShadingFactor(0, 'E');
    const f30 = getFinGeometryShadingFactor(30, 'E');
    const f45 = getFinGeometryShadingFactor(45, 'E');
    const f60 = getFinGeometryShadingFactor(60, 'E');
    expect(f0).toBeGreaterThan(f30);
    expect(f30).toBeGreaterThan(f45);
    expect(f45).toBeGreaterThan(f60);
  });

  it('Α/Δ κόβονται ΠΕΡΙΣΣΟΤΕΡΟ από Ν & Β στην ίδια γωνία (πλάγιος ήλιος — ΑΝΤΙΘΕΤΟ προβόλου)', () => {
    expect(getFinGeometryShadingFactor(45, 'E')).toBeLessThan(getFinGeometryShadingFactor(45, 'S'));
    expect(getFinGeometryShadingFactor(45, 'E')).toBeLessThan(getFinGeometryShadingFactor(45, 'N'));
    expect(getFinGeometryShadingFactor(30, 'S')).toBeLessThan(getFinGeometryShadingFactor(30, 'N'));
  });

  it('επιστρέφει τις τιμές πίνακα στις ακριβείς γωνίες (Ανατολή)', () => {
    const e = FIN_GEOMETRY_SHADING_FACTOR.E;
    expect(getFinGeometryShadingFactor(30, 'E')).toBeCloseTo(e[1].factor); // 0.72
    expect(getFinGeometryShadingFactor(45, 'E')).toBeCloseTo(e[2].factor); // 0.60
    expect(getFinGeometryShadingFactor(60, 'E')).toBeCloseTo(e[3].factor); // 0.50
  });

  it('γραμμική interpolation μεταξύ γωνιών (Ανατολή, 37.5° μεταξύ 0.72 & 0.60)', () => {
    const mid = getFinGeometryShadingFactor(37.5, 'E');
    expect(mid).toBeLessThan(FIN_GEOMETRY_SHADING_FACTOR.E[1].factor); // < 0.72
    expect(mid).toBeGreaterThan(FIN_GEOMETRY_SHADING_FACTOR.E[2].factor); // > 0.60
    expect(mid).toBeCloseTo((0.72 + 0.6) / 2); // 0.66
  });

  it('clamp πέρα από την τελευταία γωνία (80° → ο τελευταίος συντελεστής)', () => {
    expect(getFinGeometryShadingFactor(80, 'E')).toBeCloseTo(FIN_GEOMETRY_SHADING_FACTOR.E[3].factor); // 0.50
  });

  it('είναι συμμετρικό Α↔Δ / ΝΑ↔ΝΔ / ΒΑ↔ΒΔ σε κάθε γωνία', () => {
    for (const angle of [15, 30, 45, 60]) {
      expect(getFinGeometryShadingFactor(angle, 'E')).toBe(getFinGeometryShadingFactor(angle, 'W'));
      expect(getFinGeometryShadingFactor(angle, 'SE')).toBe(getFinGeometryShadingFactor(angle, 'SW'));
      expect(getFinGeometryShadingFactor(angle, 'NE')).toBe(getFinGeometryShadingFactor(angle, 'NW'));
    }
  });

  it('βαθμονόμηση: βαθύ πτερύγιο β≈22° ≈ Slice C moderate (Ανατολή)', () => {
    // d_fin=0.6, w_ref=1.5 → β=atan(0.4)=21.8°. Slice C: moderate E=0.78, heavy E=0.62.
    const fGeom = getFinGeometryShadingFactor((Math.atan(0.6 / 1.5) * 180) / Math.PI, 'E');
    expect(fGeom).toBeLessThan(getFinShadingFactor('light', 'E')); // < light (πιο σκιασμένο)
    expect(fGeom).toBeGreaterThan(getFinShadingFactor('heavy', 'E')); // > heavy (όχι ακραίο)
    expect(fGeom).toBeCloseTo(0.7965, 2); // ≈ Slice C moderate (0.78) τάξη μεγέθους
  });

  it('όλες οι τιμές πίνακα ∈ (0,1] — exhaustive', () => {
    for (const o of SOLAR_ORIENTATIONS) {
      for (const band of FIN_GEOMETRY_SHADING_FACTOR[o]) {
        expect(band.factor).toBeGreaterThan(0);
        expect(band.factor).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('getThermalMassCapacity (L7.9 — EN ISO 13790 §12.3.1 Πίν. 12)', () => {
  it('επιστρέφει τις τιμές του πίνακα ανά κλάση μάζας', () => {
    for (const level of THERMAL_MASS_LEVELS) {
      expect(getThermalMassCapacity(level)).toBe(THERMAL_MASS_CAPACITY_J_PER_K_M2[level]);
    }
  });

  it('είναι αύξον με τη βαρύτητα κατασκευής (very-light < … < very-heavy)', () => {
    for (let i = 1; i < THERMAL_MASS_LEVELS.length; i++) {
      expect(getThermalMassCapacity(THERMAL_MASS_LEVELS[i])).toBeGreaterThan(
        getThermalMassCapacity(THERMAL_MASS_LEVELS[i - 1]),
      );
    }
  });

  it('όλες οι τιμές > 0 (φυσική θερμοχωρητικότητα) — exhaustive', () => {
    expect(THERMAL_MASS_LEVELS).toHaveLength(5);
    for (const level of THERMAL_MASS_LEVELS) {
      expect(getThermalMassCapacity(level)).toBeGreaterThan(0);
    }
  });
});

describe('computeTimeConstantHours (L7.9 — τ = C_m / (H·3600))', () => {
  it('υπολογίζει τ σε ώρες (C_m=4.16e6 J/K, H=40 W/K → 28.889 h)', () => {
    expect(computeTimeConstantHours(4_160_000, 40)).toBeCloseTo(28.8889, 3);
  });

  it('μεγαλύτερη μάζα → μεγαλύτερη τ (ίδιο H)', () => {
    expect(computeTimeConstantHours(2_000_000, 40)).toBeGreaterThan(
      computeTimeConstantHours(1_000_000, 40),
    );
  });

  it('μικρότερες απώλειες → μεγαλύτερη τ (ίδιο C_m)', () => {
    expect(computeTimeConstantHours(2_000_000, 20)).toBeGreaterThan(
      computeTimeConstantHours(2_000_000, 40),
    );
  });

  it('H ≤ 0 ⇒ τ = 0 (fallback, ΟΧΙ άπειρο — μηδέν crash)', () => {
    expect(computeTimeConstantHours(4_160_000, 0)).toBe(0);
    expect(computeTimeConstantHours(4_160_000, -5)).toBe(0);
  });
});

describe('computeNumericParam (L7.9 — a0 = a0,ref + τ/τ0)', () => {
  it('reference pair = 1.0 / 15 h (monthly, συνεπές με zero-regression)', () => {
    expect(UTILISATION_REFERENCE_PARAM_A0).toBe(1.0);
    expect(UTILISATION_REFERENCE_TIME_CONSTANT_H).toBe(15);
  });

  it('τ = 0 ⇒ a0 = a0,ref (simplified baseline)', () => {
    expect(computeNumericParam(0)).toBe(UTILISATION_REFERENCE_PARAM_A0);
  });

  it('a0 = a0,ref + τ/τ0 (τ=15 ⇒ a0=2.0· τ=28.889 ⇒ a0≈2.926)', () => {
    expect(computeNumericParam(15)).toBeCloseTo(2.0);
    expect(computeNumericParam(28.8889)).toBeCloseTo(2.92593, 4);
  });

  it('είναι αύξον στο τ (μεγαλύτερη μάζα → μεγαλύτερο a0)', () => {
    expect(computeNumericParam(30)).toBeGreaterThan(computeNumericParam(10));
  });

  it('clamp a0 ≥ a0,ref για αρνητικό τ (μη-φυσικό)', () => {
    expect(computeNumericParam(-10)).toBe(UTILISATION_REFERENCE_PARAM_A0);
  });
});

describe('computeGainUtilisation — δυναμικό a0 (L7.9)', () => {
  it('absent a0 ⇒ a0,ref=1.0 ⇒ ίδιο με σημερινό (zero-regression)', () => {
    expect(computeGainUtilisation(0.25)).toBeCloseTo(computeGainUtilisation(0.25, 1.0));
    expect(computeGainUtilisation(1)).toBeCloseTo(computeGainUtilisation(1, 1.0));
    expect(computeGainUtilisation(1, 1.0)).toBeCloseTo(0.5); // a0/(a0+1)
  });

  it('είναι αύξουσα στο a0 (μεγαλύτερη μάζα → μεγαλύτερη αξιοποίηση), fixed γ<1', () => {
    const ref = computeGainUtilisation(0.2769, 1.0);
    const heavy = computeGainUtilisation(0.2769, 2.926);
    const veryHeavy = computeGainUtilisation(0.2769, 3.741);
    expect(heavy).toBeGreaterThan(ref);
    expect(veryHeavy).toBeGreaterThan(heavy);
  });

  it('παραμένει εντός [0,1] για μεγάλο a0 (clamp)', () => {
    const eta = computeGainUtilisation(0.5, 10);
    expect(eta).toBeGreaterThanOrEqual(0);
    expect(eta).toBeLessThanOrEqual(1);
  });

  it('γ ≤ 0 ⇒ η = 1 ανεξαρτήτως a0 (no-op)', () => {
    expect(computeGainUtilisation(0, 3)).toBe(1);
    expect(computeGainUtilisation(-1, 3)).toBe(1);
  });
});
