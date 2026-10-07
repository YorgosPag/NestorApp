/**
 * POST /api/properties/[id]/payment-plan/loans/[loanId]/transition
 *
 * FSM status transition for a loan.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { resolvePlanId, noActivePlan } from '@/app/api/properties/_shared/active-payment-plan';
import { logFinancialTransition } from '@/lib/auth/audit';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { LOAN_TRACKING_STATUSES } from '@/types/loan-tracking';

const LoanTransitionFieldsSchema = z.object({
  targetStatus: z.enum(LOAN_TRACKING_STATUSES),
  notes: z.string().max(2000).optional(),
});
const LoanTransitionSchema = LoanTransitionFieldsSchema.extend({
  planId: z.string().max(128).optional(),
});

export const POST = withStandardRateLimit(propertyRoute<{ id: string; loanId: string }>({
  path: '/api/properties/[id]/payment-plan/loans/[loanId]/transition',
  intent: 'write',
  failure: 'Failed to transition loan',
  handle: async ({ req, ctx, params, propertyId }) => {
    const parsed = safeParseBody(LoanTransitionSchema, await req.json());
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const planId = await resolvePlanId(propertyId, body.planId);
    if (!planId) return noActivePlan();

    const transitionInput = LoanTransitionFieldsSchema.parse(body);
    const result = await LoanTrackingService.transitionLoanStatus(
      propertyId, planId, params.loanId, transitionInput, ctx.uid
    );
    if (!result.success) return failure(result.error);

    await logFinancialTransition(ctx, 'loan', params.loanId, 'unknown', body.targetStatus, { propertyId, planId });

    return NextResponse.json({ success: true });
  },
}));
