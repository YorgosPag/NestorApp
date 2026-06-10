/**
 * ADR-422 L1.7 — tests για τις config σταθερές αερισμού/διείσδυσης (EN 12831-1).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Επιβεβαιώνει: presets εντός φυσικού εύρους, exhaustive getters, default =
 * zero-regression (n50=0 / η=0), και τη χαρτογράφηση ανεμοπροστασίας ανά #όψεων.
 */

import {
  AIR_TIGHTNESS_LEVELS,
  DEFAULT_AIR_TIGHTNESS_LEVEL,
  DEFAULT_VENTILATION_SYSTEM,
  HEAT_RECOVERY_EFFICIENCY_BY_SYSTEM,
  HEIGHT_CORRECTION_FACTOR_EPSILON,
  INFILTRATION_N50_PRESETS,
  VENTILATION_SYSTEMS,
  WIND_SHIELDING_MULTIPLE_EXPOSED_FACADES,
  WIND_SHIELDING_NO_EXPOSED_FACADE,
  WIND_SHIELDING_SINGLE_EXPOSED_FACADE,
  getHeatRecoveryEfficiency,
  getInfiltrationN50,
  getWindShieldingCoefficient,
} from '../heat-load-config';

describe('L1.7 — αεροστεγανότητα n50', () => {
  it('default = unspecified ⇒ n50 = 0 (zero-regression)', () => {
    expect(DEFAULT_AIR_TIGHTNESS_LEVEL).toBe('unspecified');
    expect(getInfiltrationN50(DEFAULT_AIR_TIGHTNESS_LEVEL)).toBe(0);
  });

  it('presets αύξουσας διαπερατότητας εντός εύρους [0,10]', () => {
    expect(getInfiltrationN50('tight')).toBe(1.0);
    expect(getInfiltrationN50('standard')).toBe(3.0);
    expect(getInfiltrationN50('leaky')).toBe(6.0);
    expect(getInfiltrationN50('very-leaky')).toBe(10.0);
  });

  it('κάθε level στη λίστα έχει preset (exhaustive)', () => {
    for (const level of AIR_TIGHTNESS_LEVELS) {
      expect(INFILTRATION_N50_PRESETS[level]).toBeGreaterThanOrEqual(0);
      expect(INFILTRATION_N50_PRESETS[level]).toBeLessThanOrEqual(10);
    }
  });
});

describe('L1.7 — ανάκτηση θερμότητας η', () => {
  it('default = natural ⇒ η = 0 (zero-regression)', () => {
    expect(DEFAULT_VENTILATION_SYSTEM).toBe('natural');
    expect(getHeatRecoveryEfficiency(DEFAULT_VENTILATION_SYSTEM)).toBe(0);
  });

  it('mechanical χωρίς ανάκτηση ⇒ η = 0', () => {
    expect(getHeatRecoveryEfficiency('mechanical')).toBe(0);
  });

  it('hr παραλλαγές: standard 0.6 / high 0.8 / passive 0.9 (κάθε preset reachable)', () => {
    expect(getHeatRecoveryEfficiency('mechanical-hr-standard')).toBeCloseTo(0.6, 6);
    expect(getHeatRecoveryEfficiency('mechanical-hr-high')).toBeCloseTo(0.8, 6);
    expect(getHeatRecoveryEfficiency('mechanical-hr-passive')).toBeCloseTo(0.9, 6);
  });

  it('κάθε σύστημα στη λίστα έχει η ∈ [0,1) (exhaustive)', () => {
    for (const system of VENTILATION_SYSTEMS) {
      const eta = HEAT_RECOVERY_EFFICIENCY_BY_SYSTEM[system];
      expect(eta).toBeGreaterThanOrEqual(0);
      expect(eta).toBeLessThan(1);
    }
  });
});

describe('L1.7 — ανεμοπροστασία e ανά #εκτεθειμένων όψεων', () => {
  it('0 όψεις ⇒ 0 · 1 όψη ⇒ 0.02 · ≥2 όψεις ⇒ 0.03', () => {
    expect(getWindShieldingCoefficient(0)).toBe(WIND_SHIELDING_NO_EXPOSED_FACADE);
    expect(getWindShieldingCoefficient(1)).toBe(WIND_SHIELDING_SINGLE_EXPOSED_FACADE);
    expect(getWindShieldingCoefficient(2)).toBe(WIND_SHIELDING_MULTIPLE_EXPOSED_FACADES);
    expect(getWindShieldingCoefficient(5)).toBe(WIND_SHIELDING_MULTIPLE_EXPOSED_FACADES);
  });

  it('αρνητικά/NaN ⇒ 0', () => {
    expect(getWindShieldingCoefficient(-1)).toBe(0);
    expect(getWindShieldingCoefficient(Number.NaN)).toBe(0);
  });

  it('μονοτονία 0 ≤ e(0) ≤ e(1) ≤ e(2)', () => {
    expect(getWindShieldingCoefficient(0)).toBeLessThanOrEqual(getWindShieldingCoefficient(1));
    expect(getWindShieldingCoefficient(1)).toBeLessThanOrEqual(getWindShieldingCoefficient(2));
  });

  it('ε διόρθωση ύψους ≈ 1.0', () => {
    expect(HEIGHT_CORRECTION_FACTOR_EPSILON).toBeCloseTo(1.0, 6);
  });
});
