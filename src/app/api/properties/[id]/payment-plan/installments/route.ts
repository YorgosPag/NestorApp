/**
 * =============================================================================
 * POST + PATCH + DELETE /api/properties/[id]/payment-plan/installments
 * =============================================================================
 *
 * POST:   Add installment (with optional insertAtIndex)
 * PATCH:  Update installment
 * DELETE: Remove installment
 *
 * @module api/properties/[id]/payment-plan/installments
 * @enterprise ADR-234 - Payment Plan & Installment Tracking (SPEC-234D)
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { CreateInstallmentInput, UpdateInstallmentInput } from '@/types/payment-plan';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// POST — Add Installment
// =============================================================================

interface AddInstallmentBody {
  planId: string;
  installment: CreateInstallmentInput;
  insertAtIndex?: number;
}

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payment-plan/installments' });
      try {
        const body = (await req.json()) as AddInstallmentBody;

        if (!body.planId || !body.installment) {
          return NextResponse.json(
            { success: false, error: 'planId and installment are required' },
            { status: 400 }
          );
        }

        const { label, type, amount, percentage, dueDate } = body.installment;
        if (!label || !type || amount === undefined || percentage === undefined || !dueDate) {
          return NextResponse.json(
            { success: false, error: 'installment must include label, type, amount, percentage, dueDate' },
            { status: 400 }
          );
        }

        // 🛡️ ADR-249 P2-2: Defense-in-depth — basic amount sanity check
        if (typeof amount !== 'number' || amount <= 0) {
          return NextResponse.json(
            { success: false, error: 'Installment amount must be a positive number' },
            { status: 400 }
          );
        }

        const result = await PaymentPlanService.addInstallment(
          propertyId,
          body.planId,
          body.installment,
          ctx.uid,
          body.insertAtIndex
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to add installment');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);

// =============================================================================
// PATCH — Update Installment
// =============================================================================

interface UpdateInstallmentBody {
  planId: string;
  index: number;
  updates: UpdateInstallmentInput;
}

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payment-plan/installments' });
      try {
        const body = (await req.json()) as UpdateInstallmentBody;

        if (!body.planId || body.index === undefined) {
          return NextResponse.json(
            { success: false, error: 'planId and index are required' },
            { status: 400 }
          );
        }

        const result = await PaymentPlanService.updateInstallment(
          propertyId,
          body.planId,
          body.index,
          body.updates,
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update installment');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);

// =============================================================================
// DELETE — Remove Installment
// =============================================================================

interface RemoveInstallmentBody {
  planId: string;
  index: number;
}

async function handleDelete(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payment-plan/installments' });
      try {
        const body = (await req.json()) as RemoveInstallmentBody;

        if (!body.planId || body.index === undefined) {
          return NextResponse.json(
            { success: false, error: 'planId and index are required' },
            { status: 400 }
          );
        }

        const result = await PaymentPlanService.removeInstallment(
          propertyId,
          body.planId,
          body.index,
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to remove installment');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const DELETE = withStandardRateLimit(handleDelete);
