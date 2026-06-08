/**
 * ADR-422 L2 — tests για τον radiator-sizing engine (EN 442 exponent correction).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Worked examples με Ti = 20 °C (πρότυπη αναφορά EN 442):
 *   - 75/65 → AMTD = 50 → factor 1.0   (= ΔΤ_nominal, ουδέτερο)
 *   - 80/60 → AMTD = 50 → factor 1.0
 *   - 70/55 → AMTD = 42.5 → (50/42.5)^1.3 ≈ 1.227
 *   - 45/35 → AMTD = 20 → (50/20)^1.3 = 2.5^1.3 ≈ 3.39 (ενδοδαπέδια)
 */

import { computeRequiredRadiatorOutput } from '../radiator-sizing';
import {
  DEFAULT_RADIATOR_EXPONENT,
  DELTA_T_NOMINAL_K,
  resolveSystemRegime,
  SYSTEM_REGIME_PRESETS,
  DEFAULT_SYSTEM_REGIME_PRESET_ID,
} from '../radiator-sizing-config';

const n = DEFAULT_RADIATOR_EXPONENT;

describe('computeRequiredRadiatorOutput (EN 442)', () => {
  it('factor 1.0 όταν ΔΤ_actual = ΔΤ_nominal (75/65/20)', () => {
    const r = computeRequiredRadiatorOutput({ roomLoadW: 1000, supplyC: 75, returnC: 65, indoorC: 20, exponent: n });
    expect(r.deltaTActualK).toBeCloseTo(DELTA_T_NOMINAL_K, 6);
    expect(r.correctionFactor).toBeCloseTo(1.0, 6);
    expect(r.requiredNominalW).toBeCloseTo(1000, 6);
  });

  it('factor 1.0 και για 80/60/20 (ίδια AMTD = 50)', () => {
    const r = computeRequiredRadiatorOutput({ roomLoadW: 1500, supplyC: 80, returnC: 60, indoorC: 20, exponent: n });
    expect(r.deltaTActualK).toBeCloseTo(50, 6);
    expect(r.correctionFactor).toBeCloseTo(1.0, 6);
    expect(r.requiredNominalW).toBeCloseTo(1500, 6);
  });

  it('70/55/20 → AMTD 42.5 → factor ≈ 1.227', () => {
    const r = computeRequiredRadiatorOutput({ roomLoadW: 1000, supplyC: 70, returnC: 55, indoorC: 20, exponent: n });
    expect(r.deltaTActualK).toBeCloseTo(42.5, 6);
    expect(r.correctionFactor).toBeCloseTo(Math.pow(50 / 42.5, n), 6);
    expect(r.correctionFactor).toBeGreaterThan(1.2);
    expect(r.correctionFactor).toBeLessThan(1.25);
  });

  it('45/35/20 ενδοδαπέδια → AMTD 20 → factor ≈ 3.39', () => {
    const r = computeRequiredRadiatorOutput({ roomLoadW: 1000, supplyC: 45, returnC: 35, indoorC: 20, exponent: n });
    expect(r.deltaTActualK).toBeCloseTo(20, 6);
    expect(r.correctionFactor).toBeCloseTo(Math.pow(2.5, n), 6);
    expect(r.correctionFactor).toBeCloseTo(3.291, 3);
    expect(r.requiredNominalW).toBeGreaterThan(3250);
    expect(r.requiredNominalW).toBeLessThan(3350);
  });

  it('μεγαλύτερος εκθέτης n → μεγαλύτερη διόρθωση σε χαμηλό ΔΤ', () => {
    const lo = computeRequiredRadiatorOutput({ roomLoadW: 1000, supplyC: 45, returnC: 35, indoorC: 20, exponent: 1.1 });
    const hi = computeRequiredRadiatorOutput({ roomLoadW: 1000, supplyC: 45, returnC: 35, indoorC: 20, exponent: 1.4 });
    expect(hi.correctionFactor).toBeGreaterThan(lo.correctionFactor);
  });

  it('guard: ΔΤ_actual ≤ 0 (νερό όχι θερμότερο από χώρο) → factor 0, required = φορτίο', () => {
    const r = computeRequiredRadiatorOutput({ roomLoadW: 800, supplyC: 25, returnC: 15, indoorC: 20, exponent: n });
    expect(r.deltaTActualK).toBe(0);
    expect(r.correctionFactor).toBe(0);
    expect(r.requiredNominalW).toBe(800);
  });

  it('μη-πεπερασμένο φορτίο → 0 (καμία εξαίρεση)', () => {
    const r = computeRequiredRadiatorOutput({ roomLoadW: Number.NaN, supplyC: 75, returnC: 65, indoorC: 20, exponent: n });
    expect(r.requiredNominalW).toBe(0);
  });
});

describe('resolveSystemRegime (config SSoT)', () => {
  it('επιστρέφει το preset για έγκυρο id', () => {
    expect(resolveSystemRegime('45-35')).toEqual(SYSTEM_REGIME_PRESETS.find((p) => p.id === '45-35'));
  });

  it('fallback στο default όταν id απόν', () => {
    expect(resolveSystemRegime(undefined).id).toBe(DEFAULT_SYSTEM_REGIME_PRESET_ID);
  });

  it('default regime → AMTD 50 (factor 1.0 @ Ti 20)', () => {
    const def = resolveSystemRegime(undefined);
    const r = computeRequiredRadiatorOutput({ roomLoadW: 1000, supplyC: def.supplyC, returnC: def.returnC, indoorC: 20, exponent: n });
    expect(r.correctionFactor).toBeCloseTo(1.0, 6);
  });
});
