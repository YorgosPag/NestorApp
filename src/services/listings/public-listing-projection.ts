/**
 * @fileoverview **Η ΜΗΧΑΝΗ ΤΗΣ ΠΡΟΒΟΛΗΣ** — ακίνητο + τόπος → δημόσια αγγελία, ή τίποτα.
 * @related ADR-777 §7 (Α1 · Α3 · Α5 · Α20) · types/public-listing.ts
 * @module services/listings/public-listing-projection
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΖΕΙ ΣΤΟ `src/` ΚΑΙ ΟΧΙ ΣΕ CLOUD FUNCTION — **μετρημένο, όχι προτιμώμενο**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το προφανές σχέδιο ήταν trigger σε `properties/{docId}`, στο ύφος του
 * `floorUnitsAggregation`. **Απορρίφθηκε μετά από μέτρηση**, για δύο λόγους:
 *
 * 1. **Το `functions/` ΔΕΝ μπορεί να εισάγει από το `src/`** (`functions/tsconfig.json`:
 *    `include: ["src"]`, `outDir: "lib"`). Άρα ένα ολόκληρο **σχήμα καλωδίου** θα
 *    καθρεφτιζόταν με το χέρι. Το repo έχει **ήδη τρία** τέτοια mirrors, και **κανένα
 *    δεν έχει πύλη**: το `functions/src/config/firestore-collections.ts` λέει «*RULE:
 *    ensure it matches*» (κανόνας σε σχόλιο), και το test του `svg-from-dxf-scene`
 *    ισχυρίζεται ότι «*μια αποτυχία εδώ προειδοποιεί ότι τα δύο αντίγραφα απέκλιναν*»
 *    — **ψευδές**: test πάνω στο αντίγραφο Α δεν μπορεί να δει αλλαγή στο Β.
 *    *(Μετρήθηκε ότι το πρώτο **δεν** έχει αποκλίνει ακόμη: 24/24 συμφωνούν. Λανθάνον,
 *    όχι ζωντανό — αλλά τέταρτο mirror χωρίς πύλη, και μάλιστα **δημόσιου** σχήματος,
 *    θα ήταν προσθήκη ρίσκου εκεί που ξέρουμε ήδη ότι δεν υπάρχει φρουρός.)*
 *
 * 2. **Η γραφή ΗΔΗ περνά από διακομιστή** — επαληθεύτηκε: `properties.service.ts:105`
 *    → `apiClient.patch(API_ROUTES.PROPERTIES.BY_ID)` → `app/api/properties/[id]`.
 *    Δηλαδή υπάρχει **πραγματικό σημείο διακομιστή** στη διαδρομή γραφής, με πλήρη
 *    πρόσβαση στους αληθινούς τύπους. Ένα trigger θα πρόσθετε **δεύτερο** στρώμα για
 *    δουλειά που το πρώτο μπορεί να κάνει **με μία αλήθεια**.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ, με όνομα:** γραφή που **παρακάμπτει** τα API routes (Admin SDK,
 * μαζική εισαγωγή, χειροκίνητη επεξεργασία στην κονσόλα) **δεν** ενημερώνει την
 * προβολή. Δίχτυ ασφαλείας είναι η **επανασύνθεση** ({@link buildPublicListing} πάνω
 * σε ολόκληρη τη συλλογή), που είναι **idempotent** και αναφέρει **κλειστή λογιστική**
 * — όχι σιωπηλή ελπίδα ότι δεν συνέβη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΡΙΤΗΡΙΟ ΔΗΜΟΣΙΕΥΣΗΣ ΓΡΑΦΕΤΑΙ **ΜΙΑ** ΦΟΡΑ, ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι κανόνες Firestore του `properties` έχουν **δύο** δημόσια σκέλη (παλιό λεξιλόγιο ·
 * `offerKinds`). Η ένωσή τους είναι **ο ορισμός** του «δημοσιευμένο». Αν το κριτήριο
 * ξαναγραφόταν στην οθόνη ή στο ερώτημα, θα υπήρχαν τρεις τόποι που απαντούν «είναι
 * δημόσιο;» — και θα διαφωνούσαν ακριβώς στην αντιπαροχή, που είναι η **μόνη**
 * περίπτωση όπου τα δύο σκέλη δεν συμπίπτουν.
 */

