/**
 * Project Cost Ledger — the ONE budget-vs-actual arithmetic (ADR-917 §4 Δ1)
 *
 * Pure: BOQ lines + purchase orders → one row per cost code. Every surface that
 * compares budget with commitments (procurement analytics, project overview KPIs,
 * and — from ADR-917 Φ2 — the Financial Intelligence card) delegates here.
 *
 * - Budget per BOQ line comes ONLY from `cost-engine.computeItemCost` (ADR-175).
 * - PO buckets come ONLY from the status sets in `types/procurement`.
 * - `boqItemCount === 0` means the budget has NO source, not «zero cost»
 *   (ADR-917 §4 Δ2 · SPEC-242C §3.1) — consumers must not read it as 0 €.
 *
 * @module services/project-cost/cost-ledger
 * @see ADR-917
 */

import type { PurchaseOrder } from '@/types/procurement';
import { PO_COMMITTED_STATUSES, PO_DELIVERED_STATUSES, PO_PENDING_STATUSES } from '@/types/procurement';
import type { BOQItem } from '@/types/boq';
import { computeItemCost, type BOQCostInput } from '@/services/measurements/cost-engine';
import { compareByLocale } from '@/lib/intl-utils';

// ============================================================================
// TYPES
// ============================================================================

/** Bucket for lines that carry no cost code */
export const UNCATEGORIZED_COST_CODE = 'OTHER';

export type LedgerBoqItem = BOQCostInput & Pick<BOQItem, 'id' | 'categoryCode'>;
export type LedgerPurchaseOrder = Pick<PurchaseOrder, 'status' | 'items'>;

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
}

export interface CostLedger {
  rows: CostLedgerRow[];
  boqItemCount: number;
  coveredBoqItemCount: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function codeOf(raw: string | null | undefined): string {
  return raw ? raw : UNCATEGORIZED_COST_CODE;
}

function emptyRow(categoryCode: string): CostLedgerRow {
  return { categoryCode, budget: 0, boqItemCount: 0, coveredBoqItemCount: 0, pending: 0, committed: 0, delivered: 0 };
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
    row.budget += computeItemCost(item).totalCost;
    row.boqItemCount += 1;
    codeByBoqId.set(item.id, code);
  }
  return codeByBoqId;
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
    rows: [...rows.values()].sort((a, b) => compareByLocale(a.categoryCode, b.categoryCode)),
    boqItemCount: codeByBoqId.size,
    coveredBoqItemCount,
  };
}

/** Rows a budget-vs-commitment chart shows: a budget source or money committed (pending-only codes wait for Φ2). */
export function hasBudgetOrCommitment(row: CostLedgerRow): boolean {
  return row.boqItemCount > 0 || row.committed > 0;
}
