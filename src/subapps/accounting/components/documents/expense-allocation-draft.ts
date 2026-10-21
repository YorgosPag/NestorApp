/**
 * Expense allocation DRAFT — what the human is editing before «Save» (ADR-917 Φ4). Pure.
 *
 * Amounts stay TEXT while typed (either decimal convention, `parseLocaleNumber`) and become numbers only when
 * the draft is resolved — through the SAME `validateAllocations` the writer runs, so the form refuses before the
 * request what the server would refuse after it. Editing a proposed line makes it `manual` (visible origin).
 *
 * @module subapps/accounting/components/documents/expense-allocation-draft
 * @see ADR-917 §4 Γ1
 */

import { parseLocaleNumber } from '@/lib/number/locale-number';
import { formatNumber } from '@/lib/intl-utils';
import { allocationKeyOf, validateAllocations } from '@/services/project-cost/expense-allocation';
import type { ExpenseCostAllocation } from '../../types/documents';

export interface AllocationDraftLine extends Omit<ExpenseCostAllocation, 'netAmount'> {
  amountText: string;
}

export type AllocationDraftProblem =
  | { readonly kind: 'amount' }
  | { readonly kind: 'exceeds'; readonly allocated: number; readonly net: number }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'invalid' };

type AllocationDraftResolution =
  | { readonly ok: true; readonly lines: ExpenseCostAllocation[] }
  | { readonly ok: false; readonly problem: AllocationDraftProblem };

const AMOUNT_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

export function toDraftLines(lines: readonly ExpenseCostAllocation[]): AllocationDraftLine[] {
  return lines.map(({ netAmount, ...rest }) => ({ ...rest, amountText: formatNumber(netAmount, AMOUNT_FORMAT) }));
}

export function editDraftAmount(draft: readonly AllocationDraftLine[], index: number, amountText: string): AllocationDraftLine[] {
  return draft.map((line, i) => (i === index ? { ...line, amountText, origin: 'manual' } : line));
}

export function removeDraftLine(draft: readonly AllocationDraftLine[], index: number): AllocationDraftLine[] {
  return draft.filter((_, i) => i !== index);
}

export interface DirectLineInput {
  projectId: string;
  costCode: string;
  amountText: string;
}

/** A direct cost (no PO) line — or why not: a field is missing, or it duplicates an existing line */
export function addDirectDraftLine(
  draft: readonly AllocationDraftLine[],
  input: DirectLineInput,
): { draft: AllocationDraftLine[] } | { error: 'missingFields' | 'duplicate' } {
  const amount = parseLocaleNumber(input.amountText);
  if (!input.projectId || !input.costCode || amount === null || amount <= 0) return { error: 'missingFields' };
  const line: AllocationDraftLine = {
    projectId: input.projectId, costCode: input.costCode, purchaseOrderId: null, origin: 'manual', amountText: input.amountText,
  };
  if (draft.some(existing => allocationKeyOf(existing) === allocationKeyOf(line))) return { error: 'duplicate' };
  return { draft: [...draft, line] };
}

/** Draft → the lines to send, or the ONE reason it cannot be sent (judged like the server judges it) */
export function resolveDraft(draft: readonly AllocationDraftLine[], netAmount: number | null): AllocationDraftResolution {
  const lines: ExpenseCostAllocation[] = [];
  for (const { amountText, ...rest } of draft) {
    const amount = parseLocaleNumber(amountText);
    if (amount === null) return { ok: false, problem: { kind: 'amount' } };
    lines.push({ ...rest, netAmount: amount });
  }
  const issues = validateAllocations(lines, netAmount);
  const exceeds = issues.find(issue => issue.kind === 'exceeds_net');
  if (exceeds && exceeds.kind === 'exceeds_net') {
    return { ok: false, problem: { kind: 'exceeds', allocated: exceeds.allocated, net: exceeds.netAmount } };
  }
  if (issues.some(issue => issue.kind === 'duplicate')) return { ok: false, problem: { kind: 'duplicate' } };
  if (issues.some(issue => issue.kind === 'non_positive')) return { ok: false, problem: { kind: 'amount' } };
  if (issues.length > 0) return { ok: false, problem: { kind: 'invalid' } };
  return { ok: true, lines };
}
