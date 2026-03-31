/**
 * PATCH /api/properties/[id]/payment-plan/loans/[loanId]
 *
 * Update loan fields.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, logAuditEvent } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { DISBURSEMENT_TYPES, COLLATERAL_TYPES, INTEREST_RATE_TYPES } from '@/types/loan-tracking';

/** Loan update fields — planId is routing-only, stripped before service call */
const UpdateLoanFieldsSchema = z.object({
  bankName: z.string().max(200).optional(),
  bankBranch: z.string().max(200).optional(),
  bankReferenceNumber: z.string().max(100).optional(),
  bankContactPerson: z.string().max(200).optional(),
  bankContactPhone: z.string().max(30).optional(),
  requestedAmount: z.number().min(0).max(999_999_999).optional(),
  approvedAmount: z.number().min(0).max(999_999_999).optional(),
  ltvPercentage: z.number().min(0).max(100).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  interestRateType: z.enum(INTEREST_RATE_TYPES).optional(),
  termYears: z.number().int().min(1).max(50).optional(),
  monthlyPayment: z.number().min(0).max(999_999_999).optional(),
  dstiRatio: z.number().min(0).max(100).optional(),
  bankFees: z.number().min(0).max(999_999_999).optional(),
  disbursementType: z.enum(DISBURSEMENT_TYPES).optional(),
  collateralType: z.enum(COLLATERAL_TYPES).optional(),
  collateralAmount: z.number().min(0).max(999_999_999).optional(),
  collateralRegistrationNumber: z.string().max(100).optional(),
  collateralRegistrationDate: z.string().max(30).optional(),
  appraisalValue: z.number().min(0).max(999_999_999).optional(),
  appraisalDate: z.string().max(30).optional(),
  appraiserName: z.string().max(200).optional(),
  preApprovalExpiryDate: z.string().max(30).optional(),
  notes: z.string().max(5000).optional(),
});
const UpdateLoanSchema = UpdateLoanFieldsSchema.extend({
  planId: z.string().max(128).optional(),
});

type SegmentData = { params: Promise<{ id: string; loanId: string }> };

// =============================================================================
// PATCH — Update Loan
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: propertyId, loanId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId: propertyId, path: '/api/properties/[id]/payment-plan/loans/[loanId]' });

      try {
        const parsed = safeParseBody(UpdateLoanSchema, await req.json());
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

        const updateInput = UpdateLoanFieldsSchema.parse(body);
        const result = await LoanTrackingService.updateLoan(propertyId, planId, loanId, updateInput, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        await logAuditEvent(ctx, 'data_updated', loanId, 'loan', {
          metadata: { reason: `Loan fields updated property: ${propertyId}, plan: ${planId})` },
        }).catch(() => {/* non-blocking */});

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update loan');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);
