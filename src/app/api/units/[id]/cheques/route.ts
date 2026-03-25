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
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateChequeSchema = z.object({
  chequeType: z.enum(['bank_cheque', 'personal_cheque']),
  chequeNumber: z.string().min(1).max(50),
  amount: z.number().positive().max(999_999_999),
  bankName: z.string().min(1).max(200),
  bankBranch: z.string().max(200).optional(),
  drawerName: z.string().min(1).max(200),
  drawerTaxId: z.string().max(20).optional(),
  accountNumber: z.string().max(50).optional(),
  issueDate: z.string().min(10).max(30),
  maturityDate: z.string().min(10).max(30),
  crossedCheque: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  projectId: z.string().min(1).max(128),
  paymentPlanId: z.string().max(128).optional(),
  contactId: z.string().max(128).optional(),
});

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
        const parsed = safeParseBody(CreateChequeSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

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
