/**
 * ADR-377 — BIM Line Patterns tests.
 */
import { describe, it, expect } from '@jest/globals';
import {
  BIM_LINE_PATTERNS,
  BUILT_IN_DASH_ARRAYS,
  linePatternToDashArray,
} from '../bim-line-patterns';

describe('BIM_LINE_PATTERNS', () => {
  it('has exactly 28 built-in patterns', () => {
    expect(BIM_LINE_PATTERNS.length).toBe(28);
  });

  it('starts with solid', () => {
    expect(BIM_LINE_PATTERNS[0]).toBe('solid');
  });

  it('includes all 9 standard variant families (3× each)', () => {
    const families = ['dashed', 'dotted', 'center', 'hidden', 'dashdot', 'divide', 'phantom', 'border'];
    for (const base of families) {
      expect(BIM_LINE_PATTERNS).toContain(base as typeof BIM_LINE_PATTERNS[number]);
      expect(BIM_LINE_PATTERNS).toContain(`${base}2` as typeof BIM_LINE_PATTERNS[number]);
      expect(BIM_LINE_PATTERNS).toContain(`${base}X2` as typeof BIM_LINE_PATTERNS[number]);
    }
  });

  it('includes special patterns double, dot, zigzag', () => {
    expect(BIM_LINE_PATTERNS).toContain('double');
    expect(BIM_LINE_PATTERNS).toContain('dot');
    expect(BIM_LINE_PATTERNS).toContain('zigzag');
  });
});

describe('BUILT_IN_DASH_ARRAYS', () => {
  it('has an entry for every built-in pattern', () => {
    for (const key of BIM_LINE_PATTERNS) {
      expect(BUILT_IN_DASH_ARRAYS[key]).toBeDefined();
    }
  });

  it('solid maps to empty array (ctx.setLineDash([]) = native solid)', () => {
    expect(BUILT_IN_DASH_ARRAYS.solid).toEqual([]);
  });

  it('dashed maps to [8, 4]', () => {
    expect(BUILT_IN_DASH_ARRAYS.dashed).toEqual([8, 4]);
  });

  it('dashedX2 is double dashed (16, 8)', () => {
    expect(BUILT_IN_DASH_ARRAYS.dashedX2).toEqual([16, 8]);
  });

  it('dashed2 is half dashed (4, 2)', () => {
    expect(BUILT_IN_DASH_ARRAYS.dashed2).toEqual([4, 2]);
  });

  it('dot maps to [0, 4] (pure point marks)', () => {
    expect(BUILT_IN_DASH_ARRAYS.dot).toEqual([0, 4]);
  });

  it('center has 4-segment array (long-short pattern)', () => {
    expect(BUILT_IN_DASH_ARRAYS.center.length).toBe(4);
  });

  it('divide has 6-segment array (dash + 2 dots)', () => {
    expect(BUILT_IN_DASH_ARRAYS.divide.length).toBe(6);
  });

  it('all dash arrays contain only non-negative numbers', () => {
    for (const arr of Object.values(BUILT_IN_DASH_ARRAYS)) {
      for (const val of arr) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('X2 variants have entries double the length of base variants for dashed family', () => {
    const base = BUILT_IN_DASH_ARRAYS.dashed;
    const x2 = BUILT_IN_DASH_ARRAYS.dashedX2;
    expect(x2[0]).toBe(base[0]! * 2);
    expect(x2[1]).toBe(base[1]! * 2);
  });
});

describe('linePatternToDashArray', () => {
  it('returns empty array for solid', () => {
    expect(linePatternToDashArray('solid')).toEqual([]);
  });

  it('returns correct array for dashed', () => {
    expect(linePatternToDashArray('dashed')).toEqual([8, 4]);
  });

  it('returns correct array for center (4-segment)', () => {
    expect(linePatternToDashArray('center')).toEqual([20, 6, 4, 6]);
  });

  it('returns custom pattern from map when present', () => {
    const map = new Map<string, ReadonlyArray<number>>([
      ['custom_insulation', [4, 2, 2, 2]],
    ]);
    expect(linePatternToDashArray('custom_insulation', map)).toEqual([4, 2, 2, 2]);
  });

  it('returns solid fallback [] for unknown custom key without map', () => {
    expect(linePatternToDashArray('custom_unknown')).toEqual([]);
  });

  it('returns solid fallback [] for custom key not in map', () => {
    const map = new Map<string, ReadonlyArray<number>>();
    expect(linePatternToDashArray('custom_nothere', map)).toEqual([]);
  });

  it('solid lookup is zero-allocation (returns the same array reference)', () => {
    const a = linePatternToDashArray('solid');
    const b = linePatternToDashArray('solid');
    expect(a).toBe(b);
  });
});
