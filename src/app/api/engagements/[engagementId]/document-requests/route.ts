/**
 * ADR-901 Φ4.5 · ADR-942 Φ1 — ο **επαγγελματίας** ζητά έγγραφα της υπόθεσης του από όποιον τα οφείλει (§5.8 γρ.3).
 * Κάθε είδος υπόθεσης (μεταβίβαση · ανάθεση έκδοσης) απαντά από το **μητρώο προσαρμογέων** — καμία διακλάδωση εδώ.
 *
 * POST /api/engagements/{engagementId}/document-requests { checklistItemIds }
 *   → `{ items: [{ itemId, kind: 'requested' | 'already-requested' | 'refused', recipient? , refusal? }] }`
 *   - **μέσω της δικής μου** ενεργής συμμετοχής (`requestDocumentsAsEngaged`) — ανάκληση = άμεση
 *   - ο παραλήπτης **δεν** έρχεται από το σώμα: τον ορίζει ο πάροχος της γραμμής (Α29)
 *   - γραμμή που ο ρόλος μου δεν βλέπει ⇒ `refused/not-found` (ίδιο με ανύπαρκτη)
 *   - ίδια γραμμή ξανά την ίδια μέρα ⇒ `already-requested`, καμία δεύτερη ειδοποίηση (Α30)
 *
 * @module api/engagements/[engagementId]/document-requests
 */

import { withPersonalOrOrgAuth } from '@/lib/auth/personal-scope-middleware';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { requestDocumentsAsEngaged } from '@/server/document-requests/request-adapters';
import { documentRequestBody, documentRequestResponse } from '../../_shared/document-request-response';
import { engagementPost } from '../../_shared/engagement-post';

const handler = engagementPost(documentRequestBody, async ({ db, uid, engagementId, body }) => documentRequestResponse(
  await requestDocumentsAsEngaged(db, { uid, engagementId, itemIds: body.checklistItemIds, nowMs: Date.now() }),
));

export const POST = withStandardRateLimit(withPersonalOrOrgAuth(handler));
