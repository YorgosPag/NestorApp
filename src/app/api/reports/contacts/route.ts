/**
 * @module api/reports/contacts
 * @enterprise ADR-265 Phase 9 — Contacts & Customers Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ReportDataAggregator } from '@/services/report-engine';
import type { ContactsReportData } from '@/services/report-engine';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ContactsReportRoute');

export const dynamic = 'force-dynamic';

type ContactsResponse = ApiSuccessResponse<ContactsReportData>;

export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
) {
  const handler = withAuth<ContactsResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<ContactsResponse>> => {
      try {
        const filter = { companyId: ctx.companyId };
        const data = await ReportDataAggregator.getContactsReport(filter);

        return apiSuccess<ContactsReportData>(data, 'Contacts report generated');
      } catch (err) {
        logger.error('Contacts report failed', { error: getErrorMessage(err) });
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
