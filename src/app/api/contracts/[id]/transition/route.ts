/**
 * =============================================================================
 * POST /api/contracts/[id]/transition — FSM Status Transition
 * =============================================================================
 *
 * Μετάβαση status: draft → pending_signature → signed → completed
 * Forward-only FSM (Ελληνική νομική διαδικασία)
 *
 * @module api/contracts/[id]/transition
 * @enterprise ADR-230 - Contract Workflow & Legal Process
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LegalContractService } from '@/services/legal-contract.service';
import type { ContractTransitionInput, ContractStatus } from '@/types/legal-contracts';

type SegmentData = { params: Promise<{ id: string }> };

const VALID_STATUSES: ContractStatus[] = ['draft', 'pending_signature', 'signed', 'completed'];

// =============================================================================
// POST — FSM Transition
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const { id } = await segmentData!.params;
        const body = (await req.json()) as ContractTransitionInput;

        if (!body.targetStatus || !VALID_STATUSES.includes(body.targetStatus)) {
          return NextResponse.json(
            { success: false, error: 'targetStatus must be draft, pending_signature, signed, or completed' },
            { status: 400 }
          );
        }

        const result = await LegalContractService.transitionStatus(id, body);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 409 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to transition contract';
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 }
        );
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
