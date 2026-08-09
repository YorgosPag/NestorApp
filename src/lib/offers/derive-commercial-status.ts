/**
 * =============================================================================
 * SSoT: ΠΑΡΑΓΩΓΗ κατάστασης από ΔΙΑΘΕΣΕΙΣ — ADR-777 Α20
 * =============================================================================
 *
 * Το `commercialStatus` παύει να είναι **δήλωση** και γίνεται **ΠΑΡΑΓΟΜΕΝΟ** από
 * τις διαθέσεις. Δεν σβήνει και δεν μεταναστεύει κανείς αναγνώστης: κάθε badge,
 * κάθε φίλτρο, κάθε κανόνας Firestore συνεχίζει να διαβάζει το ίδιο πεδίο με τις
 * **ίδιες επτά** τιμές.
 *
 * ## Γιατί παραγόμενο και όχι δεύτερο πεδίο δίπλα
 *
 * - **Revit**: παράμετρος read-only *«cannot be modified»*, γιατί *«some
 *   parameters hold values that are **driven by other constraints** built into
 *   the BIM»* ⇒ αλλάζεις **ό,τι την οδηγεί**, όχι αυτήν.
 * - **DDD**: κάθε πράξη περνά από το aggregate root· ένα derived πεδίο που
 *   γράφεται απ' έξω **παρακάμπτει** την επιβολή του invariant.
 * - Δύο εγγράψιμα πεδία για το ίδιο γεγονός = **δύο αλήθειες** — ακριβώς το
 *   σχήμα που κυνηγά το ADR-749.
 *
 * ## 🔴 Η ΠΡΟΒΟΛΗ ΕΙΝΑΙ LOSSY, ΚΑΙ ΤΟ ΛΕΕΙ
 *
 * Το `COMMERCIAL_STATUSES` έχει **επτά** τιμές και **καμία δεν σημαίνει
 * αντιπαροχή** — και η Α20 απαγορεύει ρητά όγδοη (combinatorial explosion:
 * 3 → 7 listed τιμές). Άρα μια διάθεση `exchange` **δεν έχει πού να προβληθεί**.
 *
 * **Η απόφαση: προβάλλεται σε `unavailable`, ρητά και με όνομα**
 * ({@link EXCHANGE_HAS_NO_LEGACY_PROJECTION}). Δηλαδή το παλιό λεξιλόγιο λέει
 * *«δεν είναι στην αγορά **που εγώ ξέρω**»* — που είναι **αληθές**, αντί να πει
 * «προς πώληση» που θα ήταν **ψέμα στην οθόνη** (η αντιπαροχή δεν έχει τιμή· θα
 * εμφανιζόταν ως πώληση χωρίς ποσό).
 *
 * ⚠️ **Η αντιπαροχή ΔΕΝ εξαφανίζεται** — γίνεται ορατή από τον **νέο άξονα**:
 * το denormalized `offerKinds` την κουβαλά, και το `firestore.rules` αποκτά
 * σκέλος `offerKinds.hasAny([...])`. Η **αλήθεια** ζει στις διαθέσεις· το
 * `commercialStatus` είναι **προβολή σε λεξιλόγιο που δεν έχει τη λέξη**.
 *
 * @module lib/offers/derive-commercial-status
 * @enterprise ADR-777 Α20
 */

import type { CommercialStatus } from '@/constants/commercial-statuses';
import {
  isLiveOffer,
  type OfferKind,
  type PropertyOffer,
} from '@/types/property-offers';

// =============================================================================
// 1. ΔΗΛΩΜΕΝΑ ΟΡΙΑ ΤΗΣ ΠΡΟΒΟΛΗΣ
// =============================================================================

/**
 * Τα είδη διάθεσης που **δεν έχουν** αντίστοιχο στο `COMMERCIAL_STATUSES`.
 *
 * Υπάρχει ως **ονομασμένη σταθερά** και όχι ως σιωπηλό `else`, ώστε ένα τέταρτο
 * είδος να μην προβληθεί κατά λάθος σε «διαθέσιμο»: η παράλειψη γίνεται
 * **δηλωμένη**, όχι τυχαία (μάθημα CHECK 3.44 — *«σιωπηλή απόρριψη με άλλο
 * όνομα»*).
 */
export const EXCHANGE_HAS_NO_LEGACY_PROJECTION = [
  'exchange',
] as const satisfies readonly OfferKind[];

/** `true` αν το είδος **μπορεί** να προβληθεί στο παλιό λεξιλόγιο. */
function hasLegacyProjection(kind: OfferKind): boolean {
  return !(EXCHANGE_HAS_NO_LEGACY_PROJECTION as readonly string[]).includes(kind);
}

