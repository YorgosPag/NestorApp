/**
 * ADR-901 Φ3 — Ακύρωση της εκκρεμούς πρόσκλησης με email μιας θέσης (ο ΟΙΚΟΔΕΣΠΟΤΗΣ).
 *
 * POST /api/conveyance-cases/{id}/invitations/{role}/revoke
 *   - `pending` ⇒ `revoked`: ο σύνδεσμος στο email σταματά **αμέσως** να δίνει οτιδήποτε
 *   - ιδεμποτές: καμία εκκρεμής ⇒ 200 με τις ίδιες θέσεις · **ποτέ διαγραφή** (το ίχνος μένει)
 *
 * Δικαίωμα: `legal:conveyance:manage`. Ξένη υπόθεση ≡ ανύπαρκτη (404, ADR-742). Ρόλος εκτός λεξιλογίου ⇒ 404.
 *
 * @module api/conveyance-cases/[id]/invitations/[role]/revoke
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { isLegalEngagementRole } from '@/types/engagement';
import { readOwnedConveyanceCase } from '@/services/conveyance/conveyance-case.service';
import { cancelCaseInvitation } from '@/services/conveyance/conveyance-engagement-host.service';
import { actorOf, authorizeForProperty, CONVEYANCE_MANAGE, failureToApiError } from '../../../../_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases/[id]/invitations/[role]/revoke';

type Segment = { params: Promise<{ id: string; role: string }> };

export const POST = withSensitiveRateLimit(
  withAuth(async (_request: NextRequest, ctx: AuthContext, cache: PermissionCache, segmentData?: Segment) => {
    const { id, role } = await segmentData!.params;
    if (!isLegalEngagementRole(role)) throw new ApiError(404, 'Slot not found', 'NOT_FOUND');
    const db = requireAdminFirestore();
    const actor = actorOf(ctx);
    const record = await readOwnedConveyanceCase(db, actor, id);
    if (!record) throw failureToApiError({ kind: 'case_not_found' });
    await authorizeForProperty({ ctx, cache, propertyId: record.subject.propertyId, permission: CONVEYANCE_MANAGE, path: PATH });

    return apiSuccess({ slots: await cancelCaseInvitation(db, actor, record, role, Date.now()) });
  }),
);
