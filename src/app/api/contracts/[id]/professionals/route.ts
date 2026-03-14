/**
 * =============================================================================
 * PATCH /api/contracts/[id]/professionals — Override Professional Snapshot
 * =============================================================================
 *
 * Αλλαγή/αφαίρεση νομικού επαγγελματία σε draft/pending_signature contract.
 * Δεν επιτρέπεται σε signed/completed contracts.
 *
 * @module api/contracts/[id]/professionals
 * @enterprise ADR-230 - Contract Workflow & Legal Process
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LegalContractService } from '@/services/legal-contract.service';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

type SegmentData = { params: Promise<{ id: string }> };

interface OverrideProfessionalBody {
  role: LegalProfessionalRole;
  contactId: string | null;
}

const VALID_ROLES: LegalProfessionalRole[] = ['seller_lawyer', 'buyer_lawyer', 'notary'];

// =============================================================================
// PATCH — Override Professional
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;
        const body = (await req.json()) as OverrideProfessionalBody;

        if (!body.role || !VALID_ROLES.includes(body.role)) {
          return NextResponse.json(
            { success: false, error: 'role must be seller_lawyer, buyer_lawyer, or notary' },
            { status: 400 }
          );
        }

        const result = await LegalContractService.overrideProfessional(
          id,
          body.role,
          body.contactId
        );

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 409 }
          );
        }

        return NextResponse.json({ success: true, data: { snapshot: result.snapshot } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to override professional';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
