/**
 * =============================================================================
 * POST + PATCH + DELETE /api/properties/[id]/payment-plan/installments
 * =============================================================================
 *
 * POST:   Add installment (with optional insertAtIndex)
 * PATCH:  Update installment
 * DELETE: Remove installment
 *
 * @module api/properties/[id]/payment-plan/installments
 * @enterprise ADR-234 - Payment Plan & Installment Tracking (SPEC-234D)
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { PaymentPlanService } from '@/services/payment-plan.service';
import type { CreateInstallmentInput, UpdateInstallmentInput } from '@/types/payment-plan';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';

const PATH = '/api/properties/[id]/payment-plan/installments';

// =============================================================================
// POST — Add Installment
// =============================================================================

interface AddInstallmentBody {
  planId: string;
  installment: CreateInstallmentInput;
  insertAtIndex?: number;
}

/** Το πρώτο που λείπει ή δεν στέκει στο σώμα — `null` όταν είναι πλήρες. */
function addInstallmentProblem(body: AddInstallmentBody): string | null {
  if (!body.planId || !body.installment) return 'planId and installment are required';

  const { label, type, amount, percentage, dueDate } = body.installment;
  if (!label || !type || amount === undefined || percentage === undefined || !dueDate) {
    return 'installment must include label, type, amount, percentage, dueDate';
  }

  // 🛡️ ADR-249 P2-2: Defense-in-depth — basic amount sanity check
  if (typeof amount !== 'number' || amount <= 0) return 'Installment amount must be a positive number';

  return null;
}

export const POST = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to add installment',
  handle: async ({ req, ctx, propertyId }) => {
    const body = (await req.json()) as AddInstallmentBody;
    const problem = addInstallmentProblem(body);
    if (problem) return failure(problem, 400);

    const result = await PaymentPlanService.addInstallment(
      propertyId,
      body.planId,
      body.installment,
      ctx.uid,
      body.insertAtIndex
    );
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true }, { status: 201 });
  },
}));

// =============================================================================
// PATCH — Update Installment
// =============================================================================

interface UpdateInstallmentBody {
  planId: string;
  index: number;
  updates: UpdateInstallmentInput;
}

const INDEX_REQUIRED = 'planId and index are required';

export const PATCH = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to update installment',
  handle: async ({ req, ctx, propertyId }) => {
    const body = (await req.json()) as UpdateInstallmentBody;
    if (!body.planId || body.index === undefined) return failure(INDEX_REQUIRED, 400);

    const result = await PaymentPlanService.updateInstallment(
      propertyId,
      body.planId,
      body.index,
      body.updates,
      ctx.uid
    );
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true });
  },
}));

// =============================================================================
// DELETE — Remove Installment
// =============================================================================

interface RemoveInstallmentBody {
  planId: string;
  index: number;
}

export const DELETE = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to remove installment',
  handle: async ({ req, ctx, propertyId }) => {
    const body = (await req.json()) as RemoveInstallmentBody;
    if (!body.planId || body.index === undefined) return failure(INDEX_REQUIRED, 400);

    const result = await PaymentPlanService.removeInstallment(propertyId, body.planId, body.index, ctx.uid);
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true });
  },
}));