import {
  FINALIZED_COMMERCIAL_STATUSES,
  LISTED_COMMERCIAL_STATUSES,
  type CommercialStatus,
} from '@/constants/commercial-statuses';
import { projectLegality } from './legality-projection';
import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';
import { offerKindsFromLegacyStatus } from '@/lib/offers/derive-commercial-status';
import type { PropertyType } from '@/types/property';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import type {
  ListingImageSource,
  ListingPosition,
  PublicListing,
  PublicListingStay,
  UnknownPositionReason,
} from '@/types/public-listing';
import { LISTING_GALLERY_ALT_KEY } from '@/lib/listings/listing-images';
import { projectListingAttributes } from './public-listing-attributes';
import { outranksForLocation } from '@/lib/location/location-provenance';

// ============================================================================
// ΕΙΣΟΔΟΙ — το συμβόλαιο ζει στο -types.ts (N.7.1), η μηχανή εδώ
// ============================================================================

export type {
  ProjectableProperty,
  PlaceKnowledge,
  ListingPositionCandidate,
} from './public-listing-projection-types';

import type {
  ProjectableProperty,
  PlaceKnowledge,
  ListingPositionCandidate,
} from './public-listing-projection-types';

// ============================================================================
// ΔΗΜΟΣΙΕΥΣΗ — το κριτήριο, μία φορά
// ============================================================================

/** Οι διαθέσεις που κάνουν μια αγγελία ορατή. Παράγεται από το SSoT, δεν ξαναγράφεται. */
const PUBLIC_OFFER_KINDS: ReadonlySet<string> = new Set<OfferKind>(OFFER_KINDS);

/**
 * Δημοσιεύεται αυτό το ακίνητο;
 *
 * **Η ένωση των δύο σκελών των κανόνων Firestore**, γραμμένη μία φορά:
 *   - παλιό λεξιλόγιο: `commercialStatus ∈ LISTED_COMMERCIAL_STATUSES`
 *   - νέος άξονας (Α20): υπάρχει **έστω μία** ζωντανή διάθεση
 *
 * ⚠️ **Χρειάζονται και τα δύο.** Το πρώτο μόνο του κρύβει την **αντιπαροχή** (προβάλλεται
 * σε `'unavailable'`)· το δεύτερο μόνο του κρύβει **κάθε έγγραφο γραμμένο πριν την Α20**
 * — και μετρήθηκε ότι σήμερα **κανένα** από τα 8 δεν έχει `offerKinds`, δηλαδή σκέτο το
 * δεύτερο σκέλος θα έδινε **άδεια οθόνη με όλες τις πύλες πράσινες**.
 */
