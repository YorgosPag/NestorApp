/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΘΕΣΗΣ ΜΙΑΣ ΔΙΕΥΘΥΝΣΗΣ** — σημείο *και* ακρίβεια, μαζί ή καθόλου.
 * @related ADR-777 Α5 · ADR-332 §3.10 (Φάση 8) · lib/location/location-provenance.ts
 * @module lib/geocoding/address-position
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — μετρημένο 2026-08-25, όχι υποθετικό
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `ProjectAddress.geocodingMetadata` περιγράφεται στον τύπο του ως *«Frozen
 * geocoding metadata captured **at write time**»*, και το
 * `subapps/dxf-viewer/systems/basemap/project-anchor-resolution.ts` δηλώνει στην
 * κεφαλίδα του, κατά λέξη, ότι *«τα γράφει ο **επεξεργαστής διευθύνσεων (ADR-332)**
 * μαζί με παγωμένα μεταδεδομένα ποιότητας»*.
 *
 * **Κανείς δεν τα γράφει.** Μετρημένο με παρονομαστή:
 *
 *     grep -rn "geocodingMetadata" src/ --include=*.ts --include=*.tsx | grep -v __tests__
 *     → 12 ευρήματα · **και τα 12 αναγνώστες** (3 καταναλωτές + 3 αρχεία τύπων/βοηθών)
 *
 * ⇒ Το `provenance: 'geocoded'` του {@link ../../services/listings/public-listing-projection}
 * ήταν **απροσπέλαστο**, και μαζί του ολόκληρη η κλίμακα ακρίβειας
 * (`exact` → πινέζα … `center` → σκιασμένη πόλη). Κάθε αγγελία εταιρείας που θα
 * αποκτούσε θέση θα ζωγραφιζόταν ως **ακριβής πινέζα** — είτε γράφτηκε «Εγνατίας 147»
 * είτε «Θεσσαλονίκη».
 *
 * Είναι **κατά λέξη** το ελάττωμα που γεννήθηκε να λύσει το `lib/listings/listing-map-shape.ts`
 * (*«Μια «Θεσσαλονίκη» και μια «Εγνατίας 147» ζωγραφίζονται **οπτικά ταυτόσημες**»*),
 * αναπαραγμένο **ένα στρώμα πιο πάνω**: εκείνο το αρχείο έλυσε το *σχήμα από την
 * ακρίβεια*, και η ακρίβεια **δεν έφτανε ποτέ**. Φρουρός με σωστό κριτήριο και
 * ανύπαρκτη είσοδο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΕΝΤΕ ΤΟΠΟΙ ΑΠΑΝΤΟΥΣΑΝ «ΠΟΥ ΕΙΝΑΙ ΑΥΤΗ Η ΔΙΕΥΘΥΝΣΗ;» — ΚΑΘΕΝΑΣ ΕΧΑΝΕ ΚΑΤΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | # | Τόπος | Τι έχανε |
 * |---|---|---|
 * | 1 | `useAddressMapGeocoding` (περιηγητής) | λύνει τη διεύθυνση **για την οθόνη** και **πετά** την απάντηση |
 * | 2 | `useProjectLocations` | αποθηκεύει `coordinates` **μόνο** αν ο άνθρωπος σύρει την πινέζα |
 * | 3 | `geocodePrimaryAddress` (κτίρια) | λύνει στον διακομιστή και **πετά** `accuracy` + `confidence` |
 * | 4 | `addressToPositionCandidate` | συνάγει προέλευση από μεταδεδομένα που **κανείς δεν γράφει** |
 * | 5 | `project-anchor-resolution` | διαβάζει τα ίδια μεταδεδομένα, και **ισχυρίζεται** ότι κάποιος τα γράφει |
 *
 * Είναι το σχήμα του **ADR-749** στην ακριβέστερη μορφή του: πολλές μηχανές, μία
 * ερώτηση, και η απάντηση **χάνεται στη μεταφορά**. Εδώ απαντιέται **μία φορά**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΠΡΑΚΤΙΚΗ — και τι ακολουθούμε αυτούσιο
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Ακολουθούμε** (γιατί είναι σωστό και καθιερωμένο):
 *   - Το `GeocodingAccuracy` (`exact` · `interpolated` · `approximate` · `center`) **είναι**
 *     η κλίμακα `location_type` της Google (`ROOFTOP` · `RANGE_INTERPOLATED` ·
 *     `GEOMETRIC_CENTER` · `APPROXIMATE`). Δεν επινοούμε λεξιλόγιο.
 *   - Η βιομηχανία αποθηκεύει την ακρίβεια **δίπλα** στη συντεταγμένη — *«critical for
 *     tracking the quality of your geocoded data»*. Αυτό κάνουμε.
 *   - Το **OSMF Geocoding Guideline** επιτρέπει ρητά την **αποθήκευση**: *«only names,
 *     addresses, and/or latitude/longitude information are included»* ⇒ το share-alike
 *     **δεν** ενεργοποιείται. Γι' αυτό αποθηκεύουμε σημείο και **ποτέ** γεωμετρία
 *     (`outline`) — δες `app/api/places/[placeId]/outline/route.ts`.
 *
 * **Ξεπερνάμε** σε δύο σημεία, και τα δύο είναι δομικά:
 *
 * 1. **Το σημείο και η ακρίβειά του είναι ΕΝΑ πράγμα, αδιαίρετο.** Οι μεγάλοι
 *    επιστρέφουν `location_type` και αφήνουν τον καταναλωτή να θυμηθεί να το κρατήσει —
 *    και ο δικός μας #3 παραπάνω **δεν το θυμήθηκε**. Εδώ ο τύπος επιστροφής είναι
 *    **κλειστή ένωση καταστάσεων**: δεν υπάρχει τιμή που να λέει «σημείο, χωρίς να ξέρω
 *    πόσο καλό». Η απώλεια ακρίβειας δεν είναι δύσκολη — είναι **μη εκφράσιμη**.
 *
 * 2. **«Δεν βρέθηκε» και «δεν ρωτήθηκε ποτέ» και «μας έκοψε ο ρυθμιστής» είναι ΤΡΕΙΣ
 *    διαφορετικές απαντήσεις.** Ένας γεωκωδικοποιητής που επιστρέφει `null` και για τα
 *    τρία υποχρεώνει τον καλούντα να μαντέψει — και το λάθος μάντεμα **σβήνει σωστές
 *    συντεταγμένες σε μια διακοπή δικτύου**. Δες {@link AddressPositionOutcome}.
 */

