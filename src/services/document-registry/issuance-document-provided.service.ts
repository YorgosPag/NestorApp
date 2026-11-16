import 'server-only';

/**
 * @fileoverview ADR-942 Φ1 (Δ8) — **«ανέβηκε έγγραφο που ζητήσατε»**: το γραφείο ανέβασε στον φάκελο του ακινήτου ένα
 *   είδος που ζήτησε ο μηχανικός· ο μηχανικός ειδοποιείται στον χώρο του.
 * @related issuance-document-request.service.ts (το αίτημα) · issuance-request-files.server.ts (το δοχείο)
 * @module services/document-registry/issuance-document-provided.service
 *
 * 🔑 **Ο server δεν πιστεύει τον client**: ξαναδιαβάζει το αρχείο και κρίνει ο ίδιος ότι είναι ζωντανό, στο δοχείο του
 *    **κατόχου** και είδος του καταλόγου που **ζητήθηκε**. Ό,τι δεν περνά ⇒ καμία ειδοποίηση.
 * 🔑 **Ιδεμποτικό**: `eventId` = (αίτημα, αρχείο, μηχανικός) — δεύτερη κλήση για το ίδιο αρχείο δεν ξαναστέλνει.
 * 🔑 **Δίχτυ ασφαλείας, όχι πηγή αλήθειας**: αν η κλήση χαθεί, η όψη του μηχανικού δείχνει ήδη «έχει δοθεί» — η
 *    κατάσταση **παράγεται** από τον φάκελο, δεν αποθηκεύεται.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { issuanceRequestItemsOf } from '@/config/document-requests/issuance-request-catalog';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { COLLECTIONS } from '@/config/firestore-collections';
import { readEngagementForSubject } from '@/lib/auth/engagement-read';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { isLiveFileRecord } from '@/lib/files/container-file-verdict';
import { announceDocumentProvided } from '@/server/issuance-invitations/issuance-document-request-notifier';
import { isIssuanceEngagement, type IssuanceEngagement } from '@/types/engagement';
import type { IssuanceDocumentRequest } from '@/types/issuance-document-request';
import { issuanceAssignmentIdOf, type DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { readIssuanceRequests } from './issuance-document-request-panel.server';
import { issuancePropertyNameOf, readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';
import { issuanceRequestContainerOf, issuanceRequestPurposeOf, type IssuanceRequestContainer } from './issuance-request-files.server';

export interface DocumentProvidedInput {
  readonly companyId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
  readonly fileId: string;
}

export type DocumentProvidedResult = { readonly ok: true; readonly notified: number } | { readonly ok: false; readonly rejection: 'not-found' | 'unknown' };

/** Το είδος του καταλόγου που **είναι** αυτό το αρχείο — μόνο αν ζει στο δοχείο του κατόχου· αλλιώς `null`. */
async function catalogItemOfFile(db: Firestore, container: IssuanceRequestContainer, kind: DocumentKind, fileId: string): Promise<string | null> {
  const data = (await db.collection(COLLECTIONS.FILES).doc(fileId).get()).data();
  if (data === undefined || !isLiveFileRecord(data)) return null;
  if (!isPayloadOwnedByCompany(data, container.companyId)) return null;
  if (data.entityType !== container.entityType || data.entityId !== container.entityId) return null;
  const item = issuanceRequestItemsOf(kind).find((candidate) => issuanceRequestPurposeOf(candidate.itemId) === data.purpose);
  return item?.itemId ?? null;
}

/** Το νεότερο αίτημα **κάθε** μηχανικού για αυτό το είδος — ένας αποδέκτης ανά άνθρωπο, όσες φορές κι αν ζήτησε. */
function latestPerRequester(requests: readonly IssuanceDocumentRequest[], itemId: string): IssuanceDocumentRequest[] {
  const latest = new Map<string, IssuanceDocumentRequest>();
  for (const request of requests) {
    if (request.itemId !== itemId || request.recipient !== 'host' || request.requesterRole === 'host') continue;
    const known = latest.get(request.requesterUid);
    if (known === undefined || request.requestedAt > known.requestedAt) latest.set(request.requesterUid, request);
  }
  return [...latest.values()];
}

/** Η **ενεργή** συμμετοχή του αιτούντος στον χώρο αυτής της ανάθεσης — αλλιώς `null` (δεν ειδοποιείται όποιος έφυγε). */
async function activeRequester(db: Firestore, assignment: DocumentIssuanceAssignment, request: IssuanceDocumentRequest): Promise<IssuanceEngagement | null> {
  if (request.projectId === null) return null;
  const read = await readEngagementForSubject(db, {
    hostCompanyId: assignment.companyId, projectId: request.projectId, uid: request.requesterUid,
    subject: { kind: 'document_issuance', assignmentId: assignment.id },
  });
  const engagement = read.outcome === 'found' ? read.engagement : null;
  return engagement !== null && engagement.state === 'active' && isIssuanceEngagement(engagement) ? engagement : null;
}

/** Το γραφείο ανέβασε το `fileId`: ειδοποίησε όσους μηχανικούς το είχαν ζητήσει και είναι ακόμη στον χώρο. */
export async function announceIssuanceDocumentProvided(db: Firestore, input: DocumentProvidedInput): Promise<DocumentProvidedResult> {
  const assignmentId = issuanceAssignmentIdOf(input.companyId, input.propertyId, input.documentKind);
  const assignment = await readHostedIssuanceAssignment(db, input.companyId, assignmentId);
  if (!assignment) return { ok: false, rejection: 'not-found' };
  const container = await issuanceRequestContainerOf(db, assignment);
  if (container === null) return { ok: false, rejection: 'not-found' };
  const itemId = await catalogItemOfFile(db, container, assignment.documentKind, input.fileId);
  if (itemId === null) return { ok: false, rejection: 'not-found' };
  const requests = await readIssuanceRequests(db, assignment);
  if (requests === null) return { ok: false, rejection: 'unknown' };
  const asked = latestPerRequester(requests, itemId);
  if (asked.length === 0) return { ok: true, notified: 0 };
  const propertyName = await issuancePropertyNameOf(db, assignment.companyId, assignment.propertyId);
  const engaged = await Promise.all(asked.map(async (request) => ({ request, engagement: await activeRequester(db, assignment, request) })));
  const reachable = engaged.filter((entry): entry is { request: IssuanceDocumentRequest; engagement: IssuanceEngagement } => entry.engagement !== null);
  await Promise.all(reachable.map(({ request, engagement }) => announceDocumentProvided({
    assignment, propertyName, requestId: request.id, fileId: input.fileId, engagement,
  })));
  return { ok: true, notified: reachable.length };
}
