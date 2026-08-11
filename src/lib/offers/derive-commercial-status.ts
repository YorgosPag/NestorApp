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

import {
  COMMERCIAL_STATUSES,
  normalizeCommercialStatus,
  type CommercialStatus,
} from '@/constants/commercial-statuses';
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
// 3b. ΤΑ ΠΟΣΑ ΣΤΟ ΠΑΛΙΟ ΣΧΗΜΑ — ο τρίτος αδελφός της παραγωγής
// =============================================================================

/**
 * Το παλιό αντικείμενο τιμών, **παραγόμενο** από τις διαθέσεις.
 *
 * 🔑 **Δομικό σχήμα, όχι ονομασμένος τύπος** — ίδιο ιδίωμα με το
 * `ProjectableProperty['commercial']`, που είναι ακριβώς ο καταναλωτής του: ο κώδικας
 * κουβαλά **δύο** `Property` και τα ωμά δεδομένα Firestore, οπότε ένας ονομασμένος
 * τύπος εδώ θα ανάγκαζε `as` σε κάθε καλούντα.
 */
export interface DerivedCommercialAmounts {
  readonly askingPrice: number | null;
  readonly finalPrice: number | null;
  readonly rentPrice: number | null;
}

/**
 * Διαθέσεις → **τα ποσά του παλιού σχήματος**.
 *
 * 🔴 **Γιατί χρειάζεται, και γιατί ζει ΕΔΩ.** Οι δύο υπάρχουσες παραγωγές απαντούν
 * *«σε ποια **κατάσταση** είναι;»* και *«ποια **είδη** ζωντανεύουν;»*. Καμία δεν
 * απαντά *«**πόσο** κοστίζει;»* — και το `buildPublicListing` το ρωτά ρητά
 * (`commercial.askingPrice` · `rentPrice` · `finalPrice`). Χωρίς αυτό, κάθε νέος
 * γραφέας που κρατά την **αλήθεια** στις διαθέσεις (Α20) θα έγραφε τη δική του
 * αντιστοίχιση προς το παλιό σχήμα — δηλαδή **Ν μεταφραστές για ένα λεξιλόγιο**, το
 * σχήμα του ADR-749. Ζει δίπλα στους δύο αδελφούς της γιατί είναι **η ίδια πράξη**:
 * ανάγνωση των διαθέσεων σε γλώσσα που δεν τις έχει.
 *
 * ⚠️ **Μόνο ΖΩΝΤΑΝΕΣ διαθέσεις** ({@link isLiveOffer}) — μια αποσυρμένη πώληση είναι
 * **ιστορικό**, και *το ιστορικό δεν βάφει την οθόνη*. Ίδιο κριτήριο με το
 * {@link deriveOfferKinds}, ώστε τα δύο να μη διαφωνούν ποτέ για το ίδιο έγγραφο.
 *
 * ⚠️ **Το `percentage` της αντιπαροχής ΔΕΝ χαρτογραφείται πουθενά, και είναι
 * δηλωμένη απώλεια** — τρίτη μορφή του {@link EXCHANGE_HAS_NO_LEGACY_PROJECTION}: το
 * παλιό σχήμα έχει **τρία πεδία ευρώ** και **κανένα ποσοστού**. Ένα ποσοστό γραμμένο
 * σε `askingPrice` θα εμφανιζόταν ως **«50 €»** στην κάρτα — ψέμα με νούμερο. Η
 * αντιπαροχή γίνεται ορατή από το `offerKinds`, όπως ορίζει η Α20.
 */
