/**
 * POST /api/units/[id]/payment-plan/loans/[loanId]/transition
 *
 * FSM status transition for a loan.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import type { LoanTransitionInput } from '@/types/loan-tracking';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { logFinancialTransition } from '@/lib/auth/audit';

type SegmentData = { params: Promise<{ id: string; loanId: string }> };

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId, loanId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payment-plan/loans/[loanId]/transition' });

      try {
        const body = (await req.json()) as LoanTransitionInput & { planId?: string };

        let planId = body.planId;
        if (!planId) {
          const plan = await PaymentPlanService.getActivePaymentPlan(unitId);
          if (!plan) {
            return NextResponse.json(
              { success: false, error: 'No active payment plan found' },
              { status: 404 }
            );
          }
          planId = plan.id;
        }

        if (!body.targetStatus) {
          return NextResponse.json(
            { success: false, error: 'targetStatus is required' },
            { status: 400 }
          );
        }

        const result = await LoanTrackingService.transitionLoanStatus(
          unitId, planId, loanId, body, ctx.uid
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logFinancialTransition(ctx, 'loan', loanId, 'unknown', body.targetStatus, { unitId, planId });

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
