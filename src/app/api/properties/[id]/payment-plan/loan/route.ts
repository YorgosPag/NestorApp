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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { LoanInfo } from '@/types/payment-plan';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// PATCH — Update Loan Info
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payment-plan/loan' });

      try {
        const body = (await req.json()) as Partial<LoanInfo> & { planId: string };

        if (!body.planId) {
          return NextResponse.json(
            { success: false, error: 'planId is required' },
            { status: 400 }
          );
        }

        const { planId, ...loanUpdates } = body;
        const result = await PaymentPlanService.updateLoanInfo(propertyId, planId, loanUpdates, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update loan info');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
