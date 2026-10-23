/**
 * @fileoverview **Η ΣΦΡΑΓΙΔΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ**: γράφει στο ΑΚΙΝΗΤΟ, ποτέ στην προβολή.
 * @related ADR-919 §10 · ADR-777 §8.99.4 (Δ3) · lib/listings/availability-history.ts · property-history-stamp.ts
 * @module services/listings/availability-history-stamp
 *
 * 🔑 **Δίδυμο του `price-history-stamp.ts`, ΟΧΙ αντίγραφό του**: η μηχανική (CAS, μηδέν κόστος, ποτέ εξαίρεση)
 * ζει στο `property-history-stamp.ts`. Εδώ δηλώνεται μόνο η κρίση του πεδίου.
 *
 * ⛔ **Η είσοδος είναι η ΔΗΜΟΣΙΑ τιμή** (`publicAvailabilityOf(listingAvailabilityOf(…), isPubliclyListed(…))`),
 * ποτέ φάσεις, πρόβλεψη ή `completionDate` (ADR-777 §8.99.4 «Ιδιωτικότητα»).
 *
 * 🔒 **Κανένας πελάτης δεν γράφει εδώ**: το `availabilityHistory` **δεν** ανήκει στο `isAllowedPropertyFieldUpdate`
 * (deny-by-default) και το `owner_properties` έχει `allow update: if false`. Άγκυρα:
 * `tests/firestore-rules/suites/properties.rules.test.ts`.
 */

import type { AdminFirestore } from '@/lib/api/guarded-route';
import { nextAvailabilityHistory, readAvailabilityHistory } from '@/lib/listings/availability-history';
import type { AvailabilityObservation } from '@/types/availability-history';
import type { ListingAvailability } from '@/types/listing-availability';

import { resolvePropertyHistory, type PropertyHistoryPolicy } from './property-history-stamp';

const AVAILABILITY_HISTORY_POLICY: PropertyHistoryPolicy<AvailabilityObservation, ListingAvailability | null> = {
  field: 'availabilityHistory',
  read: readAvailabilityHistory,
  next: nextAvailabilityHistory,
  failureMessage: 'Το ιστορικό διαθεσιμότητας ΔΕΝ γράφτηκε — η αγγελία δημοσιεύεται χωρίς ιστορία μεταθέσεων',
};

/**
 * **Το ιστορικό διαθεσιμότητας όπως ισχύει ΜΕΤΑ από αυτό το πέρασμα**, ή `null` όταν η εγγραφή απέτυχε (τότε η
 * αγγελία δημοσιεύεται **χωρίς** ιστορία, που είναι αληθές).
 *
 * @param availability Η δημόσια τιμή **τώρα**, ή `null` όταν η αγγελία δεν είναι δημόσια (τίποτα προς καταγραφή).
 */
export async function resolveAvailabilityHistory(
  adminDb: AdminFirestore,
  collectionName: string,
  docId: string,
  current: unknown,
  availability: ListingAvailability | null,
  at: string,
): Promise<readonly AvailabilityObservation[] | null> {
  return resolvePropertyHistory(adminDb, AVAILABILITY_HISTORY_POLICY, {
    collectionName,
    docId,
    current,
    observation: availability,
    at,
  });
}
