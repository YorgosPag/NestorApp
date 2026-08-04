/**
 * Characterisation net for `roundWithLargestRemainder` — written BEFORE the
 * ADR-235 apportionment extraction, against the engine exactly as it shipped.
 *
 * 🔑 Why this file exists at all: `src/services/ownership/` had **zero** tests.
 * The function that guarantees the 1000‰ total of every ownership table in the
 * product — the one three calculation methods delegate to — had no net under it.
 * Refactoring it without this file would have been blind.
 *
 * These tests describe **what the engine does today**, warts included (see the
 * `MIN_SHARES_PER_ROW` group: the minimum can defeat the target). They must stay
 * green, UNCHANGED, across the extraction — that is the proof that moving the
 * Hamilton core into `lib/ownership/millesimal-apportionment` changed no
 * behaviour. A characterisation test that gets edited alongside the refactor
 * proves nothing.
 *
 * @jest-environment node
 * @enterprise ADR-235 (Ownership Calculation Engine)
 */

import { roundWithLargestRemainder } from '@/services/ownership/ownership-calculation-engine';
import { MIN_SHARES_PER_ROW, TOTAL_SHARES_TARGET } from '@/types/ownership-table';

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

// ============================================================================
// The contract the three calculation methods rely on
// ============================================================================

describe('the sum reaches the target', () => {
  it('closes on 1000 where naive per-row rounding would land on 999', () => {
    // Three equal thirds: 333.33… each. Rounding each row on its own gives 999.
    const shares = roundWithLargestRemainder([100, 100, 100], TOTAL_SHARES_TARGET);
    expect(sum(shares)).toBe(TOTAL_SHARES_TARGET);
  });

  it('closes on 1000 where naive per-row rounding would land on 1001', () => {
    // 1/6 each → 166.66… → rounding each up gives 167 × 6 = 1002.
    const shares = roundWithLargestRemainder([1, 1, 1, 1, 1, 1], TOTAL_SHARES_TARGET);
    expect(sum(shares)).toBe(TOTAL_SHARES_TARGET);
  });

  it('closes on the reduced target when manual overrides took part of the 1000', () => {
    // calculateByArea/Value/Volume all pass `TOTAL_SHARES_TARGET - manualTotal`.
    const shares = roundWithLargestRemainder([80, 80, 70], TOTAL_SHARES_TARGET - 250);
    expect(sum(shares)).toBe(750);
  });

  it('gives every unit to the single row when there is only one', () => {
    expect(roundWithLargestRemainder([42], TOTAL_SHARES_TARGET)).toEqual([TOTAL_SHARES_TARGET]);
  });

  it('returns nothing for no rows', () => {
    expect(roundWithLargestRemainder([], TOTAL_SHARES_TARGET)).toEqual([]);
  });
});

// ============================================================================
// Proportionality — the shares track the inputs, not just the total
// ============================================================================

