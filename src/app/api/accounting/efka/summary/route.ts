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
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { isPartnership, isLlc, isCorporation } from '@/subapps/accounting/utils/entity-guards';

// =============================================================================
// GET — EFKA Annual Summary
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { service, repository } = createAccountingServices();
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

        // Check entity type for partnership / corporate path
        const profile = await repository.getCompanySetup();

        if (profile && isPartnership(profile)) {
          const partnershipSummary = await service.getPartnershipEfkaSummary(year);
          return NextResponse.json({
            success: true,
            entityType: 'oe',
            data: partnershipSummary,
          });
        }

        if (profile && isLlc(profile)) {
          const epeSummary = await service.getEPEEfkaSummary(year);
          return NextResponse.json({
            success: true,
            entityType: 'epe',
            data: epeSummary,
          });
        }

        if (profile && isCorporation(profile)) {
          const aeSummary = await service.getAEEfkaSummary(year);
          return NextResponse.json({
            success: true,
            entityType: 'ae',
            data: aeSummary,
          });
        }

        const summary = await service.getEfkaAnnualSummary(year);

        return NextResponse.json({
          success: true,
          entityType: 'sole_proprietor',
          data: summary,
        });
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
