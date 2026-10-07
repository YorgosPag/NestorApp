/**
 * ADR-901 Φ4.5 — ο **οικοδεσπότης** ζητά έγγραφα της υπόθεσης από όποιον τα οφείλει (§5.8 γρ.3).
 *
 * POST /api/conveyance-cases/{id}/document-requests { checklistItemIds }
 *   → `{ items: [{ itemId, kind: 'requested' | 'already-requested' | 'refused', recipient?, refusal? }] }`
 *   - ο παραλήπτης **δεν** έρχεται από το σώμα: τον ορίζει ο πάροχος της γραμμής (Α29) — π.χ. «Σχέδιο συμβολαίου» ⇒
 *     ο συμβολαιογράφος, «Πιστοποιητικό τράπεζας» ⇒ ο δικηγόρος του αγοραστή
 *   - ίδια γραμμή ξανά την ίδια μέρα από τον χώρο ⇒ `already-requested`, καμία δεύτερη ειδοποίηση (Α30)
 *   - σύνορο ιδεμποτίας ADR-872 μέσα στο `withAuth`
 *
 * Δικαίωμα: `legal:conveyance:manage` (ενέργεια, όχι ανάγνωση), με το έργο του ακινήτου. Υπόθεση **άλλου** μισθωτή ≡
 * ανύπαρκτη (404).
 *
 * @module api/conveyance-cases/[id]/document-requests
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { decodeRouteParam } from '@/lib/routes/route-param';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import { requestCaseDocuments } from '@/services/conveyance/conveyance-document-request.service';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import { documentRequestBody, documentRequestResponse } from '../../../engagements/_shared/document-request-response';
import { CONVEYANCE_MANAGE, failureToApiError, readAuthorizedCase } from '../../_shared/conveyance-route-support';

const PATH = '/api/conveyance-cases/[id]/document-requests';

type Segment = { params: Promise<{ id: string }> };

export const POST = withStandardRateLimit(
  withAuth(async (request: NextRequest, ctx: AuthContext, cache: PermissionCache, segmentData?: Segment) => {
    const params = await segmentData!.params;
    const parsed = safeParseBody(documentRequestBody, await request.json());
    if (parsed.error) return parsed.error;
    const { db, actor, record } = await readAuthorizedCase({
      ctx, cache, caseId: decodeRouteParam(params.id), permission: CONVEYANCE_MANAGE, path: PATH, intent: 'write',
    });
    const context = await loadConveyanceSubject(db, actor.companyId, record.subject.propertyId);
    if (!context) throw failureToApiError({ kind: 'property_not_found' });

    return documentRequestResponse(await requestCaseDocuments(db, {
      requester: { kind: 'host', uid: actor.uid, name: actor.email },
      record,
      context,
      itemIds: parsed.data.checklistItemIds,
      nowMs: Date.now(),
    }));
  }),
);
