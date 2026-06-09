/**
 * ADR-422 L1/L7.4 — tests για το SSoT υαλοπίνακα (U-value + g-value ανά υαλοπίνακες).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Καλύπτει:
 *   - `getGlazingUValue` (L1): μονό/διπλό/τριπλό + default(2).
 *   - `getGlazingSolarFactor` (L7.4): default(2)→0.60 (zero-regression anchor), φθίνον
 *     με τους υαλοπίνακες (single>double>triple), exhaustive Record, κάθε τιμή ∈(0,1].
 */

import {
  DEFAULT_GLAZING_PANES,
  GLAZING_SOLAR_FACTOR_BY_PANES,
  GLAZING_U_BY_PANES,
  getGlazingSolarFactor,
  getGlazingUValue,
  type GlazingPanes,
} from '../glazing-u-catalog';

const ALL_PANES: readonly GlazingPanes[] = [1, 2, 3];

describe('getGlazingUValue (L1)', () => {
  it('default = διπλό υαλοπίνακα (2.8 W/m²K)', () => {
    expect(getGlazingUValue()).toBe(GLAZING_U_BY_PANES[DEFAULT_GLAZING_PANES]);
    expect(getGlazingUValue()).toBe(2.8);
  });

  it('μειώνεται με περισσότερους υαλοπίνακες (καλύτερη μόνωση)', () => {
    expect(getGlazingUValue(1)).toBeGreaterThan(getGlazingUValue(2));
    expect(getGlazingUValue(2)).toBeGreaterThan(getGlazingUValue(3));
  });
});

describe('getGlazingSolarFactor (L7.4 — g-value / SHGC)', () => {
  it('default = διπλό υαλοπίνακα → g=0.60 (zero-regression anchor)', () => {
    expect(getGlazingSolarFactor()).toBe(0.6);
    expect(getGlazingSolarFactor(DEFAULT_GLAZING_PANES)).toBe(0.6);
  });

  it('αντιστοιχίζει σωστά κάθε αριθμό υαλοπινάκων', () => {
    expect(getGlazingSolarFactor(1)).toBe(0.8);
    expect(getGlazingSolarFactor(2)).toBe(0.6);
    expect(getGlazingSolarFactor(3)).toBe(0.5);
  });

  it('φθίνον: μονός περνά περισσότερη ηλιακή από διπλό από τριπλό', () => {
    expect(getGlazingSolarFactor(1)).toBeGreaterThan(getGlazingSolarFactor(2));
    expect(getGlazingSolarFactor(2)).toBeGreaterThan(getGlazingSolarFactor(3));
  });

  it('absent panes (undefined) ⇒ default (διπλό) ⇒ 0.60', () => {
    const panes: GlazingPanes | undefined = undefined;
    expect(getGlazingSolarFactor(panes)).toBe(0.6);
  });

  it('exhaustive Record — ορισμένο για κάθε αριθμό υαλοπινάκων', () => {
    for (const panes of ALL_PANES) {
      expect(GLAZING_SOLAR_FACTOR_BY_PANES[panes]).toBeDefined();
      expect(getGlazingSolarFactor(panes)).toBe(GLAZING_SOLAR_FACTOR_BY_PANES[panes]);
    }
  });

  it('κάθε g-value είναι φυσικά έγκυρο ∈ (0,1]', () => {
    for (const panes of ALL_PANES) {
      const g = getGlazingSolarFactor(panes);
      expect(g).toBeGreaterThan(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });
});
