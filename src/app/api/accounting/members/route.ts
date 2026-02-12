/**
 * =============================================================================
 * GET + PUT /api/accounting/members — Member Management (EPE)
 * =============================================================================
 *
 * GET:  Fetch members array
 * PUT:  Save/update members (validation: dividendSharePercent sum = 100%)
 *
 * Auth: withAuth (authenticated users)
 * Rate: withStandardRateLimit (60 req/min)
 *
 * @module api/accounting/members
 * @enterprise ADR-ACC-014 EPE LLC Support
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import type { Member } from '@/subapps/accounting/types/entity';

// =============================================================================
// VALIDATION
// =============================================================================

function validateMembers(members: Member[]): string | null {
  if (!Array.isArray(members)) return 'members must be an array';
  if (members.length === 0) return 'at least one member is required';

  for (const m of members) {
    if (!m.fullName?.trim()) return `member ${m.memberId}: fullName is required`;
    if (!m.vatNumber?.trim()) return `member ${m.memberId}: vatNumber is required`;
    if (!/^\d{9}$/.test(m.vatNumber.trim())) return `member ${m.memberId}: vatNumber must be 9 digits`;
    if (typeof m.sharesCount !== 'number' || m.sharesCount < 0) {
      return `member ${m.memberId}: sharesCount must be a non-negative number`;
    }
    if (typeof m.dividendSharePercent !== 'number' || m.dividendSharePercent < 0 || m.dividendSharePercent > 100) {
      return `member ${m.memberId}: dividendSharePercent must be 0-100`;
    }
  }

  // Validate active members dividendSharePercent sum ≈ 100%
  const activeMembers = members.filter((m) => m.isActive);
  const shareSum = activeMembers.reduce((sum, m) => sum + m.dividendSharePercent, 0);
  if (Math.abs(shareSum - 100) > 0.01) {
    return `active members dividendSharePercent sum must equal 100% (currently ${shareSum}%)`;
  }

  return null;
}

// =============================================================================
// GET — Fetch Members
// =============================================================================

async function handleGet(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const members = await repository.getMembers();

        return NextResponse.json({ success: true, data: members });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch members';
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
// PUT — Save Members
// =============================================================================

async function handlePut(request: NextRequest): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { repository } = createAccountingServices();
        const body = (await req.json()) as { members: Member[] };

        const validationError = validateMembers(body.members);
        if (validationError) {
          return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 }
          );
        }

        // Ensure nullable fields (Firestore compliance)
        const sanitizedMembers = body.members.map((m) => ({
          ...m,
          fullName: m.fullName.trim(),
          vatNumber: m.vatNumber.trim(),
          taxOffice: m.taxOffice?.trim() ?? '',
          capitalContribution: m.sharesCount * m.shareNominalValue,
          exitDate: m.exitDate ?? null,
          efkaConfig: m.isManager && m.efkaConfig
            ? {
                selectedMainPensionCode: m.efkaConfig.selectedMainPensionCode ?? 'main_1',
                selectedSupplementaryCode: m.efkaConfig.selectedSupplementaryCode ?? 'supplementary_1',
                selectedLumpSumCode: m.efkaConfig.selectedLumpSumCode ?? 'lump_sum_1',
                efkaRegistrationNumber: m.efkaConfig.efkaRegistrationNumber ?? '',
                activityStartDate: m.efkaConfig.activityStartDate ?? '',
                notes: m.efkaConfig.notes ?? null,
              }
            : null,
        }));

        await repository.saveMembers(sanitizedMembers);

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save members';
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
