/**
 * @fileoverview **Η ΑΝΑΓΝΩΣΗ ΤΩΝ ΖΩΝΤΑΝΩΝ ΑΓΓΕΛΙΩΝ** — ο καθρέφτης του
 * `live-demands.reader.ts`, για την αντίθετη κατεύθυνση.
 * @related ADR-777 §7 (Α3 · Α9) · CHECK 3.74 (σύνορο ανάγνωσης αγγελίας) · N.18
 * @module services/listings/live-public-listings.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ — **ίδιο σχήμα με το `live-demands.reader.ts`, άλλη πλευρά**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ειδοποιητής «βγήκε αγγελία που ταιριάζει στη ζήτησή σου» χρειάζεται **όλες** τις
 * ζωντανές αγγελίες για να τις περάσει από τη μηχανή ταιριάσματος, πάνω από **κάθε**
 * μισθωτή — ακριβώς όπως ο σαρωτής ζητήσεων χρειάζεται όλες τις ζωντανές ζητήσεις. Το
 * να γραφτεί η ίδια ανάγνωση δεύτερη φορά μέσα στον καταναλωτή θα ήταν sibling clone
 * (N.18) και θα ξεχνούσε εύκολα το όριο ή τη μετατροπή.
 *
 * 🔴 **ΥΠΟΧΡΕΩΤΙΚΟ ΣΥΝΟΡΟ (CHECK 3.74, zero-tolerance).** Κάθε έγγραφο περνάει από
 * {@link publicListingFromDocument} — τον **μοναδικό** επιτρεπόμενο ισχυρισμό
 * `PublicListing` σε όλο το repo. `as PublicListing` εδώ θα έσπαγε την πύλη.
 *
 * **Layering**: service — Admin SDK μόνο. Η **κρίση** (ταίριασμα) ζει στο `lib/demand/`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicListing } from '@/types/public-listing';

const logger = createModuleLogger('listings/live-public-listings');

/**
 * 🔴 **Το ανώτατο πλήθος αγγελιών που διαβάζονται σε ένα πέρασμα.**
 *
 * Ίδια τιμή και ίδιο σκεπτικό με το `MAX_DEMAND_CANDIDATES`
 * (`live-demands.reader.ts`): το ταίριασμα είναι τομή ευρών στη μνήμη, όχι ερώτημα
 * Firestore, άρα χρειάζεται ρητό άνω όριο ορατό στην κλήση.
 */
export const MAX_LIVE_LISTINGS = 2_000;

/** Τι διαβάστηκε, **και αν ο αριθμός είναι πλήρης ή κάτω φράγμα**. */
export interface LiveListingPool {
  readonly listings: readonly PublicListing[];
  /** `true` όταν αγγίχθηκε το όριο ⇒ **δεν εξετάστηκαν όλες οι αγγελίες**. */
  readonly truncated: boolean;
}

/**
 * **Όλες οι ζωντανές αγγελίες, πάνω από κάθε μισθωτή.**
 *
 * ⚠️ **Χωρίς `where()` και χωρίς `orderBy`, και είναι απόφαση.** Η ύπαρξη του
 * εγγράφου στο `public_listings` **είναι** το «ζωντανή»: η προβολή γράφεται μόνο για
 * δημοσιευμένες αγγελίες και διαγράφεται με την απόσυρση
 * (`tenant-config.ts` → `published-projection`) — δεν υπάρχει δεύτερη κατάσταση να
 * φιλτραριστεί. Ένα `where()` εδώ θα ήταν ερώτημα σε πεδίο που δεν υπάρχει.
 *
 * @param label — ποιος ρωτά· μπαίνει στο ημερολόγιο ώστε ένα αγγιγμένο όριο να
 *   αποδίδεται στη διαδρομή που το αγγίζει
 */
export async function readLivePublicListings(
  db: AdminFirestore,
  label: string,
): Promise<LiveListingPool> {
  // tenant-scope-exempt: το `public_listings` είναι `mode: 'none'`
  // (`unscopedCategory: 'published-projection'`) — δημοσιευμένη προβολή χωρίς καμία
  // ταυτότητα πελάτη μέσα στο σχήμα της. Η απομόνωση επιτυγχάνεται με ΤΟ ΤΙ ΓΡΑΦΕΤΑΙ
  // στο έγγραφο, όχι με φίλτρο ανάγνωσης — άρα μια σάρωση πάνω από όλους τους
  // μισθωτές είναι ακριβώς η πρόθεση, ίδιο σκεπτικό με το `live-demands.reader.ts:68`.
  const snapshot = await db
    .collection(COLLECTIONS.PUBLIC_LISTINGS)
    .limit(MAX_LIVE_LISTINGS)
    .get();

  const listings: PublicListing[] = [];
  for (const doc of snapshot.docs) {
    // 🔴 CHECK 3.74 — ο μοναδικός επιτρεπόμενος ισχυρισμός `PublicListing` ζει ΜΕΣΑ
    // στο `publicListingFromDocument`, ποτέ εδώ.
    const listing = publicListingFromDocument(doc.data(), doc.id);
    if (listing !== null) listings.push(listing);
  }

  const truncated = snapshot.docs.length === MAX_LIVE_LISTINGS;

  if (truncated) {
    logger.warn('Το όριο αγγελιών αγγίχθηκε — ο αριθμός είναι κάτω φράγμα', {
      data: { limit: String(MAX_LIVE_LISTINGS), caller: label },
    });
  }

  return { listings, truncated };
}