import type { GeocodingAccuracy, GeocodingVariant } from './geocoding-types';

// ============================================================================
// ΕΙΣΟΔΟΙ — δομικές, ΟΧΙ δεμένες σε ονομασμένο τύπο
// ============================================================================

/**
 * Τα πεδία κειμένου που **ορίζουν** τη γεωγραφική ταυτότητα μιας διεύθυνσης.
 *
 * 🔑 **Δεν είναι δεύτερη λίστα.** Είναι το ίδιο σύνολο με το `ADDRESS_GEOCODING_FIELDS`
 * (`components/shared/addresses/address-map-config.tsx`), και ο τύπος το **επιβάλλει**:
 * το {@link assertSameGeocodingFields} στο test συγκρίνει τα δύο σύνολα, ώστε μια
 * προσθήκη εκεί να **κοκκινίσει** εδώ αντί να αποκλίνει σιωπηλά.
 *
 * ⚠️ Δεν εισάγεται απευθείας από εκείνο το αρχείο **επίτηδες**: είναι module του
 * περιηγητή (`.tsx`, εισάγει React), και αυτό εδώ τρέχει στον **διακομιστή**.
 */
export const ADDRESS_IDENTITY_FIELDS = [
  'street',
  'number',
  'city',
  'neighborhood',
  'postalCode',
  'municipality',
  'region',
  'regionalUnit',
  'country',
] as const;

export type AddressIdentityField = (typeof ADDRESS_IDENTITY_FIELDS)[number];

/**
 * Η διεύθυνση όπως τη βλέπει αυτό το αρχείο — **δομικός** τύπος.
 *
 * Ίδιο ιδίωμα με το `ProjectableProperty`, και ο λόγος είναι ο ίδιος: την ίδια ερώτηση
 * τη ρωτούν το `ProjectAddress`, το `ContactAddress` και τα ωμά δεδομένα Firestore του
 * διακομιστή. Ένας ονομασμένος τύπος θα ανάγκαζε `as` σε κάθε καλούντα — δηλαδή θα
 * μετέτρεπε μια πραγματική ασυμφωνία σχημάτων σε cast.
 */
