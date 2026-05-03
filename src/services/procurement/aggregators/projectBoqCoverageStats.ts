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
 * BOQ costs are NOT stored in Firestore — computed from:
 *   totalCost = (materialUnitCost + laborUnitCost + equipmentUnitCost)
 *               × estimatedQuantity × (1 + wasteFactor)
 *
 * @module services/procurement/aggregators/projectBoqCoverageStats
 * @see ADR-330 §5.1 S3, D11
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { PurchaseOrder } from '@/types/procurement';

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

interface RawBoqItem {
  categoryCode: string;
  estimatedQuantity: number | null;
  wasteFactor: number | null;
  materialUnitCost: number | null;
  laborUnitCost: number | null;
  equipmentUnitCost: number | null;
}

const COMMITTED_STATUSES = new Set(['ordered', 'partially_delivered', 'delivered', 'closed']);

// ============================================================================
// HELPERS
// ============================================================================

function computeItemCost(item: RawBoqItem): number {
  const qty = item.estimatedQuantity ?? 0;
  const waste = item.wasteFactor ?? 0;
  const gross = qty * (1 + waste);
  const unitCost =
    (item.materialUnitCost ?? 0) +
    (item.laborUnitCost ?? 0) +
    (item.equipmentUnitCost ?? 0);
  return gross * unitCost;
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
    const [boqSnap, poSnap] = await Promise.all([
      db
        .collection(COLLECTIONS.BOQ_ITEMS)
        .where('companyId', '==', companyId)
        .where('projectId', '==', projectId)
        .get(),
      db
        .collection(COLLECTIONS.PURCHASE_ORDERS)
        .where('companyId', '==', companyId)
        .where('isDeleted', '==', false)
        .where('projectId', '==', projectId)
        .get(),
    ]);

    // Budget per category from BOQ items
    const budgetByCategory = new Map<string, number>();
    for (const doc of boqSnap.docs) {
      const item = doc.data() as RawBoqItem;
      const code = item.categoryCode ?? 'OTHER';
      const cost = computeItemCost(item);
      budgetByCategory.set(code, (budgetByCategory.get(code) ?? 0) + cost);
    }

    // Committed spend per category + covered boqItemIds from committed POs
    const committedByCategory = new Map<string, number>();
    const coveredBoqItemIds = new Set<string>();
    for (const doc of poSnap.docs) {
      const po = doc.data() as PurchaseOrder;
      if (!COMMITTED_STATUSES.has(po.status)) continue;
      for (const item of po.items ?? []) {
        const code = item.categoryCode ?? 'OTHER';
        committedByCategory.set(code, (committedByCategory.get(code) ?? 0) + (item.total ?? 0));
        if (item.boqItemId) coveredBoqItemIds.add(item.boqItemId);
      }
    }

    // Merge budget + committed into unified category list
    const allCodes = new Set([...budgetByCategory.keys(), ...committedByCategory.keys()]);
    const budgetVsCommitted: BudgetVsCommittedEntry[] = [];
    for (const code of allCodes) {
      budgetVsCommitted.push({
        categoryCode: code,
        budget: budgetByCategory.get(code) ?? 0,
        committed: committedByCategory.get(code) ?? 0,
      });
    }
    budgetVsCommitted.sort((a, b) => a.categoryCode.localeCompare(b.categoryCode));

    const totalBoqItemCount = boqSnap.size;
    const coveredBoqItemCount = coveredBoqItemIds.size;
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
