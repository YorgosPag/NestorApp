/**
 * POST /api/rfqs/[id]/cancel — Cancel RFQ (ADR-335 Q2)
 *
 * Body:
 *   - reason?: RfqCancellationReason (mandatory when current status === 'active')
 *   - detail?: string (mandatory when reason === 'other', max 500)
 *   - notifyVendors?: boolean (active RFQ only — fan-out cancel notification)
 *
 * Effects:
 *   - status → 'cancelled'
 *   - cancellationReason / cancellationDetail / cancelledAt / cancelledBy persisted
 *   - audit entry 'cancelled'
 *   - sourcingEvent status recomputed if linked
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-335
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { cancelRfq } from '@/subapps/procurement/services/rfq-lifecycle-service';
import { RFQ_CANCELLATION_REASONS } from '@/subapps/procurement/types/rfq';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { getErrorMessage } from '@/lib/error-utils';

const CancelBodySchema = z.object({
  reason: z.enum(RFQ_CANCELLATION_REASONS as readonly [string, ...string[]]).optional().nullable(),
  detail: z.string().max(500).optional().nullable(),
  notifyVendors: z.boolean().optional(),
});

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(CancelBodySchema, await req.json().catch(() => ({})));
        if (parsed.error) return parsed.error;
        const updated = await cancelRfq(ctx, id, {
          reason: parsed.data.reason ?? null,
          detail: parsed.data.detail ?? null,
          notifyVendors: parsed.data.notifyVendors,
        });
        return NextResponse.json({ success: true, data: updated });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 400 }
        );
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
