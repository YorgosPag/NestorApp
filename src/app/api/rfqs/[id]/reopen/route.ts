/**
 * POST /api/rfqs/[id]/reopen — Reopen closed RFQ (ADR-335 Q3)
 *
 * Effects:
 *   - status: closed → active
 *   - winnerQuoteId cleared
 *   - audit entry 'reopened'
 *   - sourcingEvent status recomputed if linked
 *
 * Errors:
 *   - 409 PO_EXISTS — winning quote has an active PO (must cancel PO first)
 *   - 400 invalid status (only closed → active allowed)
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-335
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { rfqIdRoute } from '../../_shared/rfq-id-route';
import { reopenRfq } from '@/subapps/procurement/services/rfq-lifecycle-service';

const handlePost = rfqIdRoute({
  // Μόνο αυτή η διαδρομή εκθέτει `code` (`PO_EXISTS` → 409, χωρίς μεταμφίεση).
  exposeCode: true,
  run: async ({ ctx, id }) =>
    NextResponse.json({ success: true, data: await reopenRfq(ctx, id) }),
});

export const POST = withSensitiveRateLimit(handlePost);
