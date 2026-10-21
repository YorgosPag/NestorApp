/**
 * Expense cost allocation — the ONE arithmetic of «which project + cost code does this invoice pay for?»
 * (ADR-917 Φ4 · §4 Γ1). Pure: shared by the writer, the review form and the tests.
 *
 * - **Proposal from the PO** (SAP proportional distribution): the confirmed net amount is spread over the
 *   PO's cost codes in proportion to its line totals, in CENTS, remainder by largest fraction then code order
 *   ⇒ the parts always sum to the invoice exactly, and the same PO + amount gives the same proposal.
 * - **One line per (project, code, PO)** — a duplicate is refused, never merged behind the human's back.
 * - **Coverage is derived, never stored**: `none` / `partial` / `full` against the confirmed net amount; an
 *   unknown net amount is `unknown`, not «fully allocated» (a missing figure is not 0 €).
 *
 * @module services/project-cost/expense-allocation
 * @see ADR-917 §4 Γ1 · Ζ5
 */

import { compareCostCodes, isBudgetLineCostCode } from '@/config/cost-taxonomy';
import type { PurchaseOrder } from '@/types/procurement';
import type { ExpenseCostAllocation, ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';

/** How a document is named on every screen and history row: issuer · number, else the file name */
export function expenseDocumentLabelOf(
  document: Pick<ReceivedExpenseDocument, 'confirmedIssuerName' | 'extractedData' | 'fileName'>,
): string {
  const issuer = document.confirmedIssuerName ?? document.extractedData?.issuerName ?? null;
  const number = document.extractedData?.documentNumber ?? null;
  return [issuer, number].filter((part): part is string => Boolean(part)).join(' · ') || document.fileName;
}

/** A typo / abuse guard on one document, not a business rule */
export const EXPENSE_ALLOCATION_MAX_LINES = 50;

export const toCents = (euros: number): number => Math.round(euros * 100);
export const fromCents = (cents: number): number => cents / 100;

/**
 * THE net amount an allocation is measured against: what the human confirmed, else what the AI read, else
 * `null` (unknown — never 0 €). One answer for the writer, the form, the confirmation and the ledger.
 */
export function expenseNetAmountOf(
  document: Pick<ReceivedExpenseDocument, 'confirmedNetAmount' | 'extractedData'>,
): number | null {
  return document.confirmedNetAmount ?? document.extractedData?.netAmount ?? null;
}

type AllocationProposalSource = Pick<PurchaseOrder, 'id' | 'projectId' | 'items'>;

interface CodeWeight {
  readonly costCode: string;
  readonly weight: number;
}

/** PO lines → one weight per cost code (several lines of one code are one share) */
function weightsByCode(po: AllocationProposalSource): CodeWeight[] {
  const weights = new Map<string, number>();
  for (const item of po.items ?? []) {
    const weight = Math.max(0, item.total ?? 0);
    if (weight > 0 && isBudgetLineCostCode(item.categoryCode)) {
      weights.set(item.categoryCode, (weights.get(item.categoryCode) ?? 0) + weight);
    }
  }
  return [...weights].map(([costCode, weight]) => ({ costCode, weight }));
}

/** Largest-remainder split of `totalCents` by weight; ties by cost-code order ⇒ deterministic */
function splitCents(totalCents: number, weights: readonly CodeWeight[]): number[] {
  const sum = weights.reduce((acc, entry) => acc + entry.weight, 0);
  const exact = weights.map(entry => (totalCents * entry.weight) / sum);
  const cents = exact.map(Math.floor);
  const order = weights
    .map((entry, index) => ({ index, fraction: exact[index] - cents[index], costCode: entry.costCode }))
    .sort((a, b) => b.fraction - a.fraction || compareCostCodes(a.costCode, b.costCode));
  let remainder = totalCents - cents.reduce((acc, value) => acc + value, 0);
  for (const { index } of order) {
    if (remainder <= 0) break;
    cents[index] += 1;
    remainder -= 1;
  }
  return cents;
}

/**
 * The proposal for an invoice billed against ONE purchase order. `[]` ⇔ nothing to propose (no positive net
 * amount, or a PO without priced lines) — the human allocates by hand, nothing is guessed.
 */
export function proposeAllocationsFromPurchaseOrder(
  po: AllocationProposalSource,
  netAmount: number | null,
): ExpenseCostAllocation[] {
  const totalCents = netAmount === null ? 0 : toCents(netAmount);
  const weights = weightsByCode(po).sort((a, b) => compareCostCodes(a.costCode, b.costCode));
  if (totalCents <= 0 || weights.length === 0) return [];
  const cents = splitCents(totalCents, weights);
  return weights
    .map((entry, index) => ({
      projectId: po.projectId,
      costCode: entry.costCode,
      netAmount: fromCents(cents[index]),
      purchaseOrderId: po.id,
      origin: 'po_proposal' as const,
    }))
    .filter(line => line.netAmount > 0);
}

// ============================================================================
// VALIDATION
// ============================================================================

export const allocationKeyOf = (line: Pick<ExpenseCostAllocation, 'projectId' | 'costCode' | 'purchaseOrderId'>): string =>
  `${line.projectId}|${line.costCode}|${line.purchaseOrderId ?? ''}`;

export type AllocationIssue =
  | { readonly kind: 'too_many'; readonly max: number }
  | { readonly kind: 'invalid_code'; readonly index: number }
  | { readonly kind: 'non_positive'; readonly index: number }
  | { readonly kind: 'duplicate'; readonly index: number }
  | { readonly kind: 'exceeds_net'; readonly allocated: number; readonly netAmount: number }
  | { readonly kind: 'net_unknown' };

/** Euros → cents precision on every line; float noise never reaches the disk */
export function normalizeAllocations(lines: readonly ExpenseCostAllocation[]): ExpenseCostAllocation[] {
  return lines.map(line => ({ ...line, netAmount: fromCents(toCents(line.netAmount)) }));
}

function lineIssues(lines: readonly ExpenseCostAllocation[]): AllocationIssue[] {
  const issues: AllocationIssue[] = [];
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    if (!isBudgetLineCostCode(line.costCode)) issues.push({ kind: 'invalid_code', index });
    if (!Number.isFinite(line.netAmount) || toCents(line.netAmount) <= 0) issues.push({ kind: 'non_positive', index });
    const key = allocationKeyOf(line);
    if (seen.has(key)) issues.push({ kind: 'duplicate', index });
    seen.add(key);
  });
  return issues;
}

