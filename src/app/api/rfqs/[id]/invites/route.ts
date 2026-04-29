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
import type { CreateVendorInviteDTO } from '@/subapps/procurement/types/vendor-invite';
import { getErrorMessage } from '@/lib/error-utils';
import { safeParseBody } from '@/lib/validation/shared-schemas';

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateInviteSchema = z
  .object({
    vendorContactId: z.string().min(1).optional(),
    manualEmail: z.string().email().optional(),
    manualName: z.string().min(1).optional(),
    deliveryChannel: z.enum(['email', 'copy_link']),
    expiresInDays: z.number().int().min(1).max(90).optional(),
    locale: z.enum(['el', 'en']).optional(),
  })
  .refine(
    (val) => (val.vendorContactId !== undefined) !== (val.manualEmail !== undefined),
    { message: 'Provide either vendorContactId or manualEmail+manualName' },
  )
  .refine(
    (val) => val.manualEmail === undefined || val.manualName !== undefined,
    { message: 'manualName is required when manualEmail is provided' },
  );

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
        const { locale, vendorContactId, manualEmail, manualName, deliveryChannel, expiresInDays } = parsed.data;
        const dto: CreateVendorInviteDTO = vendorContactId !== undefined
          ? { rfqId: id, vendorContactId, deliveryChannel, expiresInDays }
          : { rfqId: id, manualEmail: manualEmail!, manualName: manualName!, deliveryChannel, expiresInDays };
        const result = await createVendorInvite(ctx, dto, { locale });
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
