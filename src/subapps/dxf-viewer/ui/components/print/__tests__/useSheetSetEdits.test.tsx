/**
 * ADR-651 Φάση Μ — tests της action `applyPlan` του `useSheetSetEdits`.
 *
 * Το AI (reconciled) σχέδιο οδηγεί το **ίδιο** state: `applyPlan` πρέπει να **επιλέγει** ακριβώς
 * τους ορόφους του σχεδίου (αγνοώντας άγνωστα ids), να **επαναριθμεί** στη **σειρά των ορόφων**
 * (όχι στη σειρά του σχεδίου), και μια δεύτερη κλήση να **αντικαθιστά** την επιλογή (όχι union).
 */

import { act, renderHook } from '@testing-library/react';

import { useSheetSetEdits } from '../useSheetSetEdits';
import type { SheetRow } from '../../../../text-engine/title-block/sheet-set';

function makeRow(levelId: string, levelName: string): SheetRow {
  return { levelId, levelName, autoNumber: '', autoTitle: levelName, numberText: '', titleText: '' };
}

const ROWS: readonly SheetRow[] = [
  makeRow('lvl-basement', 'Υπόγειο'),
  makeRow('lvl-ground', 'Ισόγειο'),
  makeRow('lvl-first', '1ος όροφος'),
];

function numberOf(result: { current: ReturnType<typeof useSheetSetEdits> }, levelId: string): string {
  const row = ROWS.find((r) => r.levelId === levelId)!;
  return result.current.valuesFor(row).sheetNumber;
}

describe('useSheetSetEdits.applyPlan', () => {
  it('selects exactly the planned levels, ignoring unknown ids', () => {
    const { result } = renderHook(() => useSheetSetEdits(ROWS));
    act(() => result.current.applyPlan(['lvl-ground', 'ghost', 'lvl-first'], { prefix: 'Α', start: 1 }));
    expect([...result.current.selected].sort()).toEqual(['lvl-first', 'lvl-ground']);
    expect(result.current.selectedCount).toBe(2);
  });

  it('renumbers the selected levels in LEVEL order, not plan order', () => {
    const { result } = renderHook(() => useSheetSetEdits(ROWS));
    // Το σχέδιο δίνει first πριν ground — η αρίθμηση ακολουθεί τη σειρά των ROWS (ground πρώτα).
    act(() => result.current.applyPlan(['lvl-first', 'lvl-ground'], { prefix: 'Α', start: 1 }));
    expect(numberOf(result, 'lvl-ground')).toBe('Α-1');
    expect(numberOf(result, 'lvl-first')).toBe('Α-2');
    expect(numberOf(result, 'lvl-basement')).toBe(''); // μη επιλεγμένο ⇒ αυτόματο placeholder, μηδέν edit
  });

  it('honours a custom prefix and start number', () => {
    const { result } = renderHook(() => useSheetSetEdits(ROWS));
    act(() => result.current.applyPlan(['lvl-ground', 'lvl-first'], { prefix: 'S', start: 5 }));
    expect(numberOf(result, 'lvl-ground')).toBe('S-5');
    expect(numberOf(result, 'lvl-first')).toBe('S-6');
  });

  it('a second plan REPLACES the selection (never unions with the previous one)', () => {
    const { result } = renderHook(() => useSheetSetEdits(ROWS));
    act(() => result.current.applyPlan(['lvl-basement'], { prefix: 'Α', start: 1 }));
    expect([...result.current.selected]).toEqual(['lvl-basement']);
    act(() => result.current.applyPlan(['lvl-first'], { prefix: 'Α', start: 1 }));
    expect([...result.current.selected]).toEqual(['lvl-first']);
  });

  it('an empty plan clears the selection', () => {
    const { result } = renderHook(() => useSheetSetEdits(ROWS));
    act(() => result.current.applyPlan(['lvl-ground'], { prefix: 'Α', start: 1 }));
    expect(result.current.selectedCount).toBe(1);
    act(() => result.current.applyPlan([], { prefix: 'Α', start: 1 }));
    expect(result.current.selectedCount).toBe(0);
  });
});
