/**
 * @module api/reports/projects
 * @enterprise ADR-265 Phase 7 — Projects & Buildings Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ReportDataAggregator } from '@/services/report-engine';
import type { ProjectsReportData } from '@/services/report-engine';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ProjectsReportRoute');

export const dynamic = 'force-dynamic';

type ProjectsResponse = ApiSuccessResponse<ProjectsReportData>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<ProjectsResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const filter = { companyId: ctx.companyId };
        const data = await ReportDataAggregator.getProjectsReport(filter);

        return apiSuccess<ProjectsReportData>(data, 'Projects report generated');
      } catch (err) {
        logger.error('Projects report failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: new Date().toISOString() },
          { status: 500 },
        );
      }
    },
    { permissions: 'reports:reports:view' },
  );

  return handler(request);
});
