import 'server-only';

/**
 * @fileoverview ADR-942 Φ2 (Ε4) — **πότε εκδόθηκε** τελευταία το έγγραφο μιας ανάθεσης: η ολοκλήρωσή της, όπως την ξέρει
 *   το **μητρώο** (ο ΕΝΑΣ αναγνώστης `readDocumentRegistry`, ίδιος με το γραφείο και το αίτημα νέας ημερομηνίας).
 * @module services/document-registry/issuance-latest-issued.server
 *
 * 🔑 «Δεν ξέρω» ≠ «δεν εκδόθηκε»: μητρώο χωρίς γνώση αναθέσεων ⇒ `'unknown'`, ώστε ο καλών να μην ανοίξει τίποτα από άγνοια.
 * 🔑 ADR-945 §7.5 — **ανά βιβλίο**: γραφείο ⇒ το μητρώο του (και για ακίνητο ιδιώτη υπό θεματοφυλακή του)· ιδιώτης ⇒ τα
 *    έγγραφα του ακινήτου του (`readOwnerPropertyDocuments`) με τον ΙΔΙΟ κανόνα «νεότερο `issuedOn`» (`latestIssuedOnOfDocuments`).
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { DocumentKind } from '@/config/document-validity/document-validity';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import { latestIssuedOnOfDocuments } from '@/lib/document-validity/issuance-rows';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { readDocumentRegistry } from './document-registry.service';
import { readOwnerPropertyDocuments } from './owner-property-documents.server';
import type { RegistryProperty } from './registry-properties.server';

export async function issuanceLatestIssuedOn(
  db: Firestore,
  assignment: Pick<DocumentIssuanceAssignment, 'companyId' | 'propertyId' | 'documentKind'>,
  now: Date,
): Promise<string | null | 'unknown'> {
  const registry = await readDocumentRegistry(db, assignment.companyId, now);
  if (!registry.issuanceKnown) return 'unknown';
  return registry.issuance[issuanceKeyOf(assignment.propertyId, assignment.documentKind)]?.latestIssuedOn ?? null;
}

/**
 * Τι ξέρουμε για το έγγραφο ενός υποκειμένου:
 * - `known` — το νεότερο `issuedOn` (`null` = κανένα έγγραφο του είδους)·
 * - `unknown` — ο κατάλογος αναθέσεων του γραφείου δεν διαβάστηκε τώρα (ποτέ πράξη από άγνοια)·
 * - `not-assignable` — στο μητρώο του γραφείου η γραμμή **δεν** ζητά ανάθεση (ίδια κρίση με την απευθείας ανάθεση §27).
 */
export type SubjectIssuance =
  | { readonly kind: 'known'; readonly latestIssuedOn: string | null }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'not-assignable' };

/** Το υποκείμενο όπως το έκρινε ο κριτής (`readUpkeepSubject`) — ακίνητο **και** βιβλίο, ποτέ από τον καλούντα. */
export interface IssuanceSubject {
  readonly property: RegistryProperty;
  readonly owner: CustodyScope;
}

export async function subjectLatestIssuedOn(db: Firestore, subject: IssuanceSubject, kind: DocumentKind, now: Date): Promise<SubjectIssuance> {
  const key = issuanceKeyOf(subject.property.id, kind);
  if (subject.owner.companyId !== undefined) {
    const registry = await readDocumentRegistry(db, subject.owner.companyId, now);
    if (!registry.issuanceKnown) return { kind: 'unknown' };
    const row = registry.issuance[key];
    return row === undefined ? { kind: 'not-assignable' } : { kind: 'known', latestIssuedOn: row.latestIssuedOn };
  }
  const documents = await readOwnerPropertyDocuments(db, subject);
  return { kind: 'known', latestIssuedOn: latestIssuedOnOfDocuments(documents).get(key) ?? null };
}
