/**
 * ADR-901 Φ2 · ADR-862 Φ1 — Τέλος συμμετοχής επαγγελματία (ο ΟΙΚΟΔΕΣΠΟΤΗΣ).
 *
 * POST /api/conveyance-cases/{id}/engagements/{engagementId}/revoke
 *   - πρόταση ⇒ `withdrawn` · ενεργή ⇒ `revoked` — **άμεσα**, καμία περίοδος χάριτος (ADR-787 Ε-2 §5)
 *   - **ποτέ διαγραφή** (Α5): η κατάσταση αλλάζει, το ίχνος μένει· ο επαγγελματίας **ειδοποιείται**
 *   - ιδεμποτές: ήδη τελειωμένη ⇒ 200 χωρίς εγγραφή
 *
 * Δικαίωμα: `legal:conveyance:manage`. Συμμετοχή **άλλης** υπόθεσης ≡ ανύπαρκτη (404).
 *
 * @module api/conveyance-cases/[id]/engagements/[engagementId]/revoke
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { ApiError, apiSuccess } from '@/lib/api/ApiErrorHandler';
import { readOwnedConveyanceCase } from '@/services/conveyance/conveyance-case.service';
import { endCaseEngagement } from '@/services/conveyance/conveyance-engagement-host.service';
import { actorOf, authorizeForProperty, CONVEYANCE_MANAGE, failureToApiError } from '../../../../_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases/[id]/engagements/[engagementId]/revoke';

type Segment = { params: Promise<{ id: string; engagementId: string }> };

export const POST = withStandardRateLimit(
  withAuth(async (_request: NextRequest, ctx: AuthContext, cache: PermissionCache, segmentData?: Segment) => {
    const { id, engagementId } = await segmentData!.params;
    const db = requireAdminFirestore();
    const actor = actorOf(ctx);
    const record = await readOwnedConveyanceCase(db, actor, id);
    if (!record) throw failureToApiError({ kind: 'case_not_found' });
    await authorizeForProperty({ ctx, cache, propertyId: record.subject.propertyId, permission: CONVEYANCE_MANAGE, path: PATH });

    const outcome = await endCaseEngagement(db, actor, record, engagementId, Date.now());
    if (!outcome.ok) throw new ApiError(404, 'Engagement not found', 'NOT_FOUND');
    return apiSuccess({ slots: outcome.slots });
  }),
);
