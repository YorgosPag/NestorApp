import 'server-only';

/**
 * @fileoverview ADR-942 Φ2 (Ε4) — **πότε εκδόθηκε** τελευταία το έγγραφο μιας ανάθεσης: η ολοκλήρωσή της, όπως την ξέρει
 *   το **μητρώο** (ο ΕΝΑΣ αναγνώστης `readDocumentRegistry`, ίδιος με το γραφείο και το αίτημα νέας ημερομηνίας).
 * @module services/document-registry/issuance-latest-issued.server
 *
 * 🔑 «Δεν ξέρω» ≠ «δεν εκδόθηκε»: μητρώο χωρίς γνώση αναθέσεων ⇒ `'unknown'`, ώστε ο καλών να μην ανοίξει τίποτα από άγνοια.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { readDocumentRegistry } from './document-registry.service';

export async function issuanceLatestIssuedOn(
  db: Firestore,
  assignment: Pick<DocumentIssuanceAssignment, 'companyId' | 'propertyId' | 'documentKind'>,
  now: Date,
): Promise<string | null | 'unknown'> {
  const registry = await readDocumentRegistry(db, assignment.companyId, now);
  if (!registry.issuanceKnown) return 'unknown';
  return registry.issuance[issuanceKeyOf(assignment.propertyId, assignment.documentKind)]?.latestIssuedOn ?? null;
}
