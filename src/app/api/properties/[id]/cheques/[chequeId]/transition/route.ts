/**
 * POST /api/properties/[id]/cheques/[chequeId]/transition
 *
 * FSM status transition for a cheque.
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
import { logFinancialTransition } from '@/lib/auth/audit';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const ChequeTransitionSchema = z.object({
  targetStatus: z.enum([
    'received', 'in_custody', 'deposited', 'clearing', 'cleared',
    'bounced', 'endorsed', 'cancelled', 'expired', 'replaced',
  ]),
  notes: z.string().max(2000).optional(),
});

type SegmentData = { params: Promise<{ id: string; chequeId: string }> };

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId, chequeId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requirePropertyInTenantScope({ ctx, propertyId: propertyId, path: '/api/properties/[id]/cheques/[chequeId]/transition' });
      try {
        const parsed = safeParseBody(ChequeTransitionSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await ChequeRegistryService.transitionStatus(chequeId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logFinancialTransition(ctx, 'cheque', chequeId, 'unknown', body.targetStatus);

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to transition cheque');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
