/**
 * Project Cost Ledger — the ONE budget-vs-actual arithmetic (ADR-917 §4 Δ1)
 *
 * Pure: BOQ lines + purchase orders → one row per cost code. Every surface that
 * compares budget with commitments (procurement analytics, project overview KPIs,
 * the Financial Intelligence card, the AI tool) delegates here.
 *
 * - Budget per BOQ line comes ONLY from `cost-engine.computeItemCost` (ADR-175).
 * - PO buckets come ONLY from the status sets in `types/procurement`.
 * - `boqItemCount === 0` means the budget has NO source, not «zero cost»
 *   (ADR-917 §4 Δ2 · SPEC-242C §3.1) — consumers must not read it as 0 €.
 * - Every row carries the documents behind its numbers (`sources`, ADR-917 Φ2 drill-down).
 *
 * @module services/project-cost/cost-ledger
 * @see ADR-917
 */

import type { PurchaseOrder } from '@/types/procurement';
import { PO_COMMITTED_STATUSES, PO_DELIVERED_STATUSES, PO_PENDING_STATUSES } from '@/types/procurement';
import type { BOQItem } from '@/types/boq';
import { computeItemCost, type BOQCostInput } from '@/services/measurements/cost-engine';
import { compareByLocale } from '@/lib/intl-utils';
import { atoeGroupCodeOf, findATOECategory } from '@/config/boq-categories';

// ============================================================================
// TYPES
// ============================================================================

/** Bucket for lines that carry no cost code */
export const UNCATEGORIZED_COST_CODE = 'OTHER';

export type LedgerBoqItem = BOQCostInput & Pick<BOQItem, 'id' | 'categoryCode' | 'title'>;
export type LedgerPurchaseOrder = Pick<PurchaseOrder, 'id' | 'poNumber' | 'status' | 'items'>;

/** One BOQ line behind a row's budget */
export interface LedgerBoqSource {
  id: string;
  /** The line's own code (article `OIK-2.03`) — the row groups it under `OIK-2` */
  costCode: string | null;
  title: string;
  amount: number;
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
}

export interface CostLedgerRow {
  categoryCode: string;
  /** Σ BOQ line cost — meaningful only when `boqItemCount > 0` */
  budget: number;
  /** BOQ lines behind `budget`; 0 ⇒ the budget has no source */
  boqItemCount: number;
  /** BOQ lines of this code referenced by a committed PO line */
  coveredBoqItemCount: number;
  /** PO lines not yet sent (draft / approved) */
  pending: number;
  committed: number;
  delivered: number;
  /** The documents behind every number of the row — a bar always answers «from where?» */
  sources: CostLedgerSources;
}

export interface CostLedger {
  rows: CostLedgerRow[];
  boqItemCount: number;
  coveredBoqItemCount: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Rows are ΑΤΟΕ **groups**: BOQ lines carry article codes (`OIK-2.03`) while PO lines
 * carry group codes (`OIK-2`) — compared at different levels they would never meet.
 */
function codeOf(raw: string | null | undefined): string {
  return raw ? atoeGroupCodeOf(raw) : UNCATEGORIZED_COST_CODE;
}

/** ΑΤΟΕ catalogue order (OIK-2 before OIK-10); codes outside it (OTHER, SOFT-*) after, by name. */
function compareCostCodes(a: string, b: string): number {
  const order = (code: string): number => findATOECategory(code)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  return order(a) - order(b) || compareByLocale(a, b);
}

function emptyRow(categoryCode: string): CostLedgerRow {
  return {
    categoryCode,
    budget: 0,
    boqItemCount: 0,
    coveredBoqItemCount: 0,
    pending: 0,
    committed: 0,
    delivered: 0,
    sources: { boqItems: [], purchaseOrders: [] },
  };
}

function rowFor(rows: Map<string, CostLedgerRow>, code: string): CostLedgerRow {
  const existing = rows.get(code);
  if (existing) return existing;
  const row = emptyRow(code);
  rows.set(code, row);
  return row;
}

function accumulateBudget(
  rows: Map<string, CostLedgerRow>,
  boqItems: readonly LedgerBoqItem[],
  accepts: (code: string) => boolean,
): Map<string, string> {
  const codeByBoqId = new Map<string, string>();
  for (const item of boqItems) {
    const code = codeOf(item.categoryCode);
    if (!accepts(code)) continue;
    const row = rowFor(rows, code);
    const amount = computeItemCost(item).totalCost;
    row.budget += amount;
    row.boqItemCount += 1;
    row.sources.boqItems.push({ id: item.id, costCode: item.categoryCode ?? null, title: item.title, amount });
    codeByBoqId.set(item.id, code);
  }
  return codeByBoqId;
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

function accumulatePurchaseOrders(
  rows: Map<string, CostLedgerRow>,
  purchaseOrders: readonly LedgerPurchaseOrder[],
  accepts: (code: string) => boolean,
): Set<string> {
  const coveredBoqIds = new Set<string>();
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
    }
  }
  return coveredBoqIds;
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
  categoryFilter: readonly string[] = [],
): CostLedger {
  const accepts = (code: string): boolean => categoryFilter.length === 0 || categoryFilter.includes(code);
  const rows = new Map<string, CostLedgerRow>();
  const codeByBoqId = accumulateBudget(rows, boqItems, accepts);
  const coveredBoqIds = accumulatePurchaseOrders(rows, purchaseOrders, accepts);

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
  };
}

/** Rows a budget-vs-commitment chart shows: a budget source or money committed. */
export function hasBudgetOrCommitment(row: CostLedgerRow): boolean {
  return row.boqItemCount > 0 || row.committed > 0;
}
