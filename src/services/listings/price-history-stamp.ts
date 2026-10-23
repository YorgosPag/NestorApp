/**
 * @fileoverview **Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΤΙΜΗΣ** — γράφει στο ΑΚΙΝΗΤΟ, ποτέ στην προβολή.
 * @related ADR-777 §8.69 · lib/listings/price-history.ts · services/listings/property-history-stamp.ts
 * @module services/listings/price-history-stamp
 *
 * 🔑 **Η μηχανική ζει στο `property-history-stamp.ts`** (ADR-919 §10): συναλλαγή μόνο όταν αλλάζει κάτι,
 * δεύτερη ανάγνωση μέσα στη συναλλαγή, `update` όχι `set`, ποτέ εξαίρεση. Το ίδιο συμβόλαιο έχει και το
 * ιστορικό διαθεσιμότητας. Εδώ μένει μόνο η **κρίση** του πεδίου (`nextPriceHistory` / `readPriceHistory`).
 *
 * 🔒 **Κανένας πελάτης δεν γράφει εδώ**: το `priceHistory` **δεν** ανήκει στο
 * `isAllowedPropertyFieldUpdate` και το `owner_properties` έχει `allow update: if false`
 * (`firestore.rules`). Άγκυρα: `tests/firestore-rules/suites/properties.rules.test.ts`.
 */

import type { AdminFirestore } from '@/lib/api/guarded-route';
import { nextPriceHistory, readPriceHistory } from '@/lib/listings/price-history';
import type { PriceObservation } from '@/types/price-history';

import { resolvePropertyHistory, type PropertyHistoryPolicy } from './property-history-stamp';

const PRICE_HISTORY_POLICY: PropertyHistoryPolicy<PriceObservation, PriceObservation['price']> = {
  field: 'priceHistory',
  read: readPriceHistory,
  next: nextPriceHistory,
  failureMessage: 'Το ιστορικό τιμής ΔΕΝ γράφτηκε — η αγγελία δημοσιεύεται χωρίς σήμανση μείωσης',
};

/**
 * **Το ιστορικό τιμής όπως ισχύει ΜΕΤΑ από αυτό το πέρασμα** — ή `null` όταν η εγγραφή απέτυχε
 * (η αγγελία δημοσιεύεται **χωρίς** σήμανση μείωσης, που είναι αληθές).
 *
 * @param price Η κατάσταση αγοράς **τώρα** — από το `marketPriceOf`, με τον **έναν**
 *   κριτή δημοσίευσης (`isPubliclyListed`) ήδη ρωτημένο.
 * @param at Η στιγμή του περάσματος — η **ίδια** με το `projectedAt`.
 */
export async function resolvePriceHistory(
  adminDb: AdminFirestore,
  collectionName: string,
  docId: string,
  current: unknown,
  price: PriceObservation['price'],
  at: string,
): Promise<readonly PriceObservation[] | null> {
  return resolvePropertyHistory(adminDb, PRICE_HISTORY_POLICY, {
    collectionName,
    docId,
    current,
    observation: price,
    at,
  });
}