export function isPubliclyListed(property: ProjectableProperty): boolean {
  const status = property.commercialStatus ?? property.status ?? null;
  if (typeof status === 'string' && (LISTED_COMMERCIAL_STATUSES as readonly string[]).includes(status)) {
    return true;
  }

  // 🔴 **ΤΟ ΚΛΕΙΣΙΜΟ ΚΟΒΕΙ ΤΟ ΔΕΥΤΕΡΟ ΣΚΕΛΟΣ — αλλιώς πουλημένα ακίνητα μένουν στην
  // αγορά.** Βρέθηκε με μέτρηση γράφοντας την **Α14** (2026-08-11), και είναι
  // *ακριβώς* ο κίνδυνος που το σχόλιο του `projectedOfferKinds` ονομάζει δέκα
  // γραμμές πιο κάτω — αλλά εκεί ονομάζεται μόνο για το **παραγόμενο** σκέλος:
  //
  //   «το `sold` **αποδεικνύει** `['sell']`, οπότε ένα σκέλος “έχει είδος ⇒ δημόσιο”
  //    θα έβγαζε **πουλημένα ακίνητα στην αγορά**»
  //
  // Το ίδιο ισχύει για το **δηλωμένο** `offerKinds`, και για τον ίδιο ακριβώς λόγο:
  // το `LIVE_OFFER_LIFECYCLES` περιλαμβάνει σκόπιμα το `closed` (*«μετράει για το τι
  // ΕΙΝΑΙ σήμερα το ακίνητο»* — έτσι παράγεται το `sold`), οπότε το `deriveOfferKinds`
  // μιας πουλημένης μονάδας επιστρέφει `['sell']`. «Τι είναι» και «τι διαφημίζεται»
  // είναι **δύο ερωτήσεις**, και μόνο η πρώτη απαντιέται από τον κύκλο ζωής.
  //
  // ⚠️ **ΜΗΔΕΝ αλλαγή συμπεριφοράς για τα σημερινά δεδομένα, μετρημένη:** κανένα
  // έγγραφο δεν έχει ακόμη `offerKinds` (§8.5), άρα ο βρόχος επέστρεφε ήδη `false`
  // για κάθε `sold`/`rented`. Η γραμμή δεν διορθώνει ζωντανό ελάττωμα — **αποτρέπει
  // το πρώτο**: οι αγγελίες της Α14 είναι τα **πρώτα** έγγραφα του συστήματος που
  // γράφουν πραγματικά αυτό το πεδίο.
  //
  // 🔑 Χρησιμοποιεί το **υπάρχον** `FINALIZED_COMMERCIAL_STATUSES` και όχι δύο ωμά
  // αλφαριθμητικά: μια όγδοη τελική κατάσταση οφείλει να κληρονομήσει τον κανόνα
  // χωρίς να τη θυμηθεί κανείς.
  if (typeof status === 'string' && (FINALIZED_COMMERCIAL_STATUSES as readonly string[]).includes(status)) {
    return false;
  }

  return (property.offerKinds ?? []).some((kind) => PUBLIC_OFFER_KINDS.has(kind));
}

// ============================================================================
// ΘΕΣΗ — ο κανόνας του §14.3, εφαρμοσμένος
// ============================================================================

/**
 * Ποια από τις υποψήφιες θέσεις ισχύει.
 *
 * 🔴 **Χρησιμοποιεί `outranksForLocation`, ΠΟΤΕ το σκαλοπάτι της σκάλας** — και αυτό
 * είναι το εύρημα #1 του Β1, γραμμένο εδώ ως κώδικας: το σκαλοπάτι **5** σημαίνει
 * «έγγραφο ναι, **θέση όχι**» ενώ το **4** δίνει σχήμα. Όποιος διαβάσει τον αριθμό ως
 * αξιοπιστία, αφήνει **ανύπαρκτο** στοιχείο θέσης να σβήσει **υπαρκτό**.
 *
 * ⚠️ **Ισοβαθμία ⇒ κρατάει ο πρώτος.** Το `outranksForLocation` επιστρέφει `false` σε
 * ισοβαθμία **επίτηδες**: δύο πηγές ίδιας βαθμίδας που διαφωνούν είναι σύγκρουση προς
 * επίλυση από άνθρωπο, όχι «το τελευταίο νικά».
 */
export function resolveListingPosition(
  place: PlaceKnowledge,
  disclosure: ProjectableProperty['locationDisclosure']
): ListingPosition {
  let winner: ListingPositionCandidate | null = null;

  for (const candidate of place.candidates) {
    if (outranksForLocation(candidate.provenance, winner?.provenance ?? null)) {
      winner = candidate;
    }
  }

  if (winner) return winner;

  const reason: UnknownPositionReason = disclosure === 'declined' ? 'owner-declined' : 'never-asked';
  return { kind: 'unknown', reason };
}

// ============================================================================
// Η ΠΡΟΒΟΛΗ
// ============================================================================

