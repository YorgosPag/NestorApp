/**
 * @fileoverview **ΤΟ ΕΝΑ ΣΥΝΟΡΟ** — έγγραφο Firestore → {@link PublicListing}.
 * @related ADR-839 · lib/listings/public-listing-schema.ts · ADR-777 Α3
 * @module lib/listings/public-listing-from-document
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΡΕΙΣ ΙΣΧΥΡΙΣΜΟΙ, ΚΑΝΕΝΑΣ ΚΡΙΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι το ADR-839 η ίδια πράξη γινόταν σε **τρία** σημεία, και στα τρία με ωμό
 * ισχυρισμό τύπου:
 *
 * ```
 * usePublicListings.ts:57      doc.data() as PublicListing        (client, λίστα)
 * usePublicListings.ts:141     snapshot.data() as PublicListing   (client, ένα)
 * mandate-inbox.service.ts:243 ...(data as PublicListing)         (ADMIN, server)
 * ```
 *
 * Ένα `as` δεν είναι έλεγχος — είναι **εντολή στον μεταγλωττιστή να πάψει να
 * ρωτά**. Ο τύπος υποσχόταν 18 πεδία· η βάση έδινε 15· κανείς δεν συνέκρινε. Το
 * αποτέλεσμα ήταν λευκή οθόνη στην παραγωγή (δες την κεφαλίδα του
 * `public-listing-schema.ts`).
 *
 * 🔑 **ΓΙΑΤΙ ΚΑΘΑΡΗ ΣΥΝΑΡΤΗΣΗ ΚΑΙ ΟΧΙ `withConverter`.** Το ιδίωμα του έργου για
 * σύνορα Firestore είναι ο {@link FirestoreDataConverter} (`lib/firestore/utils.ts:9`),
 * και ήταν η πρώτη σκέψη. **Δεν αρκεί**: ο τρίτος καταναλωτής τρέχει σε **Admin
 * SDK** (`firebase-admin/firestore`), που είναι άλλη βιβλιοθήκη με άλλον τύπο
 * converter. Ένας converter εδώ θα κάλυπτε τα δύο από τα τρία σημεία και θα άφηνε
 * το τρίτο με το `as` — δηλαδή θα γεννούσε **δεύτερο** κριτή για την ίδια ερώτηση,
 * ελεύθερο να αποκλίνει (ADR-749). Η καθαρή συνάρτηση απαντά και στους τρεις.
 *
 * ⚠️ **ΕΔΩ ΖΕΙ Ο ΜΟΝΑΔΙΚΟΣ ΕΠΙΤΡΕΠΟΜΕΝΟΣ ΙΣΧΥΡΙΣΜΟΣ.** Το CHECK 3.74 απαγορεύει
 * `as PublicListing` οπουδήποτε αλλού. Δεν εξαφανίστηκε ο ισχυρισμός — **μαζεύτηκε
 * σε ένα σημείο που έχει άγκυρες, τεκμηρίωση και πύλη**, αντί για τρία που δεν
 * είχαν τίποτα.
 */

import type { PublicListing } from '@/types/public-listing';

import {
  PUBLIC_LISTING_SCHEMA_VERSION,
  storedSchemaVersion,
  upgradeListingDocument,
  type StoredListingDocument,
} from './public-listing-schema';

/** Τι διαβάστηκε, **και τι χρειάστηκε για να διαβαστεί**. */
export interface StoredListingRead {
  readonly listing: PublicListing;
  /**
   * Η έκδοση **όπως βρέθηκε στη βάση** — πριν την αναβάθμιση.
   *
   * 🔑 **Δεν είναι διαγνωστικό στολίδι.** Είναι ο μόνος τρόπος να μάθουμε ότι
   * εκκρεμεί επανασύνθεση: ο επισκέπτης βλέπει ήδη σωστά (η μετάφραση έγινε στη
   * μνήμη), οπότε **τίποτα δεν πονάει** και τίποτα δεν θα το φανερώσει αλλιώς.
   * Ο καταναλωτής που τη βλέπει παλαιότερη οφείλει να το **καταγράψει**.
   */
  readonly storedVersion: number;
  /** `true` όταν το έγγραφο της βάσης είναι πίσω από τον σημερινό γραφέα. */
  readonly needsRebuild: boolean;
}

/**
 * **Διαβάζει ένα αποθηκευμένο έγγραφο ως αγγελία** — ή απαντά `null`.
 *
 * `null` σημαίνει **«αυτό δεν είναι αγγελία»**, και συμβαίνει σε ακριβώς μία
 * περίπτωση: τα δεδομένα δεν είναι καν αντικείμενο. Δεν επιστρέφεται `null` για
 * ελλιπή πεδία — αυτά τα **γεμίζει** η αλυσίδα, γιατί μια αγγελία που έχασε ένα
 * πεδίο εξακολουθεί να είναι αγγελία και ο επισκέπτης δικαιούται να τη δει.
 *
 * ⚠️ **Η ΤΑΥΤΟΤΗΤΑ ΕΡΧΕΤΑΙ ΑΠΟ ΕΞΩ, ΚΑΙ ΝΙΚΑ.** Το `id` του **εγγράφου** είναι η
 * αυθεντία, ποτέ ένα `id` γραμμένο μέσα στο περιεχόμενο: το δεύτερο είναι
 * αντίγραφο που μπορεί να αποκλίνει, και ήδη ένας από τους τρεις καταναλωτές
 * (`mandate-inbox`) το επέβαλλε χειροκίνητα ακριβώς γι' αυτόν τον λόγο.
 */
export function readStoredListing(raw: unknown, id: string): StoredListingRead | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const stored = raw as StoredListingDocument;
  const storedVersion = storedSchemaVersion(stored);
  const upgraded = upgradeListingDocument(stored);

  return {
    // 🔴 Ο ΕΝΑΣ ισχυρισμός — δες την κεφαλίδα. Η αλυσίδα μόλις εγγυήθηκε ότι κάθε
    //    πεδίο της τρέχουσας έκδοσης υπάρχει, και το CHECK 3.74 εγγυάται ότι η
    //    αλυσίδα δεν ξέχασε κανένα.
    listing: { ...upgraded, id } as PublicListing,
    storedVersion,
    needsRebuild: storedVersion < PUBLIC_LISTING_SCHEMA_VERSION,
  };
}

/**
 * Η ίδια πράξη όταν ο καταναλωτής **δεν** έχει τι να κάνει με τη διάγνωση.
 *
 * Λεπτό περιτύλιγμα, ώστε η συνηθισμένη κλήση να μη σέρνει πεδία που θα αγνοούσε —
 * και **ποτέ** δεύτερη υλοποίηση: delegate, όχι αντίγραφο.
 */
export function publicListingFromDocument(raw: unknown, id: string): PublicListing | null {
  return readStoredListing(raw, id)?.listing ?? null;
}
