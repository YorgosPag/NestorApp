/**
 * Σύνολα διαστημάτων (SSoT, ADR-929 Φ2): κανονικοποίηση, τομή, διαφορά, κάλυψη. Οι πράξεις ελέγχονται απέναντι σε
 * ωμή δύναμη πάνω σε πλέγμα, ώστε να μην εξαρτώνται από χειρόγραφα αναμενόμενα.
 */

import { describe, expect, it } from '@jest/globals';
import {
  coversInterval,
  intersectIntervals,
  intervalContaining,
  normalizeIntervals,
  subtractIntervals,
  unionIntervals,
  type Interval,
} from '../interval-set';

const set = (...pairs: [number, number][]): Interval[] => normalizeIntervals(pairs.map(([lo, hi]) => ({ lo, hi })));
const inSet = (s: readonly Interval[], x: number) => s.some((i) => i.lo <= x && x <= i.hi);

/** Δείγματα στο μέσο κάθε μοναδιαίου κελιού: η ωμή αλήθεια για ακέραια άκρα. */
function bruteCheck(a: Interval[], b: Interval[], op: (x: boolean, y: boolean) => boolean, got: readonly Interval[]): void {
  for (let x = -0.5; x <= 30.5; x += 1) expect(inSet(got, x)).toBe(op(inSet(a, x), inSet(b, x)));
}

describe('interval-set', () => {
  it('κανονικοποίηση: ταξινόμηση, συγχώνευση επικαλύψεων και κενών ως joinGap, απόρριψη κενών', () => {
    expect(normalizeIntervals([{ lo: 5, hi: 7 }, { lo: 0, hi: 2 }, { lo: 1, hi: 3 }, { lo: 4, hi: 4 }])).toEqual([
      { lo: 0, hi: 3 }, { lo: 5, hi: 7 },
    ]);
    expect(normalizeIntervals([{ lo: 0, hi: 2 }, { lo: 3, hi: 4 }], 1)).toEqual([{ lo: 0, hi: 4 }]);
  });

  it('τομή / διαφορά / ένωση = ωμή δύναμη', () => {
    const a = set([0, 5], [8, 14], [20, 26]);
    const b = set([3, 10], [12, 22], [25, 30]);
    bruteCheck(a, b, (x, y) => x && y, intersectIntervals(a, b));
    bruteCheck(a, b, (x, y) => x && !y, subtractIntervals(a, b));
    bruteCheck(a, b, (x, y) => x || y, unionIntervals(a, b));
  });

  it('κάλυψη και διάστημα που περιέχει σημείο, με ανοχή', () => {
    const s = set([0, 10], [12, 20]);
    expect(coversInterval(s, 2, 8)).toBe(true);
    expect(coversInterval(s, 8, 14)).toBe(false);
    expect(coversInterval(s, 0.5, 10.5, 1)).toBe(true);
    expect(intervalContaining(s, 11)).toBeNull();
    expect(intervalContaining(s, 11, 1)).toEqual({ lo: 0, hi: 10 });
  });
});
