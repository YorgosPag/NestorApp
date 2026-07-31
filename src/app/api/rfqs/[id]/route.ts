/**
 * GET    /api/rfqs/[id] — Get single RFQ
 * PATCH  /api/rfqs/[id] — Update RFQ / FSM transitions
 * DELETE /api/rfqs/[id] — Soft delete (archive)
 *
 * Auth: withAuth | Rate: standard (GET), sensitive (PATCH/DELETE)
 * @see ADR-327 §5.3 Phase P1b
 */

import 'server-only';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import {
  withStandardRateLimit,
  withSensitiveRateLimit,
} from '@/lib/middleware/with-rate-limit';
import { rfqIdRoute } from '../_shared/rfq-id-route';
import { getRfq, updateRfq, archiveRfq } from '@/subapps/procurement/services/rfq-service';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { rfqNotFoundResponse } from '../_shared/rfq-error-response';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';

// ============================================================================
// SCHEMAS
// ============================================================================

const RfqLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  trade: z.enum(TRADE_CODES),
  categoryCode: z.string().max(30).nullable().default(null),
  quantity: z.number().positive().nullable().default(null),
  unit: z.string().max(20).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
});

const UpdateRfqSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  lines: z.array(RfqLineSchema).max(100).optional(),
  deadlineDate: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'closed', 'archived']).optional(),
  awardMode: z.enum(['whole_package', 'cherry_pick']).optional(),
  reminderTemplate: z.enum(['aggressive', 'standard', 'soft', 'off']).optional(),
  winnerQuoteId: z.string().nullable().optional(),
});

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
