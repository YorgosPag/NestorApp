/**
 * =============================================================================
 * GET /api/accounting/reports/[type] — Financial Report Generator
 * =============================================================================
 *
 * Generates one of 8 financial reports with comparative analysis.
 *
 * Path params:
 *   - type: profit_and_loss | trial_balance | ar_aging | tax_summary
 *           | bank_reconciliation | cash_flow | income_by_customer | expense_by_category
 *
 * Query params:
 *   - preset (required): this_month | last_month | this_quarter | last_quarter
 *                         | this_year | last_year | ytd | custom
 *   - from (required if preset=custom): ISO 8601 date (e.g. 2026-01-01)
 *   - to (required if preset=custom): ISO 8601 date (e.g. 2026-03-31)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/reports/[type]
 * @enterprise Phase 2c — DECISIONS-PHASE-2.md Q6-Q10
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { generateReport, VALID_REPORT_TYPES } from '@/subapps/accounting/services/reports';
import { resolveReportPeriods, validateDateFilter } from '@/subapps/accounting/services/reports/report-date-utils';
import type { ReportType, ReportDateFilter, ReportDatePreset } from '@/subapps/accounting/types/reports';
import { getErrorMessage } from '@/lib/error-utils';

// =============================================================================
// GET — Generate Report
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ type: string }> }
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        // 1. Validate report type from path
        const { type: reportTypeParam } = await segmentData!.params;
        if (!VALID_REPORT_TYPES.includes(reportTypeParam as ReportType)) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid report type: ${reportTypeParam}. Valid: ${VALID_REPORT_TYPES.join(', ')}`,
            },
            { status: 400 }
          );
        }
        const reportType = reportTypeParam as ReportType;

        // 2. Parse date filter from query params
        const { searchParams } = new URL(req.url);
        const preset = searchParams.get('preset');
        if (!preset) {
          return NextResponse.json(
            { success: false, error: 'preset query parameter is required' },
            { status: 400 }
          );
        }

        const dateFilter: ReportDateFilter = {
          preset: preset as ReportDatePreset,
          customFrom: searchParams.get('from') ?? undefined,
          customTo: searchParams.get('to') ?? undefined,
        };

        // 3. Validate date filter
        const validationError = validateDateFilter(dateFilter);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        // 4. Resolve periods
        const periods = resolveReportPeriods(dateFilter);

        // 5. Generate report
        const { repository, vatEngine, taxEngine } = createAccountingServices();
        const result = await generateReport(reportType, { repository, vatEngine, taxEngine }, periods);

        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to generate report');
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );
  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);
