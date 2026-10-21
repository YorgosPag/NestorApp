/**
 * ADR-917 Φ3γ · Α29 — the optimistic overlay of the budget editor: shown at once, rolled back by DROPPING the
 * overlay, a conflict keeps the human's side, and `expectedRevision` comes from the confirmed layer only.
 */

import {
  budgetLineConflicts,
  confirm,
  dismissConflict,
  displayedBudgetLines,
  EMPTY_BUDGET_LINES,
  expectedRevisionOf,
  markConflict,
  replaceConfirmed,
  rollback,
  withOverlay,
  type ConfirmedBudgetLine,
} from '../budget-lines-optimistic';

const line = (costCode: string, amount: number, revision: number): ConfirmedBudgetLine =>
  ({ costCode, amount, note: null, revision });

const loaded = replaceConfirmed(EMPTY_BUDGET_LINES, [line('SOFT-LAND', 100, 2), line('OIK-2', 50, 1)]);

describe('budget lines — optimistic overlay (Α29)', () => {
  it('shown in taxonomy order (ΑΤΟΕ → soft), confirmed ones not pending', () => {
    expect(displayedBudgetLines(loaded)).toEqual([
      { costCode: 'OIK-2', amount: 50, note: null, pending: false },
      { costCode: 'SOFT-LAND', amount: 100, note: null, pending: false },
    ]);
  });

  it('🔴 an edit shows AT ONCE as pending; the revision sent is still the confirmed one', () => {
    const editing = withOverlay(loaded, 'SOFT-LAND', { amount: 900, note: 'x' });
    expect(displayedBudgetLines(editing)[1]).toEqual({ costCode: 'SOFT-LAND', amount: 900, note: 'x', pending: true });
    expect(expectedRevisionOf(editing, 'SOFT-LAND')).toBe(2);
    expect(expectedRevisionOf(editing, 'SOFT-DESIGN')).toBe(0);
  });

  it('🔴 rollback returns to the confirmed value — nothing typed survives a failure', () => {
    const failed = rollback(withOverlay(loaded, 'SOFT-LAND', { amount: 900, note: null }), 'SOFT-LAND');
    expect(displayedBudgetLines(failed)).toEqual(displayedBudgetLines(loaded));
  });

  it('confirm: the server line becomes the truth (its revision is the next expected one)', () => {
    const saved = confirm(withOverlay(loaded, 'SOFT-LAND', { amount: 900, note: null }), 'SOFT-LAND', line('SOFT-LAND', 900, 3));
    expect(displayedBudgetLines(saved)[1].pending).toBe(false);
    expect(expectedRevisionOf(saved, 'SOFT-LAND')).toBe(3);
  });

  it('an archive hides the line at once; confirmed as `null` it is gone with its revision', () => {
    const archiving = withOverlay(loaded, 'OIK-2', null);
    expect(displayedBudgetLines(archiving).map(row => row.costCode)).toEqual(['SOFT-LAND']);
    expect(expectedRevisionOf(confirm(archiving, 'OIK-2', null), 'OIK-2')).toBe(0);
  });

  it('🔴 409: the human\'s version leaves the table but is KEPT next to theirs', () => {
    const conflicted = markConflict(withOverlay(loaded, 'SOFT-LAND', { amount: 900, note: null }), 'SOFT-LAND');
    const reread = replaceConfirmed(conflicted, [line('SOFT-LAND', 300, 4), line('OIK-2', 50, 1)]);
    expect(displayedBudgetLines(reread)[1]).toEqual({ costCode: 'SOFT-LAND', amount: 300, note: null, pending: false });
    expect(budgetLineConflicts(reread)).toEqual([
      { costCode: 'SOFT-LAND', mine: { amount: 900, note: null }, theirs: line('SOFT-LAND', 300, 4) },
    ]);
    expect(budgetLineConflicts(dismissConflict(reread, 'SOFT-LAND'))).toEqual([]);
  });

  it('a fresh read keeps overlays still in flight on top', () => {
    const editing = withOverlay(loaded, 'SOFT-LAND', { amount: 900, note: null });
    expect(displayedBudgetLines(replaceConfirmed(editing, [line('SOFT-LAND', 100, 2)]))[0].amount).toBe(900);
  });
});
