/**
 * POST /api/properties/[id]/payment-plan/loans/[loanId]/disburse
 *
 * Record a loan disbursement — auto-creates PaymentRecord.
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
import type { RecordDisbursementInput } from '@/types/loan-tracking';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { logFinancialTransition } from '@/lib/auth/audit';

type SegmentData = { params: Promise<{ id: string; loanId: string }> };

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId, loanId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payment-plan/loans/[loanId]/disburse' });

      try {
        const body = (await req.json()) as RecordDisbursementInput & { planId?: string };

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

        if (!body.amount || body.amount <= 0) {
          return NextResponse.json(
            { success: false, error: 'amount must be positive' },
            { status: 400 }
          );
        }

        const result = await LoanTrackingService.recordDisbursement(
          propertyId, planId, loanId, body, ctx.uid
        );

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logFinancialTransition(ctx, 'loan', loanId, 'approved', 'disbursed', { propertyId, planId });

        return NextResponse.json({ success: true, paymentId: result.paymentId }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to record disbursement');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