/** Καθαρίζει αριθμό: `0` είναι **υπαρκτή τιμή**· μόνο η απουσία γίνεται `null`. */
function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Ο άξονας των διαθέσεων για την προβολή — **το νέο λεξιλόγιο νικά όταν υπάρχει**.
 *
 * 🔴 **Η ΑΣΥΜΜΕΤΡΙΑ ΠΟΥ ΔΙΟΡΘΩΝΕΙ, μετρημένη 2026-08-11.** Η {@link isPubliclyListed}
 * δέχεται **δύο** λεξιλόγια· αυτή η γραμμή δεχόταν **ένα**. Η ίδια συνάρτηση προβολής
 * απαντούσε *«δημοσιεύεται;»* σε δύο γλώσσες και *«τι είδους διάθεση;»* σε μία — και η
 * δεύτερη **σιωπούσε**. Ζωντανή μέτρηση: **6/6** δημόσιες αγγελίες με σωστό
 * `commercialStatus` και `offerKinds: []`, δηλαδή **έξι κάρτες χωρίς είδος διάθεσης
 * και όλες οι πύλες πράσινες**.
 *
 * 🔑 **ΚΡΙΤΗΡΙΟ ΕΦΕΔΡΕΙΑΣ: ΚΕΝΟ, ΟΧΙ ΑΠΟΝ — και είναι ΑΠΟΔΕΙΞΙΜΟ, όχι προτίμηση.**
 * Ο μοναδικός παραγωγός των δύο πεδίων (`property-offer-write-projection.ts`) τα
 * βγάζει **από τον ίδιο πίνακα `offers`** στην ίδια πράξη. Άρα:
 *
 *   `commercialStatus ∈ LISTED` ⇒ υπήρχε **ενεργή** `sell`/`leaseOut` ⇒ `offerKinds ≠ []`
 *
 * ⇒ ο συνδυασμός «**listed κατάσταση ΚΑΙ κενό `offerKinds`**» είναι **ακριβώς και μόνο**
 * το έγγραφο που γράφτηκε **πριν** την Α20. Δεν χρειάζεται να μαντέψουμε αν το κενό
 * σημαίνει «σβήστηκε» ή «δεν γράφτηκε ποτέ»: ο γραφέας **δεν μπορεί** να το παράγει.
 *
 * ⛔ **ΔΕΝ επιτρέπεται να τροφοδοτήσει την {@link isPubliclyListed}** — και ο λόγος έχει
 * όνομα: το `sold` **αποδεικνύει** `['sell']`, οπότε ένα δεύτερο σκέλος «έχει είδος ⇒
 * δημόσιο» θα έβγαζε **πουλημένα ακίνητα στην αγορά**. Το κριτήριο δημοσίευσης είναι η
 * ένωση των **δύο σκελών των κανόνων Firestore** — η μετάφραση **δεν είναι σκέλος
 * κανόνα**, είναι ανάγνωση του ίδιου γεγονότος σε άλλη γλώσσα.
 *
 * ⚠️ Το φίλτρο `PUBLIC_OFFER_KINDS` μένει στο **δηλωμένο** σκέλος: εκεί η τιμή έρχεται
 * ωμή από Firestore (`readonly string[]`) και μπορεί να είναι λέξη που δεν ξέρουμε. Το
 * παραγόμενο σκέλος είναι **ήδη** `OfferKind[]` από κλειστό πίνακα — δεύτερο φίλτρο εκεί
 * θα ήταν φρουρός που δεν μπορεί να πυροδοτήσει (ADR-749 §5).
 */
function projectedOfferKinds(property: ProjectableProperty): OfferKind[] {
  const declared = (property.offerKinds ?? []).filter(
    (kind): kind is OfferKind => PUBLIC_OFFER_KINDS.has(kind)
  );
  if (declared.length > 0) return declared;

  return offerKindsFromLegacyStatus(property.commercialStatus ?? property.status);
}

