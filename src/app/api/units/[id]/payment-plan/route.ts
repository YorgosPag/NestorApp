/**
 * =============================================================================
 * GET + POST + PATCH /api/units/[id]/payment-plan
 * =============================================================================
 *
 * GET:   Get active payment plan for unit
 * POST:  Create new payment plan
 * PATCH: Update payment plan (negotiation/draft only)
 *
 * @module api/units/[id]/payment-plan
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { CreatePaymentPlanInput, UpdatePaymentPlanInput } from '@/types/payment-plan';

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// GET — Active Payment Plan
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, _ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const plan = await PaymentPlanService.getActivePaymentPlan(unitId);
        return NextResponse.json({ success: true, data: plan });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment plan';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// POST — Create Payment Plan
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as Omit<CreatePaymentPlanInput, 'unitId'>;

        if (!body.buyerContactId || !body.buyerName || !body.totalAmount || !body.installments) {
          return NextResponse.json(
            { success: false, error: 'buyerContactId, buyerName, totalAmount, and installments are required' },
            { status: 400 }
          );
        }

        const result = await PaymentPlanService.createPaymentPlan(
          { ...body, unitId },
          ctx.uid
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true, data: result.plan }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create payment plan';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);

// =============================================================================
// PATCH — Update Payment Plan
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as UpdatePaymentPlanInput & { planId: string };

        if (!body.planId) {
          return NextResponse.json(
            { success: false, error: 'planId is required' },
            { status: 400 }
          );
        }

        const { planId, ...updates } = body;
        const result = await PaymentPlanService.updatePaymentPlan(unitId, planId, updates, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update payment plan';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
