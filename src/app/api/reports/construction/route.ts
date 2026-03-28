/**
 * @module api/reports/construction
 * @enterprise ADR-265 Phase 11 — Construction & Timeline Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ReportDataAggregator } from '@/services/report-engine';
import type { ConstructionReportData } from '@/services/report-engine';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ConstructionReportRoute');

export const dynamic = 'force-dynamic';

type ConstructionResponse = ApiSuccessResponse<ConstructionReportData>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<ConstructionResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<ConstructionResponse>> => {
      try {
        const filter = { companyId: ctx.companyId };
        const data = await ReportDataAggregator.getConstructionReport(filter);

        return apiSuccess<ConstructionReportData>(data, 'Construction report generated');
      } catch (err) {
        logger.error('Construction report failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: new Date().toISOString() },
          { status: 500 },
        );
      }
    },
    { requiredPermission: 'reports:reports:view' },
  );

  return handler(request);
});
