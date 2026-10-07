/**
 * =============================================================================
 * GET + POST + PATCH /api/properties/[id]/payment-plan
 * =============================================================================
 *
 * GET:   Get active payment plan for property
 * POST:  Create new payment plan
 * PATCH: Update payment plan (negotiation/draft only)
 *
 * @module api/properties/[id]/payment-plan
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { CreatePaymentPlanInput, UpdatePaymentPlanInput } from '@/types/payment-plan';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';

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
  // ADR-244: Multi-owner support — ownerContactId/ownerName nullable for joint plans
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

type CreatePlanBody = z.infer<typeof createPaymentPlanSchema>;
type SplitOwners = NonNullable<CreatePlanBody['owners']>;
type PlanFields = Omit<CreatePlanBody, 'owners'>;

const PATH = '/api/properties/[id]/payment-plan';

// =============================================================================
// GET — Active Payment Plan
// =============================================================================

export const GET = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'read',
  failure: 'Failed to get payment plan',
  handle: async ({ propertyId }) => {
    // ADR-244: Return ALL active plans (supports multi-owner split)
    const plans = await PaymentPlanService.getPaymentPlans(propertyId);
    return NextResponse.json({ success: true, data: plans });
  },
}));

// =============================================================================
// POST — Create Payment Plan
// =============================================================================

/** ADR-244: split mode — N individual plans, one per owner. */
function createSplitPlans(propertyId: string, owners: SplitOwners, plan: PlanFields, uid: string) {
  return PaymentPlanService.createSplitPaymentPlans(
    propertyId,
    owners,
    {
      buildingId: plan.buildingId,
      projectId: plan.projectId,
      taxRegime: plan.taxRegime ?? 'vat_24',
      taxRate: plan.taxRate ?? 24,
      config: plan.config,
      loan: plan.loan,
      notes: plan.notes,
    },
    plan.totalAmount,
    plan.installments,
    uid,
  );
}

export const POST = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to create payment plan',
  handle: async ({ req, ctx, propertyId }) => {
    const rawBody: unknown = await req.json();
    const parsed = createPaymentPlanSchema.safeParse(rawBody);
    if (!parsed.success) return failure(parsed.error.issues[0].message, 400);

    const { owners: splitOwners, ...planFields } = parsed.data;

    // ADR-244: If owners[] present → split mode (create N individual plans)
    if (splitOwners && splitOwners.length > 1) {
      const split = await createSplitPlans(propertyId, splitOwners, planFields, ctx.uid);
      if (!split.success) return failure(split.error);
      return NextResponse.json({ success: true, data: split.plans }, { status: 201 });
    }

    // Standard: single/joint plan
    const input: CreatePaymentPlanInput = { ...planFields, propertyId } as CreatePaymentPlanInput;
    const result = await PaymentPlanService.createPaymentPlan(input, ctx.uid);
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true, data: result.plan }, { status: 201 });
  },
}));

// =============================================================================
// PATCH — Update Payment Plan
// =============================================================================

export const PATCH = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to update payment plan',
  handle: async ({ req, ctx, propertyId }) => {
    const body = (await req.json()) as UpdatePaymentPlanInput & { planId: string };
    if (!body.planId) return failure('planId is required', 400);

    const { planId, ...updates } = body;
    const result = await PaymentPlanService.updatePaymentPlan(propertyId, planId, updates, ctx.uid);
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true });
  },
}));

// =============================================================================
// DELETE — Delete Payment Plan (negotiation/draft only, no payments)
// =============================================================================

export const DELETE = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to delete payment plan',
  handle: async ({ req, ctx, propertyId }) => {
    const planId = new URL(req.url).searchParams.get('planId');
    if (!planId) return failure('planId query parameter is required', 400);

    const result = await PaymentPlanService.deletePlan(propertyId, planId, ctx.uid);
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true });
  },
}));
