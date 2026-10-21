/**
 * Project Cost Ledger — the ONE budget-vs-actual arithmetic (ADR-917 §4 Δ1)
 *
 * Pure: BOQ lines + purchase orders + project budget lines → one row per cost code.
 * Every surface that compares budget with commitments (procurement analytics, project
 * overview KPIs, the Financial Intelligence card, the AI tool) delegates here.
 *
 * - Budget per BOQ line comes ONLY from `cost-engine.computeItemCost` (ADR-175);
 *   «priced?» ONLY from `cost-engine.hasUnitPrice` (Ζ7 — an unpriced line is not 0 €).
 * - WHICH document stands behind a row's budget: `cost-ledger-budget.resolveRowBudget`.
 * - PO buckets come ONLY from the status sets in `types/procurement`.
 * - `budgetSource === null` means the budget has NO source, not «zero cost»
 *   (ADR-917 §4 Δ2 · SPEC-242C §3.1) — consumers must not read `budget` as 0 €.
 * - Every row carries the documents behind its numbers (`sources`, ADR-917 Φ2 drill-down).
 * - Actuals (Φ4) come ONLY from `cost-ledger-actuals.accumulateExpenseDocuments`: invoiced · direct cost ·
 *   over-billing — a line billed against a PO is never added on top of the PO (Α3).
 * - «Does this BOQ line count?» ONLY from `boq-line-role.partitionCountableBoqLines` (Λ7): a
 *   summary parent (DNA wall) is NOT summed — its children are — and it stays visible in
 *   `sources.excludedSummaries`, never silently dropped.
 *
 * @module services/project-cost/cost-ledger
 * @see ADR-917
 */

import type { PurchaseOrder } from '@/types/procurement';
import { PO_COMMITTED_STATUSES, PO_DELIVERED_STATUSES, PO_PENDING_STATUSES } from '@/types/procurement';
import type { BOQItem } from '@/types/boq';
import { isFrozenBaselineStatus } from '@/types/boq/units';
import { computeItemCost, hasUnitPrice, type BOQCostInput } from '@/services/measurements/cost-engine';
import { partitionCountableBoqLines, type BoqRoleInput, type ExcludedBoqSummary } from '@/services/measurements/boq-line-role';
import { compareCostCodes, costCodeGroupOf, UNCATEGORIZED_COST_CODE } from '@/config/cost-taxonomy';
import {
  resolveRowBudget,
  type CostLedgerBudgetSource,
  type LedgerBudgetLine,
} from './cost-ledger-budget';
import {
  accumulateExpenseDocuments,
  purchaseOrderAmountKey,
  type LedgerExpenseCompleteness,
  type LedgerExpenseDocument,
  type LedgerExpenseDocumentSource,
} from './cost-ledger-actuals';

export { UNCATEGORIZED_COST_CODE };
export type {
  CostLedgerBudgetSource,
  LedgerBudgetLine,
  LedgerExpenseCompleteness,
  LedgerExpenseDocument,
  LedgerExpenseDocumentSource,
};

// ============================================================================
// TYPES
// ============================================================================

/** `status` absent ⇒ not signed off (a draft take-off) */
export type LedgerBoqItem = BOQCostInput
  & Pick<BOQItem, 'id' | 'categoryCode' | 'title'>
  & Partial<Pick<BOQItem, 'status'>>
  & BoqRoleInput;
export type LedgerPurchaseOrder = Pick<PurchaseOrder, 'id' | 'poNumber' | 'status' | 'items'>;

/** One BOQ line behind a row's budget */
export interface LedgerBoqSource {
  id: string;
  /** The line's own code (article `OIK-2.03`) — the row groups it under `OIK-2` */
  costCode: string | null;
  title: string;
  amount: number;
  /** `false` ⇒ no unit price yet: «unpriced», not «0 €» (Ζ7) */
  priced: boolean;
}

