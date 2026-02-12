/**
 * =============================================================================
 * GET /api/accounting/tax/estimate — Tax Estimate (Real-time Projection)
 * =============================================================================
 *
 * Returns a real-time tax estimate for the given fiscal year based on
 * current income, expenses, EFKA contributions, and applicable tax scales.
 *
 * Query params:
 *   - fiscalYear (optional): Defaults to current year
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/tax/estimate
 * @enterprise ADR-ACC-009 Tax Engine
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { isPartnership, isLlc, isCorporation } from '@/subapps/accounting/utils/entity-guards';

// =============================================================================
// GET — Tax Estimate
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { service, repository } = createAccountingServices();
        const { searchParams } = new URL(req.url);

        const fiscalYearParam = searchParams.get('fiscalYear');
        const fiscalYear = fiscalYearParam
          ? parseInt(fiscalYearParam, 10)
          : new Date().getFullYear();

        if (Number.isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
          return NextResponse.json(
            { success: false, error: 'fiscalYear must be a valid year (2000-2100)' },
            { status: 400 }
          );
        }

        // Check entity type for partnership / corporate path
        const profile = await repository.getCompanySetup();

        if (profile && isPartnership(profile)) {
          const partnershipResult = await service.calculatePartnershipTax(fiscalYear);
          return NextResponse.json({
            success: true,
            entityType: 'oe',
            data: partnershipResult,
          });
        }

        if (profile && isLlc(profile)) {
          const epeResult = await service.calculateEPETax(fiscalYear);
          return NextResponse.json({
            success: true,
            entityType: 'epe',
            data: epeResult,
          });
        }

        if (profile && isCorporation(profile)) {
          const aeResult = await service.calculateAETax(fiscalYear);
          return NextResponse.json({
            success: true,
            entityType: 'ae',
            data: aeResult,
          });
        }

        const estimate = await service.getTaxEstimate(fiscalYear);

        return NextResponse.json({
          success: true,
          entityType: 'sole_proprietor',
          data: estimate,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get tax estimate';
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
