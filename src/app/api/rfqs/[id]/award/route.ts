/**
 * POST /api/rfqs/[id]/award — Declare winner + transition all quotes.
 *
 * Body:
 *   - winnerQuoteId: string (must belong to this RFQ)
 *   - overrideReason?: string (≥20 chars, mandatory when winner ≠ recommendation OR has risk flags)
 *
 * Effects:
 *   - Winner quote → 'accepted' (via under_review if needed)
 *   - Other comparable quotes → 'rejected'
 *   - RFQ → 'closed' with winnerQuoteId
 *   - Audit entry 'award_decision' on RFQ
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §8.3 Override-with-reason (Phase P4)
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { awardRfq } from '@/subapps/procurement/services/comparison-service';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { getErrorMessage } from '@/lib/error-utils';

const AwardBodySchema = z.object({
  winnerQuoteId: z.string().min(1).max(80),
  overrideReason: z.string().min(20).max(1000).optional(),
});

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const parsed = safeParseBody(AwardBodySchema, await req.json());
        if (parsed.error) return parsed.error;

        const result = await awardRfq(ctx, id, parsed.data);
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 400 }
        );
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
