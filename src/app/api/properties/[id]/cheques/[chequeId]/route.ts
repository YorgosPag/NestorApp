/**
 * GET + PATCH /api/properties/[id]/cheques/[chequeId]
 *
 * GET:   Get single cheque
 * PATCH: Update mutable fields
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdateChequeSchema = z.object({
  bankBranch: z.string().max(200).optional(),
  drawerTaxId: z.string().max(20).optional(),
  accountNumber: z.string().max(50).optional(),
  crossedCheque: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  depositBankName: z.string().max(200).optional(),
  depositAccountNumber: z.string().max(50).optional(),
}).strict();

type ChequeParams = { id: string; chequeId: string };

const PATH = '/api/properties/[id]/cheques/[chequeId]';

// =============================================================================
// GET — Single Cheque
// =============================================================================

export const GET = withStandardRateLimit(propertyRoute<ChequeParams>({
  path: PATH,
  intent: 'read',
  failure: 'Failed to get cheque',
  handle: async ({ params }) => {
    const result = await ChequeRegistryService.getCheque(params.chequeId);
    if (!result.success) return failure(result.error, 404);
    return NextResponse.json({ success: true, data: result.cheque });
  },
}));

// =============================================================================
// PATCH — Update Cheque
// =============================================================================

export const PATCH = withStandardRateLimit(propertyRoute<ChequeParams>({
  path: PATH,
  intent: 'write',
  failure: 'Failed to update cheque',
  handle: async ({ req, ctx, params, propertyId }) => {
    const parsed = safeParseBody(UpdateChequeSchema, await req.json());
    if (parsed.error) return parsed.error;

    const result = await ChequeRegistryService.updateCheque(params.chequeId, parsed.data, ctx.uid);
    if (!result.success) return failure(result.error);

    await logAuditEvent(ctx, 'data_updated', params.chequeId, 'cheque', {
      metadata: { reason: `Cheque fields updated property: ${propertyId})` },
    }).catch(() => {/* non-blocking */});

    return NextResponse.json({ success: true });
  },
}));
