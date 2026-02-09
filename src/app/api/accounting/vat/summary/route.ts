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
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/vat/summary
 * @enterprise ADR-ACC-004 VAT Engine
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { FiscalQuarter } from '@/subapps/accounting/types';

// =============================================================================
// GET — VAT Summary (Quarter or Annual)
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { service } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const fiscalYearParam = searchParams.get('fiscalYear');
        if (!fiscalYearParam) {
          return NextResponse.json(
            { success: false, error: 'fiscalYear query parameter is required' },
            { status: 400 }
          );
        }

        const fiscalYear = parseInt(fiscalYearParam, 10);
        if (Number.isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
          return NextResponse.json(
            { success: false, error: 'fiscalYear must be a valid year (2000-2100)' },
            { status: 400 }
          );
        }

        const quarterParam = searchParams.get('quarter');

        if (quarterParam) {
          // Quarterly summary
          const quarter = parseInt(quarterParam, 10);
          if (quarter < 1 || quarter > 4) {
            return NextResponse.json(
              { success: false, error: 'quarter must be 1, 2, 3, or 4' },
              { status: 400 }
            );
          }

          const summary = await service.getVATQuarterDashboard(
            fiscalYear,
            quarter as FiscalQuarter
          );

          return NextResponse.json({ success: true, data: summary });
        }

        // Annual summary
        const summary = await service.getVATAnnualDashboard(fiscalYear);

        return NextResponse.json({ success: true, data: summary });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get VAT summary';
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
