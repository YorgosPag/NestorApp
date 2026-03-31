/**
 * =============================================================================
 * GET + POST + PATCH /api/units/[id]/payment-plan
 * =============================================================================
 *
 * GET:   Get active payment plan for unit
 * POST:  Create new payment plan
 * PATCH: Update payment plan (negotiation/draft only)
 *
 * @module api/units/[id]/payment-plan
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { CreatePaymentPlanInput, UpdatePaymentPlanInput } from '@/types/payment-plan';
import { getErrorMessage } from '@/lib/error-utils';
import { requireUnitInTenant } from '@/lib/auth/tenant-isolation';

// =============================================================================
// VALIDATION SCHEMAS — ADR-252 Phase 3 Security Hardening
// =============================================================================

const installmentSchema = z.object({
  label: z.string().min(1).max(200),
  type: z.enum(['reservation', 'down_payment', 'stage_payment', 'final_payment', 'custom']),
  amount: z.number().positive().max(100_000_000),
  percentage: z.number().min(0).max(100),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format (expected YYYY-MM-DD)'),
  notes: z.string().max(2000).optional(),
});

const createPaymentPlanSchema = z.object({
  ownerContactId: z.string().min(1).max(200),
  ownerName: z.string().min(1).max(500),
  buildingId: z.string().min(1).max(200),
  projectId: z.string().min(1).max(200),
  totalAmount: z.number().positive().max(100_000_000),
  installments: z.array(installmentSchema).min(1).max(120),
  taxRegime: z.enum(['vat_24', 'vat_suspension_3', 'transfer_tax_3', 'custom']).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  loan: z.record(z.unknown()).optional(),
  loans: z.array(z.record(z.unknown())).optional(),
  notes: z.string().max(5000).optional(),
  // ADR-244: Multi-owner support
  planType: z.enum(['joint', 'individual']).optional(),
  planGroupId: z.string().max(128).optional(),
  ownerContactId: z.string().max(200).nullable().optional(),
  ownerName: z.string().max(500).nullable().optional(),
  ownershipPct: z.number().min(0).max(100).nullable().optional(),
  /** Split mode: owners array — when present, creates N individual plans */
  owners: z.array(z.object({
    contactId: z.string().min(1).max(200),
    name: z.string().min(1).max(500),
    ownershipPct: z.number().min(0).max(100),
  })).optional(),
});

type SegmentData = { params: Promise<{ id: string }> };

// =============================================================================
// GET — Active Payment Plan
// =============================================================================

async function handleGet(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (_req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payment-plan' });
      try {
        // ADR-244: Return ALL active plans (supports multi-owner split)
        const plans = await PaymentPlanService.getPaymentPlans(unitId);
        return NextResponse.json({ success: true, data: plans });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to get payment plan');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const GET = withStandardRateLimit(handleGet);

// =============================================================================
// POST — Create Payment Plan
// =============================================================================

async function handlePost(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payment-plan' });
      try {
        const rawBody: unknown = await req.json();
        const parsed = createPaymentPlanSchema.safeParse(rawBody);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: parsed.error.issues[0].message },
            { status: 400 }
          );
        }

        const { owners: splitOwners, ...planFields } = parsed.data;

        // ADR-244: If owners[] present → split mode (create N individual plans)
        if (splitOwners && splitOwners.length > 1) {
          const result = await PaymentPlanService.createSplitPaymentPlans(
            unitId,
            splitOwners,
            {
              buildingId: planFields.buildingId,
              projectId: planFields.projectId,
              taxRegime: planFields.taxRegime ?? 'vat_24',
              taxRate: planFields.taxRate ?? 24,
              config: planFields.config,
              loan: planFields.loan,
              notes: planFields.notes,
            },
            planFields.totalAmount,
            planFields.installments,
            ctx.uid,
          );
          if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 409 });
          }
          return NextResponse.json({ success: true, data: result.plans }, { status: 201 });
        }

        // Standard: single/joint plan
        const input: CreatePaymentPlanInput = { ...planFields, unitId } as CreatePaymentPlanInput;
        const result = await PaymentPlanService.createPaymentPlan(input, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true, data: result.plan }, { status: 201 });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to create payment plan');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const POST = withStandardRateLimit(handlePost);

// =============================================================================
// PATCH — Update Payment Plan
// =============================================================================

async function handlePatch(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payment-plan' });
      try {
        const body = (await req.json()) as UpdatePaymentPlanInput & { planId: string };

        if (!body.planId) {
          return NextResponse.json(
            { success: false, error: 'planId is required' },
            { status: 400 }
          );
        }

        const { planId, ...updates } = body;
        const result = await PaymentPlanService.updatePaymentPlan(unitId, planId, updates, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to update payment plan');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const PATCH = withStandardRateLimit(handlePatch);

// =============================================================================
// DELETE — Delete Payment Plan (negotiation/draft only, no payments)
// =============================================================================

async function handleDelete(
  request: NextRequest,
  segmentData?: SegmentData
): Promise<NextResponse> {
  const { id: unitId } = await segmentData!.params;

  const handler = withAuth(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      await requireUnitInTenant({ ctx, unitId, path: '/api/units/[id]/payment-plan' });
      try {
        const { searchParams } = new URL(req.url);
        const planId = searchParams.get('planId');

        if (!planId) {
          return NextResponse.json(
            { success: false, error: 'planId query parameter is required' },
            { status: 400 }
          );
        }

        const result = await PaymentPlanService.deletePlan(unitId, planId, ctx.uid);

        if (!result.success) {
          return NextResponse.json({ success: false, error: result.error }, { status: 409 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        const message = getErrorMessage(error, 'Failed to delete payment plan');
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }
  );

  return handler(request);
}

export const DELETE = withStandardRateLimit(handleDelete);
