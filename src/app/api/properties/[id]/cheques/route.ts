/**
 * GET + POST /api/properties/[id]/cheques
 *
 * GET:  List all cheques for a property
 * POST: Create a new cheque
 *
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ChequeRegistryService } from '@/services/cheque-registry.service';
import { propertyRoute, failure } from '@/app/api/properties/_shared/property-route';
import { safeParseBody } from '@/lib/validation/shared-schemas';

const CreateChequeSchema = z.object({
  chequeType: z.enum(['bank_cheque', 'personal_cheque']),
  chequeNumber: z.string().min(1).max(50),
  amount: z.number().positive().max(999_999_999),
  bankName: z.string().min(1).max(200),
  bankBranch: z.string().max(200).optional(),
  drawerName: z.string().min(1).max(200),
  drawerTaxId: z.string().max(20).optional(),
  accountNumber: z.string().max(50).optional(),
  issueDate: z.string().min(10).max(30),
  maturityDate: z.string().min(10).max(30),
  crossedCheque: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  projectId: z.string().min(1).max(128),
  paymentPlanId: z.string().max(128).optional(),
  contactId: z.string().max(128).optional(),
});

const PATH = '/api/properties/[id]/cheques';

// =============================================================================
// GET — List Cheques
// =============================================================================

export const GET = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'read',
  failure: 'Failed to get cheques',
  handle: async ({ propertyId }) => {
    const result = await ChequeRegistryService.getChequesByProperty(propertyId);
    if (!result.success) return failure(result.error, 500);
    return NextResponse.json({ success: true, data: result.cheques });
  },
}));

// =============================================================================
// POST — Create Cheque
// =============================================================================

export const POST = withStandardRateLimit(propertyRoute({
  path: PATH,
  intent: 'write',
  failure: 'Failed to create cheque',
  handle: async ({ req, ctx, propertyId }) => {
    const parsed = safeParseBody(CreateChequeSchema, await req.json());
    if (parsed.error) return parsed.error;

    const result = await ChequeRegistryService.createCheque(propertyId, parsed.data, ctx.uid);
    if (!result.success) return failure(result.error);

    return NextResponse.json({ success: true, data: result.cheque }, { status: 201 });
  },
}));
