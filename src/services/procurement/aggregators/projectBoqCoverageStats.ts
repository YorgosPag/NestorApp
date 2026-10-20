import 'server-only';

/**
 * projectBoqCoverageStats — Server-side aggregator for Project Procurement Overview KPIs 4/5
 *
 * KPI 4 — Budget vs Committed per ΑΤΟΕ category
 *   Budget   = sum of computed estimatedTotalCost per BOQ item per category
 *   Committed = sum of PO item totals per categoryCode for committed POs
 *
 * KPI 5 — % BOQ coverage
 *   Covered = unique boqItemIds across PO items of committed POs
 *   Total   = count of boq_items for the project
 *
 * BOQ costs are NOT stored in Firestore — the arithmetic lives ONCE in
 * `services/project-cost/cost-ledger` (→ `cost-engine.computeItemCost`), ADR-917 Δ1.
 *
 * @module services/procurement/aggregators/projectBoqCoverageStats
 * @see ADR-330 §5.1 S3, D11
 * @see ADR-917
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { fetchProjectPurchaseOrders } from './project-purchase-orders';
import { normalizeBOQItem } from '@/services/measurements/boq-document-normalize';
import { computeCostLedger, hasBudgetOrCommitment } from '@/services/project-cost/cost-ledger';

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetVsCommittedEntry {
  categoryCode: string;
  budget: number;
  committed: number;
}

export interface BoqCoverageStats {
  budgetVsCommitted: BudgetVsCommittedEntry[];
  coveredBoqItemCount: number;
  totalBoqItemCount: number;
  coveragePercentage: number;
}

// ============================================================================
// AGGREGATOR
// ============================================================================

export async function computeBoqCoverageStats(
  companyId: string,
  projectId: string,
): Promise<BoqCoverageStats> {
  const empty: BoqCoverageStats = {
    budgetVsCommitted: [],
    coveredBoqItemCount: 0,
    totalBoqItemCount: 0,
    coveragePercentage: 0,
  };

  return safeFirestoreOperation(async (db) => {
    const [boqSnap, purchaseOrders] = await Promise.all([
      db
        .collection(COLLECTIONS.BOQ_ITEMS)
        .where('companyId', '==', companyId)
        .where('projectId', '==', projectId)
        .get(),
      fetchProjectPurchaseOrders(db, companyId, projectId),
    ]);

    // ADR-917 Δ1: one arithmetic (cost-engine + PO status SSoT) — no local copy.
    const boqItems = boqSnap.docs.map(d => normalizeBOQItem(d.id, d.data()));
    const ledger = computeCostLedger(boqItems, purchaseOrders);

    const budgetVsCommitted: BudgetVsCommittedEntry[] = ledger.rows
      .filter(hasBudgetOrCommitment)
      .map(row => ({ categoryCode: row.categoryCode, budget: row.budget, committed: row.committed }));

    const totalBoqItemCount = ledger.boqItemCount;
    const coveredBoqItemCount = ledger.coveredBoqItemCount;
    const coveragePercentage =
      totalBoqItemCount > 0
        ? Math.round((coveredBoqItemCount / totalBoqItemCount) * 100)
        : 0;

    return {
      budgetVsCommitted,
      coveredBoqItemCount,
      totalBoqItemCount,
      coveragePercentage,
    };
  }, empty);
}
