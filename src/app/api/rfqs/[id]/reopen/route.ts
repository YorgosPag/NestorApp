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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { reopenRfq } from '@/subapps/procurement/services/rfq-lifecycle-service';
import { getErrorMessage } from '@/lib/error-utils';

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const updated = await reopenRfq(ctx, id);
        return NextResponse.json({ success: true, data: updated });
      } catch (error) {
        const code = (error as { code?: string }).code;
        const status = code === 'PO_EXISTS' ? 409 : 400;
        return NextResponse.json(
          { success: false, error: getErrorMessage(error), code: code ?? null },
          { status }
        );
      }
    }
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
