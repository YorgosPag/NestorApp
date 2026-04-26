/**
 * POST /api/rfqs/[id]/invites — Create vendor invite
 * GET  /api/rfqs/[id]/invites — List invites for RFQ
 *
 * Auth: withAuth | Rate: sensitive (POST), standard (GET)
 * @see ADR-327 §7 — Phase P3.b Admin Invite UI
 */

import 'server-only';

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit, withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { createVendorInvite, listVendorInvitesByRfq } from '@/subapps/procurement/services/vendor-invite-service';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateInviteSchema = z.object({
  vendorContactId: z.string().min(1),
  deliveryChannel: z.enum(['email', 'copy_link']),
  expiresInDays: z.number().int().min(1).max(90).optional(),
  locale: z.enum(['el', 'en']).optional(),
});

// ============================================================================
// POST — create invite
// ============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = await req.json().catch(() => ({}));
        const parsed = safeParseBody(CreateInviteSchema, body);
        if (parsed.error) return parsed.error;
        const { locale, ...dto } = parsed.data;
        const result = await createVendorInvite(ctx, { rfqId: id, ...dto }, { locale });
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

// ============================================================================
// GET — list invites
// ============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await segmentData!.params;
  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const invites = await listVendorInvitesByRfq(ctx.companyId, id);
        return NextResponse.json({ success: true, data: invites });
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

// ============================================================================
// EXPORTS
// ============================================================================

export const POST = withSensitiveRateLimit(handlePost);
export const GET = withStandardRateLimit(handleGet);
