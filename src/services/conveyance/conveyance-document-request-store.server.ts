/**
 * =============================================================================
 * Τα αιτήματα εγγράφων μιας υπόθεσης μεταβίβασης — ο ΕΝΑΣ αναγνώστης της (ADR-901 Φ4.5 · ADR-942 Φ0)
 * =============================================================================
 *
 * Πάνω στον **γενικό** αναγνώστη (`server/document-requests/document-request-store.server.ts`), με μία προσθήκη που
 * ανήκει μόνο στη μεταβίβαση: ADR-915 §22 — αίτημα σε γραμμή πωλητή πριν από τις γραμμές ανά πρόσωπο ⇒ ανήκει στον
 * μοναδικό πωλητή.
 *
 * @module services/conveyance/conveyance-document-request-store.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { canonicalRowKey } from '@/lib/conveyance/case-rows';
import { readSubjectDocumentRequests } from '@/server/document-requests/document-request-store.server';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { ConveyanceDocumentRequest } from '@/types/conveyance-document-request';

/** Όλα τα αιτήματα της υπόθεσης, ή `null` αν η ανάγνωση απέτυχε («δεν ξέρω» ≠ «κανένα»). */
export async function readCaseDocumentRequests(
  db: Firestore,
  record: Pick<ConveyanceCase, 'id' | 'companyId' | 'parties'>,
): Promise<ConveyanceDocumentRequest[] | null> {
  const requests = await readSubjectDocumentRequests(db, { companyId: record.companyId, subject: { kind: 'conveyance_case', id: record.id } });
  return requests?.map((request) => ({ ...request, itemId: canonicalRowKey(request.itemId, record.parties) })) ?? null;
}
