import 'server-only';

/**
 * @fileoverview ADR-942 Φ1 (Δ8) · Φ2 — **το γραφείο δίνει** στον μηχανικό ένα αρχείο του φακέλου του ακινήτου, και
 *   **ανακαλεί**. Η μία πράξη, με δύο δρόμους (πρακτική TaxDome):
 *   - `upload`   — ανέβηκε **ως απάντηση** σε αίτημα ⇒ δοσμένο αυτόματα (η απάντηση είναι η συναίνεση)·
 *   - `existing` — αρχείο που **υπήρχε ήδη** στον φάκελο ⇒ μόνο με ρητό «Δώσε αυτό το αρχείο».
 * @related issuance-file-access.service.ts (ο μηχανικός το ανοίγει) · document-provision-store.server.ts (ο γραφέας)
 * @module services/document-registry/issuance-document-provided.service
 *
 * 🔑 **Ο server δεν πιστεύει τον client**: ξαναδιαβάζει το αρχείο και κρίνει ο ίδιος ότι είναι ζωντανό, στο δοχείο του
 *    **κατόχου** και είδος του καταλόγου. Ό,τι δεν περνά ⇒ `not-found`, κανένα δόσιμο.
 * 🔑 **Μόνο όσο η ανάθεση εκτελείται** (`accepted`) δίνεται νέο αρχείο· η **ανάκληση** επιτρέπεται πάντα.
 * 🔑 **Ιδεμποτικό**: ίδιο αρχείο για ίδιο στοιχείο ⇒ `already-given`, κανένα δεύτερο ίχνος· η ειδοποίηση έχει `eventId`
 *    (αίτημα, αρχείο, μηχανικός) ⇒ καμία δεύτερη.
 * 🔑 Ιστορικό ADR-195 στο **ακίνητο**, με λέξεις: «Δόθηκε έγγραφο: <είδος>» · «Ανάκληση εγγράφου: <είδος>».
 * ⚠️ Ειδοποιούνται **όσοι ζήτησαν** το στοιχείο και είναι ακόμη στον χώρο. Δόσιμο χωρίς αίτημα δεν ειδοποιεί· ο μηχανικός
 *    το βλέπει στο επόμενο άνοιγμα του χώρου (ADR-915 §39: καμία ζωντανή όψη).
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { readEngagementForSubject } from '@/lib/auth/engagement-read';
import { ISSUANCE_AUDIT_FIELDS } from '@/lib/document-validity/issuance-audit-fields';
import { issuanceStageOf } from '@/lib/document-validity/issuance-stage';
import { giveDocument, revokeProvision } from '@/server/document-requests/document-provision-store.server';
import { announceDocumentProvided } from '@/server/issuance-invitations/issuance-document-request-notifier';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { DocumentProvisionRoute } from '@/types/document-request';
import { isIssuanceEngagement, type IssuanceEngagement } from '@/types/engagement';
import type { IssuanceDocumentRequest } from '@/types/issuance-document-request';
import { issuanceAssignmentIdOf, type DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { readIssuanceRequests } from './issuance-document-request-panel.server';
import { issuancePropertyNameOf, readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';
import { issuanceCatalogFileOf, issuanceRequestContainerOf, type IssuanceCatalogFile } from './issuance-request-files.server';

/** Το στάδιο στο οποίο δίνεται νέο αρχείο — η ανάθεση εκτελείται. */
const GIVING_STAGE = 'accepted';

/** Ποια ανάθεση: ο μισθωτής από τη συνεδρία, ακίνητο + είδος από το αίτημα. */
export interface IssuanceAssignmentRef {
  readonly companyId: string;
  readonly propertyId: string;
  readonly documentKind: DocumentKind;
}

export interface DocumentProvidedInput extends IssuanceAssignmentRef {
  readonly fileId: string;
  readonly via: DocumentProvisionRoute;
  readonly uid: string;
  readonly nowMs: number;
}

export interface ProvisionRevokeInput extends IssuanceAssignmentRef {
  readonly provisionId: string;
  readonly uid: string;
  readonly nowMs: number;
}

export type DocumentProvidedResult =
  | { readonly ok: true; readonly outcome: 'given' | 'already-given'; readonly notified: number }
  | { readonly ok: false; readonly rejection: 'not-found' | 'case-closed' | 'unknown' };

export type ProvisionRevokeResult =
  | { readonly ok: true; readonly outcome: 'revoked' | 'already-revoked' }
  | { readonly ok: false; readonly rejection: 'not-found' };

