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
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/reports/[type]
 * @enterprise Phase 2c — DECISIONS-PHASE-2.md Q6-Q10
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { generateReport, VALID_REPORT_TYPES } from '@/subapps/accounting/services/reports';
import { resolveReportPeriods, validateDateFilter } from '@/subapps/accounting/services/reports/report-date-utils';
import type { ReportType, ReportDateFilter, ReportDatePreset } from '@/subapps/accounting/types/reports';

// =============================================================================
// GET — Generate Report
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to generate report',
  handler: async ({ req, auth, params }) => {
    // 1. Validate report type from path
    const { type: reportTypeParam } = params;
    if (!VALID_REPORT_TYPES.includes(reportTypeParam as ReportType)) {
      badRequest(`Invalid report type: ${reportTypeParam}. Valid: ${VALID_REPORT_TYPES.join(', ')}`);
    }
    const reportType = reportTypeParam as ReportType;

    // 2. Parse date filter from query params
    const { searchParams } = new URL(req.url);
    const preset = searchParams.get('preset');
    if (!preset) {
      badRequest('preset query parameter is required');
    }

    const dateFilter: ReportDateFilter = {
      preset: preset as ReportDatePreset,
      customFrom: searchParams.get('from') ?? undefined,
      customTo: searchParams.get('to') ?? undefined,
    };

    // 3. Validate date filter
    const validationError = validateDateFilter(dateFilter);
    if (validationError) {
      badRequest(validationError);
    }

    // 4. Resolve periods
    const periods = resolveReportPeriods(dateFilter);

    // 5. Generate report
    const { repository, vatEngine, taxEngine } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const result = await generateReport(reportType, { repository, vatEngine, taxEngine }, periods);

    return ok(result);
  },
});
