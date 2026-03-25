/**
 * POST /api/units/[id]/cheques/[chequeId]/bounce
 *
 * Mark a cheque as bounced with reason and optional legal actions.
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
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
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

type SegmentData = { params: Promise<{ id: string; chequeId: string }> };

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId, chequeId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/cheques/[chequeId]/bounce' });
      try {
        const parsed = safeParseBody(BounceSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await ChequeRegistryService.bounceCheque(chequeId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logFinancialTransition(ctx, 'cheque', chequeId, 'active', 'bounced', { unitId });

        return NextResponse.json({ success: true }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to bounce cheque');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
