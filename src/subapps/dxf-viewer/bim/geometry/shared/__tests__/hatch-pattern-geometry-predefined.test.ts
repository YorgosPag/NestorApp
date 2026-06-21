/**
 * ADR-507 Φ2 — `buildPredefinedHatchLines` (predefined PAT γεωμετρία).
 *
 * Επαληθεύει: παραγωγή τμημάτων εντός ορίου· επίδραση scale (αραιότερο → λιγότερα)·
 * επίδραση angle· πολλαπλές γραμμές μοτίβου (σταυρωτό)· dash subdivision· edge cases.
 */

import { buildPredefinedHatchLines, buildHatchEntitySegments } from '../hatch-pattern-geometry';
import { getHatchPattern, resolveEffectiveHatchScale, type HatchPattern } from '../../../../data/hatch-pattern-catalog';
import type { HatchEntity } from '../../../../types/entities';

const SQUARE = [[
  { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
]];

function pattern(name: string): HatchPattern {
  const p = getHatchPattern(name);
  if (!p) throw new Error(`missing pattern ${name}`);
  return p;
}

/** Όλα τα άκρα μέσα στο bbox [0,100]² (μικρό eps για αριθμητικό θόρυβο). */
function allWithinSquare(segs: ReadonlyArray<{ start: { x: number; y: number }; end: { x: number; y: number } }>): boolean {
  const ok = (v: { x: number; y: number }) => v.x >= -0.5 && v.x <= 100.5 && v.y >= -0.5 && v.y <= 100.5;
  return segs.every((s) => ok(s.start) && ok(s.end));
}

describe('buildPredefinedHatchLines', () => {
  it('ANSI31 → πολλά τμήματα, όλα εντός ορίου', () => {
    const segs = buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: 1 });
    expect(segs.length).toBeGreaterThan(10);
    expect(allWithinSquare(segs)).toBe(true);
  });

  it('μεγαλύτερο scale → αραιότερο μοτίβο (λιγότερα τμήματα)', () => {
    const dense = buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: 1 });
    const sparse = buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: 10 });
    expect(sparse.length).toBeLessThan(dense.length);
    expect(sparse.length).toBeGreaterThan(0);
  });

  it('σταυρωτό μοτίβο (ANSI37: 2 οικογένειες) → περισσότερα από ένα single', () => {
    const single = buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: 5 });
    const crossed = buildPredefinedHatchLines(SQUARE, pattern('ANSI37'), { scale: 5 });
    expect(crossed.length).toBeGreaterThan(single.length);
  });

  it('dotted μοτίβο (DOTS) → πολλά μικρά τμήματα (κουκκίδες)', () => {
    const segs = buildPredefinedHatchLines(SQUARE, pattern('DOTS'), { scale: 2 });
    expect(segs.length).toBeGreaterThan(10);
    // οι κουκκίδες είναι πολύ μικρά τμήματα
    const lengths = segs.map((s) => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y));
    expect(Math.min(...lengths)).toBeLessThan(2);
  });

  it('γωνία περιστρέφει το μοτίβο (διαφορετική έξοδος)', () => {
    const a = buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: 5, angleDeg: 0 });
    const b = buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: 5, angleDeg: 90 });
    // 45° → 135° αλλάζει τον προσανατολισμό· τα πρώτα segment διαφέρουν.
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('island (τρύπα) → μικρότερο συνολικό μήκος (even-odd αφαιρεί την τρύπα)', () => {
    const ring = [
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
      [{ x: 40, y: 40 }, { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 }],
    ];
    const totalLen = (segs: ReadonlyArray<{ start: { x: number; y: number }; end: { x: number; y: number } }>) =>
      segs.reduce((sum, s) => sum + Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y), 0);
    const full = buildPredefinedHatchLines([ring[0]], pattern('ANSI31'), { scale: 3 });
    const holed = buildPredefinedHatchLines(ring, pattern('ANSI31'), { scale: 3, islandStyle: 'normal' });
    // η τρύπα σπάει γραμμές σε δύο (count ↑) αλλά αφαιρεί υλικό → συνολικό μήκος ↓.
    expect(totalLen(holed)).toBeLessThan(totalLen(full));
  });

  it('κενό όριο → []', () => {
    expect(buildPredefinedHatchLines([], pattern('ANSI31'), {})).toEqual([]);
    expect(buildPredefinedHatchLines([[{ x: 0, y: 0 }]], pattern('ANSI31'), {})).toEqual([]);
  });

  it('scale ≤ 0 → []', () => {
    expect(buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: 0 })).toEqual([]);
  });
});

describe('buildHatchEntitySegments (SSoT entity→segments resolver)', () => {
  const base = { type: 'hatch' as const, boundaryPaths: SQUARE };

  it('solid → [] (ο caller το χειρίζεται με fill)', () => {
    const e = { ...base, fillType: 'solid' } as unknown as HatchEntity;
    expect(buildHatchEntitySegments(e)).toEqual([]);
  });

  it('predefined → ίδιο με απευθείας buildPredefinedHatchLines στην effective scale (suggested×user)', () => {
    const e = { ...base, fillType: 'predefined', patternName: 'ANSI31', patternScale: 5 } as unknown as HatchEntity;
    const viaResolver = buildHatchEntitySegments(e);
    const eff = resolveEffectiveHatchScale('ANSI31', 5); // = suggested(ANSI31) × 5
    const viaDirect = buildPredefinedHatchLines(SQUARE, pattern('ANSI31'), { scale: eff, angleDeg: 0 });
    expect(viaResolver).toEqual(viaDirect);
  });

  it('user-defined → παράγει τμήματα (delegate buildHatchLines)', () => {
    const e = { ...base, fillType: 'user-defined', lineAngle: 0, lineSpacing: 10 } as unknown as HatchEntity;
    expect(buildHatchEntitySegments(e).length).toBeGreaterThan(0);
  });

  it('predefined με άγνωστο pattern → []', () => {
    const e = { ...base, fillType: 'predefined', patternName: 'NOPE' } as unknown as HatchEntity;
    expect(buildHatchEntitySegments(e)).toEqual([]);
  });

  it('κενό όριο → []', () => {
    const e = { type: 'hatch', fillType: 'predefined', patternName: 'ANSI31', boundaryPaths: [] } as unknown as HatchEntity;
    expect(buildHatchEntitySegments(e)).toEqual([]);
  });
});
