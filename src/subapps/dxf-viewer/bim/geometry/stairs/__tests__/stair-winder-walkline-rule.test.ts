/**
 * ADR-630 — winder code-minimums + validator warning SSoT tests.
 *
 * The balanced geometry (wedges reaching P + swung transition treads) is tested
 * in `stair-winder-balanced-band.test.ts`; this file covers the mm minimum table,
 * the unit-agnostic resolver, and the walkline-going warning.
 *
 * @see ../stair-winder-walkline-rule.ts
 */

import type { StairCodeProfile } from '../../../../bim/types/stair-types';
import {
  WINDER_CODE_MINIMUMS_MM,
  resolveWinderMinimums,
  winderWalklineWarnings,
} from '../stair-winder-walkline-rule';

const ALL_PROFILES: readonly StairCodeProfile[] = [
  'nok', 'ibc', 'eurocode', 'nbc', 'nfpa', 'as1657', 'din', 'ada', 'none',
];

describe('WINDER_CODE_MINIMUMS_MM', () => {
  it('covers every code profile', () => {
    for (const p of ALL_PROFILES) {
      expect(WINDER_CODE_MINIMUMS_MM[p]).toBeDefined();
    }
  });

  it('disables the rule for the "none" profile', () => {
    expect(WINDER_CODE_MINIMUMS_MM.none).toEqual({
      walklineOffsetMm: 0,
      minWalklineGoingMm: 0,
      minInnerGoingMm: 0,
    });
  });
});

describe('resolveWinderMinimums', () => {
  it('returns raw mm when width is already in mm (scale = 1)', () => {
    const m = resolveWinderMinimums('nok', 1200);
    expect(m.walklineOffset).toBeCloseTo(300, 6);
    expect(m.minWalklineGoing).toBeCloseTo(250, 6);
    expect(m.minInnerGoing).toBeCloseTo(130, 6);
  });

  it('scales to scene units when width is in metres', () => {
    const m = resolveWinderMinimums('nok', 1.2); // 1.2 → metres → ×0.001
    expect(m.walklineOffset).toBeCloseTo(0.3, 9);
    expect(m.minInnerGoing).toBeCloseTo(0.13, 9);
  });

  it('scales to scene units when width is in centimetres', () => {
    const m = resolveWinderMinimums('ibc', 90); // 90 → cm range [10,100) → ×0.1
    expect(m.walklineOffset).toBeCloseTo(30.5, 6);
    expect(m.minInnerGoing).toBeCloseTo(15.2, 6);
  });
});

describe('winderWalklineWarnings', () => {
  it('is silent when the equal going meets the code minimum', () => {
    expect(winderWalklineWarnings(272, 250)).toHaveLength(0);
  });

  it('warns when the equal going drops below the code minimum', () => {
    expect(winderWalklineWarnings(240, 250)).toContain('winder-walkline-going-below-min');
  });

  it('never warns when the minimum is disabled (profile "none" → 0)', () => {
    expect(winderWalklineWarnings(100, 0)).toHaveLength(0);
  });
});
