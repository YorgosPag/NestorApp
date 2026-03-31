/**
 * =============================================================================
 * GET + POST /api/properties/[id]/payments
 * =============================================================================
 *
 * GET:  List payment records for property
 * POST: Record a new payment
 *
 * @module api/properties/[id]/payments
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { CreatePaymentInput } from '@/types/payment-plan';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreatePaymentSchema = z.object({
  paymentPlanId: z.string().min(1).max(128),
  installmentIndex: z.number().int().min(0),
  amount: z.number().positive().max(999_999_999),
  method: z.enum(['bank_transfer', 'bank_cheque', 'personal_cheque', 'bank_loan', 'cash', 'promissory_note', 'offset']),
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
  const { id: propertyId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payments' });
      try {
        const payments = await PaymentPlanService.getPayments(propertyId);
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
  const { id: propertyId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payments' });
      try {
        const parsed = safeParseBody(CreatePaymentSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        const paymentInput: CreatePaymentInput = {
          ...body,
          methodDetails: body.methodDetails as unknown as CreatePaymentInput['methodDetails'],
        };

        const result = await PaymentPlanService.recordPayment(propertyId, paymentInput, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logAuditEvent(ctx, 'data_created', result.payment?.id ?? propertyId, 'payment', {
          newValue: { type: 'financial_status', value: { amount: body.amount, method: body.method } },
          metadata: { reason: `Payment recorded property: ${propertyId}, amount: ${body.amount})` },
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