export type AddressLike = {
  readonly [K in AddressIdentityField]?: string | null;
} & {
  readonly coordinates?: { readonly lat?: number | null; readonly lng?: number | null } | null;
  readonly geocodingMetadata?: AddressGeocodingMetadata | null;
};

/** Τα παγωμένα μεταδεδομένα ποιότητας — **το σχήμα του `ProjectAddress`, αυτούσιο**. */
export interface AddressGeocodingMetadata {
  readonly confidence: number;
  readonly accuracy: GeocodingAccuracy;
  readonly variantUsed: number;
  readonly osmType?: string;
}

/** Ό,τι χρειάζεται αυτό το αρχείο από μια απάντηση γεωκωδικοποίησης. */
export interface GeocodeHit {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy: GeocodingAccuracy;
  readonly confidence: number;
  readonly variantUsed?: GeocodingVariant;
  readonly osmType?: string;
}

/**
 * Ο γεωκωδικοποιητής, **ενθυλακωμένος**.
 *
 * 🔑 **Παράμετρος και όχι εισαγωγή, για δύο μετρημένους λόγους:**
 *
 * 1. Η πραγματική `geocode()` ζει στο `app/api/geocoding/geocoding-engine.ts`. Το
 *    `services/places/place-source-verification.ts` την εισάγει από εκεί και **δηλώνει
 *    το χρέος στρωμάτωσης στο ίδιο του το σχόλιο**. Ένα δεύτερο αρχείο με το ίδιο χρέος
 *    δεν είναι επανάληψη κώδικα — είναι επανάληψη **λάθους**.
 * 2. Η απόφαση αυτού του αρχείου είναι **λογική**, όχι δίκτυο. Ενθυλακωμένη, ελέγχεται
 *    εξαντλητικά **χωρίς καμία κλήση δικτύου** — και ο έλεγχος είναι που κάνει τις
 *    καταστάσεις πραγματικές αντί για δηλωμένες.
 *
 * ⚠️ **Το συμβόλαιο έχει ΤΡΕΙΣ εκβάσεις, όχι δύο.** `null` = *«ρώτησα, δεν υπάρχει»*·
 * **εξαίρεση** = *«δεν μπόρεσα να ρωτήσω»*. Δες {@link AddressPositionOutcome}.
 */
export type AddressGeocoder = (query: GeocoderQuery) => Promise<GeocodeHit | null>;

/** Το ερώτημα προς τον γεωκωδικοποιητή — τα πεδία ταυτότητας, καθαρισμένα. */
export type GeocoderQuery = {
  readonly [K in AddressIdentityField]?: string;
};

// ============================================================================
// ΕΞΟΔΟΣ — κλειστή ένωση καταστάσεων, καμία σιωπή
// ============================================================================

/**
 * **Τι έγινε**, ονομαστικά. Έξι καταστάσεις, καμία `default`.
 *
 * 🔴 **Ο λόγος που είναι έξι και όχι δύο** είναι ότι τρεις από αυτές οδηγούν σε
 * **αντίθετες** πράξεις πάνω στα ίδια αποθηκευμένα δεδομένα:
 *
 * - `unresolved` ⇒ **σβήνει** τη θέση. Η διεύθυνση άλλαξε και δεν λύνεται· κρατώντας
 *   την παλιά συντεταγμένη θα δείχναμε το **προηγούμενο** κτίριο για τη **νέα**
 *   διεύθυνση. Η Α5 απαιτεί να λέμε *ό,τι ξέρουμε*, όχι το ασφαλέστερο.
 * - `geocoder-unavailable` ⇒ **κρατά** τη θέση αμετάβλητη. Δεν μάθαμε τίποτα· μια
 *   διακοπή δικτύου δεν είναι γνώση, και **δεν επιτρέπεται να σβήσει** σωστό σημείο.
 * - `unchanged` ⇒ **κρατά** τη θέση αυτούσια, **μαζί με την προέλευσή της**.
 *
 * ⚠️ Οι δύο πρώτες θα ήταν **ταυτόσημες** αν ο γεωκωδικοποιητής επέστρεφε `null` και
 * στις δύο περιπτώσεις — και η ζημιά θα ήταν **σιωπηλή απώλεια θέσεων σε κάθε διακοπή**.
 * Η διάκριση υπάρχει ήδη στο `geocodeAddressDetailed` (*«δεν υπάρχει» ≠ «μας έκοψε ο
 * ρυθμιστής»*)· εδώ **δεν χάνεται**.
 */
