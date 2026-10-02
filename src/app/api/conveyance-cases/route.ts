/**
 * ADR-901 Φ1 — Υπόθεση μεταβίβασης ανά ακίνητο.
 *
 * GET  /api/conveyance-cases?propertyId=…  → η πιο πρόσφατη υπόθεση + ο παραγόμενος κατάλογος (ή `null`)
 * POST /api/conveyance-cases { propertyId } → άνοιγμα — **ιδεμποτές**: αν υπάρχει ανοιχτή, επιστρέφεται
 *                                             αυτή (200) αντί για νέα (201)
 *
 * Δικαιώματα: `legal:conveyance:view` (GET) · `legal:conveyance:manage` (POST), κρινόμενα με το
 * έργο του ακινήτου. Μισθωτής: `requirePropertyInTenantScope`.
 *
 * @module api/conveyance-cases
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { getConveyanceCaseView, openConveyanceCase } from '@/services/conveyance/conveyance-case.service';
import {
  actorOf,
  authorizeForProperty,
  CONVEYANCE_MANAGE,
  CONVEYANCE_VIEW,
  failureToApiError,
} from './_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases';

const openCaseSchema = z.object({ propertyId: z.string().min(1).max(200) });

export const GET = withStandardRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, cache: PermissionCache) => {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) throw new ApiError(400, 'propertyId is required', 'VALIDATION_ERROR');
    await authorizeForProperty({ ctx, cache, propertyId, permission: CONVEYANCE_VIEW, path: PATH });

    const outcome = await getConveyanceCaseView(requireAdminFirestore(), actorOf(ctx), propertyId);
    if (!outcome.ok) throw failureToApiError(outcome.failure);
    return apiSuccess(outcome.value);
  }),
);

export const POST = withStandardRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, cache: PermissionCache) => {
    const parsed = safeParseBody(openCaseSchema, await request.json());
    if (parsed.error) return parsed.error;
    const { propertyId } = parsed.data;
    await authorizeForProperty({ ctx, cache, propertyId, permission: CONVEYANCE_MANAGE, path: PATH });

    const outcome = await openConveyanceCase(requireAdminFirestore(), actorOf(ctx), propertyId);
    if (!outcome.ok) throw failureToApiError(outcome.failure);
    return apiSuccess(outcome.value.view, undefined, undefined, outcome.value.created ? 201 : 200);
  }),
);
