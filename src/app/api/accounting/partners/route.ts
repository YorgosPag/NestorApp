/**
 * =============================================================================
 * GET + PUT /api/accounting/partners — Partner Management (OE)
 * =============================================================================
 *
 * GET:  Fetch partners array
 * PUT:  Save/update partners (validation: sum = 100%)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/partners
 * @enterprise ADR-ACC-012 OE Partnership Support
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { Partner } from '@/subapps/accounting/types/entity';

// =============================================================================
// VALIDATION
// =============================================================================

function validatePartners(partners: Partner[]): string | null {
  if (!Array.isArray(partners)) return 'partners must be an array';
  if (partners.length === 0) return 'at least one partner is required';

  for (const p of partners) {
    if (!p.fullName?.trim()) return `partner ${p.partnerId}: fullName is required`;
    if (!p.vatNumber?.trim()) return `partner ${p.partnerId}: vatNumber is required`;
    if (!/^\d{9}$/.test(p.vatNumber.trim())) return `partner ${p.partnerId}: vatNumber must be 9 digits`;
    if (typeof p.profitSharePercent !== 'number' || p.profitSharePercent < 0 || p.profitSharePercent > 100) {
      return `partner ${p.partnerId}: profitSharePercent must be 0-100`;
    }
  }

  // Validate sum ≈ 100% (allow ±0.01 for rounding)
  const activePartners = partners.filter((p) => p.isActive);
  const shareSum = activePartners.reduce((sum, p) => sum + p.profitSharePercent, 0);
  if (Math.abs(shareSum - 100) > 0.01) {
    return `active partners profitSharePercent sum must equal 100% (currently ${shareSum}%)`;
  }

  return null;
}

// =============================================================================
// GET — Fetch Partners
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const partners = await repository.getPartners();

        return NextResponse.json({ success: true, data: partners });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch partners';
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

// =============================================================================
// PUT — Save Partners
// =============================================================================

async function handlePut(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as { partners: Partner[] };

        const validationError = validatePartners(body.partners);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        // Ensure nullable fields (Firestore compliance)
        const sanitizedPartners = body.partners.map((p) => ({
          ...p,
          fullName: p.fullName.trim(),
          vatNumber: p.vatNumber.trim(),
          taxOffice: p.taxOffice?.trim() ?? '',
          exitDate: p.exitDate ?? null,
          efkaConfig: {
            selectedMainPensionCode: p.efkaConfig?.selectedMainPensionCode ?? 'main_1',
            selectedSupplementaryCode: p.efkaConfig?.selectedSupplementaryCode ?? 'supplementary_1',
            selectedLumpSumCode: p.efkaConfig?.selectedLumpSumCode ?? 'lump_sum_1',
            efkaRegistrationNumber: p.efkaConfig?.efkaRegistrationNumber ?? '',
            activityStartDate: p.efkaConfig?.activityStartDate ?? '',
            notes: p.efkaConfig?.notes ?? null,
          },
        }));

        await repository.savePartners(sanitizedPartners);

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save partners';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const PUT = withStandardRateLimit(handlePut);