// =============================================================================
// 2. Η ΠΑΡΑΓΩΓΗ
// =============================================================================

/** Τα είδη των ζωντανών διαθέσεων σε δεδομένο κύκλο ζωής. */
function kindsInLifecycle(
  offers: readonly PropertyOffer[],
  lifecycle: PropertyOffer['lifecycle'],
): Set<OfferKind> {
  const kinds = new Set<OfferKind>();
  for (const offer of offers) {
    if (offer.lifecycle === lifecycle) kinds.add(offer.kind);
  }
  return kinds;
}

/**
 * Παράγει το `commercialStatus` από τις διαθέσεις.
 *
 * **Σειρά προτεραιότητας — και είναι σημασιολογική, όχι αυθαίρετη:**
 *
 * 1. **Καμία ζωντανή διάθεση** → `unavailable`. Το `withdrawn` είναι ιστορικό,
 *    και *το ιστορικό δεν βάφει την οθόνη*.
 * 2. **Κλεισμένη** → `sold` / `rented`. Μια πουλημένη μονάδα **δεν είναι** πια
 *    «προς πώληση», όσες active διαθέσεις κι αν έχουν ξεμείνει.
 * 3. **Δεσμευμένη** → `reserved`. Η κράτηση είναι ισχυρότερο γεγονός από τη
 *    διαθεσιμότητα· το παλιό λεξιλόγιο **δεν μπορεί** να πει «κρατημένο προς
 *    πώληση ΚΑΙ προς ενοικίαση» — δηλωμένη απώλεια της προβολής.
 * 4. **Ενεργές** → `for-sale` / `for-rent` / `for-sale-and-rent`.
 *
 * @param offers — οι διαθέσεις του ακινήτου (μπορεί να είναι κενό/undefined)
 * @returns μία από τις **υπάρχουσες επτά** τιμές· ποτέ νέα
 */
export function deriveCommercialStatus(
  offers: readonly PropertyOffer[] | null | undefined,
): CommercialStatus {
  if (!offers || offers.length === 0) return 'unavailable';

  const live = offers.filter(isLiveOffer);
  if (live.length === 0) return 'unavailable';

  const closed = kindsInLifecycle(live, 'closed');
  if (closed.has('sell')) return 'sold';
  if (closed.has('leaseOut')) return 'rented';
  // Μόνο `exchange` κλεισμένη ⇒ δεν προβάλλεται· συνεχίζουμε στους επόμενους
  // κύκλους, ώστε μια παράλληλη ενεργή πώληση να μη χαθεί.

  const reserved = kindsInLifecycle(live, 'reserved');
  if (reserved.has('sell') || reserved.has('leaseOut')) return 'reserved';

  const active = kindsInLifecycle(live, 'active');
  const hasSell = active.has('sell');
  const hasLease = active.has('leaseOut');

  if (hasSell && hasLease) return 'for-sale-and-rent';
  if (hasSell) return 'for-sale';
  if (hasLease) return 'for-rent';

  // Έφτασε εδώ ⇒ ό,τι ζωντανό υπάρχει είναι είδος χωρίς προβολή (σήμερα:
  // μόνο `exchange`). Η αντιπαροχή ζει στο `offerKinds`, όχι εδώ.
  return 'unavailable';
}

// =============================================================================
// 3. ΤΟ DENORMALIZED ΠΕΔΙΟ — εδώ ζει η ΑΛΗΘΕΙΑ
// =============================================================================

/**
 * Παράγει το `offerKinds`: τα **ζωντανά** είδη διάθεσης, ταξινομημένα.
 *
 * Ταξινομημένα **επίτηδες**: δύο ακίνητα με τις ίδιες διαθέσεις σε άλλη σειρά
 * πρέπει να δίνουν **ταυτόσημο** πίνακα, αλλιώς κάθε αποθήκευση φαίνεται
 * αλλαγή και οι συγκρίσεις ταυτότητας σπάνε.
 *
 * ⚠️ Σε αντίθεση με το {@link deriveCommercialStatus}, εδώ **δεν χάνεται
 * τίποτα**: το `exchange` **περιλαμβάνεται**. Αυτός είναι ο άξονας που κάνει την
 * αντιπαροχή ερωτήσιμη (`array-contains` / `hasAny`).
 */
export function deriveOfferKinds(
  offers: readonly PropertyOffer[] | null | undefined,
): OfferKind[] {
  if (!offers || offers.length === 0) return [];

  const kinds = new Set<OfferKind>();
  for (const offer of offers) {
    if (isLiveOffer(offer)) kinds.add(offer.kind);
  }

  return [...kinds].sort();
}