/**
 * **Οι όροι διαμονής στη δημόσια προβολή** — ή `null`, δεμένο στο `offerKinds`.
 *
 * 🔴 **Ο ΔΕΣΜΟΣ ΕΙΝΑΙ ΜΟΝΟΜΕΡΗΣ ΚΑΙ ΣΚΟΠΙΜΟΣ: το `leaseShort` ΑΠΟΦΑΣΙΖΕΙ.** Το
 * `offerKinds` που φτάνει εδώ έχει ήδη περάσει από το {@link projectedOfferKinds},
 * δηλαδή είναι η **μία** απάντηση στο *«τι διατίθεται»*. Αν το `stay` κρινόταν
 * ανεξάρτητα (π.χ. «υπάρχουν όροι ⇒ γράψ' τους»), θα υπήρχαν **δύο** απαντήσεις στο
 * *«είναι κατάλυμα;»* — και θα διαφωνούσαν ακριβώς εκεί που πονάει: σε ακίνητο με
 * **αποσυρμένη** βραχυχρόνια, όπου το `offerKinds` λέει «όχι» και οι όροι υπάρχουν
 * ακόμη στο έγγραφο.
 *
 * ⚠️ **`nextAvailableFrom: null` ΠΑΝΤΑ, σήμερα — και είναι ΔΗΛΩΜΕΝΟ ΚΕΝΟ, όχι
 * παράλειψη.** Είναι παράγωγο του **ημερολογίου**, και το ημερολόγιο **δεν ζει στην
 * προβολή** (§4.5, τρεις δεσμευτικοί λόγοι). Θα το γεμίσει ο γραφέας της **Φ5**, που
 * βλέπει τις κρατήσεις. Ως τότε `null` = *«δεν το ξέρουμε»*, που είναι η **αλήθεια**.
 */
function projectStay(
  property: ProjectableProperty,
  offerKinds: readonly OfferKind[],
): PublicListingStay | null {
  if (!offerKinds.includes('leaseShort')) return null;
  return {
    minNights: numberOrNull(property.stay?.minNights),
    maxGuests: numberOrNull(property.stay?.maxGuests),
    nextAvailableFrom: null,
  };
}

/**
 * Ακίνητο + τόπος → **δημόσια αγγελία**, ή `null` αν δεν δημοσιεύεται.
 *
 * 🔑 **Το `null` δεν είναι σφάλμα — είναι εντολή διαγραφής.** Ο γραφέας το μεταφράζει
 * σε «σβήσε την προβολή», και αυτό είναι που κάνει την απόσυρση αγγελίας **να
 * συμβαίνει πραγματικά** αντί να μένει ένα ορφανό δημόσιο έγγραφο.
 *
 * ⚠️ **Καμία τιμή δεν λύνεται εδώ.** Περνούν οι ωμοί αριθμοί, ώστε η οθόνη να καλέσει
 * τον υπάρχοντα SSoT τιμής — αλλιώς θα υπήρχε δεύτερη μηχανή τιμής.
 */
export function buildPublicListing(
  property: ProjectableProperty,
  place: PlaceKnowledge,
  projectedAt: string
): PublicListing | null {
  if (!isPubliclyListed(property)) return null;
  return projectListingShape(property, place, projectedAt);
}

