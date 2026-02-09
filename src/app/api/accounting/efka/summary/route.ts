/**
 * =============================================================================
 * GET /api/accounting/efka/summary — EFKA Annual Summary
 * =============================================================================
 *
 * Returns the annual EFKA (social security) contributions summary
 * including monthly breakdown, payments, and balance.
 *
 * Query params:
 *   - year (optional): Fiscal year, defaults to current year
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/efka/summary
 * @enterprise ADR-ACC-006 EFKA Contributions
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services';

// =============================================================================
// GET — EFKA Annual Summary
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { service } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const yearParam = searchParams.get('year');
        const year = yearParam
          ? parseInt(yearParam, 10)
          : new Date().getFullYear();

        if (Number.isNaN(year) || year < 2000 || year > 2100) {
          return NextResponse.json(
            { success: false, error: 'year must be a valid year (2000-2100)' },
            { status: 400 }
          );
        }

        const summary = await service.getEfkaAnnualSummary(year);

        return NextResponse.json({ success: true, data: summary });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get EFKA summary';
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
