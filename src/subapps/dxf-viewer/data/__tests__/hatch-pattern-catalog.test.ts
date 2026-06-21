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
  getSuggestedScale,
  resolveEffectiveHatchScale,
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

describe('hatch-pattern-catalog — scale normalization', () => {
  it('κάθε μοτίβο σε suggested scale → ορατή πυκνότητα (delta-y_max × scale ≥ 30 mm)', () => {
    // Κανένα μοτίβο δεν πρέπει να βγαίνει υπερβολικά πυκνό στην προεπιλογή.
    for (const p of listHatchPatterns()) {
      const maxDeltaY = Math.max(...p.lines.map((l) => Math.abs(l.delta[1])));
      const visible = maxDeltaY * getSuggestedScale(p.name);
      expect(visible).toBeGreaterThanOrEqual(30);
    }
  });

  it('getSuggestedScale case-insensitive + default 1 για άγνωστο', () => {
    expect(getSuggestedScale('ANSI31')).toBe(getSuggestedScale('ansi31'));
    expect(getSuggestedScale('ANSI31')).toBeGreaterThan(1);
    expect(getSuggestedScale('does-not-exist')).toBe(1);
    expect(getSuggestedScale(undefined)).toBe(1);
  });

  it('resolveEffectiveHatchScale = suggested × user (user≤0 → 1)', () => {
    const s = getSuggestedScale('ANSI31');
    expect(resolveEffectiveHatchScale('ANSI31', 2)).toBe(s * 2);
    expect(resolveEffectiveHatchScale('ANSI31', undefined)).toBe(s);
    expect(resolveEffectiveHatchScale('ANSI31', 0)).toBe(s);
    expect(resolveEffectiveHatchScale('ANSI31', -3)).toBe(s);
  });
});
