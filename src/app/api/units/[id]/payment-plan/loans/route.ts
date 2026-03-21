/**
 * GET + POST /api/units/[id]/payment-plan/loans
 *
 * GET:  List all loans for the active payment plan
 * POST: Add a new loan
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
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';
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

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// GET — List Loans
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payment-plan/loans' });

      try {
        const plan = await PaymentPlanService.getActivePaymentPlan(unitId);
        if (!plan) {
          return NextResponse.json({ success: true, data: [] });
        }
        const result = await LoanTrackingService.getLoans(unitId, plan.id);
        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }
        return NextResponse.json({ success: true, data: result.loans });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get loans');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// POST — Add Loan
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payment-plan/loans' });

      try {
        const parsed = safeParseBody(CreateLoanSchema, await req.json());
        if (parsed.error) return parsed.error;
        const body = parsed.data;

        // Get active plan or use provided planId
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

        const loanInput = CreateLoanFieldsSchema.parse(body);
        const result = await LoanTrackingService.addLoan(unitId, planId, loanInput, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true, data: result.loan }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to add loan');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);
