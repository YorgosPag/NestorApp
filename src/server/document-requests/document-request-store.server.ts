/**
 * =============================================================================
 * Τα αιτήματα εγγράφων μιας υπόθεσης — η ΜΙΑ συλλογή και ο ΕΝΑΣ αναγνώστης (ADR-942 Φ0)
 * =============================================================================
 *
 * Ερώτημα **μόνο ισότητες** με `companyId` πρώτο (CHECK 3.35) ⇒ κανένας σύνθετος δείκτης (CHECK 3.91). Κάθε έγγραφο
 * περνά από τον αναλυτή **του είδους** (`parseDocumentRequest`): μη αναγνώσιμο ⇒ παραλείπεται **και** αναφέρεται.
 *
 * @module server/document-requests/document-request-store.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { parseDocumentRequest, type RequestRoleOf } from '@/lib/document-requests/document-request-schema';
import { createModuleLogger } from '@/lib/telemetry';
import type { DocumentRequestSubject, StoredDocumentRequest } from '@/types/document-request';
import type { EngagementSubjectKind } from '@/types/engagement';

const logger = createModuleLogger('document-request-store');

export function documentRequestsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.DOCUMENT_REQUESTS);
}

/** Ποια υπόθεση, σε ποιον μισθωτή — το είδος στενεύει τον τύπο του αποτελέσματος. */
export interface DocumentRequestScope<K extends EngagementSubjectKind> {
  readonly companyId: string;
  readonly subject: DocumentRequestSubject & { readonly kind: K };
}

/** Όλα τα αιτήματα της υπόθεσης, ή `null` αν η ανάγνωση απέτυχε («δεν ξέρω» ≠ «κανένα»). */
export async function readSubjectDocumentRequests<K extends EngagementSubjectKind>(
  db: Firestore,
  scope: DocumentRequestScope<K>,
): Promise<StoredDocumentRequest<RequestRoleOf<K>>[] | null> {
  try {
    const snapshot = await documentRequestsCollection(db)
      .where('companyId', '==', scope.companyId)
      .where('subject.kind', '==', scope.subject.kind)
      .where('subject.id', '==', scope.subject.id)
      .get();
    return snapshot.docs.flatMap((doc) => {
      const parsed = parseDocumentRequest(scope.subject.kind, doc.data());
      if (!parsed) logger.warn('Μη αναγνώσιμο αίτημα εγγράφου — παραλείφθηκε', { requestId: doc.id });
      return parsed ? [parsed] : [];
    });
  } catch (error) {
    logger.error('Τα αιτήματα εγγράφων δεν διαβάστηκαν', {
      subjectKind: scope.subject.kind,
      subjectId: scope.subject.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
