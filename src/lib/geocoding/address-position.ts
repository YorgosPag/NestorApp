/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΘΕΣΗΣ ΜΙΑΣ ΔΙΕΥΘΥΝΣΗΣ** — σημείο *και* ακρίβεια, μαζί ή καθόλου.
 * @related ADR-777 Α5 · ADR-332 §3.10 (Φάση 8) · ADR-332 D27 · lib/location/location-provenance.ts
 * @module lib/geocoding/address-position
 *
 * ⚠️ **Διασπάστηκε 2026-09-10 (N.7.1, ADR-332 D27 Βήμα Β)**: οι τύποι ζουν στο
 * `address-position-types.ts`, οι καθαροί κανόνες στο `address-position-rules.ts`. Αυτό το
 * αρχείο κρατά την **απόφαση** και την **εφαρμογή**, και επανεξάγει τα πάντα — κανένας
 * καταναλωτής δεν άλλαξε εισαγωγή.
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
 *   - **Η πινέζα του ανθρώπου μένει** όταν αλλάζει αργότερα το κείμενο (ADR-332 D27 Φ2β):
 *     Revit (η αλλαγή διεύθυνσης δεν μετακινεί την πινέζα) · Apple Maps · Salesforce Verified.
 *
 * **Ξεπερνάμε** σε τρία σημεία, και τα τρία είναι δομικά:
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
 *
 * 3. **Η κρατημένη πινέζα ΜΕΤΡΙΕΤΑΙ.** Το Salesforce κρατά τη μπαγιάτικη θέση σιωπηλά· εδώ,
 *    όταν η νέα διεύθυνση λύνεται πέρα από την αβεβαιότητα της μηχανής, επιστρέφεται
 *    **απόκλιση σε μέτρα** ώστε ο άνθρωπος να αποφασίσει (`drift`).
 */

import {
  addressIdentityChanged,
  geocodedPosition,
  humanPinned,
  keepStored,
  measureDrift,
  NO_POSITION,
  pointChanged,
  readPoint,
  storedHumanPoint,
  toQuery,
  withTrimmedIdentity,
} from './address-position-rules';
import type {
  AddressGeocoder,
  AddressLike,
  AddressPosition,
  AddressPositionDrift,
  AddressPositionIntent,
  AddressPositionOutcome,
  AddressPositionResolution,
  AddressPositionTally,
  GeocodeHit,
  ResolveAddressPositionsOptions,
  ResolvedAddressPositions,
} from './address-position-types';

export { ADDRESS_IDENTITY_FIELDS } from './address-position-types';
export type {
  AddressIdentityField,
  AddressLike,
  AddressGeocodingMetadata,
  GeocodeHit,
  AddressGeocoder,
  GeocoderQuery,
  AddressPositionOutcome,
  WrittenAddressSource,
  AddressPosition,
  PositionDrift,
  AddressPositionDrift,
  AddressPositionIntent,
  AddressPositionResolution,
  AddressPositionTally,
  ResolveAddressPositionsOptions,
  ResolvedAddressPositions,
} from './address-position-types';
export { addressIdentityChanged } from './address-position-rules';

// ============================================================================
// Η ΑΠΟΦΑΣΗ
// ============================================================================

/**
 * Κανόνας 3 — **ρώτα τη μηχανή**, και μετάφρασε τις **τρεις** εκβάσεις σε τρεις πράξεις.
 *
 * ⚠️ **Εξαίρεση = άγνοια, όχι γνώση.** Η αποθηκευμένη θέση μένει άθικτη — δες την κεφαλίδα
 * του {@link AddressPositionOutcome} για το γιατί αυτό ΔΕΝ είναι το ίδιο με `null`.
 */