export function deriveCommercialAmounts(
  offers: readonly PropertyOffer[] | null | undefined,
): DerivedCommercialAmounts {
  let askingPrice: number | null = null;
  let finalPrice: number | null = null;
  let rentPrice: number | null = null;

  for (const offer of offers ?? []) {
    if (!isLiveOffer(offer)) continue;
    if (offer.kind === 'sell') {
      askingPrice = offer.askingPrice ?? null;
      finalPrice = offer.finalPrice ?? null;
    } else if (offer.kind === 'leaseOut') {
      rentPrice = offer.rentPrice ?? null;
    }
  }

  return { askingPrice, finalPrice, rentPrice };
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

// =============================================================================
// 6. Η ΑΝΤΙΣΤΡΟΦΗ — παλιό λεξιλόγιο → νέος άξονας
// =============================================================================
//
// 🔴 **ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ.** Ο γραφέας είναι **σταδιακός επίτηδες**
// (`property-offer-write-projection.ts:122`: `if (!('offers' in payload)) return;`),
// άρα κάθε έγγραφο γραμμένο **πριν** την Α20 κουβαλά σωστό `commercialStatus` και
// **κανένα** `offerKinds`. Δεν λείπει πληροφορία — λείπει **μετάφραση**. Και επειδή
// κάθε δημόσια οθόνη ρωτά τον **νέο** άξονα (`types/public-listing.ts` §4: *«κάθε
// οθόνη ρωτά αυτό»*), ένα τέτοιο έγγραφο **φαίνεται χωρίς είδος διάθεσης**.
//
// 🔑 **Η ΑΝΤΙΣΤΡΟΦΗ ΜΙΑΣ LOSSY ΠΡΟΒΟΛΗΣ ΕΙΝΑΙ ΜΕΡΙΚΗ — ΚΑΙ ΤΟ ΛΕΕΙ.**
// Ο κανόνας που διέπει ολόκληρη την ενότητα, σε μία πρόταση:
//
//   > **ονομάζει ΜΟΝΟ τα είδη που η κατάσταση ΑΠΟΔΕΙΚΝΥΕΙ· όπου η κατάσταση
//   > αποδεικνύει διάζευξη, δεν ονομάζει τίποτα.**
//
// Δεν είναι γούστο, είναι ανάγνωση του {@link deriveCommercialStatus} ανάποδα:
//
//   | κατάσταση           | τι ΑΠΟΔΕΙΚΝΥΕΙ ο κλάδος που την παράγει        |
//   |---------------------|------------------------------------------------|
//   | `for-sale`          | ενεργή `sell`                        ⇒ βέβαιο   |
//   | `for-rent`          | ενεργή `leaseOut`                    ⇒ βέβαιο   |
//   | `for-sale-and-rent` | ενεργές **και οι δύο**               ⇒ βέβαιο   |
//   | `sold`              | κλεισμένη `sell`                     ⇒ βέβαιο   |
//   | `rented`            | κλεισμένη `leaseOut`                 ⇒ βέβαιο   |
//   | `reserved`          | `sell` **Ή** `leaseOut` (γρ. 118)    ⇒ ΔΙΑΖΕΥΞΗ |
//   | `unavailable`       | καμία ζωντανή **Ή** μόνο `exchange`  ⇒ ΔΙΑΖΕΥΞΗ |
//
// ⚠️ Οι δύο διαζεύξεις **δεν είναι κενό υλοποίησης** — είναι οι **ίδιες** δηλωμένες
// απώλειες που το αρχείο ήδη ονομάζει παραπάνω: η μία στο σχόλιο του βήματος 3
// (*«το παλιό λεξιλόγιο δεν μπορεί να πει “κρατημένο προς πώληση ΚΑΙ προς
// ενοικίαση”»*), η άλλη στο {@link EXCHANGE_HAS_NO_LEGACY_PROJECTION}. Μια
// αντίστροφη που μάντευε `['sell']` για το `reserved` θα μετέτρεπε **παραδεγμένη
// άγνοια σε ισχυρισμό** — ακριβώς το fallback «άδειο = όλα» που απαγορεύτηκε ρητά.
//
// 🏆 **Πού ξεπερνάμε το πρότυπο.** Το **RESO** ορίζει `StandardStatus` και
// `PropertyType` ως **ξεχωριστά** πεδία και δεν προσφέρει καμία μετάφραση από το ένα
// στο άλλο· τα MLS λύνουν τη μετανάστευση λεξιλογίου με **χαρτογράφηση πεδίων σε
// υπολογιστικό φύλλο**, δηλαδή με άνθρωπο που αποφασίζει ανά τιμή και **χωρίς
// αντικειμενικό κριτήριο ορθότητας**. Εδώ το κριτήριο είναι **αποδείξιμο**:
// {@link offerKindsFromLegacyStatus} ∘ {@link deriveCommercialStatus} δίνει **πάντα
// υποσύνολο** του {@link deriveOfferKinds} — δηλαδή η μετάφραση **ποτέ δεν
// ισχυρίζεται περισσότερα απ' όσα ξέρουν οι διαθέσεις. Είναι θεώρημα, όχι δείγμα**:
// επαληθεύεται εξαντλητικά στα **125** (5³) δυνατά σχήματα διαθέσεων.

/**
 * Τι **αποδεικνύει** κάθε τιμή του παλιού λεξιλογίου για τον νέο άξονα.
 *
 * 🔑 **`Record<CommercialStatus, …>` επίτηδες**: όγδοη κατάσταση **δεν μεταγλωττίζεται**
 * μέχρι κάποιος να αποφασίσει τι ονομάζει — κλειστό σύνολο, όχι σιωπηλό `default`.
 *
 * ⚠️ Οι πίνακες είναι **ταξινομημένοι**, όπως ακριβώς το {@link deriveOfferKinds}:
 * οι δύο διαδρομές πρέπει να δίνουν **ταυτόσημο** πίνακα για την ίδια σημασία,
 * αλλιώς κάθε σύγκριση ταυτότητας σπάει ανάλογα με το ποια τα παρήγαγε.
 */
const KINDS_PROVEN_BY_LEGACY_STATUS: Readonly<
  Record<CommercialStatus, readonly OfferKind[]>
> = {
  'for-sale': ['sell'],
  'for-rent': ['leaseOut'],
  'for-sale-and-rent': ['leaseOut', 'sell'],
  sold: ['sell'],
  rented: ['leaseOut'],
  // Διάζευξη: `sell` **Ή** `leaseOut` — δηλωμένη απώλεια του βήματος 3.
  reserved: [],
  // Διάζευξη: καμία ζωντανή **Ή** μόνο `exchange` ({@link EXCHANGE_HAS_NO_LEGACY_PROJECTION}).
  unavailable: [],
};

/**
 * Οι καταστάσεις που **δεν ονομάζουν** κανένα είδος διάθεσης.
 *
 * **Παράγεται** από το {@link KINDS_PROVEN_BY_LEGACY_STATUS} και δεν ξαναγράφεται με
 * το χέρι: δύο χειρόγραφες λίστες για την ίδια σχέση είναι ο ορισμός του «αποκλίνουν
 * σιωπηλά» (μάθημα CHECK 3.34 — δύο λίστες namespace που είχαν αποκλίνει **κατά 63**).
 *
 * Εξάγεται ώστε μια οθόνη να μπορεί να πει *«δεν ξέρουμε»* **με όνομα**, αντί να
 * συμπεράνει σιωπηλά από έναν άδειο πίνακα.
 */
export const STATUSES_THAT_PROVE_NO_OFFER_KIND: readonly CommercialStatus[] =
  COMMERCIAL_STATUSES.filter((status) => KINDS_PROVEN_BY_LEGACY_STATUS[status].length === 0);

/**
 * Παλιό λεξιλόγιο → νέος άξονας: τα είδη διάθεσης που **αποδεικνύει** μια κατάσταση.
 *
 * ⚠️ **ΔΕΝ αντικαθιστά το {@link deriveOfferKinds}** — το συμπληρώνει **προς τα πίσω**.
 * Όπου υπάρχουν `offers`, η αλήθεια είναι εκεί και **μόνο** εκεί· αυτή η συνάρτηση
 * είναι για έγγραφα που **δεν έχουν** διαθέσεις, δηλαδή για ό,τι γράφτηκε πριν την Α20.
 *
 * ⛔ **ΠΟΤΕ ως κριτήριο δημοσίευσης.** Το `sold` αποδεικνύει `['sell']`, οπότε ένας
 * έλεγχος «έχει είδος διάθεσης ⇒ δημοσίευσέ το» θα έβγαζε **πουλημένα ακίνητα στην
 * αγορά**. Το κριτήριο δημοσίευσης είναι η ένωση των **δύο σκελών των κανόνων
 * Firestore** και γράφεται **μία** φορά, στο `public-listing-projection.ts`.
 *
 * Δέχεται `unknown` γιατί το πεδίο έρχεται από Firestore: περνά από τον υπάρχοντα
 * {@link normalizeCommercialStatus} (ελληνικά/legacy aliases) αντί για δεύτερο parser.
 *
 * @param status — τιμή `commercialStatus`/`status` σε **οποιαδήποτε** γνωστή μορφή
 * @returns νέος, **ταξινομημένος** πίνακας· κενός όταν η κατάσταση δεν αποδεικνύει είδος
 */
export function offerKindsFromLegacyStatus(status: unknown): OfferKind[] {
  const canonical = normalizeCommercialStatus(status);
  if (!canonical) return [];
  return [...KINDS_PROVEN_BY_LEGACY_STATUS[canonical]];
}
