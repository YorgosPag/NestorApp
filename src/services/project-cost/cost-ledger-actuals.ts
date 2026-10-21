/**
 * Cost Ledger — ACTUALS from expense documents (ADR-917 Φ4 · §4 Β · Γ1)
 *
 * Pure. Turns the cost allocation of expense documents into the ledger's «invoiced» columns, inside the ONE
 * aggregator (`computeCostLedger` calls this; nobody else does).
 *
 * - **Invoiced** = Σ allocated net amounts of CONFIRMED documents. A document still in review is declared
 *   (`inReview`), never summed — the accountant has not accepted it yet.
 * - **Direct cost** = the invoiced lines WITHOUT a purchase order (permits, notary, utilities…).
 * - **No double count (Α3)**: a line billed against a PO is already in the PO's committed / pending amount —
 *   it is NOT added to the projection again. Only what exceeds the PO on that code is (`overbilled`): an invoice
 *   above its order is real cost the order does not show (Procore double-counts synced subcontractor invoices
 *   unless a budget view filters them out by hand — here it is structural).
 * - Every summed line stays visible on its row (`sources.expenseDocuments`) — a bar always answers «from where?».
 *
 * @module services/project-cost/cost-ledger-actuals
 * @see ADR-917 §4 Β · Γ1 · Ζ5
 */

import { costCodeGroupOf } from '@/config/cost-taxonomy';
import type { DocumentProcessingStatus, ReceivedExpenseDocument } from '@/subapps/accounting/types/documents';
import {
  allocationCoverageOf,
  expenseDocumentLabelOf,
  expenseNetAmountOf,
  fromCents,
  toCents,
  type AllocationCoverageState,
} from './expense-allocation';

// ============================================================================
// TYPES
// ============================================================================

/** One allocation line of THIS project */
interface LedgerExpenseAllocation {
  costCode: string;
  netAmount: number;
  purchaseOrderId: string | null;
}

/** An expense document as the ledger reads it — only the lines that belong to the project */
export interface LedgerExpenseDocument {
  id: string;
  /** Issuer · number, else the file name */
  label: string;
  status: DocumentProcessingStatus;
  /** Of the WHOLE document against its net amount (a document may also pay for other projects) */
  coverage: AllocationCoverageState;
  allocations: readonly LedgerExpenseAllocation[];
}

/** One document behind a row's actuals — its lines of THIS code summed */
export interface LedgerExpenseDocumentSource {
  id: string;
  label: string;
  status: DocumentProcessingStatus;
  amount: number;
  /** `null` ⇒ direct cost */
  purchaseOrderId: string | null;
  /** `false` ⇒ still in review: shown, not summed */
  counted: boolean;
}

/** The row fields this module owns */
interface LedgerActualsRow {
  invoiced: number;
  directCost: number;
  overbilled: number;
  sources: { expenseDocuments: LedgerExpenseDocumentSource[] };
}

/** Completeness of the actuals — «no allocation» is declared, never read as 0 € */
export interface LedgerExpenseCompleteness {
  /** Confirmed documents summed into «invoiced» */
  countedDocumentCount: number;
  /** Documents allocated to the project but still in review */
  inReviewDocumentCount: number;
  /** Counted documents whose net amount is only partly allocated (to any project) */
  partiallyAllocatedDocumentCount: number;
  /** Documents matched to one of the project's POs that carry no allocation yet (loader-supplied) */
  awaitingAllocationCount: number;
}

/** `${poId}|${groupCode}` → the PO's counted amount on that code (committed or pending) */
type PurchaseOrderAmounts = ReadonlyMap<string, number>;

export const purchaseOrderAmountKey = (poId: string, groupCode: string): string => `${poId}|${groupCode}`;

const COUNTED_STATUS: DocumentProcessingStatus = 'confirmed';

// ============================================================================
// MAPPING (stored document → ledger input)
// ============================================================================