/** A summary parent left out of the sum (Λ7) — its children carry the money */
export interface LedgerExcludedSummarySource {
  id: string;
  costCode: string | null;
  title: string;
  /** Present children that replace it in the sum */
  childCount: number;
}

/** One purchase order behind a row's money — its lines of THIS code summed */
export interface LedgerPurchaseOrderSource {
  id: string;
  poNumber: string;
  status: PurchaseOrder['status'];
  amount: number;
}

export interface CostLedgerSources {
  boqItems: LedgerBoqSource[];
  purchaseOrders: LedgerPurchaseOrderSource[];
  budgetLines: LedgerBudgetLine[];
  excludedSummaries: LedgerExcludedSummarySource[];
  /** Φ4 — expense documents allocated to this code (in-review ones shown, not summed) */
  expenseDocuments: LedgerExpenseDocumentSource[];
}

export interface CostLedgerRow {
  categoryCode: string;
  /** Which document stands behind `budget`; `null` ⇒ no source (NOT zero) */
  budgetSource: CostLedgerBudgetSource | null;
  /** Resolved budget — meaningful only when `budgetSource !== null` */
  budget: number;
  /** Σ cost of PRICED BOQ lines (any status) */
  boqAmount: number;
  /** Σ project budget lines on this code; `null` ⇒ none */
  budgetLinesAmount: number | null;
  /** BOQ − allowance while the allowance stands (estimate accuracy); `null` otherwise */
  estimateDelta: number | null;
  /** All BOQ lines of this code, priced or not */
  boqItemCount: number;
  /** BOQ lines without a unit price — the reason a budget may be missing */
  unpricedBoqItemCount: number;
  /** Signed-off BOQ lines (`isFrozenBaselineStatus`) */
  frozenBoqItemCount: number;
  frozenUnpricedBoqItemCount: number;
  /** BOQ lines of this code referenced by a committed PO line */
  coveredBoqItemCount: number;
  /** PO lines not yet sent (draft / approved) */
  pending: number;
  committed: number;
  delivered: number;
  /** Φ4 — Σ allocated net amounts of CONFIRMED expense documents */
  invoiced: number;
  /** Φ4 — the part of `invoiced` with no purchase order */
  directCost: number;
  /** Φ4 — invoiced above its PO on this code: cost the order does not show (enters the projection) */
  overbilled: number;
  /** The documents behind every number of the row — a bar always answers «from where?» */
  sources: CostLedgerSources;
}

export interface CostLedger {
  rows: CostLedgerRow[];
  /** Counted BOQ lines — summary parents excluded (Λ7) */
  boqItemCount: number;
  coveredBoqItemCount: number;
  /** Summary parents left out of every sum (their children count) */
  excludedSummaryCount: number;
  /** Legacy group parents with no provable role — counted, but declared */
  unresolvedGroupRoleCount: number;
  /** Φ4 — how complete the actuals are («no allocation» is declared, never 0 €) */
  expenses: LedgerExpenseCompleteness;
}

