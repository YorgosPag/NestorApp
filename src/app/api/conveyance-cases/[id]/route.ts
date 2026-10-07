/**
 * ADR-901 Φ1 — Εντολή πάνω σε υπόθεση μεταβίβασης.
 *
 * PATCH /api/conveyance-cases/{id} { expectedVersion, command }
 *   command ∈ answer_fact · mark_not_applicable · review · clear_override · set_target_signing_date · cancel
 *
 * - CAS: `expectedVersion` ≠ τρέχουσα ⇒ **409** (ο client ξαναφορτώνει — καμία σιωπηλή αντικατάσταση)
 * - Πάγωμα: υπογεγραμμένη/κλειστή υπόθεση ⇒ **409** (ADR-901 Ε-6)
 * - Άκυρη εντολή (άγνωστη γραμμή, ξένο αρχείο, χωρίς λόγο) ⇒ **422**
 *
 * Δικαίωμα: `legal:conveyance:manage`, κρινόμενο με το έργο του ακινήτου της υπόθεσης.
 *
 * @module api/conveyance-cases/[id]
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { apiSuccess } from '@/lib/api/ApiErrorHandler';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { conveyanceCommandRequestSchema } from '@/lib/conveyance/conveyance-commands';
import { applyConveyanceCaseCommand, readOwnedConveyanceCase } from '@/services/conveyance/conveyance-case.service';
import { actorOf, authorizeForProperty, CONVEYANCE_MANAGE, failureToApiError } from '../_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases/[id]';

export const PATCH = withStandardRateLimit(
  withAuth(async (
    request: NextRequest,
    ctx: AuthContext,
    cache: PermissionCache,
    segmentData?: { params: Promise<{ id: string }> },
  ) => {
    const { id } = await segmentData!.params;
    const parsed = safeParseBody(conveyanceCommandRequestSchema, await request.json());
    if (parsed.error) return parsed.error;

    const db = requireAdminFirestore();
    const actor = actorOf(ctx);
    const existing = await readOwnedConveyanceCase(db, actor, id);
    if (!existing) throw failureToApiError({ kind: 'case_not_found' });
    await authorizeForProperty({ ctx, cache, propertyId: existing.subject.propertyId, permission: CONVEYANCE_MANAGE, path: PATH, intent: 'write' });

    const outcome = await applyConveyanceCaseCommand(db, actor, existing, parsed.data);
    if (!outcome.ok) throw failureToApiError(outcome.failure);
    return apiSuccess(outcome.value);
  }),
);
