/**
 * GET + POST /api/properties/[id]/payment-plan/loans
 *
 * GET:  List all loans for the active payment plan
 * POST: Add a new loan
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { resolvePlanId, noActivePlan } from '@/app/api/properties/_shared/active-payment-plan';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { DISBURSEMENT_TYPES, INTEREST_RATE_TYPES } from '@/types/loan-tracking';

const CreateLoanFieldsSchema = z.object({
  bankName: z.string().min(1).max(200),
  isPrimary: z.boolean().optional(),
  requestedAmount: z.number().min(0).max(999_999_999).optional(),
  disbursementType: z.enum(DISBURSEMENT_TYPES).optional(),
  interestRateType: z.enum(INTEREST_RATE_TYPES).optional(),
  notes: z.string().max(5000).optional(),
});
const CreateLoanSchema = CreateLoanFieldsSchema.extend({
  planId: z.string().max(128).optional(),
});

const PATH = '/api/properties/[id]/payment-plan/loans';

// =============================================================================
// GET — List Loans
// =============================================================================

export const GET = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'read',
  failure: 'Failed to get loans',
  handle: async ({ propertyId }) => {
    const plan = await PaymentPlanService.getActivePaymentPlan(propertyId);
    if (!plan) return NextResponse.json({ success: true, data: [] });

    const result = await LoanTrackingService.getLoans(propertyId, plan.id);
    if (!result.success) return failure(result.error, 500);

    return NextResponse.json({ success: true, data: result.loans });
  },
}));

// =============================================================================
// POST — Add Loan
// =============================================================================

export const POST = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to add loan',
  handle: async ({ req, ctx, propertyId }) => {
    const parsed = safeParseBody(CreateLoanSchema, await req.json());
    if (parsed.error) return parsed.error;

    const planId = await resolvePlanId(propertyId, parsed.data.planId);
    if (!planId) return noActivePlan();

    const loanInput = CreateLoanFieldsSchema.parse(parsed.data);
    const result = await LoanTrackingService.addLoan(propertyId, planId, loanInput, ctx.uid);
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true, data: result.loan }, { status: 201 });
  },
}));
