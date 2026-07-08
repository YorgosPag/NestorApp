/**
 * POST   /api/procurement/[poId]/share — Create share link
 * DELETE /api/procurement/[poId]/share — Revoke share link
 *
 * Auth: withAuth | Rate: sensitive
 * @see ADR-267 Phase B — Share Link
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { z } from 'zod';
import { defineRoute, ok, created, badRequest, notFound, httpError } from '@/lib/api/define-route';
import { getPO } from '@/services/procurement';
import { createPOShare, revokePOShare } from '@/services/procurement/po-share-service';

const RevokeSchema = z.object({
  shareId: z.string().min(1),
});

// ============================================================================
// POST — Create share link (404 wrong tenant, 201 with token URL)
// ============================================================================

export const POST = defineRoute<z.ZodTypeAny, { poId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Unknown error',
  handler: async ({ auth, params }) => {
    const { poId } = params;

    const po = await getPO(poId);
    if (!po || po.companyId !== auth.companyId) notFound('PO not found');

    const result = await createPOShare(poId, auth.uid, auth.companyId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app';
    const shareUrl = `${baseUrl}/shared/po/${result.token}`;

    return created({
      shareId: result.shareId,
      token: result.token,
      url: shareUrl,
      expiresAt: result.expiresAt,
    });
  },
});

// ============================================================================
// DELETE — Revoke share link (bespoke parse → 400, revoke-fail → 500)
// ============================================================================

export const DELETE = defineRoute<z.ZodTypeAny, { poId: string }>({
  rateLimit: 'sensitive',
  fallbackError: 'Unknown error',
  handler: async ({ req }) => {
    let body: z.infer<typeof RevokeSchema>;
    try {
      body = RevokeSchema.parse(await req.json());
    } catch {
      badRequest('shareId is required');
    }

    const revoked = await revokePOShare(body!.shareId);
    if (!revoked) httpError(500, 'Failed to revoke share');

    return ok();
  },
});