async function askMachine(
  stored: AddressLike | null,
  incoming: AddressLike,
  geocode: AddressGeocoder,
  now: number,
): Promise<AddressPositionResolution> {
  const query = toQuery(incoming);
  if (!query.street && !query.city) return { outcome: 'insufficient-address', position: NO_POSITION };

  let hit: GeocodeHit | null;
  try {
    hit = await geocode(query);
  } catch {
    return { outcome: 'geocoder-unavailable', position: keepStored(stored) };
  }
  if (hit === null) return { outcome: 'unresolved', position: NO_POSITION };
  return { outcome: 'geocoded', position: geocodedPosition(hit, now) };
}

/**
 * Κανόνας 2γ — **η πινέζα του ανθρώπου μένει** (ADR-332 D27 Βήμα Β, Φ2β).
 *
 * Το νέο κείμενο ρωτιέται **μόνο για μέτρηση** — ένα αίτημα, όσα και ο παλιός κανόνας 3. Αν η
 * μηχανή δεν απαντήσει ή δεν βρει τίποτα, η πινέζα μένει **χωρίς** απόκλιση: δεν επινοούμε
 * αντίφαση που δεν μετρήσαμε.
 */
async function keepHumanPin(
  stored: AddressLike,
  incoming: AddressLike,
  human: { readonly lat: number; readonly lng: number },
  geocode: AddressGeocoder,
): Promise<AddressPositionResolution> {
  const position = keepStored(stored);
  const query = toQuery(incoming);
  if (!query.street && !query.city) return { outcome: 'human-kept', position };

  let hit: GeocodeHit | null = null;
  try {
    hit = await geocode(query);
  } catch {
    // Άγνοια: η πινέζα μένει, καμία απόκλιση.
  }
  const drift = hit ? measureDrift(human, hit) : null;
  return { outcome: 'human-kept', position, ...(drift ? { drift } : {}) };
}

/**
 * **Πού είναι αυτή η διεύθυνση, και πόσο ακριβώς;** — η μία απάντηση.
 *
 * Η σειρά των κανόνων **είναι συμβόλαιο**:
 *
 * 1. **Ο άνθρωπος πρώτα.** Αν το σημείο άλλαξε και είτε το κείμενο έμεινε ίδιο είτε ο πελάτης
 *    **δηλώνει** `source: 'dragged'`, κάποιος έσυρε την πινέζα. Αν κρινόταν δεύτερο, μια αλλαγή
 *    κειμένου **στην ίδια αποθήκευση** θα έσβηνε την πινέζα που μόλις τοποθέτησε άνθρωπος.
 * 1β. **Ρητή δήλωση «μετακίνησε στη διεύθυνση»** (`intent.relocate`) ⇒ ρώτα τη μηχανή — ακόμη κι
 *    αν τίποτα δεν άλλαξε: είναι η απάντηση του ανθρώπου σε συμβουλή απόκλισης.
 * 2. **Τίποτα δεν άλλαξε ⇒ μηδέν αίτημα** — η συμμόρφωση με το **1 αίτημα/δευτ.** του Nominatim.
 *    Νέα διεύθυνση **με** σημείο και **χωρίς** μεταδεδομένα = ανθρώπινη τοποθέτηση (φόρμα προσθήκης).
 * 2γ. **Άλλαξε μόνο το κείμενο και η αποθηκευμένη πινέζα είναι ανθρώπου ⇒ μένει** (Φ2β).
 * 3. **Αλλιώς ρώτα τη μηχανή.**
 *
 * @param stored   Η διεύθυνση όπως είναι **στη βάση**, ή `null` αν είναι νέα.
 * @param incoming Η διεύθυνση όπως την έστειλε ο πελάτης.
 * @param geocode  Ο γεωκωδικοποιητής. `null` ⇒ δεν υπάρχει· **εξαίρεση** ⇒ δεν ρωτήθηκε.
 * @param now      Η στιγμή, ως όρισμα — ώστε ο καλών να γράφει **μία** στιγμή σε όλη τη σάρωση.
 * @param intent   Ρητή δήλωση του ανθρώπου για **αυτή** την αποθήκευση — ποτέ αποθηκευμένη.
 */
