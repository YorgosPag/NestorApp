import 'server-only';

/**
 * GET /api/procurement/project-overview-stats?projectId=X
 *
 * Returns all 5 Project Procurement KPIs for a single project:
 *   1 — openRfqCount
 *   2 — pendingApprovalPoCount
 *   3 — totalCommittedSpend
 *   4 — budgetVsCommitted (per ΑΤΟΕ category)
 *   5 — boqCoverage
 *
 * @see ADR-330 §5.1 S3, D11
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { computeProjectBasicStats } from '@/services/procurement/aggregators/projectProcurementStats';
import { computeBoqCoverageStats } from '@/services/procurement/aggregators/projectBoqCoverageStats';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectProcurementStats {
  openRfqCount: number;
  pendingApprovalPoCount: number;
  totalCommittedSpend: number;
  budgetVsCommitted: Array<{
    categoryCode: string;
    budget: number;
    committed: number;
  }>;
  boqCoverage: {
    coveredCount: number;
    totalCount: number;
    percentage: number;
  };
}

// ============================================================================
// GET
// ============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Unknown error',
  handler: async ({ req, auth }) => {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) badRequest('projectId is required');

    const [basic, coverage] = await Promise.all([
      computeProjectBasicStats(auth.companyId, projectId),
      computeBoqCoverageStats(auth.companyId, projectId),
    ]);

    const stats: ProjectProcurementStats = {
      openRfqCount: basic.openRfqCount,
      pendingApprovalPoCount: basic.pendingApprovalPoCount,
      totalCommittedSpend: basic.totalCommittedSpend,
      budgetVsCommitted: coverage.budgetVsCommitted,
      boqCoverage: {
        coveredCount: coverage.coveredBoqItemCount,
        totalCount: coverage.totalBoqItemCount,
        percentage: coverage.coveragePercentage,
      },
    };

    return ok(stats);
  },
});
