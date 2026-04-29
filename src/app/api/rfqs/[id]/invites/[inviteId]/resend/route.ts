/**
 * POST /api/rfqs/[id]/invites/[inviteId]/resend — Re-send vendor invite email
 *
 * Dispatches the branded vendor invite email via email-channel.ts (NOT the
 * generic email system). Used by UnifiedShareDialog email button (ADR-327 §H).
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §7 — Phase H UnifiedShareDialog integration
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { resendVendorInvite } from '@/subapps/procurement/services/vendor-invite-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const ResendSchema = z.object({
  locale: z.enum(['el', 'en']).optional(),
});

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string; inviteId: string }> },
): Promise<NextResponse> {
  const { inviteId } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = await req.json().catch(() => ({}));
        const parsed = safeParseBody(ResendSchema, body);
        if (parsed.error) return parsed.error;
        const result = await resendVendorInvite(ctx, inviteId, { locale: parsed.data.locale });
        return NextResponse.json({ success: true, data: result });
      } catch (error) {
        return NextResponse.json(
          { success: false, error: getErrorMessage(error) },
          { status: 400 },
        );
      }
    },
  );
  return handler(request);
}

export const POST = withSensitiveRateLimit(handlePost);
