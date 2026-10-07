/**
 * «Ποιο πλάνο;» για τις διαδρομές δανείων (ADR-234): το `planId` του αιτήματος, αλλιώς το
 * ενεργό πλάνο του ακινήτου. Γραφόταν αυτούσιο σε πέντε `route.ts`.
 *
 * @module api/properties/_shared/active-payment-plan
 */

import 'server-only';

import type { NextResponse } from 'next/server';
import { PaymentPlanService } from '@/services/payment-plan.service';
import { failure } from './property-route';

/** Το πλάνο πάνω στο οποίο δουλεύει το αίτημα — `null` όταν ούτε δόθηκε ούτε υπάρχει ενεργό. */
export async function resolvePlanId(propertyId: string, provided: string | undefined): Promise<string | null> {
  if (provided) return provided;
  const plan = await PaymentPlanService.getActivePaymentPlan(propertyId);
  return plan ? plan.id : null;
}

export function noActivePlan(): NextResponse {
  return failure('No active payment plan found', 404);
}
