/**
 * =============================================================================
 * GET + POST /api/units/[id]/payments
 * =============================================================================
 *
 * GET:  List payment records for unit
 * POST: Record a new payment
 *
 * @module api/units/[id]/payments
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreatePaymentSchema = z.object({
  paymentPlanId: z.string().min(1).max(128),
  installmentIndex: z.number().int().min(0),
  amount: z.number().positive().max(999_999_999),
  method: z.enum(['cash', 'bank_transfer', 'cheque', 'card', 'offset']),
  paymentDate: z.string().min(10).max(30),
  methodDetails: z.record(z.unknown()),
  notes: z.string().max(2000).optional(),
});

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// GET — Payment History
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payments' });
      try {
        const payments = await PaymentPlanService.getPayments(unitId);
        return NextResponse.json({ success: true, data: payments });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get payments');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// POST — Record Payment
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payments' });
      try {
        const parsed = safeParseBody(CreatePaymentSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const result = await PaymentPlanService.recordPayment(unitId, body, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logAuditEvent(ctx, 'data_created', result.payment?.id ?? unitId, 'payment', {
          newValue: { type: 'financial_status', value: { amount: body.amount, method: body.method } },
          metadata: { reason: `Payment recorded (unit: ${unitId}, amount: ${body.amount})` },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true, data: result.payment }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to record payment');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
