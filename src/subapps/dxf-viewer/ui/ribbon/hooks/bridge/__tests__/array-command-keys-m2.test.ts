/**
 * ADR-353 M2 — regression guard for the "magical" scatter/align/distribution
 * command keys. A key that the type guards do NOT recognize routes to a silent
 * no-op in `useRibbonArrayBridge` (the combobox renders but changes nothing),
 * so these assertions are the cheapest catch for that class of bug.
 */

import {
  ARRAY_RIBBON_KEYS,
  isArrayRibbonKey,
  isArrayRibbonStringKey,
  isArrayRibbonToggleKey,
} from '../array-command-keys';

describe('ADR-353 M2 array ribbon command keys', () => {
  const numericM2 = [
    ARRAY_RIBBON_KEYS.params.pathAlignOffset,
    ARRAY_RIBBON_KEYS.params.pathRotationJitter,
    ARRAY_RIBBON_KEYS.params.pathScaleJitter,
    ARRAY_RIBBON_KEYS.params.pathOffsetJitter,
    ARRAY_RIBBON_KEYS.params.pathSeed,
  ];

  it('recognizes every M2 numeric key as a combo (not string, not toggle)', () => {
    for (const key of numericM2) {
      expect(isArrayRibbonKey(key)).toBe(true);
      expect(isArrayRibbonStringKey(key)).toBe(false);
      expect(isArrayRibbonToggleKey(key)).toBe(false);
    }
  });

  it('recognizes pathDistribution as a string combo (not numeric, not toggle)', () => {
    const key = ARRAY_RIBBON_KEYS.stringParams.pathDistribution;
    expect(isArrayRibbonStringKey(key)).toBe(true);
    expect(isArrayRibbonKey(key)).toBe(false);
    expect(isArrayRibbonToggleKey(key)).toBe(false);
  });

  it('keeps all M2 keys distinct from each other and from the Phase-C path keys', () => {
    const all = [
      ...numericM2,
      ARRAY_RIBBON_KEYS.stringParams.pathDistribution,
      ARRAY_RIBBON_KEYS.params.pathCount,
      ARRAY_RIBBON_KEYS.params.pathSpacing,
      ARRAY_RIBBON_KEYS.stringParams.pathMethod,
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
