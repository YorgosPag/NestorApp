/**
 * @module services/ownership/verified-ownership.reader
 * @description **Ο ΕΝΑΣ αναγνώστης του «είναι επαληθευμένος ιδιοκτήτης;»** (ADR-900 §3.8).
 *
 * Το ρωτούν **δύο** καταναλωτές και πρέπει να απαντούν **το ίδιο**:
 * - το `/api/demand/interest` (το πάνελ του ιδιοκτήτη) — ανά ακίνητο, με θεατή·
 * - ο σαρωτής ειδοποιήσεων (`interest-notifier.service.ts`) — μαζικά, ανά πέρασμα.
 * Δύο ερωτήματα γραμμένα χωριστά θα απέκλιναν (π.χ. το ένα θα ξεχνούσε τον `uid`) και ο ίδιος
 * άνθρωπος θα έβλεπε «7» στο πάνελ και «τουλάχιστον 3» στο email.
 *
 * 🔑 **Επαληθευμένος = υπάρχει `verified` εγγραφή για ΑΥΤΟ το ακίνητο ΚΑΙ ΑΥΤΟΝ τον άνθρωπο.** Ο `uid`
 * δεν είναι διακοσμητικός: αν η αγγελία άλλαξε χέρια (ADR-866 Φ4), η απόδειξη του προηγούμενου
 * **δεν** μεταβιβάζεται.
 *
 * ⚠️ Αστοχία ανάγνωσης ⇒ **ρίχνει**. Ο καλών αποφασίζει· εδώ δεν μαντεύουμε «δηλωμένος» σιωπηλά.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { OwnershipVerification, OwnershipVerificationStatus } from '@/types/ownership-verification';

const VERIFIED: OwnershipVerificationStatus = 'verified';

/** Όριο του τελεστή `in` του Firestore. */
const IN_QUERY_LIMIT = 30;

/** Είναι ο `uid` αποδεδειγμένος κάτοχος του `ownerPropertyId`; */
export async function isVerifiedOwner(
  db: AdminFirestore,
  ownerPropertyId: string,
  uid: string,
): Promise<boolean> {
  const snap = await db
    .collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS)
    .where('uid', '==', uid)
    .where('ownerPropertyId', '==', ownerPropertyId)
    .where('status', '==', VERIFIED)
    .limit(1)
    .get();
  return !snap.empty;
}

/** Η **τελευταία** προσπάθεια του `uid` για αυτή την αγγελία (ό,τι δείχνει η κάρτα του ιδιοκτήτη), ή `null`. */
export async function readLatestVerification(
  db: AdminFirestore,
  ownerPropertyId: string,
  uid: string,
): Promise<OwnershipVerification | null> {
  const snap = await db
    .collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS)
    .where('uid', '==', uid)
    .where('ownerPropertyId', '==', ownerPropertyId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as OwnershipVerification);
}

/**
 * **Ποια από αυτά τα ακίνητα είναι επαληθευμένα στον κάτοχό τους** — η μαζική μορφή του
 * {@link isVerifiedOwner}, για τον σαρωτή. Επιστρέφει `ownerPropertyId`.
 *
 * @param holders — `ownerPropertyId → uid` του κατόχου (το `authorUserId` της αγγελίας)
 */
export async function verifiedOwnerPropertyIds(
  db: AdminFirestore,
  holders: ReadonlyMap<string, string>,
): Promise<ReadonlySet<string>> {
  const ids = [...holders.keys()];
  const verified = new Set<string>();
  for (let start = 0; start < ids.length; start += IN_QUERY_LIMIT) {
    const chunk = ids.slice(start, start + IN_QUERY_LIMIT);
    // tenant-scope-exempt: σαρωτής cron — «οι επαληθευμένες ΑΥΤΩΝ των ακινήτων», για κάθε κάτοχο εκ σχεδιασμού·
    // ο άξονας `uid` εφαρμόζεται αμέσως μετά, απέναντι στον κάτοχο της ΚΑΘΕ αγγελίας.
    const snap = await db
      .collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS)
      .where('ownerPropertyId', 'in', chunk)
      .where('status', '==', VERIFIED)
      .get();
    for (const doc of snap.docs) {
      const ownerPropertyId = doc.get('ownerPropertyId');
      const uid = doc.get('uid');
      if (typeof ownerPropertyId === 'string' && holders.get(ownerPropertyId) === uid) {
        verified.add(ownerPropertyId);
      }
    }
  }
  return verified;
}
