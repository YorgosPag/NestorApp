/**
 * POST /api/properties/[id]/cheques/[chequeId]/bounce
 *
 * Mark a cheque as bounced with reason and optional legal actions.
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

const BounceSchema = z.object({
  bouncedReason: z.enum([
    'insufficient_funds', 'account_closed', 'signature_mismatch',
    'stop_payment', 'post_dated_early', 'technical_issue', 'other',
  ]),
  bouncedDate: z.string().min(10).max(30).optional(),
  legalAction: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export const POST = withStandardRateLimit(propertyRoute<{ id: string; chequeId: string }>({
  path: '/api/properties/[id]/cheques/[chequeId]/bounce',
  intent: 'write',
  failure: 'Failed to bounce cheque',
  handle: async ({ req, ctx, params, propertyId }) => {
    const parsed = safeParseBody(BounceSchema, await req.json());
    if (parsed.error) return parsed.error;

    const result = await ChequeRegistryService.bounceCheque(params.chequeId, parsed.data, ctx.uid);
    if (!result.success) return failure(result.error);

    await logFinancialTransition(ctx, 'cheque', params.chequeId, 'active', 'bounced', { propertyId });

    return NextResponse.json({ success: true }, { status: 201 });
  },
}));
