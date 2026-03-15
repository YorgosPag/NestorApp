/**
 * POST /api/units/[id]/cheques/[chequeId]/transition
 *
 * FSM status transition for a cheque.
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import type { ChequeTransitionInput } from '@/types/cheque-registry';

type SegmentData = { params: Promise<{ id: string; chequeId: string }> };

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { chequeId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as ChequeTransitionInput;

        if (!body.targetStatus) {
          return NextResponse.json(
            { success: false, error: 'targetStatus is required' },
            { status: 400 }
          );
        }

        const result = await ChequeRegistryService.transitionStatus(chequeId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to transition cheque';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
