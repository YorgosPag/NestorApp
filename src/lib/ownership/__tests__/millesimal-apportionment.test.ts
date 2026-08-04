/**
 * Millesimal apportionment — the value claims, stated as meaning.
 *
 * Organised by CLAIM, not by function. Every one of these is a number a person
 * reads off an ownership document, so each test says what the number means
 * ("an incomplete declaration stays incomplete"), never what the formula spells.
 * A test that restates the implementation moves with it and guards nothing.
 *
 * @jest-environment node
 * @enterprise ADR-235 §4 · ADR-244 · ADR-745 Φ3α
 */

import {
  allocateMillesimalsFromPercentages,
  apportionLargestRemainder,
} from '@/lib/ownership/millesimal-apportionment';

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

// ============================================================================
// The defect: a declared whole must come out whole
// ============================================================================

describe('a declaration adding up to 100% comes to exactly 1000‰', () => {
  it('THE 999 CASE: three siblings holding a third each', () => {
    // 33.33 + 33.33 + 33.34 = 100.00 exactly, and the save gate accepts it.
    // Rounding each row on its own wrote 333 + 333 + 333 = 999‰ to Firestore —
    // an ownership document short by one millesimal that nobody typed.
    const shares = allocateMillesimalsFromPercentages([33.33, 33.33, 33.34]);
    expect(sum(shares)).toBe(1000);
    expect(shares).toEqual([333, 333, 334]);
  });

  it('six co-owners of a sixth each', () => {
    const shares = allocateMillesimalsFromPercentages([16.67, 16.67, 16.67, 16.66, 16.67, 16.66]);
    expect(sum(shares)).toBe(1000);
  });

  it('the ordinary halves and quarters still come out exact', () => {
    expect(allocateMillesimalsFromPercentages([50, 50])).toEqual([500, 500]);
    expect(allocateMillesimalsFromPercentages([25, 25, 25, 25])).toEqual([250, 250, 250, 250]);
    expect(allocateMillesimalsFromPercentages([100])).toEqual([1000]);
  });
});

// ============================================================================
// The defect the obvious fix would have introduced
// ============================================================================

describe('what the user declared is what gets recorded', () => {
  it('A LONE 33.33% OWNER DOES NOT BECOME OWNER OF THE WHOLE PLOT', () => {
    // The guard against "just reuse roundWithLargestRemainder(raw, 1000)". That
    // function normalises to its target because the ownership table is HANDED
    // its 1000‰; here the total is the user's statement. `isOwnersValid` waves a
    // single owner through without ever looking at their percentage, so this row
    // is reachable — and rounding it to 1000‰ would record someone holding a
    // third of a plot as holding all of it.
    expect(allocateMillesimalsFromPercentages([33.33])).toEqual([333]);
  });

  it('an incomplete declaration stays incomplete', () => {
    // Two of three co-owners entered so far. 800‰ is the truth; 1000‰ would be
    // an invention, and one that looks perfectly correct on screen.
    const shares = allocateMillesimalsFromPercentages([50, 30]);
    expect(shares).toEqual([500, 300]);
    expect(sum(shares)).toBe(800);
  });

  it('an over-declaration is not quietly trimmed either', () => {
    // Mid-edit the draft can exceed 100%. Showing 1200‰ is what makes the user
    // fix it; silently capping at 1000‰ would hide the mistake until it mattered.
    expect(sum(allocateMillesimalsFromPercentages([60, 60]))).toBe(1200);
  });

  it('a landowner who declares nothing gets nothing — never a courtesy 1‰', () => {
    // The ownership table lifts every participating property to MIN_SHARES_PER_ROW.
    // That policy belongs to properties, not to people: a 0% row here is an empty
    // row, and 1‰ would make it look like an ownership stake.
    expect(allocateMillesimalsFromPercentages([100, 0])).toEqual([1000, 0]);
    expect(allocateMillesimalsFromPercentages([0, 0])).toEqual([0, 0]);
  });

  it('no landowners means no millesimals', () => {
    expect(allocateMillesimalsFromPercentages([])).toEqual([]);
  });
});

// ============================================================================
// Fairness — the property the total does not give you
// ============================================================================

describe('equal declarations are treated equally', () => {
  it('two owners declaring the same never differ by more than one millesimal', () => {
    const shares = allocateMillesimalsFromPercentages([
      14.28, 14.28, 14.29, 14.29, 14.28, 14.29, 14.29,
    ]);
    expect(sum(shares)).toBe(1000);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it('the bigger declaration always gets the bigger share', () => {
    const [a, b, c] = allocateMillesimalsFromPercentages([20, 30, 50]);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it('the leftover millesimal goes to the earlier row, every run', () => {
    // These numbers end up in a notarial deed. The same input has to produce the
    // same deed today and next year, on whatever engine happens to run it.
    const first = allocateMillesimalsFromPercentages([33.33, 33.33, 33.33]);
    const second = allocateMillesimalsFromPercentages([33.33, 33.33, 33.33]);
    expect(first).toEqual(second);
    expect(first).toEqual([334, 333, 333]);
  });
});

// ============================================================================
// The shared core, on its own terms
// ============================================================================

describe('the shared core hits whatever target it is given', () => {
  it('splits a target that has nothing to do with 1000', () => {
    // The ownership table calls it with 1000 minus manually overridden shares.
    const shares = apportionLargestRemainder([80, 80, 70], 750);
    expect(sum(shares)).toBe(750);
  });

  it('returns whole units only', () => {
    const shares = apportionLargestRemainder([13.7, 91.2, 44.05, 0.9], 1000);
    expect(shares.every(Number.isInteger)).toBe(true);
    expect(sum(shares)).toBe(1000);
  });

  it('shares a target evenly when no weight distinguishes the rows', () => {
    const shares = apportionLargestRemainder([0, 0, 0], 1000);
    expect(sum(shares)).toBe(1000);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });

  it('gives nothing out when there is nothing to give', () => {
    expect(apportionLargestRemainder([5, 5], 0)).toEqual([0, 0]);
    expect(apportionLargestRemainder([], 1000)).toEqual([]);
  });
});
