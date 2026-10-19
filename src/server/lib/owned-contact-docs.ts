/**
 * 🏢 SSoT — μαζική ανάγνωση επαφών **του μισθωτή** (Admin SDK), σε ΕΝΑ round-trip.
 *
 * Ό,τι ζητήθηκε και δεν επιστρέφεται είναι **άγνωστο ή ξένο** — η απάντηση δεν τα ξεχωρίζει (ADR-742: ξένη ≡ ανύπαρκτη,
 * καμία μαρτυρία ύπαρξης). Τα πεδία τα διαβάζει ο καλών με τους αναγνώστες του `contact-doc-fields`
 * (π.χ. `extractContactDisplayName`) — εδώ ζει μόνο το «ποια έγγραφα και τίνος».
 *
 * 🔑 **Δύο αναγνώστες, ΕΝΑ κριτήριο**: χωρίς συναλλαγή (`db.getAll`) και **μέσα** σε συναλλαγή (`tx.getAll`, ADR-916 Φ-Β —
 * ο γραφέας της παράδοσης κρίνει το email του αγοραστή με την **ίδια** αλήθεια που γράφει). Το «τίνος» κρίνεται μία φορά.
 *
 * @module server/lib/owned-contact-docs
 */

import 'server-only';

import type { DocumentData, DocumentReference, DocumentSnapshot, Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';

type BatchReader = (...refs: DocumentReference[]) => Promise<DocumentSnapshot[]>;

async function readOwned(
  db: Firestore,
  getAll: BatchReader,
  companyId: string,
  contactIds: readonly string[],
): Promise<ReadonlyMap<string, DocumentData>> {
  const unique = [...new Set(contactIds)];
  if (unique.length === 0) return new Map();
  const collection = db.collection(COLLECTIONS.CONTACTS);
  const snapshots = await getAll(...unique.map((id) => collection.doc(id)));
  const owned = new Map<string, DocumentData>();
  for (const snapshot of snapshots) {
    const data = ownedOrNull(snapshot.data(), companyId, { resource: 'contact', resourceId: snapshot.id, path: 'owned-contact-docs' });
    if (data) owned.set(snapshot.id, data);
  }
  return owned;
}

/** Οι επαφές του μισθωτή ανά id — όσες υπάρχουν **και** του ανήκουν. Κενή είσοδος ⇒ καμία ανάγνωση. */
export function readOwnedContactDocs(
  db: Firestore,
  companyId: string,
  contactIds: readonly string[],
): Promise<ReadonlyMap<string, DocumentData>> {
  return readOwned(db, (...refs) => db.getAll(...refs), companyId, contactIds);
}

/** Το ίδιο, **μέσα** σε συναλλαγή του καλούντα — ανάγνωση συναλλαγής, άρα **πριν** από κάθε γραφή της. */
export function readOwnedContactDocsInTransaction(
  tx: Transaction,
  db: Firestore,
  companyId: string,
  contactIds: readonly string[],
): Promise<ReadonlyMap<string, DocumentData>> {
  return readOwned(db, (...refs) => tx.getAll(...refs), companyId, contactIds);
}
