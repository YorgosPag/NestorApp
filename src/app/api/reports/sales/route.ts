/**
 * @module api/reports/sales
 * @enterprise ADR-265 Phase 6 — Sales & Collections Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ReportDataAggregator } from '@/services/report-engine';
import type { SalesReportData } from '@/services/report-engine';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('SalesReportRoute');

export const dynamic = 'force-dynamic';

type SalesResponse = ApiSuccessResponse<SalesReportData>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<SalesResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ) => {
      try {
        const filter = { companyId: ctx.companyId };
        const data = await ReportDataAggregator.getSalesReport(filter);

        return apiSuccess<SalesReportData>(data, 'Sales report generated');
      } catch (err) {
        logger.error('Sales report failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false as const, error: getErrorMessage(err), timestamp: nowISO() },
          { status: 500 },
        );
      }
    },
    { permissions: 'reports:reports:view' },
  );

  return handler(request);
});
