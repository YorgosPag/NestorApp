/**
 * POST /api/properties/[id]/payment-plan/loans/[loanId]/comm-log
 *
 * Add a bank communication log entry.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { LoanTrackingService } from '@/services/loan-tracking.service';
import type { AddCommunicationLogInput } from '@/types/loan-tracking';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { resolvePlanId, noActivePlan } from '@/app/api/properties/_shared/active-payment-plan';

export const POST = withStandardRateLimit(propertyRoute<{ id: string; loanId: string }>({
  path: '/api/properties/[id]/payment-plan/loans/[loanId]/comm-log',
  intent: 'write',
  failure: 'Failed to add comm log',
  handle: async ({ req, ctx, params, propertyId }) => {
    const body = (await req.json()) as AddCommunicationLogInput & { planId?: string };

    const planId = await resolvePlanId(propertyId, body.planId);
    if (!planId) return noActivePlan();

    if (!body.summary?.trim()) return failure('summary is required', 400);

    const result = await LoanTrackingService.addCommunicationLog(
      propertyId, planId, params.loanId, body, ctx.uid
    );
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true }, { status: 201 });
  },
}));