/**
 * Everything wrong with a set of lines for a document of `netAmount`. An empty set is valid (it clears the
 * allocation); a non-empty set needs a KNOWN net amount — allocating an unknown total is a guess.
 */
export function validateAllocations(
  lines: readonly ExpenseCostAllocation[],
  netAmount: number | null,
): AllocationIssue[] {
  if (lines.length > EXPENSE_ALLOCATION_MAX_LINES) return [{ kind: 'too_many', max: EXPENSE_ALLOCATION_MAX_LINES }];
  const issues = lineIssues(lines);
  if (lines.length === 0) return issues;
  if (netAmount === null) return [...issues, { kind: 'net_unknown' }];
  const allocatedCents = lines.reduce((acc, line) => acc + toCents(line.netAmount), 0);
  if (allocatedCents > toCents(netAmount)) {
    issues.push({ kind: 'exceeds_net', allocated: fromCents(allocatedCents), netAmount });
  }
  return issues;
}

// ============================================================================
// COVERAGE (derived)
// ============================================================================

/** `over` ⇔ more allocated than the net amount (the amount was corrected after allocating) */
export type AllocationCoverageState = 'none' | 'partial' | 'full' | 'over' | 'unknown';

export interface AllocationCoverage {
  readonly state: AllocationCoverageState;
  readonly allocated: number;
  /** `null` ⇔ the net amount is unknown */
  readonly unallocated: number | null;
}

function coverageStateOf(allocatedCents: number, unallocatedCents: number): AllocationCoverageState {
  if (allocatedCents === 0) return 'none';
  if (unallocatedCents < 0) return 'over';
  return unallocatedCents === 0 ? 'full' : 'partial';
}

export function allocationCoverageOf(
  netAmount: number | null,
  lines: readonly Pick<ExpenseCostAllocation, 'netAmount'>[] | undefined,
): AllocationCoverage {
  const allocatedCents = (lines ?? []).reduce((acc, line) => acc + toCents(line.netAmount), 0);
  const allocated = fromCents(allocatedCents);
  if (netAmount === null) return { state: allocatedCents > 0 ? 'unknown' : 'none', allocated, unallocated: null };
  const unallocatedCents = toCents(netAmount) - allocatedCents;
  return { state: coverageStateOf(allocatedCents, unallocatedCents), allocated, unallocated: fromCents(Math.max(0, unallocatedCents)) };
}

/** The query field: unique, sorted ⇒ the same lines always store the same array */
export function allocatedProjectIdsOf(lines: readonly Pick<ExpenseCostAllocation, 'projectId'>[]): string[] {
  return [...new Set(lines.map(line => line.projectId))].sort();
}

/** The POs a set of lines bills against (unique, sorted) */
export function allocatedPurchaseOrderIdsOf(lines: readonly Pick<ExpenseCostAllocation, 'purchaseOrderId'>[]): string[] {
  return [...new Set(lines.flatMap(line => (line.purchaseOrderId === null ? [] : [line.purchaseOrderId])))].sort();
}
