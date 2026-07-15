/**
 * ADR-651 Φάση Μ — tests του reconciliation (AI σχέδιο σετ → έγκυρο `SheetSetPlan`).
 *
 * Καρφώνει τα κρίσιμα invariants:
 *  - **άγνωστα** level ids πέφτουν (anti-hallucination) και καταγράφονται στο `droppedLevelIds`,
 *  - η σειρά είναι η **σειρά των ορόφων**, ΟΧΙ η σειρά που τα έδωσε το AI (ντετερμινισμός),
 *  - πρόθεμα/αρχικός αριθμός: default όταν το AI δίνει `null`, αλλιώς η τιμή του AI (έγκυρη),
 *  - ντετερμινισμός (ίδιο input ⇒ ίδιο output).
 */

import { reconcileSheetSetPlan, type SheetSetPlanLevel } from '../ai-sheet-set-reconcile';
import type { AiSheetSetPlan } from '../ai-sheet-set-schema';

const LEVELS: readonly SheetSetPlanLevel[] = [
  { id: 'lvl-basement', name: 'Υπόγειο', label: '' },
  { id: 'lvl-ground', name: 'Ισόγειο', label: '' },
  { id: 'lvl-first', name: '1ος όροφος', label: '' },
];

function makeAi(overrides: Partial<AiSheetSetPlan> = {}): AiSheetSetPlan {
  return {
    selectedLevelIds: ['lvl-ground', 'lvl-first'],
    numberingPrefix: null,
    startNumber: null,
    confidence: 0.9,
    notes: 'όλοι εκτός υπογείου',
    ...overrides,
  };
}

describe('reconcileSheetSetPlan — validation & determinism', () => {
  it('keeps only real level ids and reports the dropped (hallucinated) ones', () => {
    const plan = reconcileSheetSetPlan(
      makeAi({ selectedLevelIds: ['lvl-ground', 'lvl-ghost', 'lvl-first'] }),
      LEVELS,
      'Α',
    );
    expect(plan.selectedLevelIds).toEqual(['lvl-ground', 'lvl-first']);
    expect(plan.droppedLevelIds).toEqual(['lvl-ghost']);
  });

  it('orders selection by LEVEL order, not by the AI order', () => {
    const plan = reconcileSheetSetPlan(
      makeAi({ selectedLevelIds: ['lvl-first', 'lvl-basement', 'lvl-ground'] }),
      LEVELS,
      'Α',
    );
    expect(plan.selectedLevelIds).toEqual(['lvl-basement', 'lvl-ground', 'lvl-first']);
  });

  it('applies the locale default prefix and start=1 when the AI gives null', () => {
    const plan = reconcileSheetSetPlan(makeAi(), LEVELS, 'Α');
    expect(plan.numbering).toEqual({ prefix: 'Α', start: 1 });
  });

  it('honours an AI-supplied prefix and start number', () => {
    const plan = reconcileSheetSetPlan(
      makeAi({ numberingPrefix: 'S', startNumber: 5 }),
      LEVELS,
      'Α',
    );
    expect(plan.numbering).toEqual({ prefix: 'S', start: 5 });
  });

  it('falls back to default prefix on blank AI prefix and to 1 on an invalid start', () => {
    const plan = reconcileSheetSetPlan(
      makeAi({ numberingPrefix: '  ', startNumber: 0 }),
      LEVELS,
      'A',
    );
    expect(plan.numbering).toEqual({ prefix: 'A', start: 1 });
  });

  it('floors a fractional start number', () => {
    const plan = reconcileSheetSetPlan(makeAi({ startNumber: 3.7 }), LEVELS, 'Α');
    expect(plan.numbering.start).toBe(3);
  });

  it('yields an empty selection when the AI matches no real level', () => {
    const plan = reconcileSheetSetPlan(makeAi({ selectedLevelIds: ['x', 'y'] }), LEVELS, 'Α');
    expect(plan.selectedLevelIds).toEqual([]);
    expect(plan.droppedLevelIds).toEqual(['x', 'y']);
  });

  it('is deterministic — same input yields the same output', () => {
    const ai = makeAi({ selectedLevelIds: ['lvl-first', 'lvl-ground'] });
    expect(reconcileSheetSetPlan(ai, LEVELS, 'Α')).toEqual(reconcileSheetSetPlan(ai, LEVELS, 'Α'));
  });

  it('passes confidence and notes through untouched', () => {
    const plan = reconcileSheetSetPlan(makeAi({ confidence: 0.4, notes: 'αβέβαιο' }), LEVELS, 'Α');
    expect(plan.confidence).toBe(0.4);
    expect(plan.notes).toBe('αβέβαιο');
  });
});
