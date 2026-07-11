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

// ADR-635 Φ C.10 — acad.pat parity για τα μοτίβα του KADOS AutoCAD αρχείου. Πριν: GRASS
// είχε λάθος γωνίες (60/120 → άναρχες γραμμές)· SQUARE/HEX ΕΛΕΙΠΑΝ (catalog MISS → κανένα
// pattern). Κλειδώνει τους ορισμούς ώστε το «βελάκι»/τετράγωνο/εξάγωνο να ταιριάζουν 1:1.
describe('hatch-pattern-catalog — acad.pat parity (ADR-635 Φ C.10)', () => {
  const INCH = 25.4;

  it('GRASS = 3 οικογένειες 90/45/135 (ΟΧΙ 60/120 — το «άναρχο» bug)', () => {
    const grass = getHatchPattern('GRASS');
    expect(grass).toBeDefined();
    expect(grass!.lines.map((l) => l.angle).sort((a, b) => a - b)).toEqual([45, 90, 135]);
    // 45/135 delta = [0, 2″], dashes = [.1875″, -1.8125″] (το «στέλεχος» του βελακιού).
    const diag = grass!.lines.find((l) => l.angle === 45)!;
    expect(diag.delta[0]).toBeCloseTo(0);
    expect(diag.delta[1]).toBeCloseTo(2 * INCH);
    expect(diag.dashes).toHaveLength(2);
    expect(diag.dashes[0]).toBeCloseTo(0.1875 * INCH);
    expect(diag.dashes[1]).toBeCloseTo(-1.8125 * INCH);
  });

  it('SQUARE υπάρχει = 0/90 grid με τετράγωνα dashes (πριν: catalog MISS → κανένα pattern)', () => {
    const sq = getHatchPattern('SQUARE');
    expect(sq).toBeDefined();
    expect(sq!.lines.map((l) => l.angle).sort((a, b) => a - b)).toEqual([0, 90]);
    for (const l of sq!.lines) {
      expect(l.delta[1]).toBeCloseTo(0.25 * INCH);
      expect(l.dashes).toEqual([0.25 * INCH, -0.25 * INCH]);
    }
  });

  it('HEX υπάρχει = 0/60/120 οικογένειες (πριν: catalog MISS → κανένα pattern)', () => {
    const hex = getHatchPattern('HEX');
    expect(hex).toBeDefined();
    expect(hex!.lines.map((l) => l.angle).sort((a, b) => a - b)).toEqual([0, 60, 120]);
    for (const l of hex!.lines) {
      expect(l.delta[1]).toBeCloseTo(0.216506351 * INCH); // .25·sin60
      expect(l.dashes).toHaveLength(4);
    }
  });

  it('NET/ANSI31 παραμένουν ακριβή acad.pat (no regression)', () => {
    expect(getHatchPattern('ANSI31')!.lines[0].delta[1]).toBeCloseTo(3.175); // .125″
    const net = getHatchPattern('NET')!;
    expect(net.lines.map((l) => l.angle).sort((a, b) => a - b)).toEqual([0, 90]);
    for (const l of net.lines) expect(l.delta[1]).toBeCloseTo(3.175);
  });
});