/** The ledger's view of one stored document, for ONE project */
export function toLedgerExpenseDocument(
  documentId: string,
  document: ReceivedExpenseDocument,
  projectId: string,
): LedgerExpenseDocument {
  const lines = document.costAllocations ?? [];
  return {
    id: documentId,
    label: expenseDocumentLabelOf(document),
    status: document.status,
    coverage: allocationCoverageOf(expenseNetAmountOf(document), lines).state,
    allocations: lines
      .filter(line => line.projectId === projectId)
      .map(line => ({ costCode: line.costCode, netAmount: line.netAmount, purchaseOrderId: line.purchaseOrderId })),
  };
}

// ============================================================================
// ACCUMULATION
// ============================================================================

function addSource(row: LedgerActualsRow, document: LedgerExpenseDocument, line: LedgerExpenseAllocation, counted: boolean): void {
  const existing = row.sources.expenseDocuments.find(
    source => source.id === document.id && source.purchaseOrderId === line.purchaseOrderId,
  );
  if (existing) {
    existing.amount = fromCents(toCents(existing.amount) + toCents(line.netAmount));
    return;
  }
  row.sources.expenseDocuments.push({
    id: document.id, label: document.label, status: document.status,
    amount: line.netAmount, purchaseOrderId: line.purchaseOrderId, counted,
  });
}

/** Invoiced against each (PO, code) — the input of the over-billing rule */
type InvoicedAgainstPo = Map<string, { row: LedgerActualsRow; cents: number }>;

function addCountedLine(row: LedgerActualsRow, line: LedgerExpenseAllocation, code: string, againstPo: InvoicedAgainstPo): void {
  row.invoiced = fromCents(toCents(row.invoiced) + toCents(line.netAmount));
  if (line.purchaseOrderId === null) {
    row.directCost = fromCents(toCents(row.directCost) + toCents(line.netAmount));
    return;
  }
  const key = purchaseOrderAmountKey(line.purchaseOrderId, code);
  const entry = againstPo.get(key) ?? { row, cents: 0 };
  entry.cents += toCents(line.netAmount);
  againstPo.set(key, entry);
}

/** Α3 + over-billing: only what exceeds the PO on the same code enters the projection */
function applyOverbilling(againstPo: InvoicedAgainstPo, poAmounts: PurchaseOrderAmounts): void {
  for (const [key, { row, cents }] of againstPo) {
    const excess = cents - toCents(poAmounts.get(key) ?? 0);
    if (excess > 0) row.overbilled = fromCents(toCents(row.overbilled) + excess);
  }
}

/**
 * Accumulates the documents into the rows `rowFor` hands out. `accepts` is the ledger's code filter — the same
 * one BOQ, budget lines and POs went through, so actuals never appear under a code the reader excluded.
 */
export function accumulateExpenseDocuments(
  rowFor: (code: string) => LedgerActualsRow,
  documents: readonly LedgerExpenseDocument[],
  poAmounts: PurchaseOrderAmounts,
  accepts: (code: string) => boolean,
): Omit<LedgerExpenseCompleteness, 'awaitingAllocationCount'> {
  const againstPo: InvoicedAgainstPo = new Map();
  const completeness = { countedDocumentCount: 0, inReviewDocumentCount: 0, partiallyAllocatedDocumentCount: 0 };
  for (const document of documents) {
    const counted = document.status === COUNTED_STATUS;
    if (document.allocations.length === 0 || (!counted && document.status !== 'review')) continue;
    if (counted) completeness.countedDocumentCount += 1;
    else completeness.inReviewDocumentCount += 1;
    if (counted && document.coverage !== 'full') completeness.partiallyAllocatedDocumentCount += 1;
    for (const line of document.allocations) {
      const code = costCodeGroupOf(line.costCode);
      if (!accepts(code)) continue;
      const row = rowFor(code);
      addSource(row, document, line, counted);
      if (counted) addCountedLine(row, line, code, againstPo);
    }
  }
  applyOverbilling(againstPo, poAmounts);
  return completeness;
}
