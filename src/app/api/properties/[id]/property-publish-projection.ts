/**
 * Η δημόσια προβολή ενός ακινήτου, από τη μεριά του PATCH handler.
 *
 * Extracted from `route.ts` (N.7.1: API routes 300 lines) — και **όχι** στο
 * `property-patch-helpers.ts`, που δηλώνει ρητά *pure* helpers: αυτό εδώ γράφει σε
 * Firestore. Ένα αρχείο που υπόσχεται καθαρότητα και κρύβει I/O είναι υπόσχεση που
 * κανείς δεν μπορεί να επικαλεστεί.
 *
 * @module api/properties/[id]/property-publish-projection
 * @see ADR-777 Α3/Α5 — η προβολή ανάγνωσης της αγγελίας
 */

import type { AdminFirestore } from '@/lib/api/guarded-route';
import { createModuleLogger } from '@/lib/telemetry';
import { republishListing } from '@/services/listings/publish-public-listing';

const logger = createModuleLogger('PropertyPublishProjection');

/** Το σχήμα που περιμένει η προβολή — εξαγόμενο ώστε ο καλών να δηλώνει τη στένωσή του ρητά. */
export type ListingProperty = Parameters<typeof republishListing>[2];

/**
 * Ξαναγράφει τη δημόσια προβολή μετά από επιτυχημένη γραφή του κατόχου.
 *
 * ⚠️ **Awaited, ΟΧΙ fire-and-forget** — η διάκριση είναι σκόπιμη (N.7.2 #6): οι
 * ειδοποιήσεις, οι σύνδεσμοι και το ίχνος είναι *παρενέργειες*· αυτό είναι **τι βλέπει
 * ο κόσμος**. Ένας κάτοχος που πάτησε «αποθήκευση» και είδε επιτυχία δικαιούται η
 * αγγελία του να έχει ήδη αλλάξει όταν του απαντήσουμε.
 *
 * 🔑 **Δεν πετά ποτέ**: το `republishListing` επιστρέφει `'failed'` **ονομαστικά**. Η
 * αποτυχία της δημόσιας προβολής δεν ακυρώνει τη δουλειά του κατόχου — η γραφή του
 * **έγινε** ήδη. Η διαφορά ανάμεσα σε «*σιωπηλά μπαγιάτικο*» και «*γνωστά εκκρεμές*»
 * είναι ακριβώς αυτή η γραμμή στο ημερολόγιο.
 */
export async function republishPublicProjection(
  adminDb: AdminFirestore,
  id: string,
  property: ListingProperty,
): Promise<void> {
  const outcome = await republishListing(adminDb, id, property);
  if (outcome === 'failed') {
    logger.warn('Δημόσια προβολή εκκρεμής — θα διορθωθεί από την επανασύνθεση', { id });
  }
}
