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
import { PO_AWAITING_APPROVAL_STATUSES, PO_COMMITTED_STATUSES } from '@/types/procurement';
import { RFQ_OPEN_STATUSES } from '@/subapps/procurement/types/rfq';
import { fetchProjectPurchaseOrders } from './project-purchase-orders';
import { fetchProjectRfqs } from './project-boq-sourcing';

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
    const [rfqs, purchaseOrders] = await Promise.all([
      fetchProjectRfqs(db, companyId, projectId),
      fetchProjectPurchaseOrders(db, companyId, projectId),
    ]);

    const openRfqCount = rfqs.filter(rfq => RFQ_OPEN_STATUSES.has(rfq.status)).length;

    let pendingApprovalPoCount = 0;
    let totalCommittedSpend = 0;
    for (const po of purchaseOrders) {
      if (PO_AWAITING_APPROVAL_STATUSES.has(po.status)) pendingApprovalPoCount++;
      if (PO_COMMITTED_STATUSES.has(po.status)) totalCommittedSpend += po.total ?? 0;
    }

    return { openRfqCount, pendingApprovalPoCount, totalCommittedSpend };
  }, { openRfqCount: 0, pendingApprovalPoCount: 0, totalCommittedSpend: 0 });
}
