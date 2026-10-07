/**
 * POST /api/properties/[id]/payment-plan/loans/[loanId]/disburse
 *
 * Record a loan disbursement — auto-creates PaymentRecord.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import type { RecordDisbursementInput } from '@/types/loan-tracking';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { resolvePlanId, noActivePlan } from '@/app/api/properties/_shared/active-payment-plan';
import { logFinancialTransition } from '@/lib/auth/audit';

export const POST = withStandardRateLimit(propertyRoute<{ id: string; loanId: string }>({
  path: '/api/properties/[id]/payment-plan/loans/[loanId]/disburse',
  intent: 'write',
  failure: 'Failed to record disbursement',
  handle: async ({ req, ctx, params, propertyId }) => {
    const body = (await req.json()) as RecordDisbursementInput & { planId?: string };

    const planId = await resolvePlanId(propertyId, body.planId);
    if (!planId) return noActivePlan();

    if (!body.amount || body.amount <= 0) return failure('amount must be positive', 400);

    const result = await LoanTrackingService.recordDisbursement(
      propertyId, planId, params.loanId, body, ctx.uid
    );
    if (!result.success) return failure(result.error);

    await logFinancialTransition(ctx, 'loan', params.loanId, 'approved', 'disbursed', { propertyId, planId });

    return NextResponse.json({ success: true, paymentId: result.paymentId }, { status: 201 });
  },
}));
