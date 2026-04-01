/**
 * POST /api/properties/[id]/cheques/[chequeId]/endorse
 *
 * Endorse a cheque (append to endorsement chain).
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

const EndorseSchema = z.object({
  endorserName: z.string().min(1).max(200),
  endorseeName: z.string().min(1).max(200),
  endorsementDate: z.string().min(10).max(30).optional(),
  endorserTaxId: z.string().max(20).optional(),
  endorseeTaxId: z.string().max(20).optional(),
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
      await requirePropertyInTenantScope({ ctx, propertyId: propertyId, path: '/api/properties/[id]/cheques/[chequeId]/endorse' });
      try {
        const parsed = safeParseBody(EndorseSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const endorseInput = {
          ...body,
          endorsementDate: body.endorsementDate ?? new Date().toISOString().split('T')[0],
        };

        const result = await ChequeRegistryService.endorseCheque(chequeId, endorseInput, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logFinancialTransition(ctx, 'cheque', chequeId, 'active', 'endorsed', { propertyId });

        return NextResponse.json({ success: true }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to endorse cheque');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
