/**
 * ADR-507 Φ2 — integrity tests για τον predefined hatch pattern catalog.
 *
 * Επαληθεύει: ≥30 μοτίβα· μοναδικά ονόματα· έγκυρες `PatternLine` (delta-y ≠ 0)·
 * key === name· labelKey πεδίο υπάρχει· οι accessors (`getHatchPattern` case-insensitive,
 * `listHatchPatterns`) λειτουργούν.
 */

import {
  HATCH_PATTERN_CATALOG,
  getHatchPattern,
  listHatchPatterns,
  DEFAULT_HATCH_PATTERN_NAME,
} from '../hatch-pattern-catalog';

describe('hatch-pattern-catalog — integrity', () => {
  const patterns = listHatchPatterns();

  it('περιέχει ≥30 μοτίβα (ADR-507 Q5 «πλήρης 30+»)', () => {
    expect(patterns.length).toBeGreaterThanOrEqual(30);
  });

  it('όλα τα ονόματα είναι μοναδικά', () => {
    const names = patterns.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('key του record === pattern.name', () => {
    for (const [key, p] of Object.entries(HATCH_PATTERN_CATALOG)) {
      expect(p.name).toBe(key);
    }
  });

  it('κάθε μοτίβο έχει ≥1 έγκυρη PatternLine (delta-y ≠ 0)', () => {
    for (const p of patterns) {
      expect(p.lines.length).toBeGreaterThanOrEqual(1);
      for (const line of p.lines) {
        expect(Math.abs(line.delta[1])).toBeGreaterThan(0); // κάθετη απόσταση
        expect(line.origin).toHaveLength(2);
        expect(line.delta).toHaveLength(2);
        expect(Array.isArray(line.dashes)).toBe(true);
        expect(Number.isFinite(line.angle)).toBe(true);
      }
    }
  });

  it('κάθε μοτίβο έχει labelKey + category', () => {
    for (const p of patterns) {
      expect(typeof p.labelKey).toBe('string');
      expect(p.labelKey.length).toBeGreaterThan(0);
      expect(typeof p.category).toBe('string');
    }
  });

  it('περιλαμβάνει τα βασικά AutoCAD μοτίβα', () => {
    const names = new Set(patterns.map((p) => p.name));
    for (const expected of ['ANSI31', 'ANSI32', 'AR-CONC', 'BRICK', 'EARTH', 'STEEL']) {
      expect(names.has(expected)).toBe(true);
    }
  });

  it('getHatchPattern είναι case-insensitive + undefined-safe', () => {
    expect(getHatchPattern('ANSI31')?.name).toBe('ANSI31');
    expect(getHatchPattern('ansi31')?.name).toBe('ANSI31');
    expect(getHatchPattern(undefined)).toBeUndefined();
    expect(getHatchPattern('does-not-exist')).toBeUndefined();
  });

  it('DEFAULT_HATCH_PATTERN_NAME δείχνει σε υπαρκτό μοτίβο', () => {
    expect(getHatchPattern(DEFAULT_HATCH_PATTERN_NAME)).toBeDefined();
  });
});
