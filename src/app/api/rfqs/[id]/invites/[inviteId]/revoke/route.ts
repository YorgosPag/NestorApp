/**
 * POST /api/rfqs/[id]/invites/[inviteId]/revoke — Revoke vendor invite
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-327 §7 — Phase P3.b Admin Invite UI
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { revokeVendorInvite } from '@/subapps/procurement/services/vendor-invite-service';
import { getErrorMessage } from '@/lib/error-utils';

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string; inviteId: string }> },
): Promise<NextResponse> {
  const { inviteId } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        await revokeVendorInvite(ctx, inviteId);
        return NextResponse.json({ success: true });
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
