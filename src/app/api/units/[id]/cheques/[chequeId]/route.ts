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
import { z } from 'zod';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const UpdateChequeSchema = z.object({
  bankBranch: z.string().max(200).optional(),
  drawerTaxId: z.string().max(20).optional(),
  accountNumber: z.string().max(50).optional(),
  crossedCheque: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  depositBankName: z.string().max(200).optional(),
  depositAccountNumber: z.string().max(50).optional(),
}).strict();

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
        const parsed = safeParseBody(UpdateChequeSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await ChequeRegistryService.updateCheque(chequeId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logAuditEvent(ctx, 'data_updated', chequeId, 'cheque', {
          metadata: { reason: `Cheque fields updated (unit: ${id})` },
        }).catch(() => {/* non-blocking */});

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
