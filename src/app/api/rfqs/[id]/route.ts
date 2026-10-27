/**
 * GET    /api/rfqs/[id] — Get single RFQ
 * PATCH  /api/rfqs/[id] — Update RFQ / FSM transitions
 * DELETE /api/rfqs/[id] — Soft delete (archive)
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-327 §5.3 Phase P1b
 */

import 'server-only';

import { NextResponse } from 'next/server';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { rfqIdRoute } from '../_shared/rfq-id-route';
import { getRfq, updateRfq, archiveRfq } from '@/subapps/procurement/services/rfq-service';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { rfqNotFoundResponse } from '../_shared/rfq-error-response';
import { UpdateRfqSchema } from '../_shared/rfq-schemas';

// ============================================================================
// HANDLERS — ένα κέλυφος για τα τρία ρήματα (ADR-742 §7.8)
// ============================================================================

const handleGet = rfqIdRoute({
  run: async ({ ctx, id }) => {
    // Η υπηρεσία σιωπά (Δ): ένα `null` για «δεν υπάρχει» ΚΑΙ «ανήκει αλλού».
    const rfq = await getRfq(ctx.companyId, id);
    if (!rfq) return rfqNotFoundResponse();
    return NextResponse.json({ success: true, data: rfq });
  },
});

const handlePatch = rfqIdRoute({
  run: async ({ req, ctx, id }) => {
    const parsed = safeParseBody(UpdateRfqSchema, await req.json());
    if (parsed.error) return parsed.error;
    return NextResponse.json({ success: true, data: await updateRfq(ctx, id, parsed.data) });
  },
});

const handleDelete = rfqIdRoute({
  run: async ({ ctx, id }) => {
    await archiveRfq(ctx, id);
    return NextResponse.json({ success: true });
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const GET = withStandardRateLimit(handleGet);
export const PATCH = withSensitiveRateLimit(handlePatch);
export const DELETE = withSensitiveRateLimit(handleDelete);
