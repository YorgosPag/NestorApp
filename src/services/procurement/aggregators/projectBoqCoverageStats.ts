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
import { costCodeFamilyOf } from '@/config/cost-taxonomy';
import { hasBudgetOrCommitment, type CostLedgerRow } from '@/services/project-cost/cost-ledger';
import { loadProjectCostLedger } from '@/services/project-cost/project-cost-ledger.server';

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

/** Procurement KPIs compare hard cost only — soft cost (SOFT-*) is never bought with a PO line. */
function isProcurementRow(row: CostLedgerRow): boolean {
  return hasBudgetOrCommitment(row) && costCodeFamilyOf(row.categoryCode) !== 'soft';
}

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
    // ADR-917 Δ1/Δ3: one read + one arithmetic, shared with the cost-ledger route and the AI tool.
    const ledger = await loadProjectCostLedger(db, companyId, projectId);

    const budgetVsCommitted: BudgetVsCommittedEntry[] = ledger.rows
      .filter(isProcurementRow)
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