export type AddressPositionOutcome =
  /** Ο άνθρωπος έσυρε την πινέζα. Το σημείο **είναι** η απάντηση — καμία κλίμακα ακρίβειας. */
  | 'human-pinned'
  /** Η μηχανή έλυσε το κείμενο, και η ακρίβεια ταξιδεύει μαζί. */
  | 'geocoded'
  /** Τίποτα σχετικό δεν άλλαξε — η αποθηκευμένη θέση μένει **αυτούσια**. */
  | 'unchanged'
  /** Ρωτήθηκε και **δεν υπάρχει**. Η θέση σβήνεται. */
  | 'unresolved'
  /** **Δεν μπόρεσε να ρωτηθεί.** Η αποθηκευμένη θέση μένει άθικτη. */
  | 'geocoder-unavailable'
  /** Δεν υπάρχει αρκετό κείμενο για να τεθεί ερώτημα (ούτε οδός ούτε πόλη). */
  | 'insufficient-address';

/** Η προέλευση όπως αποθηκεύεται — υποσύνολο του `AddressSourceType`, τα τρία που παράγει αυτό το αρχείο. */
export type WrittenAddressSource = 'geocoded' | 'dragged' | 'manual';

/**
 * Ό,τι πρέπει να γραφτεί στη διεύθυνση, **ολόκληρο**.
 *
 * 🔴 **Τα τέσσερα πεδία ταξιδεύουν ΜΑΖΙ, και εκεί είναι όλο το νόημα.** Ένας τύπος που
 * επέστρεφε μόνο `{ lat, lng }` είναι ακριβώς αυτό που κάνει σήμερα το
 * `geocodePrimaryAddress` των κτιρίων — και γι' αυτό η ακρίβεια χάνεται εκεί. Εδώ ο
 * καλών **δεν μπορεί** να γράψει σημείο χωρίς να πει από πού ήρθε και πόσο καλό είναι:
 * δεν υπάρχει τιμή που να το εκφράζει.
 *
 * ⚠️ **`null` σημαίνει «σβήσε το», `undefined` δεν υπάρχει εδώ.** Η διάκριση είναι
 * σκόπιμη: ο καλών γράφει Firestore, όπου το «λείπει το κλειδί» και το «η τιμή είναι
 * κενή» είναι **διαφορετικές** πράξεις. Δες {@link applyAddressPosition}.
 */
export interface AddressPosition {
  readonly coordinates: { readonly lat: number; readonly lng: number } | null;
  readonly geocodingMetadata: AddressGeocodingMetadata | null;
  readonly source: WrittenAddressSource | null;
  /** Unix-ms — πότε επιβεβαιώθηκε αυτή η θέση. `null` όταν δεν υπάρχει θέση. */
  readonly verifiedAt: number | null;
}

/** Η πλήρης απάντηση: **τι** να γραφτεί και **γιατί**. */
export interface AddressPositionResolution {
  readonly outcome: AddressPositionOutcome;
  readonly position: AddressPosition;
}

// ============================================================================
// Η ΑΠΟΦΑΣΗ
// ============================================================================

