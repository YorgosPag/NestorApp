/**
 * POST /api/units/[id]/cheques/[chequeId]/endorse
 *
 * Endorse a cheque (append to endorsement chain).
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import type { EndorseInput } from '@/types/cheque-registry';

type SegmentData = { params: Promise<{ id: string; chequeId: string }> };

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { chequeId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as EndorseInput;

        if (!body.endorserName?.trim() || !body.endorseeName?.trim()) {
          return NextResponse.json(
            { success: false, error: 'endorserName and endorseeName are required' },
            { status: 400 }
          );
        }

        const result = await ChequeRegistryService.endorseCheque(chequeId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to endorse cheque';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