export interface CostLedgerOptions {
  /** Only these (group) codes; empty ⇒ all */
  categoryFilter?: readonly string[];
  /** Project budget lines — soft cost + ΑΤΟΕ allowances (ADR-917 Φ3) */
  budgetLines?: readonly LedgerBudgetLine[];
  /** Expense documents allocated to the project (ADR-917 Φ4) */
  expenseDocuments?: readonly LedgerExpenseDocument[];
  /** Documents matched to one of the project's POs with no allocation yet — counted by the loader */
  awaitingAllocationCount?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Rows are **groups**: BOQ lines carry article codes (`OIK-2.03`) while PO lines
 * carry group codes (`OIK-2`) — compared at different levels they would never meet.
 */
const codeOf = costCodeGroupOf;

function emptyRow(categoryCode: string): CostLedgerRow {
  return {
    categoryCode,
    budgetSource: null,
    budget: 0,
    boqAmount: 0,
    budgetLinesAmount: null,
    estimateDelta: null,
    boqItemCount: 0,
    unpricedBoqItemCount: 0,
    frozenBoqItemCount: 0,
    frozenUnpricedBoqItemCount: 0,
    coveredBoqItemCount: 0,
    pending: 0,
    committed: 0,
    delivered: 0,
    invoiced: 0,
    directCost: 0,
    overbilled: 0,
    sources: { boqItems: [], purchaseOrders: [], budgetLines: [], excludedSummaries: [], expenseDocuments: [] },
  };
}

function rowFor(rows: Map<string, CostLedgerRow>, code: string): CostLedgerRow {
  const existing = rows.get(code);
  if (existing) return existing;
  const row = emptyRow(code);
  rows.set(code, row);
  return row;
}

function addBoqItem(row: CostLedgerRow, item: LedgerBoqItem): void {
  const priced = hasUnitPrice(item);
  const frozen = isFrozenBaselineStatus(item.status);
  const amount = priced ? computeItemCost(item).totalCost : 0;
  row.boqAmount += amount;
  row.boqItemCount += 1;
  if (!priced) row.unpricedBoqItemCount += 1;
  if (frozen) row.frozenBoqItemCount += 1;
  if (frozen && !priced) row.frozenUnpricedBoqItemCount += 1;
  row.sources.boqItems.push({ id: item.id, costCode: item.categoryCode ?? null, title: item.title, amount, priced });
}

function accumulateBoq(
  rows: Map<string, CostLedgerRow>,
  boqItems: readonly LedgerBoqItem[],
  accepts: (code: string) => boolean,
): Map<string, string> {
  const codeByBoqId = new Map<string, string>();
  for (const item of boqItems) {
    const code = codeOf(item.categoryCode);
    if (!accepts(code)) continue;
    addBoqItem(rowFor(rows, code), item);
    codeByBoqId.set(item.id, code);
  }
  return codeByBoqId;
}

/** Λ7 — a summary parent stays visible on its row's drill-down, outside every number. */
function attachExcludedSummaries(
  rows: Map<string, CostLedgerRow>,
  excluded: readonly ExcludedBoqSummary<LedgerBoqItem>[],
  accepts: (code: string) => boolean,
): void {
  for (const { item, childCount } of excluded) {
    const code = codeOf(item.categoryCode);
    if (!accepts(code)) continue;
    rowFor(rows, code).sources.excludedSummaries.push({
      id: item.id, costCode: item.categoryCode ?? null, title: item.title, childCount,
    });
  }
}

/** Ζ8 — a 2nd-level line (`SOFT-PERMITS.TEE`) rolls up into its group row. */
function accumulateBudgetLines(
  rows: Map<string, CostLedgerRow>,
  budgetLines: readonly LedgerBudgetLine[],
  accepts: (code: string) => boolean,
): void {
  for (const line of budgetLines) {
    const code = codeOf(line.costCode);
    if (!accepts(code)) continue;
    const row = rowFor(rows, code);
    row.budgetLinesAmount = (row.budgetLinesAmount ?? 0) + line.amount;
    row.sources.budgetLines.push(line);
  }
}

/** Several lines of one order under one code are ONE source, not one per line. */
function addPurchaseOrderSource(row: CostLedgerRow, po: LedgerPurchaseOrder, amount: number): void {
  const existing = row.sources.purchaseOrders.find(source => source.id === po.id);
  if (existing) {
    existing.amount += amount;
    return;
  }
  row.sources.purchaseOrders.push({ id: po.id, poNumber: po.poNumber, status: po.status, amount });
}

/** Covered BOQ lines + each order's counted amount per code (the over-billing rule compares against it) */
interface PurchaseOrderAccumulation {
  coveredBoqIds: Set<string>;
  poAmounts: Map<string, number>;
}

function accumulatePurchaseOrders(
  rows: Map<string, CostLedgerRow>,
  purchaseOrders: readonly LedgerPurchaseOrder[],
  accepts: (code: string) => boolean,
): PurchaseOrderAccumulation {
  const coveredBoqIds = new Set<string>();
  const poAmounts = new Map<string, number>();
  for (const po of purchaseOrders) {
    const committed = PO_COMMITTED_STATUSES.has(po.status);
    const delivered = PO_DELIVERED_STATUSES.has(po.status);
    const pending = PO_PENDING_STATUSES.has(po.status);
    if (!committed && !pending) continue;
    for (const line of po.items ?? []) {
      const code = codeOf(line.categoryCode);
      if (!accepts(code)) continue;
      const row = rowFor(rows, code);
      const amount = line.total ?? 0;
      if (pending) row.pending += amount;
      if (committed) row.committed += amount;
      if (delivered) row.delivered += amount;
      if (committed && line.boqItemId) coveredBoqIds.add(line.boqItemId);
      addPurchaseOrderSource(row, po, amount);
      const key = purchaseOrderAmountKey(po.id, code);
      poAmounts.set(key, (poAmounts.get(key) ?? 0) + amount);
    }
  }
  return { coveredBoqIds, poAmounts };
}

function applyResolvedBudget(row: CostLedgerRow): void {
  const resolved = resolveRowBudget({
    categoryCode: row.categoryCode,
    boqAmount: row.boqAmount,
    pricedBoqItemCount: row.boqItemCount - row.unpricedBoqItemCount,
    frozenBoqItemCount: row.frozenBoqItemCount,
    frozenUnpricedBoqItemCount: row.frozenUnpricedBoqItemCount,
    budgetLinesAmount: row.budgetLinesAmount,
  });
  row.budgetSource = resolved.budgetSource;
  row.budget = resolved.budget;
  row.estimateDelta = resolved.estimateDelta;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Budget vs pending / committed / delivered per cost code.
 * Coverage counts only BOQ lines that still exist — a PO pointing at a deleted
 * line cannot push coverage past 100 %.
 */
export function computeCostLedger(
  boqItems: readonly LedgerBoqItem[],
  purchaseOrders: readonly LedgerPurchaseOrder[],
  { categoryFilter = [], budgetLines = [], expenseDocuments = [], awaitingAllocationCount = 0 }: CostLedgerOptions = {},
): CostLedger {
  const accepts = (code: string): boolean => categoryFilter.length === 0 || categoryFilter.includes(code);
  const rows = new Map<string, CostLedgerRow>();
  // Λ7: partition the WHOLE set first — the code filter must not separate a parent from its children.
  const { countable, excludedSummaries, unresolvedGroupRoleCount } = partitionCountableBoqLines(boqItems);
  const codeByBoqId = accumulateBoq(rows, countable, accepts);
  attachExcludedSummaries(rows, excludedSummaries, accepts);
  accumulateBudgetLines(rows, budgetLines, accepts);
  const { coveredBoqIds, poAmounts } = accumulatePurchaseOrders(rows, purchaseOrders, accepts);
  const expenses = accumulateExpenseDocuments(code => rowFor(rows, code), expenseDocuments, poAmounts, accepts);
  rows.forEach(applyResolvedBudget);

  let coveredBoqItemCount = 0;
  for (const boqId of coveredBoqIds) {
    const code = codeByBoqId.get(boqId);
    if (code === undefined) continue;
    rowFor(rows, code).coveredBoqItemCount += 1;
    coveredBoqItemCount += 1;
  }

  return {
    rows: [...rows.values()].sort((a, b) => compareCostCodes(a.categoryCode, b.categoryCode)),
    boqItemCount: codeByBoqId.size,
    coveredBoqItemCount,
    excludedSummaryCount: excludedSummaries.length,
    unresolvedGroupRoleCount,
    expenses: { ...expenses, awaitingAllocationCount },
  };
}

/** Rows a budget-vs-commitment chart shows: a budget source, money committed or money invoiced. */
export function hasBudgetOrCommitment(row: CostLedgerRow): boolean {
  return row.budgetSource !== null || row.committed > 0 || row.invoiced > 0;
}
