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
import { INSTALLMENT_DUE_DATE_ERROR, toInstallmentDueDay } from '@/app/api/properties/_shared/installment-due-date';

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
  if (toInstallmentDueDay(dueDate) === null) return INSTALLMENT_DUE_DATE_ERROR;

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

    // Στη βάση γράφεται πάντα η κανονική ημέρα (`YYYY-MM-DD`) — και όταν ο πελάτης έστειλε την παλιά στιγμή UTC.
    const installment: CreateInstallmentInput = { ...body.installment, dueDate: toInstallmentDueDay(body.installment.dueDate) as string };
    const result = await PaymentPlanService.addInstallment(
      propertyId,
      body.planId,
      installment,
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
    // Μερική διόρθωση: χωρίς `dueDate` η λήξη μένει ως έχει· με `dueDate`, ο ίδιος κριτής με τη δημιουργία.
    const dueDate = body.updates?.dueDate;
    const dueDay = dueDate === undefined ? undefined : toInstallmentDueDay(dueDate);
    if (dueDay === null) return failure(INSTALLMENT_DUE_DATE_ERROR, 400);
    const updates: UpdateInstallmentInput = dueDay === undefined ? body.updates : { ...body.updates, dueDate: dueDay };

    const result = await PaymentPlanService.updateInstallment(
      propertyId,
      body.planId,
      body.index,
      updates,
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