function hostedAssignment(db: Firestore, ref: IssuanceAssignmentRef): Promise<DocumentIssuanceAssignment | null> {
  return readHostedIssuanceAssignment(db, ref.companyId, issuanceAssignmentIdOf(ref.companyId, ref.propertyId, ref.documentKind));
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

/** Ειδοποίησε όσους μηχανικούς ζήτησαν το στοιχείο και είναι ακόμη στον χώρο· `null` ⇒ τα αιτήματα δεν διαβάστηκαν. */
async function notifyRequesters(db: Firestore, assignment: DocumentIssuanceAssignment, itemId: string, fileId: string): Promise<number | null> {
  const requests = await readIssuanceRequests(db, assignment);
  if (requests === null) return null;
  const asked = latestPerRequester(requests, itemId);
  if (asked.length === 0) return 0;
  const propertyName = await issuancePropertyNameOf(db, assignment.companyId, assignment.propertyId);
  const engaged = await Promise.all(asked.map(async (request) => ({ request, engagement: await activeRequester(db, assignment, request) })));
  const reachable = engaged.filter((entry): entry is { request: IssuanceDocumentRequest; engagement: IssuanceEngagement } => entry.engagement !== null);
  await Promise.all(reachable.map(({ request, engagement }) => announceDocumentProvided({
    assignment, propertyName, requestId: request.id, fileId, engagement,
  })));
  return reachable.length;
}

/** Μία γραμμή στο ιστορικό του ακινήτου: δόσιμο (`— → είδος`) ή ανάκληση (`είδος → —`), με το όνομα του αρχείου. */
async function recordProvision(db: Firestore, assignment: DocumentIssuanceAssignment, change: { readonly kind: 'shared' | 'unshared'; readonly itemId: string; readonly fileName: string | null; readonly uid: string }): Promise<void> {
  const fields = ISSUANCE_AUDIT_FIELDS[assignment.documentKind];
  if (fields === null) return;
  const shared = change.kind === 'shared';
  await EntityAuditService.recordChange({
    entityType: assignment.scope === 'property' ? 'property' : 'owner_property',
    entityId: assignment.propertyId,
    entityName: await issuancePropertyNameOf(db, assignment.companyId, assignment.propertyId),
    action: shared ? 'document_shared' : 'document_unshared',
    changes: [{
      field: fields.documentProvision,
      oldValue: shared ? null : change.itemId,
      newValue: shared ? change.itemId : null,
      ...(change.fileName === null ? {} : { label: change.fileName }),
    }],
    performedBy: change.uid,
    performedByName: null,
    companyId: assignment.companyId,
  });
}

/** Το αρχείο του κατόχου που μπορεί να δοθεί για αυτή την ανάθεση — ή η απόρριψη. */
async function givableFile(db: Firestore, assignment: DocumentIssuanceAssignment, fileId: string): Promise<IssuanceCatalogFile | 'not-found' | 'case-closed'> {
  if (issuanceStageOf(assignment) !== GIVING_STAGE) return 'case-closed';
  const container = await issuanceRequestContainerOf(db, assignment);
  if (container === null) return 'not-found';
  return (await issuanceCatalogFileOf(db, container, assignment.documentKind, fileId)) ?? 'not-found';
}

/** Το γραφείο **δίνει** το `fileId` (ανέβασμα ως απάντηση · ή υπάρχον) και ειδοποιεί όσους το ζήτησαν. */
export async function giveIssuanceDocument(db: Firestore, input: DocumentProvidedInput): Promise<DocumentProvidedResult> {
  const assignment = await hostedAssignment(db, input);
  if (!assignment) return { ok: false, rejection: 'not-found' };
  const file = await givableFile(db, assignment, input.fileId);
  if (file === 'not-found' || file === 'case-closed') return { ok: false, rejection: file };
  const { outcome } = await giveDocument(db, {
    companyId: assignment.companyId,
    subject: { kind: 'document_issuance', id: assignment.id },
    itemId: file.itemId,
    fileId: input.fileId,
    via: input.via,
    byUid: input.uid,
    nowIso: new Date(input.nowMs).toISOString(),
  });
  if (outcome === 'given') await recordProvision(db, assignment, { kind: 'shared', itemId: file.itemId, fileName: file.fileName, uid: input.uid });
  const notified = await notifyRequesters(db, assignment, file.itemId, input.fileId);
  if (notified === null) return { ok: false, rejection: 'unknown' };
  return { ok: true, outcome, notified };
}

/** Το γραφείο **ανακαλεί** ένα δόσιμο — από εκείνη τη στιγμή το αρχείο δεν ανοίγει για τον μηχανικό. */
export async function revokeIssuanceDocument(db: Firestore, input: ProvisionRevokeInput): Promise<ProvisionRevokeResult> {
  const assignment = await hostedAssignment(db, input);
  if (!assignment) return { ok: false, rejection: 'not-found' };
  const result = await revokeProvision(db, {
    companyId: assignment.companyId,
    subject: { kind: 'document_issuance', id: assignment.id },
    provisionId: input.provisionId,
    byUid: input.uid,
    nowIso: new Date(input.nowMs).toISOString(),
  });
  if (result.outcome === 'not-found') return { ok: false, rejection: 'not-found' };
  if (result.outcome === 'revoked') {
    const container = await issuanceRequestContainerOf(db, assignment);
    const file = container === null ? null : await issuanceCatalogFileOf(db, container, assignment.documentKind, result.provision.fileId);
    await recordProvision(db, assignment, { kind: 'unshared', itemId: result.provision.itemId, fileName: file?.fileName ?? null, uid: input.uid });
  }
  return { ok: true, outcome: result.outcome };
}
