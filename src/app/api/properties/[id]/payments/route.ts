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

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { CreatePaymentInput } from '@/types/payment-plan';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
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

const PATH = '/api/properties/[id]/payments';

// =============================================================================
// GET — Payment History
// =============================================================================

export const GET = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'read',
  failure: 'Failed to get payments',
  handle: async ({ propertyId }) => {
    const payments = await PaymentPlanService.getPayments(propertyId);
    return NextResponse.json({ success: true, data: payments });
  },
}));

// =============================================================================
// POST — Record Payment
// =============================================================================

export const POST = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to record payment',
  handle: async ({ req, ctx, propertyId }) => {
    const parsed = safeParseBody(CreatePaymentSchema, await req.json());
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const paymentInput: CreatePaymentInput = {
      ...body,
      methodDetails: body.methodDetails as unknown as CreatePaymentInput['methodDetails'],
    };

    const result = await PaymentPlanService.recordPayment(propertyId, paymentInput, ctx.uid);
    if (!result.success) return failure(result.error);

    await logAuditEvent(ctx, 'data_created', result.payment?.id ?? propertyId, 'payment', {
      newValue: { type: 'financial_status', value: { amount: body.amount, method: body.method } },
      metadata: { reason: `Payment recorded property: ${propertyId}, amount: ${body.amount})` },
    }).catch(() => {/* non-blocking */});

    return NextResponse.json({ success: true, data: result.payment }, { status: 201 });
  },
}));
