/**
 * =============================================================================
 * PATCH /api/properties/[id]/payment-plan/loan
 * =============================================================================
 *
 * Update loan information on the active payment plan.
 *
 * @module api/properties/[id]/payment-plan/loan
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { LoanInfo } from '@/types/payment-plan';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';

// =============================================================================
// PATCH — Update Loan Info
// =============================================================================

export const PATCH = withStandardRateLimit(propertyRoute({
  path: '/api/properties/[id]/payment-plan/loan',
  intent: 'write',
  failure: 'Failed to update loan info',
  handle: async ({ req, ctx, propertyId }) => {
    const body = (await req.json()) as Partial<LoanInfo> & { planId: string };
    if (!body.planId) return failure('planId is required', 400);

    const { planId, ...loanUpdates } = body;
    const result = await PaymentPlanService.updateLoanInfo(propertyId, planId, loanUpdates, ctx.uid);
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true });
  },
}));
