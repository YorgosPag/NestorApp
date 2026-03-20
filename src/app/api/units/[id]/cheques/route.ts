/**
 * GET + POST /api/units/[id]/cheques
 *
 * GET:  List all cheques for a unit
 * POST: Create a new cheque
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import type { CreateChequeInput } from '@/types/cheque-registry';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// GET — List Cheques
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/cheques' });
      try {
        const result = await ChequeRegistryService.getChequesByUnit(unitId);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: result.cheques });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get cheques');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// POST — Create Cheque
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/cheques' });
      try {
        const body = (await req.json()) as CreateChequeInput;

        const result = await ChequeRegistryService.createCheque(unitId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true, data: result.cheque }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create cheque');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
