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

import { LISTED_COMMERCIAL_STATUSES, type CommercialStatus } from '@/constants/commercial-statuses';
import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';
import type { PropertyType } from '@/types/property';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import type { PublicListing, ListingPosition, UnknownPositionReason } from '@/types/public-listing';
import { outranksForLocation } from '@/lib/location/location-provenance';

// ============================================================================
// ΕΙΣΟΔΟΙ — δομικές, ΟΧΙ δεμένες σε ονομασμένο τύπο
// ============================================================================

/**
 * Το ακίνητο όπως το βλέπει η προβολή.
 *
 * Δομικός τύπος, **ίδιο ιδίωμα με το `PricedPropertyLike`** — και ο λόγος είναι ο ίδιος:
 * ο κώδικας κουβαλά **δύο** σχήματα `Property` (`@/types/property`,
 * `@/types/property-viewer`) συν τα ωμά δεδομένα Firestore του διακομιστή. Ένας
 * ονομασμένος τύπος εδώ θα ανάγκαζε cast σε **κάθε** καλούντα — δηλαδή θα μετέτρεπε
 * μια πραγματική ασυμφωνία σχημάτων σε `as`, που είναι το αντίθετο του ελέγχου.
 */
export interface ProjectableProperty {
  readonly id: string;
  readonly name?: string | null;
  readonly type?: string | null;
  readonly commercialStatus?: CommercialStatus | string | null;
  readonly status?: string | null;
  readonly offerKinds?: readonly string[] | null;
  readonly commercial?: {
    readonly askingPrice?: number | null;
    readonly finalPrice?: number | null;
    readonly rentPrice?: number | null;
  } | null;
  readonly areas?: { readonly gross?: number | null } | null;
  /** @deprecated επίπεδο πεδίο· διαβάζεται ως έσχατο εφεδρικό. */
  readonly area?: number | null;
  readonly floor?: number | null;
  readonly layout?: { readonly bedrooms?: number | null } | null;
  /**
   * 🔶 **Ο ΚΑΤΟΧΟΣ ΑΡΝΗΘΗΚΕ να δηλώσει θέση** (Α5 §3).
   *
   * ⚠️ **Κανένας γραφέας δεν υπάρχει σήμερα, και το δηλώνω αντί να το υπονοώ:** το
   * πεδίο θα το γράψει η **φόρμα του κατόχου**, όταν υλοποιηθεί το «*υποχρεωτικό
   * ΕΡΩΤΗΜΑ, όχι υποχρεωτική ΑΠΑΝΤΗΣΗ*». Μέχρι τότε **κάθε** αγγελία χωρίς θέση είναι
   * `never-asked` — που είναι και η **αλήθεια** για τα σημερινά ακίνητα: φτιάχτηκαν
   * πριν υπάρξει το ερώτημα, άρα η έλλειψη είναι **δικό μας** χρέος, όχι επιλογή τους.
   */
  readonly locationDisclosure?: 'declined' | null;
}

/**
 * Ό,τι ξέρουμε για τον **τόπο** του ακινήτου — λυμένο από τον καλούντα, που είναι ο
 * μόνος που ξέρει από πού να το διαβάσει (κτίριο → έργο → επίπεδο Α).
 *
 * 🔑 **Η θέση ΔΕΝ ανήκει στο ακίνητο** (Α1): το ακίνητο προσθέτει **όροφο**. Γι' αυτό
 * είναι ξεχωριστό όρισμα και όχι πεδίο του {@link ProjectableProperty} — ο τύπος λέει
 * την ιεραρχία, δεν την περιγράφει σε σχόλιο.
 */
export interface PlaceKnowledge {
  /** Υποψήφιες θέσεις, από **οποιαδήποτε** πηγή. Νικά η ισχυρότερη (§14.3). */
  readonly candidates: readonly ListingPositionCandidate[];
}

/** Μία υποψήφια θέση, με την προέλευσή της. */
export type ListingPositionCandidate = Extract<ListingPosition, { kind: 'known' }>;

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

  const commercial = property.commercial ?? null;

  return {
    id: property.id,
    commercialStatus: (property.commercialStatus ?? property.status ?? 'unavailable') as CommercialStatus,
    commercial: {
      askingPrice: numberOrNull(commercial?.askingPrice),
      finalPrice: numberOrNull(commercial?.finalPrice),
      rentPrice: numberOrNull(commercial?.rentPrice),
    },
    // 🔶 Η εικόνα μπαίνει όταν υπάρξει ο παραγωγός της (Α19, κανόνας 31: **προ-ψημένο
    // artifact από το μοντέλο**, ποτέ ανέβασμα χρήστη). Μέχρι τότε `null` = «δεν
    // υπάρχει», και η οθόνη οφείλει να το πει — ποτέ εξωτερικό placeholder (§25.5.2).
    coverImage: null,
    type: (property.type ?? 'apartment') as PropertyType,
    areaSqm: numberOrNull(property.areas?.gross) ?? numberOrNull(property.area),
    offerKinds: (property.offerKinds ?? []).filter((k): k is OfferKind => PUBLIC_OFFER_KINDS.has(k)),
    position: resolveListingPosition(place, property.locationDisclosure),
    floor: numberOrNull(property.floor),
    bedrooms: numberOrNull(property.layout?.bedrooms),
    title: (property.name ?? '').trim(),
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
