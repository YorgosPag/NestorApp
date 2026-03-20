/**
 * GET + PATCH /api/units/[id]/cheques/[chequeId]
 *
 * GET:   Get single cheque
 * PATCH: Update mutable fields
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import type { UpdateChequeInput } from '@/types/cheque-registry';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';

type SegmentData = { params: Promise<{ id: string; chequeId: string }> };

// =============================================================================
// GET — Single Cheque
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id, chequeId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: id, path: '/api/units/[id]/cheques/[chequeId]' });
      try {
        const result = await ChequeRegistryService.getCheque(chequeId);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: result.cheque });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get cheque');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// PATCH — Update Cheque
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id, chequeId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: id, path: '/api/units/[id]/cheques/[chequeId]' });
      try {
        const body = (await req.json()) as UpdateChequeInput;

        const result = await ChequeRegistryService.updateCheque(chequeId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update cheque');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
