/**
 * POST /api/properties/[id]/payment-plan/loans/[loanId]/transition
 *
 * FSM status transition for a loan.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requirePropertyInTenantScope } from '@/lib/auth/tenant-isolation';
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

type SegmentData = { params: Promise<{ id: string; loanId: string }> };

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId, loanId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requirePropertyInTenantScope({ ctx, propertyId: propertyId, path: '/api/properties/[id]/payment-plan/loans/[loanId]/transition' });

      try {
        const parsed = safeParseBody(LoanTransitionSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        let planId = body.planId;
        if (!planId) {
          const plan = await PaymentPlanService.getActivePaymentPlan(propertyId);
          if (!plan) {
            return NextResponse.json(
              { success: false, error: 'No active payment plan found' },
              { status: 404 }
            );
          }
          planId = plan.id;
        }

        const transitionInput = LoanTransitionFieldsSchema.parse(body);
        const result = await LoanTrackingService.transitionLoanStatus(
          propertyId, planId, loanId, transitionInput, ctx.uid
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logFinancialTransition(ctx, 'loan', loanId, 'unknown', body.targetStatus, { propertyId, planId });

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to transition loan');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