describe('the split follows the input weights', () => {
  it('halves the target for two equal rows', () => {
    expect(roundWithLargestRemainder([50, 50], TOTAL_SHARES_TARGET)).toEqual([500, 500]);
  });

  it('scales inputs that do not already add up to the target', () => {
    // Inputs are square metres, not millesimals: 400 m² total → 1000‰.
    expect(roundWithLargestRemainder([200, 120, 80], TOTAL_SHARES_TARGET))
      .toEqual([500, 300, 200]);
  });

  it('gives the bigger row the bigger share', () => {
    const [small, big] = roundWithLargestRemainder([1, 3], TOTAL_SHARES_TARGET);
    expect(big).toBeGreaterThan(small);
  });

  it('never lets two equal rows differ by more than one millesimal', () => {
    // The fairness half of Hamilton, and the half the total does NOT protect:
    // rounding each row to nearest instead of down makes six equal sixths come
    // out as 165/167/167/167/167/167 — still 1000‰, one owner short by 2‰.
    // Discovered by mutation: without this assertion that change passes.
    const shares = roundWithLargestRemainder([1, 1, 1, 1, 1, 1], TOTAL_SHARES_TARGET);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Where the leftover unit goes — this ends up in a notarial deed, so it must
// be reproducible, not merely "some row"
// ============================================================================

describe('the residue lands on the largest fractional remainder', () => {
  it('gives the extra millesimal to the row with the largest remainder', () => {
    // 333.3 / 333.3 / 333.4 → floors 333/333/333, one unit left over.
    expect(roundWithLargestRemainder([333.3, 333.3, 333.4], TOTAL_SHARES_TARGET))
      .toEqual([333, 333, 334]);
  });

  it('breaks a tie deterministically towards the earlier row', () => {
    // Two identical remainders, one unit to give: the first row takes it, every
    // time. A run-to-run coin flip would make the same table print differently.
    const first = roundWithLargestRemainder([1, 1, 1], TOTAL_SHARES_TARGET);
    const second = roundWithLargestRemainder([1, 1, 1], TOTAL_SHARES_TARGET);
    expect(first).toEqual([334, 333, 333]);
    expect(second).toEqual(first);
  });
});

// ============================================================================
// Degenerate input — all weights zero
// ============================================================================

describe('when no row carries any weight', () => {
  it('splits the target evenly instead of dividing by zero', () => {
    const shares = roundWithLargestRemainder([0, 0, 0], TOTAL_SHARES_TARGET);
    expect(sum(shares)).toBe(TOTAL_SHARES_TARGET);
    expect(shares).toEqual([334, 333, 333]);
  });

  it('gives out nothing when there is nothing to give', () => {
    expect(roundWithLargestRemainder([0, 0], 0)).toEqual([0, 0]);
  });
});

// ============================================================================
// The floor policy — every participating row owns at least one millesimal
// ============================================================================

describe('MIN_SHARES_PER_ROW floor', () => {
  it('lifts a row that would otherwise round down to nothing', () => {
    // A 0.01 m² storage next to 1000 m² of flats floors to 0‰.
    const shares = roundWithLargestRemainder([1000, 0.01], TOTAL_SHARES_TARGET);
    expect(shares[1]).toBe(MIN_SHARES_PER_ROW);
  });

  it('pays for the lift out of the largest row, keeping the total intact', () => {
    expect(roundWithLargestRemainder([1000, 0.01], TOTAL_SHARES_TARGET)).toEqual([999, 1]);
    expect(sum(roundWithLargestRemainder([1000, 0.01], TOTAL_SHARES_TARGET)))
      .toBe(TOTAL_SHARES_TARGET);
  });

  it('KNOWN LIMIT: the floor outranks the target when rows outnumber it', () => {
    // Documented, not endorsed. Four rows cannot share 2‰ while each holds ≥1‰,
    // so the floor wins and the total overshoots. Unreachable for real ownership
    // tables (target is 1000 minus manual overrides, rows are far fewer), but it
    // is what the code does, and a silent change here would be a value change.
    const shares = roundWithLargestRemainder([1, 0, 0, 0], 2);
    expect(shares).toEqual([1, 1, 1, 1]);
    expect(sum(shares)).toBeGreaterThan(2);
  });
});

// ============================================================================
// Integrality — a fractional millesimal is rejected downstream by validateTotal
// ============================================================================

describe('every share is a whole millesimal', () => {
  it('never returns a fraction', () => {
    const shares = roundWithLargestRemainder([13.7, 91.2, 44.05, 0.9], TOTAL_SHARES_TARGET);
    expect(shares.every(Number.isInteger)).toBe(true);
  });

  it('never returns a negative share for non-negative input', () => {
    const shares = roundWithLargestRemainder([13.7, 91.2, 44.05, 0.9], TOTAL_SHARES_TARGET);
    expect(shares.every(s => s >= 0)).toBe(true);
  });
});
