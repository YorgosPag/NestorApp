import 'server-only';

/**
 * projectProcurementStats — Server-side aggregator for Project Procurement Overview KPIs 1/2/3
 *
 * Queries Firestore (Admin SDK) for a single project:
 *   KPI 1 — count RFQs with status 'active'
 *   KPI 2 — count POs with status 'draft' (awaiting approval)
 *   KPI 3 — sum PO totals for committed statuses (ordered/partially_delivered/delivered/closed)
 *
 * @module services/procurement/aggregators/projectProcurementStats
 * @see ADR-330 §5.1 S3, D11
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PO_COMMITTED_STATUSES } from '@/types/procurement';
import { fetchProjectPurchaseOrders } from './project-purchase-orders';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectBasicStats {
  openRfqCount: number;
  pendingApprovalPoCount: number;
  totalCommittedSpend: number;
}

// ============================================================================
// AGGREGATOR
// ============================================================================

export async function computeProjectBasicStats(
  companyId: string,
  projectId: string,
): Promise<ProjectBasicStats> {
  return safeFirestoreOperation(async (db) => {
    const [rfqSnap, purchaseOrders] = await Promise.all([
      db
        .collection(COLLECTIONS.RFQS)
        .where('companyId', '==', companyId)
        .where('projectId', '==', projectId)
        .get(),
      fetchProjectPurchaseOrders(db, companyId, projectId),
    ]);

    let openRfqCount = 0;
    for (const doc of rfqSnap.docs) {
      if ((doc.data() as { status: string }).status === 'active') openRfqCount++;
    }

    let pendingApprovalPoCount = 0;
    let totalCommittedSpend = 0;
    for (const po of purchaseOrders) {
      if (po.status === 'draft') pendingApprovalPoCount++;
      if (PO_COMMITTED_STATUSES.has(po.status)) totalCommittedSpend += po.total ?? 0;
    }

    return { openRfqCount, pendingApprovalPoCount, totalCommittedSpend };
  }, { openRfqCount: 0, pendingApprovalPoCount: 0, totalCommittedSpend: 0 });
}
