/**
 * POST   /api/procurement/[poId]/share — Create share link
 * DELETE /api/procurement/[poId]/share — Revoke share link
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-267 Phase B — Share Link
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { getPO } from '@/services/procurement';
import { createPOShare, revokePOShare } from '@/services/procurement/po-share-service';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('PO_SHARE_API');

const RevokeSchema = z.object({
  shareId: z.string().min(1),
});

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ poId: string }> }
): Promise<NextResponse> {
  const { poId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const po = await getPO(poId);
        if (!po || po.companyId !== ctx.companyId) {
          return NextResponse.json(
            { success: false, error: 'PO not found' },
            { status: 404 }
          );
        }

        const result = await createPOShare(poId, ctx.uid, ctx.companyId);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app';
        const shareUrl = `${baseUrl}/shared/po/${result.token}`;

        return NextResponse.json({
          success: true,
          data: {
            shareId: result.shareId,
            token: result.token,
            url: shareUrl,
            expiresAt: result.expiresAt,
          },
        }, { status: 201 });
      } catch (err) {
        logger.error('Share creation failed', { poId, error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false, error: getErrorMessage(err) },
          { status: 500 }
        );
      }
    }
  );

  return withSensitiveRateLimit(handler)(request);
}

async function handleDelete(
  request: NextRequest,
  segmentData?: { params: Promise<{ poId: string }> }
): Promise<NextResponse> {
  await segmentData!.params; // consume params

  const handler = withAuth(
    async (req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        let body: z.infer<typeof RevokeSchema>;
        try {
          body = RevokeSchema.parse(await req.json());
        } catch {
          return NextResponse.json(
            { success: false, error: 'shareId is required' },
            { status: 400 }
          );
        }

        const revoked = await revokePOShare(body.shareId);
        if (!revoked) {
          return NextResponse.json(
            { success: false, error: 'Failed to revoke share' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      } catch (err) {
        logger.error('Share revoke failed', { error: getErrorMessage(err) });
        return NextResponse.json(
          { success: false, error: getErrorMessage(err) },
          { status: 500 }
        );
      }
    }
  );

  return withSensitiveRateLimit(handler)(request);
}

export { handlePost as POST, handleDelete as DELETE };