/**
 * **ΤΟ ΣΧΗΜΑ ΧΩΡΙΣ ΤΗΝ ΠΥΛΗ** — ακίνητο + τόπος → η ίδια δομή, **πάντα**.
 *
 * 🔴 **ΕΙΝΑΙ SPLIT, ΟΧΙ TRIM — και οι δύο ερωτήσεις ήταν πραγματικά δύο.** Το
 * {@link buildPublicListing} απαντούσε ταυτόχρονα *«**επιτρέπεται** να το δει ο
 * κόσμος;»* (πολιτική) και *«**τι σχήμα** έχει;»* (χαρτογράφηση). Ενωμένες, ο μόνος
 * τρόπος να πάρεις το σχήμα ήταν να **περάσεις** την πολιτική — και υπάρχει
 * καταναλωτής που χρειάζεται το σχήμα **ακριβώς όταν η πολιτική λέει όχι**.
 *
 * Ο καταναλωτής είναι το **δόλωμα του SPEC-777B §12.6** (`lib/demand/demand-interest.ts`):
 * *«12 άνθρωποι ζητούν το κατάστημά σας»* λέγεται σε ιδιοκτήτη που **δεν το έχει
 * ανεβάσει πουθενά**. Χωρίς αυτή τη διάσπαση, η μηχανή ταιριάσματος δεν θα είχε
 * **τίποτα να κρίνει** για το μόνο ακίνητο που την ενδιαφέρει — και το χαρακτηριστικό
 * θα ανέφερε **«0 ζητούν»**, δηλαδή θα γεννιόταν ως το σχήμα «0 = κανείς δεν κοίταξε».
 *
 * ⛔ **ΑΥΤΗ Η ΣΥΝΑΡΤΗΣΗ ΔΕΝ ΓΡΑΦΕΙ ΠΟΤΕ ΠΟΥΘΕΝΑ.** Το `PublicListing` που επιστρέφει
 * για μη-δημοσιεύσιμο ακίνητο είναι **εφήμερο, στη μνήμη του διακομιστή**, και
 * αποκαλύπτεται **μόνο** στον κάτοχό του ως **αριθμός** (επίπεδο Γ). Ο γραφέας της
 * προβολής (`writeListingProjection`) καλεί το {@link buildPublicListing} — **με την
 * πύλη** — και οφείλει να συνεχίσει να το κάνει. Άγκυρα: `Κ1` στο
 * `__tests__/public-listing-projection.test.ts`.
 *
 * ⚠️ **Καμία αλλαγή συμπεριφοράς.** Για κάθε ακίνητο που περνά την πύλη, το
 * αποτέλεσμα είναι **ταυτόσημο** με πριν — η πύλη απλώς μετακόμισε μία γραμμή πάνω.
 */
