/**
 * PATCH /api/properties/[id]/payment-plan/loans/[loanId]
 *
 * Update loan fields.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAuditEvent } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { resolvePlanId, noActivePlan } from '@/app/api/properties/_shared/active-payment-plan';
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

// =============================================================================
// PATCH — Update Loan
// =============================================================================

export const PATCH = withStandardRateLimit(propertyRoute<{ id: string; loanId: string }>({
  path: '/api/properties/[id]/payment-plan/loans/[loanId]',
  intent: 'write',
  failure: 'Failed to update loan',
  handle: async ({ req, ctx, params, propertyId }) => {
    const parsed = safeParseBody(UpdateLoanSchema, await req.json());
    if (parsed.error) return parsed.error;

    const planId = await resolvePlanId(propertyId, parsed.data.planId);
    if (!planId) return noActivePlan();

    const updateInput = UpdateLoanFieldsSchema.parse(parsed.data);
    const result = await LoanTrackingService.updateLoan(propertyId, planId, params.loanId, updateInput, ctx.uid);
    if (!result.success) return failure(result.error);

    await logAuditEvent(ctx, 'data_updated', params.loanId, 'loan', {
      metadata: { reason: `Loan fields updated property: ${propertyId}, plan: ${planId})` },
    }).catch(() => {/* non-blocking */});

    return NextResponse.json({ success: true });
  },
}));
