/**
 * @fileoverview **Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΤΙΜΗΣ** — γράφει στο ΑΚΙΝΗΤΟ, ποτέ στην προβολή.
 * @related ADR-777 §8.69 · lib/listings/price-history.ts · services/listings/listed-at-stamp.ts
 * @module services/listings/price-history-stamp
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΙΔΙΟ ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΟ `listed-at-stamp.ts` — και για τους ίδιους λόγους
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κανόνας | Γιατί |
 * |---|---|
 * | Γράφει στο `properties` / `owner_properties` | η απόσυρση **σβήνει** την προβολή· το ιστορικό δεν επιτρέπεται να σβήνεται μαζί |
 * | Η απόφαση ζει εδώ, ο καλών δίνει μόνο **διεύθυνση** | δύο συλλογές δεν επιτρέπεται να αποκλίνουν στο *πότε* καταγράφουν |
 * | Συναλλαγή **μόνο** όταν αλλάζει κάτι | αποθήκευση που δεν άγγιξε τιμή δεν πληρώνει τίποτα |
 * | Δεύτερη ανάγνωση **μέσα** στη συναλλαγή | δύο ταυτόχρονα περάσματα δεν γράφουν δύο παρατηρήσεις |
 * | **Δεν πετά ποτέ** | η αποτυχία του ιστορικού δεν ακυρώνει τη δημοσίευση |
 *
 * 🔒 **Κανένας πελάτης δεν γράφει εδώ**: το `priceHistory` **δεν** ανήκει στο
 * `isAllowedPropertyFieldUpdate` και το `owner_properties` έχει `allow update: if false`
 * (`firestore.rules`). Άγκυρα: `tests/firestore-rules/suites/properties.rules.test.ts`.
 */

import { createModuleLogger } from '@/lib/telemetry';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { nextPriceHistory, readPriceHistory } from '@/lib/listings/price-history';
import type { PriceObservation } from '@/types/price-history';

const logger = createModuleLogger('PriceHistoryStamp');

/**
 * **Το ιστορικό τιμής όπως ισχύει ΜΕΤΑ από αυτό το πέρασμα** — διαβάζοντας ή, όταν
 * άλλαξε η κατάσταση αγοράς, γράφοντας.
 *
 * @param current Ό,τι κουβαλά **ήδη** το έγγραφο πηγής (ωμό, από τη βάση).
 * @param price Η κατάσταση αγοράς **τώρα** — από το `marketPriceOf`, με τον **έναν**
 *   κριτή δημοσίευσης (`isPubliclyListed`) ήδη ρωτημένο.
 * @param at Η στιγμή του περάσματος — η **ίδια** με το `projectedAt`, ώστε η μείωση να
 *   μη λέει ότι ίσχυσε πριν ή μετά από την προβολή που την περιέχει.
 *
 * @returns Το ιστορικό προς προβολή — ή **`null` όταν η εγγραφή απέτυχε**.
 *   ⚠️ **`null` και ΟΧΙ το παλιό ιστορικό**: το παλιό **δεν** περιέχει την τρέχουσα τιμή,
 *   και μια μείωση υπολογισμένη πάνω του θα έλεγε ψέματα για το ποσό. Με `null` η
 *   αγγελία δημοσιεύεται **χωρίς** σήμανση μείωσης, που είναι αληθές.
 */
export async function resolvePriceHistory(
  adminDb: AdminFirestore,
  collectionName: string,
  docId: string,
  current: unknown,
  price: PriceObservation['price'],
  at: string,
): Promise<readonly PriceObservation[] | null> {
  const existing = readPriceHistory(current);
  if (nextPriceHistory(existing, price, at) === null) return existing;

  const ref = adminDb.collection(collectionName).doc(docId);

  try {
    return await adminDb.runTransaction<readonly PriceObservation[]>(async (transaction) => {
      // 🔴 **Η ΔΕΥΤΕΡΗ ΑΝΑΓΝΩΣΗ ΕΙΝΑΙ ΤΟ CAS** — ίδιο ιδίωμα με το `resolveListedAt`.
      //    Το `current` διαβάστηκε **έξω** από τη συναλλαγή· αν άλλο πέρασμα κατέγραψε
      //    ήδη την ίδια τιμή, το `nextPriceHistory` εδώ μέσα απαντά «καμία αλλαγή» και
      //    δεν γράφεται δεύτερη παρατήρηση.
      const snapshot = await transaction.get(ref);
      const winner = readPriceHistory(snapshot.data()?.priceHistory);
      const next = nextPriceHistory(winner, price, at);
      if (next === null) return winner;

      // ⚠️ **`update`, ΟΧΙ `set`** — ένα πεδίο σε έγγραφο που ήδη υπάρχει. Ένα `set` με
      //    merge θα **δημιουργούσε** έγγραφο για ακίνητο που διαγράφηκε στη μέση.
      transaction.update(ref, { priceHistory: next });
      return next;
    });
  } catch (error) {
    logger.error('Το ιστορικό τιμής ΔΕΝ γράφτηκε — η αγγελία δημοσιεύεται χωρίς σήμανση μείωσης', {
      collection: collectionName,
      docId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
