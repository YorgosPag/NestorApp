/**
 * PATCH /api/units/[id]/payment-plan/loans/[loanId]
 *
 * Update loan fields.
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
import type { UpdateLoanInput } from '@/types/loan-tracking';

type SegmentData = { params: Promise<{ id: string; loanId: string }> };

// =============================================================================
// PATCH — Update Loan
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId, loanId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        const body = (await req.json()) as UpdateLoanInput & { planId?: string };

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

        const { planId: _removed, ...updateInput } = body;
        const result = await LoanTrackingService.updateLoan(unitId, planId, loanId, updateInput, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update loan';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