export function projectListingShape(
  property: ProjectableProperty,
  place: PlaceKnowledge,
  projectedAt: string
): PublicListing {
  const commercial = property.commercial ?? null;
  // 🔑 Υπολογίζεται **μία** φορά και μοιράζεται: το `stay` είναι δεμένο στο
  //    `leaseShort` αυτού **ακριβώς** του πίνακα — δεύτερη κλήση θα ήταν δεύτερη
  //    απάντηση στο «τι διατίθεται», ελεύθερη να αποκλίνει (δες `projectStay`).
  const offerKinds = projectedOfferKinds(property);

  return {
    id: property.id,
    commercialStatus: (property.commercialStatus ?? property.status ?? 'unavailable') as CommercialStatus,
    commercial: {
      askingPrice: numberOrNull(commercial?.askingPrice),
      finalPrice: numberOrNull(commercial?.finalPrice),
      rentPrice: numberOrNull(commercial?.rentPrice),
      // ⚠️ Ίδιος **ωμός** χειρισμός με τα τρία από πάνω: η προβολή δεν λύνει τιμή —
      // τη λύνει ο ΕΝΑΣ `price-resolver` στην οθόνη (δες τη σημείωση του σχήματος).
      nightlyRate: numberOrNull(commercial?.nightlyRate),
    },
    // ── ADR-835 §4.5 — οι όροι διαμονής· **ποτέ** ημερολόγιο. Δες `projectStay`.
    stay: projectStay(property, offerKinds),
    // 🔶 Η εικόνα μπαίνει όταν υπάρξει ο παραγωγός της (Α19, κανόνας 31: **προ-ψημένο
    // artifact από το μοντέλο**, ποτέ ανέβασμα χρήστη). Μέχρι τότε `null` = «δεν
    // υπάρχει», και η οθόνη οφείλει να το πει — ποτέ εξωτερικό placeholder (§25.5.2).
    coverImage: null,
    // 🔴 **ΚΕΝΟΣ ΠΙΝΑΚΑΣ = «ΤΟ ΡΑΦΙ ΔΕΝ ΕΧΕΙ ΡΩΤΗΘΕΙ ΑΚΟΜΗ», όχι «δεν έχει φωτογραφίες».**
    //    Αυτή η συνάρτηση είναι **καθαρή**: τα URL των παραγώγων γεννιούνται από το
    //    **sha256 των καθαρισμένων bytes**, δηλαδή δεν υπάρχουν πριν τρέξει η
    //    συμφιλίωση. Τα δένει ο γραφέας, με το {@link withPublishedGallery}, **αφού**
    //    μάθει τι πραγματικά κάθεται στον κάδο (ADR-841 §7 Α2.2).
    gallery: [],
    type: (property.type ?? 'apartment') as PropertyType,
    areaSqm: numberOrNull(property.areas?.gross) ?? numberOrNull(property.area),
    offerKinds,
    position: resolveListingPosition(place, property.locationDisclosure),
    // 🔑 **Ο δεσμός προς το επίπεδο Α ταξιδεύει ΑΥΤΟΥΣΙΟΣ** — καμία κρίση, καμία
    // λύση, καμία εικασία. Είναι δήλωση του κατόχου («*το ακίνητό μου είναι σε αυτό
    // το κτίριο*»), και η **επαλήθευσή** της είναι άλλο ερώτημα (§14.3): εδώ απλώς
    // δεν χάνεται, ώστε η Ζ3/Ζ5 να έχει με τι να συγκρίνει.
    //
    // ⚠️ Διαβάζεται από το `place` και **όχι** από το ακίνητο: ο ιδιώτης δηλώνει τον
    // δεσμό στο **δικό του** έγγραφο, ο επαγγελματίας τον κληρονομεί από το **κτίριο**
    // (επίπεδο Β). Δύο πηγές, **ένα** πεδίο εισόδου — δες {@link PlaceKnowledge.ref}.
    place: place.ref,
    floor: numberOrNull(property.floor),
    bedrooms: numberOrNull(property.layout?.bedrooms),
    // 🔴 **ADR-842 Φ3 — ΤΟ ΦΡΑΓΜΑ ΠΟΥ ΕΣΠΑΣΕ.** Η εταιρεία κατείχε ~60 πεδία και
    //    δημόσια έφευγαν **τέσσερα**· εδώ φεύγουν είκοσι τρία ακόμη, **χωρίς να
    //    ρωτηθεί κανένας άνθρωπος τίποτα**. Η κρίση «είναι ονομάσιμη αυτή η τιμή;»
    //    ζει στο `public-listing-attributes.ts` — δες εκεί γιατί δεν είναι `as`.
    ...projectListingAttributes(property, projectedAt),
    title: (property.name ?? '').trim(),
    // §8.33 — δες τον κανόνα της απουσίας στο `ProjectableProperty.authorship`.
    // ── Α17 (ADR-838) — η ΒΑΘΜΙΔΑ φεύγει, το έγγραφο ποτέ. Δες projectLegality.
    legality: projectLegality(property, offerKinds, projectedAt),
    authorship: property.authorship ?? 'agency',
    agencyName: property.agency?.name ?? null,
    agencyId: property.agency?.id ?? null,
    projectedAt,
  };
}

// ============================================================================
// ΔΙΕΥΘΥΝΣΗ → ΥΠΟΨΗΦΙΑ ΘΕΣΗ
// ============================================================================

/** Δομική όψη μιας καταχωρημένης διεύθυνσης — όσο χρειάζεται η θέση, τίποτα άλλο. */
export interface AddressLike {
  readonly coordinates?: { readonly lat?: number | null; readonly lng?: number | null } | null;
  readonly geocodingMetadata?: { readonly accuracy?: GeocodingAccuracy | null } | null;
  readonly isPrimary?: boolean | null;
  readonly verifiedAt?: number | null;
}

/**
 * Διεύθυνση → υποψήφια θέση, ή `null` αν δεν κουβαλά συντεταγμένες.
 *
 * 🔑 **Η προέλευση συνάγεται από ΤΑ ΙΔΙΑ ΤΑ ΔΕΔΟΜΕΝΑ, όχι από παραδοχή:**
 *
 *   - υπάρχει `geocodingMetadata` ⇒ **μηχανή** το συμπέρανε από κείμενο ⇒ `geocoded`,
 *     και **κουβαλά την ακρίβειά της** — που είναι ολόκληρη η Α5.
 *   - υπάρχουν συντεταγμένες **χωρίς** μεταδεδομένα geocoder ⇒ κάποιος τις **έβαλε**
 *     ⇒ `manual`.
 *
 * ⚠️ **Η δεύτερη περίπτωση δεν βαφτίζεται `geocoded` με `accuracy: 'center'`** — θα
 * ήταν εύκολο και θα ήταν **ψέμα** προς την ασφαλή κατεύθυνση: θα ζωγράφιζε σκιασμένη
 * πόλη εκεί που άνθρωπος έδειξε ακριβές σημείο, δηλαδή θα **έκρυβε** γνώση που έχουμε.
 * Η Α5 απαιτεί να λέμε **ό,τι ξέρουμε**, όχι το ασφαλέστερο.
 */
