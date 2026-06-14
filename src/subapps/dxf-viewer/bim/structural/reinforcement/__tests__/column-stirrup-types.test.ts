/**
 * ADR-456 Slice 3 (static) — stirrup TYPE tests: quantity per type
 * (hooked vs welded vs spiral) + confinement effectiveness α = αn·αs.
 */

import { computeColumnReinforcementQuantities } from '../column-reinforcement-compute';
import { computeColumnConfinement } from '../column-confinement';
import type { ColumnReinforcement, StirrupType } from '../column-reinforcement-types';
import type { ColumnSectionContext } from '../../codes/structural-code-types';

const CTX: ColumnSectionContext = { widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 };

function reinf(type?: StirrupType): ColumnReinforcement {
  return {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type },
    coverMm: 30,
  };
}

describe('stirrup quantity per type', () => {
  it('welded uses LESS steel than hooked (no 135° hooks)', () => {
    const hooked = computeColumnReinforcementQuantities(CTX, reinf('closed-hooked'));
    const welded = computeColumnReinforcementQuantities(CTX, reinf('closed-welded'));
    expect(welded.stirrupWeightKg).toBeLessThan(hooked.stirrupWeightKg);
    expect(welded.stirrupCount).toBe(hooked.stirrupCount); // ίδιο πλήθος, μικρότερο μήκος
  });

  it('absent type === closed-hooked (back-compat)', () => {
    const def = computeColumnReinforcementQuantities(CTX, reinf(undefined));
    const hooked = computeColumnReinforcementQuantities(CTX, reinf('closed-hooked'));
    expect(def.stirrupTotalLengthM).toBeCloseTo(hooked.stirrupTotalLengthM, 6);
  });

  it('spiral produces a continuous length > 0 and turns count', () => {
    const spiral = computeColumnReinforcementQuantities(CTX, reinf('spiral'));
    expect(spiral.stirrupTotalLengthM).toBeGreaterThan(0);
    expect(spiral.stirrupCount).toBeGreaterThan(0);
    expect(spiral.stirrupWeightKg).toBeGreaterThan(0);
  });

  it('spiral total differs from discrete hooped total', () => {
    const spiral = computeColumnReinforcementQuantities(CTX, reinf('spiral'));
    const hooked = computeColumnReinforcementQuantities(CTX, reinf('closed-hooked'));
    expect(spiral.stirrupTotalLengthM).not.toBeCloseTo(hooked.stirrupTotalLengthM, 2);
  });
});

describe('confinement effectiveness α = αn·αs', () => {
  it('all factors in [0,1]', () => {
    const c = computeColumnConfinement(CTX, reinf('closed-hooked'));
    for (const v of [c.alphaN, c.alphaS, c.alpha]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(c.alpha).toBeCloseTo(c.alphaN * c.alphaS, 6);
  });

  it('spiral has αn = 1 (no in-plan gaps) → higher α than rectangular hoops', () => {
    const spiral = computeColumnConfinement(CTX, reinf('spiral'));
    const hooked = computeColumnConfinement(CTX, reinf('closed-hooked'));
    expect(spiral.alphaN).toBe(1);
    expect(hooked.alphaN).toBeLessThan(1);
    expect(spiral.alpha).toBeGreaterThan(hooked.alpha);
  });

  it('welded flags ductility restriction; hooked does not (same geometry → same α)', () => {
    const welded = computeColumnConfinement(CTX, reinf('closed-welded'));
    const hooked = computeColumnConfinement(CTX, reinf('closed-hooked'));
    expect(welded.ductilityWarning).toBe(true);
    expect(hooked.ductilityWarning).toBe(false);
    expect(welded.alpha).toBeCloseTo(hooked.alpha, 6);
  });

  it('degenerate core → zero α', () => {
    const tiny: ColumnSectionContext = { widthMm: 50, depthMm: 50, heightMm: 3000, grossAreaMm2: 2500 };
    const c = computeColumnConfinement(tiny, reinf('closed-hooked'));
    expect(c.alpha).toBe(0);
  });
});
