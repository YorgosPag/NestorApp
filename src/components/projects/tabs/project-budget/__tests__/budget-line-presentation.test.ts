/**
 * ADR-917 Φ3γ · Α30 — what a budget line shows: its label (group + typed lower level), what it does in the
 * ledger (read from the ledger row of its GROUP, never re-derived), and what a typed amount becomes.
 */

import type { ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';
import {
  budgetLineEffect,
  budgetLineFamilyOf,
  budgetLineInvoiced,
  budgetLineLabel,
  parseBudgetAmount,
} from '../budget-line-presentation';
import { validateBudgetLineDraft } from '../BudgetLineAddForm';

const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key);

function ledgerWith(rows: Array<{ costCode: string; budgetSource: 'boq' | 'allowance' | 'soft' | null; estimateDelta?: number | null }>) {
  return { rows: rows.map(row => ({ estimateDelta: null, ...row })) } as unknown as ProjectCostLedgerView;
}

describe('budget line on screen (Α30)', () => {
  it('the family IS the kind (Ζ8): OIK-* allowance · SOFT-* soft', () => {
    expect(budgetLineFamilyOf('OIK-2.03')).toBe('allowance');
    expect(budgetLineFamilyOf('SOFT-PERMITS.TEE')).toBe('soft');
  });

  it('🔴 a lower-level code is labelled group + segment — never a raw key of the lower level', () => {
    expect(budgetLineLabel('SOFT-PERMITS', t)).toBe('procurement:categories.SOFT-PERMITS');
    expect(budgetLineLabel('SOFT-PERMITS.TEE', t))
      .toBe('budgetEditor.codeWithLowerLevel|{"group":"procurement:categories.SOFT-PERMITS","lowerLevel":"TEE"}');
  });

  it('🔴 an allowance counts while its GROUP rests on it, with the estimate accuracy; steps aside for a signed BOQ', () => {
    const active = ledgerWith([{ costCode: 'OIK-2', budgetSource: 'allowance', estimateDelta: -1200 }]);
    expect(budgetLineEffect('OIK-2.03', active)).toEqual({ kind: 'allowanceActive', estimateDelta: -1200 });
    expect(budgetLineEffect('OIK-2', ledgerWith([{ costCode: 'OIK-2', budgetSource: 'boq' }]))).toEqual({ kind: 'superseded' });
  });

  it('soft is soft; no ledger yet ⇒ unknown (never a guess)', () => {
    expect(budgetLineEffect('SOFT-LAND', null)).toEqual({ kind: 'soft' });
    expect(budgetLineEffect('OIK-2', null)).toEqual({ kind: 'unknown' });
  });

  it('🔴 an amount is a net, non-negative figure in cents, in either decimal convention', () => {
    expect(parseBudgetAmount('1.200,50')).toBe(1200.5);
    expect(parseBudgetAmount('1,200.505')).toBe(1200.51);
    expect(parseBudgetAmount('-5')).toBeNull();
    expect(parseBudgetAmount('')).toBeNull();
    expect(parseBudgetAmount('2000000000000')).toBeNull();
  });
});

describe('invoiced column (Φ4) — read from the GROUP row of the ledger', () => {
  const ledger = { rows: [
    { costCode: 'SOFT-PERMITS', invoiced: 80, directCost: 80 },
    { costCode: 'OIK-2', invoiced: null, directCost: 0 },
  ] } as unknown as ProjectCostLedgerView;

  it('a lower-level line reads its group; direct cost travels with it', () => {
    expect(budgetLineInvoiced('SOFT-PERMITS.TEE', ledger)).toEqual({ kind: 'amount', amount: 80, directCost: 80 });
  });

  it('🔴 nothing invoiced is `none` (said in words), never 0 €; no ledger yet ⇒ unknown', () => {
    expect(budgetLineInvoiced('OIK-2', ledger)).toEqual({ kind: 'none' });
    expect(budgetLineInvoiced('SOFT-LAND', ledger)).toEqual({ kind: 'none' });
    expect(budgetLineInvoiced('OIK-2', null)).toEqual({ kind: 'unknown' });
  });
});

describe('new line draft (Ζ1 · Ζ8)', () => {
  const draft = { group: 'SOFT-PERMITS', lowerLevel: '', amount: '100', note: ' ' };

  it('a valid draft becomes the code + values (note trimmed, empty ⇒ null)', () => {
    expect(validateBudgetLineDraft(draft, new Set())).toEqual({ costCode: 'SOFT-PERMITS', values: { amount: 100, note: null } });
    expect(validateBudgetLineDraft({ ...draft, lowerLevel: 'tee' }, new Set())).toEqual(expect.objectContaining({ costCode: 'SOFT-PERMITS.TEE' }));
  });

  it('🔴 one line per code: an existing code is refused BEFORE any request', () => {
    expect(validateBudgetLineDraft(draft, new Set(['SOFT-PERMITS']))).toEqual({ error: 'duplicate' });
  });

  it('no group, a free-text segment or a bad amount are refused by name', () => {
    expect(validateBudgetLineDraft({ ...draft, group: '' }, new Set())).toEqual({ error: 'invalidCode' });
    expect(validateBudgetLineDraft({ ...draft, lowerLevel: 'Τ.Ε.Ε' }, new Set())).toEqual({ error: 'invalidCode' });
    expect(validateBudgetLineDraft({ ...draft, amount: 'abc' }, new Set())).toEqual({ error: 'invalidAmount' });
  });
});