export function addressToPositionCandidate(
  address: AddressLike,
  locatedAt: string
): ListingPositionCandidate | null {
  const lat = address.coordinates?.lat;
  const lng = address.coordinates?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const accuracy = address.geocodingMetadata?.accuracy ?? null;
  const point = { lat, lng } as const;

  if (accuracy) {
    return { kind: 'known', provenance: 'geocoded', point, locatedAt, accuracy };
  }
  return { kind: 'known', provenance: 'manual', point, locatedAt };
}

// ---------------------------------------------------------------------------
// Η ΣΥΝΔΕΣΗ ΤΩΝ ΠΑΡΑΓΩΓΩΝ — το manifest (ADR-841 §7 Α2.2)
// ---------------------------------------------------------------------------

/**
 * **Μια δημοσιευμένη εικόνα, όπως τη μαθαίνει ο γραφέας από το ράφι.**
 *
 * ⚠️ **Δομικός τύπος και ΟΧΙ ο τύπος της υπηρεσίας**: το `public-shelf.service` σέρνει
 * `firebase-admin` και `sharp`, και αυτό το αρχείο δηλώνει ρητά ότι είναι **καθαρό**.
 * Η μία γραμμή μετάφρασης στον γραφέα είναι φθηνότερη από μια εξάρτηση που θα έκανε την
 * προβολή αδύνατη να δοκιμαστεί χωρίς κάδο.
 */
export interface ProjectedShelfImage {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly sources: readonly ListingImageSource[];
}

/**
 * **Η αγγελία με τη συλλογή της δεμένη** — η στιγμή που το έγγραφο γίνεται *manifest*.
 *
 * 🔑 **ΕΝΑΣ γραφέας του πεδίου, εδώ.** Ο πειρασμός ήταν ένα `{ ...listing, gallery }`
 * μέσα στον `writeListingProjection`, δίπλα στο `schemaVersion`. Αλλά το `schemaVersion`
 * είναι μεταδεδομένο **αποθήκευσης** *(κανείς επισκέπτης δεν το διαβάζει)*, ενώ η
 * συλλογή είναι **περιεχόμενο αγγελίας** — και το περιεχόμενο συντίθεται σε αυτό το
 * αρχείο, αλλιώς το κλειστό σχήμα θα είχε **δύο** τόπους σύνθεσης.
 *
 * 🔑 **Και το `altKey` μπαίνει ΕΔΩ, μία φορά**: είναι απόφαση **αποκάλυψης** *(τι λέμε
 * σε όποιον δεν βλέπει την εικόνα)*, όχι λεπτομέρεια απόδοσης. Δες
 * {@link LISTING_GALLERY_ALT_KEY} για το γιατί δεν είναι κενό και δεν περιγράφει.
 *
 * ⚠️ **Η σειρά ταξιδεύει αυτούσια** από τη συμφιλίωση, που την πήρε αυτούσια από την
 * επιλογή του κατόχου *(Α2.1)*. Καμία ταξινόμηση σε κανένα από τα τρία σημεία.
 */
export function withPublishedGallery(
  listing: PublicListing,
  images: readonly ProjectedShelfImage[],
): PublicListing {
  return {
    ...listing,
    gallery: images.map((image) => ({
      url: image.url,
      width: image.width,
      height: image.height,
      altKey: LISTING_GALLERY_ALT_KEY,
      sources: image.sources,
    })),
  };
}
