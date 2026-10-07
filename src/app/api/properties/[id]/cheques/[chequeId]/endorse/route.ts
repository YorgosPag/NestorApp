/**
 * POST /api/properties/[id]/cheques/[chequeId]/endorse
 *
 * Endorse a cheque (append to endorsement chain).
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
import { nowISO } from '@/lib/date-local';

const EndorseSchema = z.object({
  endorserName: z.string().min(1).max(200),
  endorseeName: z.string().min(1).max(200),
  endorsementDate: z.string().min(10).max(30).optional(),
  endorserTaxId: z.string().max(20).optional(),
  endorseeTaxId: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const POST = withStandardRateLimit(propertyRoute<{ id: string; chequeId: string }>({
  path: '/api/properties/[id]/cheques/[chequeId]/endorse',
  intent: 'write',
  failure: 'Failed to endorse cheque',
  handle: async ({ req, ctx, params, propertyId }) => {
    const parsed = safeParseBody(EndorseSchema, await req.json());
    if (parsed.error) return parsed.error;

    const endorseInput = {
      ...parsed.data,
      endorsementDate: parsed.data.endorsementDate ?? nowISO().split('T')[0],
    };

    const result = await ChequeRegistryService.endorseCheque(params.chequeId, endorseInput, ctx.uid);
    if (!result.success) return failure(result.error);

    await logFinancialTransition(ctx, 'cheque', params.chequeId, 'active', 'endorsed', { propertyId });

    return NextResponse.json({ success: true }, { status: 201 });
  },
}));