/** Έγκυρο ζεύγος συντεταγμένων. `0` είναι **υπαρκτή τιμή** — μόνο η απουσία είναι απουσία. */
function readPoint(
  address: AddressLike
): { readonly lat: number; readonly lng: number } | null {
  const lat = address.coordinates?.lat;
  const lng = address.coordinates?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Κανονικοποιημένη τιμή πεδίου ταυτότητας.
 *
 * ⚠️ Το `''`, το `null` και το `undefined` είναι **η ίδια απουσία**. Χωρίς αυτό, μια
 * φόρμα που στέλνει `number: ''` εκεί που η βάση έχει `number: undefined` θα φαινόταν
 * **αλλαγή** και θα ξεκινούσε γεωκωδικοποίηση σε κάθε αποθήκευση — δηλαδή θα έσπαγε την
 * πολιτική **1 αίτημα/δευτερόλεπτο** του Nominatim για μηδέν κέρδος.
 */
function identityValue(address: AddressLike, field: AddressIdentityField): string {
  const raw = address[field];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Άλλαξε η **γεωγραφική ταυτότητα**; (Το `label`, ο τύπος και η σειρά δεν μετρούν.) */
export function addressIdentityChanged(a: AddressLike | null, b: AddressLike): boolean {
  if (a === null) return true;
  return ADDRESS_IDENTITY_FIELDS.some((f) => identityValue(a, f) !== identityValue(b, f));
}

/** Άλλαξε το **σημείο**; (Δύο απόντα σημεία δεν είναι αλλαγή.) */
function pointChanged(a: AddressLike | null, b: AddressLike): boolean {
  const pa = a === null ? null : readPoint(a);
  const pb = readPoint(b);
  if (pa === null && pb === null) return false;
  if (pa === null || pb === null) return true;
  return pa.lat !== pb.lat || pa.lng !== pb.lng;
}

/** Το ερώτημα προς τη μηχανή — **μόνο** πεδία με περιεχόμενο. */
function toQuery(address: AddressLike): GeocoderQuery {
  const query: Record<string, string> = {};
  for (const field of ADDRESS_IDENTITY_FIELDS) {
    const value = identityValue(address, field);
    if (value) query[field] = value;
  }
  return query as GeocoderQuery;
}

/** Καμία θέση — η ρητή κενή τιμή, γραμμένη μία φορά. */
const NO_POSITION: AddressPosition = {
  coordinates: null,
  geocodingMetadata: null,
  source: null,
  verifiedAt: null,
};

/** Η αποθηκευμένη θέση, **αυτούσια** — για τις καταστάσεις που δεν αλλάζουν τίποτα. */
function keepStored(stored: AddressLike | null): AddressPosition {
  if (stored === null) return NO_POSITION;
  const point = readPoint(stored);
  if (point === null) return NO_POSITION;
  return {
    coordinates: point,
    geocodingMetadata: stored.geocodingMetadata ?? null,
    // ⚠️ Η προέλευση **συνάγεται από τα ίδια τα δεδομένα**, ίδιο κριτήριο με το
    // `addressToPositionCandidate`: μεταδεδομένα ⇒ μηχανή, σκέτο σημείο ⇒ άνθρωπος.
    // Δεύτερο κριτήριο εδώ θα ήταν δεύτερη αλήθεια για την ίδια ερώτηση (ADR-749).
    source: stored.geocodingMetadata ? 'geocoded' : 'dragged',
    verifiedAt: null,
  };
}

/**
 * **Πού είναι αυτή η διεύθυνση, και πόσο ακριβώς;** — η μία απάντηση.
 *
 * Η σειρά των κανόνων **είναι συμβόλαιο**:
 *
 * 1. **Ο άνθρωπος πρώτα.** Αν το σημείο άλλαξε ενώ το κείμενο έμεινε ίδιο, κάποιος
 *    έσυρε την πινέζα. Καμία μηχανή δεν έχει λόγο να το αμφισβητήσει — και το
 *    `outranksForLocation` το επιβεβαιώνει ανεξάρτητα (`manual` 2 > `geocoded` 1).
 *    Αν κρινόταν δεύτερο, μια αλλαγή κειμένου **στην ίδια αποθήκευση** θα έσβηνε την
 *    πινέζα που μόλις τοποθέτησε άνθρωπος.
 * 2. **Τίποτα δεν άλλαξε ⇒ μηδέν αίτημα.** Είναι ο κανόνας που κρατά τη συμμόρφωση με
 *    το **1 αίτημα/δευτερόλεπτο** του Nominatim: μια αποθήκευση που αγγίζει μόνο την
 *    ετικέτα δεν ρωτά κανέναν.
 * 3. **Αλλιώς ρώτα** — και μετάφρασε τις **τρεις** εκβάσεις σε τρεις διαφορετικές πράξεις.
 *
 * @param stored   Η διεύθυνση όπως είναι **στη βάση**, ή `null` αν είναι νέα.
 * @param incoming Η διεύθυνση όπως την έστειλε ο πελάτης.
 * @param geocode  Ο γεωκωδικοποιητής. `null` ⇒ δεν υπάρχει· **εξαίρεση** ⇒ δεν ρωτήθηκε.
 * @param now      Η στιγμή, ως όρισμα — ώστε ο καλών να γράφει **μία** στιγμή σε όλη τη σάρωση.
 */
export async function resolveAddressPosition(
  stored: AddressLike | null,
  incoming: AddressLike,
  geocode: AddressGeocoder,
  now: number
): Promise<AddressPositionResolution> {
  const identityMoved = addressIdentityChanged(stored, incoming);
  const point = readPoint(incoming);

  // ── 1. Ο ΑΝΘΡΩΠΟΣ ────────────────────────────────────────────────────────
  if (!identityMoved && pointChanged(stored, incoming) && point !== null) {
    return {
      outcome: 'human-pinned',
      position: { coordinates: point, geocodingMetadata: null, source: 'dragged', verifiedAt: now },
    };
  }

  // ── 2. ΤΙΠΟΤΑ ΔΕΝ ΑΛΛΑΞΕ ─────────────────────────────────────────────────
  if (!identityMoved && !pointChanged(stored, incoming)) {
    return { outcome: 'unchanged', position: keepStored(stored) };
  }

  // Νέα διεύθυνση **με** σημείο και **χωρίς** μεταδεδομένα: ο μόνος τρόπος να συμβεί
  // είναι η φόρμα προσθήκης, που αποθηκεύει συντεταγμένες **μόνο** όταν ο άνθρωπος
  // σύρει την πινέζα. Άρα είναι κι αυτό ανθρώπινη τοποθέτηση, όχι κείμενο προς επίλυση.
  if (stored === null && point !== null && !incoming.geocodingMetadata) {
    return {
      outcome: 'human-pinned',
      position: { coordinates: point, geocodingMetadata: null, source: 'dragged', verifiedAt: now },
    };
  }

  // ── 3. ΡΩΤΑ ΤΗ ΜΗΧΑΝΗ ────────────────────────────────────────────────────
  const query = toQuery(incoming);
  if (!query.street && !query.city) {
    return { outcome: 'insufficient-address', position: NO_POSITION };
  }

  let hit: GeocodeHit | null;
  try {
    hit = await geocode(query);
  } catch {
    // ⚠️ **Άγνοια, όχι γνώση.** Η αποθηκευμένη θέση μένει άθικτη — δες την κεφαλίδα
    // του {@link AddressPositionOutcome} για το γιατί αυτό ΔΕΝ είναι το ίδιο με `null`.
    return { outcome: 'geocoder-unavailable', position: keepStored(stored) };
  }

  if (hit === null) {
    return { outcome: 'unresolved', position: NO_POSITION };
  }

  return {
    outcome: 'geocoded',
    position: {
      coordinates: { lat: hit.lat, lng: hit.lng },
      geocodingMetadata: {
        confidence: hit.confidence,
        accuracy: hit.accuracy,
        variantUsed: hit.variantUsed ?? 0,
        ...(hit.osmType ? { osmType: hit.osmType } : {}),
      },
      source: 'geocoded',
      verifiedAt: now,
    },
  };
}

// ============================================================================
// ΕΦΑΡΜΟΓΗ — από την απόφαση στο έγγραφο
// ============================================================================

/**
 * Γράφει την απόφαση πάνω στη διεύθυνση, **ολόκληρη**.
 *
 * 🔴 **Τα τέσσερα πεδία γράφονται ΠΑΝΤΑ μαζί — και το «σβήσιμο» είναι ΑΦΑΙΡΕΣΗ κλειδιού,
 * όχι `null`.** Το `stripUndefinedDeep` του γραφέα πετά τα `undefined` πριν φτάσουν στο
 * Firestore, οπότε ένα πεδίο που έγινε `undefined` **μένει με την παλιά του τιμή** στο
 * έγγραφο. Γι' αυτό η συνάρτηση επιστρέφει αντικείμενο όπου το «καμία θέση» εκφράζεται
 * με **απουσία των κλειδιών από το αποτέλεσμα** — και ο καλών γράφει ολόκληρο τον
 * πίνακα `addresses` με `set`-σημασιολογία, όχι μερική ενημέρωση.
 *
 * ⚠️ Αν κάποιος μελλοντικός καλών κάνει **μερική** ενημέρωση πεδίου-πεδίου, οφείλει να
 * γράψει ρητά `FieldValue.delete()` για τα απόντα. Δεν το κάνει αυτή η συνάρτηση επειδή
 * θα έδενε ένα καθαρό module στο Admin SDK.
 */
export function applyAddressPosition<T extends object>(
  address: T,
  position: AddressPosition
): T {
  const rest = { ...address } as Record<string, unknown>;
  delete rest['coordinates'];
  delete rest['geocodingMetadata'];
  delete rest['source'];
  delete rest['verifiedAt'];

  if (position.coordinates === null) return { ...rest, coordinates: undefined } as T;

  return {
    ...rest,
    coordinates: position.coordinates,
    ...(position.geocodingMetadata ? { geocodingMetadata: position.geocodingMetadata } : {}),
    ...(position.source ? { source: position.source } : {}),
    ...(position.verifiedAt !== null ? { verifiedAt: position.verifiedAt } : {}),
  } as T;
}

// ============================================================================
// ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ — ποιος κρίθηκε, ονομαστικά
// ============================================================================

/** Πλήθος ανά έκβαση. Κάθε κάδος υπάρχει **ακόμη και στο μηδέν**. */
export type AddressPositionTally = Readonly<Record<AddressPositionOutcome, number>>;

/** Οι έξι εκβάσεις — **παράγεται** από τη λογιστική, δεν ξαναγράφεται. */
const EMPTY_TALLY: AddressPositionTally = {
  'human-pinned': 0,
  geocoded: 0,
  unchanged: 0,
  unresolved: 0,
  'geocoder-unavailable': 0,
  'insufficient-address': 0,
};

export const ADDRESS_POSITION_OUTCOMES: readonly AddressPositionOutcome[] = Object.keys(
  EMPTY_TALLY
) as AddressPositionOutcome[];

/**
 * Λύνει **όλες** τις διευθύνσεις ενός εγγράφου και επιστρέφει τις νέες μαζί με τη
 * λογιστική.
 *
 * ⚠️ **Σειριακά, ΠΟΤΕ `Promise.all`.** Η πολιτική χρήσης του Nominatim είναι *«an
 * absolute maximum of 1 request per second»*· ένα `Promise.all` πάνω σε πέντε
 * διευθύνσεις τη σπάει **στο πρώτο κιόλας αίτημα**. Το κόστος είναι πραγματικό αλλά
 * φραγμένο: μόνο οι διευθύνσεις που **άλλαξαν** ρωτούν (κανόνας 2).
 *
 * 🔑 **Η αντιστοίχιση γίνεται με το `id`, ποτέ με τη θέση στον πίνακα.** Ο πελάτης
 * μπορεί να αναδιατάξει, να σβήσει ή να προσθέσει· ένα ταίριασμα κατά δείκτη θα
 * σύγκρινε **άλλη** διεύθυνση με άλλη, δηλαδή θα διάβαζε αλλαγή εκεί που δεν υπήρχε
 * και θα ξεκινούσε γεωκωδικοποίηση για λάθος κείμενο.
 */
export async function resolveAddressPositions<T extends AddressLike & { readonly id?: string }>(
  storedAddresses: readonly T[],
  incomingAddresses: readonly T[],
  geocode: AddressGeocoder,
  now: number
): Promise<{ readonly addresses: readonly T[]; readonly tally: AddressPositionTally }> {
  const storedById = new Map<string, T>();
  for (const address of storedAddresses) {
    if (typeof address.id === 'string' && address.id) storedById.set(address.id, address);
  }

  const tally: Record<AddressPositionOutcome, number> = { ...EMPTY_TALLY };
  const resolved: T[] = [];

  for (const incoming of incomingAddresses) {
    const stored =
      typeof incoming.id === 'string' && incoming.id ? storedById.get(incoming.id) ?? null : null;
    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, now);
    tally[outcome] += 1;
    resolved.push(applyAddressPosition(incoming, position));
  }

  return { addresses: resolved, tally };
}