export async function resolveAddressPosition(
  stored: AddressLike | null,
  incoming: AddressLike,
  geocode: AddressGeocoder,
  now: number,
  intent: AddressPositionIntent = {},
): Promise<AddressPositionResolution> {
  const identityMoved = addressIdentityChanged(stored, incoming);
  const point = readPoint(incoming);
  const moved = pointChanged(stored, incoming);

  // 🔴 «Κείμενο ίδιο» ΔΕΝ αρκεί: το σύρσιμο ξαναγράφει οδό/αριθμό από την αντίστροφη
  // γεωκωδικοποίηση, και χωρίς ρητή δήλωση ο κανόνας 3 έσβηνε την πινέζα (2026-09-10).
  if ((!identityMoved || incoming.source === 'dragged') && moved && point !== null) {
    return humanPinned(point, now);
  }
  if (intent.relocate) return askMachine(stored, incoming, geocode, now);
  if (!identityMoved && !moved) return { outcome: 'unchanged', position: keepStored(stored) };
  if (stored === null && point !== null && !incoming.geocodingMetadata) return humanPinned(point, now);

  const human = moved ? null : storedHumanPoint(stored);
  if (stored !== null && human !== null) return keepHumanPin(stored, incoming, human, geocode);
  return askMachine(stored, incoming, geocode, now);
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

  if (position.coordinates === null) return rest as T;

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

/** Οι επτά εκβάσεις — **παράγεται** από τη λογιστική, δεν ξαναγράφεται. */
const EMPTY_TALLY: AddressPositionTally = {
  'human-pinned': 0,
  'human-kept': 0,
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
 * λογιστική — και τις **αποκλίσεις** των κρατημένων ανθρώπινων πινεζών (Φ2β).
 *
 * ⚠️ **Σειριακά, ΠΟΤΕ `Promise.all`.** Η πολιτική χρήσης του Nominatim είναι *«an
 * absolute maximum of 1 request per second»*· ένα `Promise.all` πάνω σε πέντε
 * διευθύνσεις τη σπάει **στο πρώτο κιόλας αίτημα**.
 *
 * 🔑 **Η αντιστοίχιση γίνεται με το `id`, ποτέ με τη θέση στον πίνακα** — και η δήλωση
 * μετακίνησης (`relocateIds`) επίσης: ανά ταυτότητα, ποτέ ανά δείκτη.
 */
export async function resolveAddressPositions<T extends AddressLike & { readonly id?: string }>(
  storedAddresses: readonly T[],
  incomingAddresses: readonly T[],
  geocode: AddressGeocoder,
  now: number,
  options: ResolveAddressPositionsOptions = {},
): Promise<ResolvedAddressPositions<T>> {
  const storedById = new Map<string, T>();
  for (const address of storedAddresses) {
    if (typeof address.id === 'string' && address.id) storedById.set(address.id, address);
  }

  const tally: Record<AddressPositionOutcome, number> = { ...EMPTY_TALLY };
  const resolved: T[] = [];
  const drifts: AddressPositionDrift[] = [];

  for (const raw of incomingAddresses) {
    // Β7 — η γραφή χωρίς κενά στα άκρα, στο ΕΝΑ σύνορο (έργα ΚΑΙ κτίρια).
    const incoming = withTrimmedIdentity(raw);
    const id = typeof incoming.id === 'string' && incoming.id ? incoming.id : null;
    const stored = id ? storedById.get(id) ?? null : null;
    const relocate = id !== null && options.relocateIds?.has(id) === true;
    const { outcome, position, drift } = await resolveAddressPosition(stored, incoming, geocode, now, { relocate });
    tally[outcome] += 1;
    resolved.push(applyAddressPosition(incoming, position));
    if (drift && id) drifts.push({ addressId: id, ...drift });
  }

  return { addresses: resolved, tally, drifts };
}
