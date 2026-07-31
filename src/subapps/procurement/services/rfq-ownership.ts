/**
 * «Αυτό το RFQ — αν είναι δικό μου»: ο ένας φορτωτής του RFQ
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (N.0.2 · CHECK 3.28 · ADR-742 Ομάδα 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το RFQ φορτώνεται με έλεγχο ιδιοκτησίας από **τρία** αρχεία:
 *
 * | Αρχείο | Πού |
 * |---|---|
 * | `rfq-service` | `updateRfq` |
 * | `rfq-lifecycle-service` | `cancelRfq`, `reopenRfq` |
 * | `rfq-line-service` | ο γονέας κάθε πράξης σε γραμμή (4 σημεία) |
 *
 * Το `jscpd` τα μετρούσε ως κλώνους **και μέσα** στο `rfq-lifecycle-service`
 * **και ανάμεσα** σε αυτό και το `rfq-service`. Ένας φορτωτής ανά αρχείο θα
 * ήταν τρία μικρότερα δίδυμα — και το ζητούμενο είναι ότι το **όνομα του
 * πόρου** (`'RFQ'`) και η **σειρά των βημάτων** δεν επιτρέπεται να αποκλίνουν:
 * το όνομα μπαίνει αυτούσιο στο γνήσιο «δεν βρέθηκε» και άρα **και** στο
 * μεταμφιεσμένο (ADR-742 §7.1).
 *
 * @module subapps/procurement/services/rfq-ownership
 * @see ./procurement-owned-doc · ADR-742 §3.3, §3.4
 */

import 'server-only';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  PROCUREMENT_RESOURCE,
  loadOwnedProcurementDoc,
  type OwnedProcurementDoc,
} from './procurement-owned-doc';

/** Ο πόρος «RFQ» — ένα σημείο για όλο το πεδίο ορισμού. */
export const rfqSubject = (rfqId: string) =>
  ({ resource: PROCUREMENT_RESOURCE.RFQ, resourceId: rfqId }) as const;

/** Η αναφορά του RFQ — μία γραφή αντί για επτά. */
export const rfqRef = (db: FirebaseFirestore.Firestore, rfqId: string) =>
  db.collection(COLLECTIONS.RFQS).doc(rfqId);

/**
 * Φόρτωσε το RFQ και βεβαιώσου ότι ανήκει στον καλούντα.
 *
 * Ρίχνει `ProcurementNotFoundError` (δεν υπάρχει) ή
 * `ProcurementCrossTenantError` (ανήκει αλλού) — τυποποιημένα, ώστε το σύνορο
 * HTTP να κρίνει τι φεύγει στο σύρμα χωρίς να διαβάσει ποτέ κείμενο.
 */
export function loadOwnedRfq<T>(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  rfqId: string,
): Promise<OwnedProcurementDoc<T>> {
  return loadOwnedProcurementDoc<T>(rfqRef(db, rfqId), companyId, rfqSubject(rfqId));
}

/**
 * Ο γονέας φυλάει το παιδί: κάθε πράξη σε **γραμμή** RFQ περνά πρώτα από την
 * ιδιοκτησία του RFQ, γιατί οι γραμμές ζουν σε υποσυλλογή του.
 *
 * ⚠️ Το `rfq-line-service` έγραφε `(snap.data() as { companyId: string }).companyId`
 * — **ο τύπος υπόσχεται, η βάση δεν εγγυάται** (ADR-742 §7.5). Με σκέτο `!==`,
 * καλών με χαλασμένο token (`companyId: ''`) περνούσε σε κάθε RFQ με κενό/απόν
 * `companyId`.
 */
export async function assertOwnedRfq(
  db: FirebaseFirestore.Firestore,
  rfqId: string,
  companyId: string,
): Promise<void> {
  await loadOwnedRfq(db, companyId, rfqId);
}