// =============================================================================
// 4. ΤΟ ΚΛΕΙΣΙΜΟ ΑΠΟΣΥΡΕΙ ΤΙΣ ΑΛΛΕΣ — Α20 σημείο 4
// =============================================================================

/**
 * Κλείνει **μία** διάθεση και **αποσύρει τις υπόλοιπες ζωντανές**.
 *
 * 🏆 **Εδώ ξεπερνάμε το MLS.** Η ίδια πράξη είναι εκεί **προθεσμία σε
 * κανονισμό**: το CVR MLS §5.29 δίνει *«πέντε (5) ημέρες»* για να αποσυρθεί η
 * άλλη αγγελία, και το Bright MLS απαιτεί οι δύο να αναφέρονται σταυρωτά **στο
 * πεδίο «Σχόλια Μεσίτη»**. Δηλαδή η συνέπεια είναι **ανθρώπινη υποχρέωση με
 * προθεσμία**. Εδώ είναι **συνάρτηση**: όταν πουληθεί, η ενοικίαση **έχει ήδη**
 * αποσυρθεί την ίδια στιγμή, και δεν υπάρχει παράθυρο όπου το ακίνητο
 * διαφημίζεται σε δύο αγορές ταυτόχρονα.
 *
 * ⚠️ **Δεν αγγίζει** ήδη `closed` ή `withdrawn` διαθέσεις: είναι **ιστορικό**,
 * και το ιστορικό δεν ξαναγράφεται.
 *
 * ⚠️ **Καθαρή συνάρτηση** — επιστρέφει νέο πίνακα, δεν μεταλλάσσει την είσοδο.
 * Ο καλών αποθηκεύει μέσω του `property-mutation-gateway`, που είναι ο **μόνος**
 * που παράγει `commercialStatus`/`offerKinds`.
 *
 * @param offers — οι τρέχουσες διαθέσεις
 * @param closedOfferId — το `id` της διάθεσης που κλείνει
 * @param closedDate — η στιγμή του κλεισίματος, ίδια για όλες τις επηρεαζόμενες
 * @returns νέος πίνακας διαθέσεων· **αμετάβλητος** αν το `id` δεν βρέθηκε
 */
export function closeOffer(
  offers: readonly PropertyOffer[],
  closedOfferId: string,
  closedDate: PropertyOffer['closedDate'],
): PropertyOffer[] {
  const target = offers.find((offer) => offer.id === closedOfferId);
  if (!target) return [...offers];

  return offers.map((offer) => {
    if (offer.id === closedOfferId) {
      return { ...offer, lifecycle: 'closed', closedDate };
    }

    // Οι υπόλοιπες ΖΩΝΤΑΝΕΣ αποσύρονται. Το ιστορικό μένει άθικτο.
    if (offer.lifecycle === 'active' || offer.lifecycle === 'reserved') {
      return { ...offer, lifecycle: 'withdrawn', closedDate };
    }

    return offer;
  });
}

// =============================================================================
// 5. ΕΓΚΥΡΟΤΗΤΑ — τι ΔΕΝ επιτρέπεται να συνυπάρξει
// =============================================================================

/**
 * `true` αν ο πίνακας διαθέσεων παραβιάζει το invariant «**μία ζωντανή διάθεση
 * ανά είδος**».
 *
 * Δύο ενεργές πωλήσεις για το **ίδιο** ακίνητο δεν είναι πλούτος επιλογών —
 * είναι **δύο τιμές για ένα πράγμα**, δηλαδή ακριβώς το διπλότυπο που ολόκληρη
 * η Α20 υπάρχει για να εξαλείψει. Το invariant επιβάλλεται στην πύλη γραφής.
 */
export function hasDuplicateLiveOfferKind(
  offers: readonly PropertyOffer[] | null | undefined,
): boolean {
  if (!offers || offers.length === 0) return false;

  const seen = new Set<OfferKind>();
  for (const offer of offers) {
    if (!isLiveOffer(offer)) continue;
    if (seen.has(offer.kind)) return true;
    seen.add(offer.kind);
  }

  return false;
}

/**
 * Ονόματα των ειδών που **δεν** προβάλλονται στο παλιό λεξιλόγιο, για μηνύματα
 * και αναφορές. Εξάγεται ώστε ο έλεγχος να μη γράφεται δεύτερη φορά αλλού.
 */
export function offerKindsWithoutLegacyProjection(
  offers: readonly PropertyOffer[] | null | undefined,
): OfferKind[] {
  return deriveOfferKinds(offers).filter((kind) => !hasLegacyProjection(kind));
}
