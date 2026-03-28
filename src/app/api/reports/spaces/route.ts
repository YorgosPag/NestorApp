/**
 * @module api/reports/spaces
 * @enterprise ADR-265 Phase 10 — Spaces (Parking/Storage) Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ReportDataAggregator } from '@/services/report-engine';
import type { SpacesReportData } from '@/services/report-engine';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('SpacesReportRoute');

export const dynamic = 'force-dynamic';

type SpacesResponse = ApiSuccessResponse<SpacesReportData>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<SpacesResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<SpacesResponse>> => {
      try {
        const filter = { companyId: ctx.companyId };
        const data = await ReportDataAggregator.getSpacesReport(filter);

        return apiSuccess<SpacesReportData>(data, 'Spaces report generated');
      } catch (err) {
        logger.error('Spaces report failed', { error: getErrorMessage(err) });
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
