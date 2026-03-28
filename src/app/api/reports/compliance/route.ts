/**
 * @module api/reports/compliance
 * @enterprise ADR-265 Phase 12 — Compliance & Labor Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ReportDataAggregator } from '@/services/report-engine';
import type { ComplianceReportData } from '@/services/report-engine';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ComplianceReportRoute');

export const dynamic = 'force-dynamic';

type ComplianceResponse = ApiSuccessResponse<ComplianceReportData>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<ComplianceResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<ComplianceResponse>> => {
      try {
        const filter = { companyId: ctx.companyId };
        const data = await ReportDataAggregator.getComplianceReport(filter);

        return apiSuccess<ComplianceReportData>(data, 'Compliance report generated');
      } catch (err) {
        logger.error('Compliance report failed', { error: getErrorMessage(err) });
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
