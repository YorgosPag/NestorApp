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
import { NextResponse } from 'next/server';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { rfqIdRoute } from '../../_shared/rfq-id-route';
import { cancelRfq } from '@/subapps/procurement/services/rfq-lifecycle-service';
import { RFQ_CANCELLATION_REASONS } from '@/subapps/procurement/types/rfq';
import type { RfqCancellationReason } from '@/subapps/procurement/types/rfq';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CancelBodySchema = z.object({
  reason: z.enum(RFQ_CANCELLATION_REASONS as readonly [string, ...string[]]).optional().nullable(),
  detail: z.string().max(500).optional().nullable(),
  notifyVendors: z.boolean().optional(),
});

const handlePost = rfqIdRoute({
  run: async ({ req, ctx, id }) => {
    const parsed = safeParseBody(CancelBodySchema, await req.json().catch(() => ({})));
    if (parsed.error) return parsed.error;
    const updated = await cancelRfq(ctx, id, {
      reason: (parsed.data.reason as RfqCancellationReason | null | undefined) ?? null,
      detail: parsed.data.detail ?? null,
      notifyVendors: parsed.data.notifyVendors,
    });
    return NextResponse.json({ success: true, data: updated });
  },
});

export const POST = withSensitiveRateLimit(handlePost);
