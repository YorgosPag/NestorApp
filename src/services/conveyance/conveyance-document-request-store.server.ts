/**
 * =============================================================================
 * Τα αιτήματα εγγράφων μιας υπόθεσης — ο ΕΝΑΣ αναγνώστης (ADR-901 Φ4.5)
 * =============================================================================
 *
 * Ερώτημα **μόνο ισότητες** με `companyId` πρώτο (CHECK 3.35) ⇒ κανένας σύνθετος δείκτης (CHECK 3.91). Κάθε έγγραφο
 * περνά από το σχήμα (`parseDocumentRequest`): μη αναγνώσιμο ⇒ παραλείπεται **και** αναφέρεται.
 *
 * @module services/conveyance/conveyance-document-request-store.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { parseDocumentRequest } from '@/lib/conveyance/document-request-schema';
import { createModuleLogger } from '@/lib/telemetry';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { ConveyanceDocumentRequest } from '@/types/conveyance-document-request';

const logger = createModuleLogger('conveyance-document-request-store');

export function documentRequestsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.CONVEYANCE_DOCUMENT_REQUESTS);
}

/** Όλα τα αιτήματα της υπόθεσης, ή `null` αν η ανάγνωση απέτυχε («δεν ξέρω» ≠ «κανένα»). */
export async function readCaseDocumentRequests(
  db: Firestore,
  record: Pick<ConveyanceCase, 'id' | 'companyId'>,
): Promise<ConveyanceDocumentRequest[] | null> {
  try {
    const snapshot = await documentRequestsCollection(db)
      .where('companyId', '==', record.companyId)
      .where('caseId', '==', record.id)
      .get();
    return snapshot.docs.flatMap((doc) => {
      const parsed = parseDocumentRequest(doc.data());
      if (!parsed) logger.warn('Μη αναγνώσιμο αίτημα εγγράφου — παραλείφθηκε', { requestId: doc.id });
      return parsed ? [parsed] : [];
    });
  } catch (error) {
    logger.error('Τα αιτήματα εγγράφων δεν διαβάστηκαν', { caseId: record.id, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
