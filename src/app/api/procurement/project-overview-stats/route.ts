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
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { getErrorMessage } from '@/lib/error-utils';
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

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (
      req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse> => {
      const projectId = req.nextUrl.searchParams.get('projectId');
      if (!projectId) {
        return NextResponse.json(
          { success: false, error: 'projectId is required' },
          { status: 400 },
        );
      }

      try {
        const [basic, coverage] = await Promise.all([
          computeProjectBasicStats(ctx.companyId, projectId),
          computeBoqCoverageStats(ctx.companyId, projectId),
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

        return NextResponse.json({ success: true, data: stats });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 500 },
        );
      }
    },
  );
  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
