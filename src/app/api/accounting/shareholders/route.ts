/**
 * =============================================================================
 * GET + PUT /api/accounting/shareholders — Shareholder Management (AE)
 * =============================================================================
 *
 * GET:  Fetch shareholders array
 * PUT:  Save/update shareholders (validation: dividendSharePercent sum = 100%)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/shareholders
 * @enterprise ADR-ACC-015 AE Setup & Shareholders
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { Shareholder, ShareholderEFKAMode } from '@/subapps/accounting/types/entity';

// =============================================================================
// EFKA MODE DERIVATION
// =============================================================================

/**
 * Υπολογισμός EFKA mode βάσει κανόνων ΕΦΚΑ (Εγκύκλιοι 4/2017, 17/2017)
 *
 * - employee: isBoardMember && compensation > 0 && shares < 3% συνόλου
 * - self_employed: isBoardMember && compensation > 0 && shares ≥ 3%
 * - none: !isBoardMember || compensation === 0/null
 */
function deriveEfkaMode(
  shareholder: Shareholder,
  totalShares: number
): ShareholderEFKAMode {
  if (!shareholder.isBoardMember || !shareholder.monthlyCompensation || shareholder.monthlyCompensation <= 0) {
    return 'none';
  }
  const sharePercent = totalShares > 0 ? (shareholder.sharesCount / totalShares) * 100 : 0;
  return sharePercent < 3 ? 'employee' : 'self_employed';
}

// =============================================================================
// VALIDATION
// =============================================================================

function validateShareholders(shareholders: Shareholder[]): string | null {
  if (!Array.isArray(shareholders)) return 'shareholders must be an array';
  if (shareholders.length === 0) return 'at least one shareholder is required';

  for (const s of shareholders) {
    if (!s.fullName?.trim()) return `shareholder ${s.shareholderId}: fullName is required`;
    if (!s.vatNumber?.trim()) return `shareholder ${s.shareholderId}: vatNumber is required`;
    if (!/^\d{9}$/.test(s.vatNumber.trim())) return `shareholder ${s.shareholderId}: vatNumber must be 9 digits`;
    if (typeof s.sharesCount !== 'number' || s.sharesCount < 0) {
      return `shareholder ${s.shareholderId}: sharesCount must be a non-negative number`;
    }
    if (typeof s.dividendSharePercent !== 'number' || s.dividendSharePercent < 0 || s.dividendSharePercent > 100) {
      return `shareholder ${s.shareholderId}: dividendSharePercent must be 0-100`;
    }
    if (s.isBoardMember && !s.boardRole) {
      return `shareholder ${s.shareholderId}: boardRole is required when isBoardMember is true`;
    }
  }

  // Validate active shareholders dividendSharePercent sum ≈ 100%
  const activeShareholders = shareholders.filter((s) => s.isActive);
  const shareSum = activeShareholders.reduce((sum, s) => sum + s.dividendSharePercent, 0);
  if (Math.abs(shareSum - 100) > 0.01) {
    return `active shareholders dividendSharePercent sum must equal 100% (currently ${shareSum}%)`;
  }

  return null;
}

// =============================================================================
// GET — Fetch Shareholders
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const shareholders = await repository.getShareholders();

        return NextResponse.json({ success: true, data: shareholders });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch shareholders';
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
// PUT — Save Shareholders
// =============================================================================

async function handlePut(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as { shareholders: Shareholder[] };

        const validationError = validateShareholders(body.shareholders);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        // Calculate total shares for EFKA mode derivation
        const totalShares = body.shareholders.reduce((sum, s) => sum + s.sharesCount, 0);

        // Sanitize + derive EFKA mode (Firestore compliance)
        const sanitizedShareholders = body.shareholders.map((s) => ({
          ...s,
          fullName: s.fullName.trim(),
          vatNumber: s.vatNumber.trim(),
          taxOffice: s.taxOffice?.trim() ?? '',
          capitalContribution: s.sharesCount * s.shareNominalValue,
          boardRole: s.isBoardMember ? (s.boardRole ?? 'member') : null,
          monthlyCompensation: s.isBoardMember ? (s.monthlyCompensation ?? null) : null,
          efkaMode: deriveEfkaMode(s, totalShares),
          exitDate: s.exitDate ?? null,
          efkaConfig: s.efkaMode === 'self_employed' && s.efkaConfig
            ? {
                selectedMainPensionCode: s.efkaConfig.selectedMainPensionCode ?? 'main_1',
                selectedSupplementaryCode: s.efkaConfig.selectedSupplementaryCode ?? 'supplementary_1',
                selectedLumpSumCode: s.efkaConfig.selectedLumpSumCode ?? 'lump_sum_1',
                efkaRegistrationNumber: s.efkaConfig.efkaRegistrationNumber ?? '',
                activityStartDate: s.efkaConfig.activityStartDate ?? '',
                notes: s.efkaConfig.notes ?? null,
              }
            : null,
        }));

        await repository.saveShareholders(sanitizedShareholders);

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save shareholders';
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
