/**
 * ADR-901 Φ4.5 — ο **επαγγελματίας** ζητά έγγραφα της υπόθεσης από όποιον τα οφείλει (§5.8 γρ.3).
 *
 * POST /api/engagements/{engagementId}/document-requests { checklistItemIds }
 *   → `{ items: [{ itemId, kind: 'requested' | 'already-requested' | 'refused', recipient? , refusal? }] }`
 *   - **μέσω της δικής μου** ενεργής συμμετοχής (`resolveEngagedCase`) — ανάκληση = άμεση
 *   - ο παραλήπτης **δεν** έρχεται από το σώμα: τον ορίζει ο πάροχος της γραμμής (Α29)
 *   - γραμμή που ο ρόλος μου δεν βλέπει ⇒ `refused/not-found` (ίδιο με ανύπαρκτη)
 *   - ίδια γραμμή ξανά την ίδια μέρα ⇒ `already-requested`, καμία δεύτερη ειδοποίηση (Α30)
 *
 * @module api/engagements/[engagementId]/document-requests
 */

import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requestCaseDocuments } from '@/services/conveyance/conveyance-document-request.service';
import { resolveEngagedCase } from '@/services/conveyance/conveyance-engagement-access.service';
import { documentRequestBody, documentRequestResponse } from '../../_shared/document-request-response';
import { engagementPost } from '../../_shared/engagement-post';

const handler = engagementPost(documentRequestBody, async ({ db, uid, engagementId, body }) => {
  const nowMs = Date.now();
  const resolution = await resolveEngagedCase(db, uid, engagementId, nowMs);
  if (!resolution.ok) return documentRequestResponse(resolution);
  const { engagement, record, context } = resolution.access;
  return documentRequestResponse(await requestCaseDocuments(db, {
    requester: { kind: 'engaged', engagement },
    record,
    context,
    itemIds: body.checklistItemIds,
    nowMs,
  }));
});

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
