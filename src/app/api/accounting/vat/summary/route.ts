/**
 * =============================================================================
 * GET /api/accounting/vat/summary — VAT Dashboard Summary
 * =============================================================================
 *
 * Returns VAT summary — either quarterly or annual.
 *
 * Query params:
 *   - fiscalYear (required): e.g. 2026
 *   - quarter (optional): 1-4. If omitted, returns annual summary.
 *
 * Auth: withAuth (authenticated users)
 * Rate: standard (60 req/min)
 *
 * @module api/accounting/vat/summary
 * @enterprise ADR-ACC-004 VAT Engine
 * @enterprise ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { defineRoute, ok, badRequest } from '@/lib/api/define-route';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { FiscalQuarter } from '@/subapps/accounting/types';

// =============================================================================
// GET — VAT Summary (Quarter or Annual)
// =============================================================================

export const GET = defineRoute({
  rateLimit: 'standard',
  fallbackError: 'Failed to get VAT summary',
  handler: async ({ req, auth }) => {
    const { service } = createAccountingServices({ companyId: auth.companyId, userId: auth.uid });
    const { searchParams } = new URL(req.url);

    const fiscalYearParam = searchParams.get('fiscalYear');
    if (!fiscalYearParam) {
      badRequest('fiscalYear query parameter is required');
    }

    const fiscalYear = parseInt(fiscalYearParam, 10);
    if (Number.isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      badRequest('fiscalYear must be a valid year (2000-2100)');
    }

    const quarterParam = searchParams.get('quarter');

    if (quarterParam) {
      // Quarterly summary
      const quarter = parseInt(quarterParam, 10);
      if (quarter < 1 || quarter > 4) {
        badRequest('quarter must be 1, 2, 3, or 4');
      }

      const summary = await service.getVATQuarterDashboard(
        fiscalYear,
        quarter as FiscalQuarter
      );

      return ok(summary);
    }

    // Annual summary
    const summary = await service.getVATAnnualDashboard(fiscalYear);

    return ok(summary);
  },
});
