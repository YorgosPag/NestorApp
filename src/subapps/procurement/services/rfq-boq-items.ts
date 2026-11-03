import 'server-only';

/**
 * **Τα στοιχεία επιμέτρησης που ζητά ένα RFQ** — το ένα ερώτημα και ο ένας φράχτης tenant (ADR-327 Q29 · ADR-923 §5.13 Τ4).
 *
 * 🔴 Γράφονταν **τρεις** φορές: στιγμιότυπο BOQ, προσυμπλήρωση builder, και τώρα η συναλλαγή του `createRfq`. Ο φράχτης
 *    `companyId` (CHECK 3.10) είναι το μέρος που ξεχνιέται σε ένα τρίτο αντίγραφο: εδώ δεν παραλείπεται.
 * Το ερώτημα επιστρέφεται **χωρίς** εκτέλεση, ώστε ο καλών να το τρέξει με `query.get()` ή μέσα στη συναλλαγή του (`tx.get`).
 *
 * @module subapps/procurement/services/rfq-boq-items
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { BOQItem } from '@/types/boq/boq';

import { RFQ_FROM_BOQ_MAX_ITEMS } from '../types/rfq';

/** Το ερώτημα `in` κατά id. Περισσότερα από το όριο τα απορρίπτουν τα σύνορα (zod)· εδώ είναι ο τελευταίος φρουρός. */
export function boqItemsByIdQuery(db: admin.firestore.Firestore, boqItemIds: readonly string[]): admin.firestore.Query {
  const ids = boqItemIds.slice(0, RFQ_FROM_BOQ_MAX_ITEMS);
  return db.collection(COLLECTIONS.BOQ_ITEMS).where(admin.firestore.FieldPath.documentId(), 'in', ids);
}

/** Μόνο τα στοιχεία **αυτού** του tenant: ξένο ≡ ανύπαρκτο. */
export function ownedBoqItems(snap: admin.firestore.QuerySnapshot, companyId: string): BOQItem[] {
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as BOQItem)
    .filter((item) => item.companyId === companyId);
}
