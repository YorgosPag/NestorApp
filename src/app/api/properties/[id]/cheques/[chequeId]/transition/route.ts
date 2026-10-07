/**
 * POST /api/properties/[id]/cheques/[chequeId]/transition
 *
 * FSM status transition for a cheque.
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { logFinancialTransition } from '@/lib/auth/audit';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const ChequeTransitionSchema = z.object({
  targetStatus: z.enum([
    'received', 'in_custody', 'deposited', 'clearing', 'cleared',
    'bounced', 'endorsed', 'cancelled', 'expired', 'replaced',
  ]),
  notes: z.string().max(2000).optional(),
});

export const POST = withStandardRateLimit(propertyRoute<{ id: string; chequeId: string }>({
  path: '/api/properties/[id]/cheques/[chequeId]/transition',
  intent: 'write',
  failure: 'Failed to transition cheque',
  handle: async ({ req, ctx, params }) => {
    const parsed = safeParseBody(ChequeTransitionSchema, await req.json());
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const result = await ChequeRegistryService.transitionStatus(params.chequeId, body, ctx.uid);
    if (!result.success) return failure(result.error);

    await logFinancialTransition(ctx, 'cheque', params.chequeId, 'unknown', body.targetStatus);

    return NextResponse.json({ success: true });
  },
}));
