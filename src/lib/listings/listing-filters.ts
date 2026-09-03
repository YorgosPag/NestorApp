/**
 * @fileoverview Τα φίλτρα της οθόνης 2 — **μία** κατάσταση, στη διεύθυνση.
 * @related ADR-777 §7 (Α3 · Α20) · SPEC-777-RESEARCH §25.8
 * @module lib/listings/listing-filters
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΤΟ `FilterState` — και δεν είναι διπλότυπο
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `FilterState` (`types/property-viewer`) φιλτράρει σε **`status`**, δηλαδή στο
 * παλιό λεξιλόγιο των επτά τιμών — που είναι **ρητά lossy**: δεν έχει λέξη για την
 * αντιπαροχή, και ένα ακίνητο μόνο προς αντιπαροχή προβάλλεται σε `'unavailable'`.
 *
 * Μια **νέα** οθόνη που ρωτούσε εκείνον τον άξονα θα γεννιόταν με το ελάττωμα που η
 * Α20 λύνει: θα έκρυβε ακριβώς τις αγγελίες για τις οποίες χτίστηκε ο νέος άξονας.
 * Άρα εδώ φιλτράρουμε σε **`offerKinds`** — «*ο άξονας όπου δεν χάνεται τίποτα*».
 *
 * Δεν είναι δεύτερη μηχανή φίλτρων: είναι η **ίδια ερώτηση σε σωστό λεξιλόγιο**. Η
 * παλιά ζει μέχρι να μεταναστεύσει ο καταναλωτής της (κανόνας 19).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ, ΚΑΙ ΟΧΙ ΣΕ `useState`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Α3 δεσμεύτηκε ότι «**τα φίλτρα επιμένουν**» — και μετρήθηκε ότι **75%** των
 * αποτυχιών της σημερινής μας κατάστασης ήταν ακριβώς εκεί. Κατάσταση σε `useState`
 * επιβιώνει μόνο όσο ζει το component: χάνεται σε ανανέωση, σε «πίσω», και **δεν
 * μοιράζεται** — δηλαδή ένας σύνδεσμος προς αποτελέσματα δεν δείχνει τα ίδια
 * αποτελέσματα. Η διεύθυνση λύνει και τα τρία ταυτόχρονα.
 */

import type { OfferKind } from '@/types/property-offers';
import { OFFER_KINDS } from '@/types/property-offers';
import type { PublicListing } from '@/types/public-listing';
import type { GeoPoint } from '@/types/geo/coordinates';
import { isLandProperty } from '@/constants/property-classification';
import { getEffectivePrice } from '@/lib/properties/price-resolver';
import { distanceMeters } from '@/lib/geo/geo-distance';
import { intervalShape } from '@/lib/date-local';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';

/**
 * **Ο γεωγραφικός άξονας** — η απάντηση της οθόνης 1 στο *«πού ψάχνεις;»* (Α3).
 *
 * 🔑 **Σημείο + ακτίνα, ΠΟΤΕ όνομα τόπου.** Το {@link PublicListing} **δεν κουβαλά
 * καμία λέξη τόπου** (μετρημένο: κουβαλά `position` και `title`, τίποτα άλλο), οπότε
 * ένα φίλτρο «πόλη = Θεσσαλονίκη» θα έπρεπε είτε να ψάξει στον **τίτλο** — που είναι
 * κείμενο του κατόχου, όχι διεύθυνση — είτε να γεννήσει νέο πεδίο, που είναι
 * **απόφαση δημοσιοποίησης** και δεν ανήκει σε ένα αρχείο φίλτρων.
 *
 * Το κείμενο του επισκέπτη λύνεται σε **σημείο** από τον υπάρχοντα geocoder
 * (`/api/geocoding`, ανώνυμα προσβάσιμος) **πριν** φτάσει εδώ. Έτσι το φίλτρο
 * συγκρίνει **γεωμετρία με γεωμετρία** — το μόνο πράγμα που και οι δύο πλευρές
 * ξέρουν με βεβαιότητα.
 */
export interface ListingGeoFilter {
  readonly center: GeoPoint;
  /** Ακτίνα σε **χιλιόμετρα**. Πάντα > 0 — το 0 δεν είναι «παντού», είναι «πουθενά». */
  readonly radiusKm: number;
}

/**
 * **Ο ΧΡΟΝΙΚΟΣ ΑΞΟΝΑΣ** — η απάντηση στο *«πότε;»* (ADR-835 §4.6).
 *
 * 🔑 **Αντικείμενο `| null`, ΠΟΤΕ δύο επίπεδα πεδία** — ίδιο ιδίωμα με το
 * {@link ListingGeoFilter}, και για τον **ίδιο ακριβώς λόγο**: μια άφιξη χωρίς
 * αναχώρηση δεν είναι «σχεδόν ερώτηση», είναι **μη ερώτηση**. Δύο `string | null`
 * πεδία θα επέτρεπαν στον τύπο να εκφράσει τη μισή, και κάθε καταναλωτής θα έπρεπε να
 * θυμάται τον έλεγχο — δηλαδή θα τον ξεχνούσε κάποιος.
 *
 * ⚠️ **Ημι-ανοιχτό `[checkIn, checkOut)`** (§16 · ADR-832 §5.2): η μέρα αναχώρησης
 * **είναι** μέρα άφιξης του επόμενου. **Μην το αγγίξεις.**
 */
export interface ListingStayWindow {
  /** ISO `YYYY-MM-DD` — η άφιξη. Ανήκει στο διάστημα. */
  readonly checkIn: string;
  /** ISO `YYYY-MM-DD` — η αναχώρηση. **ΔΕΝ** ανήκει στο διάστημα. */
  readonly checkOut: string;
}

/** Κλειστό σχήμα — κάθε φίλτρο της οθόνης 2, και κανένα άλλο. */
export interface ListingFilters {
  /** Κενό = «όλες οι διαθέσεις», **όχι** «καμία». */
  readonly offerKinds: readonly OfferKind[];
  readonly types: readonly string[];
  readonly priceMin: number | null;
  readonly priceMax: number | null;
  readonly areaMin: number | null;
  readonly areaMax: number | null;
  readonly bedroomsMin: number | null;
  /** `null` = «όπου να 'ναι». Δες {@link ListingGeoFilter}. */
  readonly near: ListingGeoFilter | null;

  // ── Ο ΧΡΟΝΟΣ (ADR-835 Φ3) ─────────────────────────────────────────────────
  /** `null` = «οποτεδήποτε» — καμία χρονική ερώτηση. Δες {@link ListingStayWindow}. */
  readonly stayWindow: ListingStayWindow | null;
  /**
   * Πόσα άτομα· `null` = **δεν ρωτήθηκε**, ποτέ «ένα».
   *
   * 🔑 **Ανεξάρτητο από το {@link ListingFilters.stayWindow}, επίτηδες**: ο επισκέπτης
   * μπορεί να ξέρει *πόσοι* είναι πριν ξέρει *πότε*, και το αντίστροφο. Δεμένο μέσα
   * στο παράθυρο, η μία ερώτηση θα ήταν **ανέκφραστη χωρίς την άλλη**.
   */
  readonly guests: number | null;
}

/** Προεπιλεγμένη ακτίνα όταν η διεύθυνση δεν τη δηλώνει. Πόλη-κλίμακα. */
export const DEFAULT_SEARCH_RADIUS_KM = 10;

export const EMPTY_LISTING_FILTERS: ListingFilters = {
  offerKinds: [],
  types: [],
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  bedroomsMin: null,
  near: null,
  stayWindow: null,
  guests: null,
};

// ============================================================================
// ΔΙΕΥΘΥΝΣΗ ⇄ ΚΑΤΑΣΤΑΣΗ
// ============================================================================

const PARAM = {
  offer: 'offer',
  type: 'type',
  priceMin: 'pmin',
  priceMax: 'pmax',
  areaMin: 'amin',
  areaMax: 'amax',
  bedroomsMin: 'beds',
  lat: 'lat',
  lng: 'lng',
  radiusKm: 'r',
  checkIn: 'in',
  checkOut: 'out',
  guests: 'guests',
} as const;

/**
 * Διεύθυνση → γεωγραφικό φίλτρο, ή `null`.
 *
 * ⚠️ **Απαιτούνται ΚΑΙ ΤΑ ΔΥΟ σκέλη της συντεταγμένης.** Ένα μισό ζεύγος (`lat` χωρίς
 * `lng`) δεν είναι «σχεδόν σωστό» — είναι σημείο πάνω σε μεσημβρινό μηδέν, δηλαδή
 * κάπου στον Ατλαντικό, και ο χάρτης θα το ζωγράφιζε **με απόλυτη σιγουριά**. Είναι
 * το ίδιο ελάττωμα που ο τύπος `PlacePosition` απαγορεύει με το ρητό `unknown`.
 *
 * ⚠️ **Ακτίνα ≤ 0 ⇒ αγνοείται ολόκληρο το φίλτρο**, δεν «διορθώνεται» σε 0 χλμ.:
 * ακτίνα μηδέν φιλτράρει **τα πάντα** και ο επισκέπτης θα έβλεπε άδεια οθόνη χωρίς
 * να ξέρει ότι έφταιγε μια παράμετρος στη διεύθυνση.
 *
 * 🔑 **ΕΞΑΓΕΤΑΙ ΑΠΟ ΤΗ Φ6-Β (ADR-841)** — δεύτερος καταναλωτής: το φίλτρο περιοχής
 * του δημόσιου καταλόγου επαγγελματιών *(`lib/agency/showcase-filter.ts`)*. Δύο
 * αναγνώστες των **ίδιων** τριών παραμέτρων θα ήταν δύο απαντήσεις στο *«τι
 * σημαίνει κοντά;»*, και ο δεύτερος θα ξεχνούσε τον έλεγχο `|lat| > 90`.
 *
 * ⛔ **ΜΗΝ αντιγράψεις αυτή τη λογική** — ούτε «απλοποιημένη». Οι τρεις έλεγχοι
 * *(μισό ζεύγος · εκτός ορίων · ακτίνα ≤ 0)* είναι ο λόγος ύπαρξής της.
 *
 * 🔶 **Δηλωμένο, μη λυμένο**: το `ListingGeoFilter` και το
 * {@link DEFAULT_SEARCH_RADIUS_KM} έχουν πλέον καταναλωτές σε **τέσσερα** δέντρα
 * *(listings · demand · search · agency)*, και το `DemandPlaceResolver.tsx:20`
 * γράφει ήδη ότι χρησιμοποιεί *«το **ίδιο** σχήμα»*. Ώριμο για μετακόμιση σε
 * `lib/geo/`, με το πρότυπο *«η μηχανή μετακομίζει όταν αποκτά δεύτερο
 * καταναλωτή»* (ADR-841 Α6). **Δεν γίνεται εδώ**: θα άγγιζε έξι αρχεία εκτός του
 * εύρους της Φ6-Β, σε δέντρο που δουλεύει άλλος πράκτορας αυτή τη στιγμή.
 */
export function readGeoFilter(params: URLSearchParams): ListingGeoFilter | null {
  const lat = readNumber(params, PARAM.lat);
  const lng = readNumber(params, PARAM.lng);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const radiusKm = readNumber(params, PARAM.radiusKm) ?? DEFAULT_SEARCH_RADIUS_KM;
  if (radiusKm <= 0) return null;

  return { center: { lat, lng }, radiusKm };
}

function readNumber(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  // ⚠️ `Number('')` είναι 0 και `Number('abc')` είναι NaN — και τα δύο θα γίνονταν
  // σιωπηλά «φίλτρο 0», που φιλτράρει τα πάντα. Η άρνηση είναι ρητή.
  return Number.isFinite(value) ? value : null;
}

function readOfferKinds(params: URLSearchParams): readonly OfferKind[] {
  const known = new Set<string>(OFFER_KINDS);
  return params.getAll(PARAM.offer).filter((k): k is OfferKind => known.has(k));
}

/**
 * **Αυστηρή ημερολογιακή μέρα `YYYY-MM-DD`** — τίποτα άλλο.
 *
 * 🔴 **ΓΙΑΤΙ REGEX ΚΑΙ ΟΧΙ ΣΚΕΤΟ `intervalShape`.** Ο αναγνώστης στιγμών δέχεται
 * **πολλές** μορφές (`2026-08-10T12:00:00Z`, `Timestamp`, …) και θα τις έκρινε μια
 * χαρά. Αλλά ο τύπος {@link ListingStayWindow} υπόσχεται **ημέρα**, και μια στιγμή με
 * **ώρα** μέσα σε ημι-ανοιχτό διάστημα νυχτών αλλάζει σιωπηλά τη σημασία της
 * αναχώρησης — δηλαδή θα έκανε τη **διαδοχή** δύο κρατήσεων να επικαλύπτεται κατά
 * μισή μέρα, στην πιο ακριβή δυνατή θέση.
 *
 * ⚠️ Ο έλεγχος είναι **μορφής**, όχι υπαρκτότητας: το `2026-02-31` περνά εδώ και
 * κόβεται από το {@link intervalShape} παρακάτω, που το διαβάζει ως στιγμή.
 */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

function readDay(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key)?.trim() ?? '';
  return CALENDAR_DAY.test(raw) ? raw : null;
}

/**
 * Διεύθυνση → χρονικό παράθυρο, ή `null`.
 *
 * ⚠️ **Απαιτούνται ΚΑΙ ΤΑ ΔΥΟ άκρα** — ίδιος κανόνας με το `lat`/`lng`: μισό παράθυρο
 * δεν είναι μισή ερώτηση, είναι **καμία**.
 *
 * 🔴 **ΚΑΙ ΤΟ ΔΙΑΣΤΗΜΑ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ `proper`** — ο φρουρός του Ε-10, στη μία θέση
 * που ο κόσμος γράφει ημερομηνίες με το χέρι. Ένα **κενό** (`in === out`) θα ήταν
 * αίτημα **μηδέν νυχτών**· ένα **ανάποδο** (`out < in`) δεν περιγράφει διάστημα. Και
 * τα δύο θα ταξίδευαν σε κάθε κοινοποιημένο σύνδεσμο, και ο κριτής θα τα έκρινε
 * **ασυνεπώς** (§17: *«η ίδια μηδενική διαμονή συγκρούεται ή όχι ανάλογα με το πού
 * πέφτει»*). Απορρίπτονται **εδώ**, στην πόρτα.
 */
function readStayWindow(params: URLSearchParams): ListingStayWindow | null {
  const checkIn = readDay(params, PARAM.checkIn);
  const checkOut = readDay(params, PARAM.checkOut);
  if (checkIn === null || checkOut === null) return null;
  if (intervalShape(checkIn, checkOut) !== 'proper') return null;
  return { checkIn, checkOut };
}

/**
 * Διεύθυνση → πλήθος ατόμων, ή `null`.
 *
 * ⚠️ **Θετικός ακέραιος, ή τίποτα.** Το `0` δεν είναι «χαλαρό φίλτρο» — είναι αίτημα
 * για **κανέναν επισκέπτη**, και το `2,5` δεν είναι άνθρωποι. Ο `readNumber` δέχεται
 * και τα δύο (είναι πεπερασμένα), οπότε ο περιορισμός ανήκει **εδώ**: το ίδιο μάθημα
 * με το *«ακτίνα ≤ 0 ⇒ αγνοείται ολόκληρο το φίλτρο»*.
 */
function readGuests(params: URLSearchParams): number | null {
  const value = readNumber(params, PARAM.guests);
  if (value === null || !Number.isInteger(value) || value < 1) return null;
  return value;
}

/** Διεύθυνση → φίλτρα. **Άγνωστη τιμή αγνοείται**, ποτέ δεν σκάει η οθόνη. */
export function parseListingFilters(params: URLSearchParams): ListingFilters {
  return {
    offerKinds: readOfferKinds(params),
    types: params.getAll(PARAM.type).filter((t) => t.trim() !== ''),
    priceMin: readNumber(params, PARAM.priceMin),
    priceMax: readNumber(params, PARAM.priceMax),
    areaMin: readNumber(params, PARAM.areaMin),
    areaMax: readNumber(params, PARAM.areaMax),
    bedroomsMin: readNumber(params, PARAM.bedroomsMin),
    near: readGeoFilter(params),
    stayWindow: readStayWindow(params),
    guests: readGuests(params),
  };
}

/**
 * Φίλτρα → διεύθυνση.
 *
 * ⚠️ **Τα κενά φίλτρα ΔΕΝ γράφονται.** Αλλιώς κάθε σύνδεσμος θα κουβαλούσε επτά κενές
 * παραμέτρους, και δύο ταυτόσημες αναζητήσεις θα είχαν **διαφορετική** διεύθυνση —
 * που για μια μηχανή αναζήτησης σημαίνει δύο σελίδες με το ίδιο περιεχόμενο.
 */
export function serializeListingFilters(filters: ListingFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const kind of filters.offerKinds) params.append(PARAM.offer, kind);
  for (const type of filters.types) params.append(PARAM.type, type);
  const numbers: ReadonlyArray<readonly [string, number | null]> = [
    [PARAM.priceMin, filters.priceMin],
    [PARAM.priceMax, filters.priceMax],
    [PARAM.areaMin, filters.areaMin],
    [PARAM.areaMax, filters.areaMax],
    [PARAM.bedroomsMin, filters.bedroomsMin],
    [PARAM.guests, filters.guests],
  ];
  for (const [key, value] of numbers) {
    if (value !== null) params.set(key, String(value));
  }
  // ⚠️ Τα τρία γεωγραφικά γράφονται **μαζί ή καθόλου**: μια διεύθυνση με `lat` χωρίς
  // `lng` δεν είναι μερικώς χρήσιμη, είναι μη αναγνώσιμη από το `readGeoFilter` — και
  // θα ταξίδευε σιωπηλά σε κάθε κοινοποιημένο σύνδεσμο.
  if (filters.near !== null) {
    params.set(PARAM.lat, String(filters.near.center.lat));
    params.set(PARAM.lng, String(filters.near.center.lng));
    params.set(PARAM.radiusKm, String(filters.near.radiusKm));
  }
  // ⚠️ **Τα δύο άκρα γράφονται μαζί ή καθόλου**, ίδιος κανόνας με τα γεωγραφικά: ένα
  // `in` χωρίς `out` δεν είναι μερικώς χρήσιμο — το `readStayWindow` το απορρίπτει,
  // άρα θα ταξίδευε σιωπηλά ως σκουπίδι σε κάθε κοινοποιημένο σύνδεσμο.
  if (filters.stayWindow !== null) {
    params.set(PARAM.checkIn, filters.stayWindow.checkIn);
    params.set(PARAM.checkOut, filters.stayWindow.checkOut);
  }
  return params;
}

/**
 * **Ο ΜΟΝΑΔΙΚΟΣ ΚΑΤΑΣΚΕΥΑΣΤΗΣ ΤΟΥ ΧΡΟΝΙΚΟΥ ΕΡΩΤΗΜΑΤΟΣ** — φίλτρα → {@link StayQuery}.
 *
 * @returns το ερώτημα, ή `null` όταν ο επισκέπτης **δεν ρώτησε χρόνο**.
 *
 * 🔑 **Εδώ ενώνονται οι δύο ανεξάρτητοι άξονες** (παράθυρο · άτομα) στο σχήμα που
 * περιμένει η μηχανή διαθεσιμότητας. Ένας δεύτερος κατασκευαστής σε component θα ήταν
 * η θέση όπου κάποιος θα έγραφε `guests: filters.guests ?? 1` — δηλαδή θα υπόσχονταν
 * σιωπηλά «ένα άτομο» για κάθε αναζήτηση χωρίς αριθμό.
 *
 * ⚠️ **Χωρίς παράθυρο δεν υπάρχει ερώτημα, όσα άτομα κι αν δηλώθηκαν.** Η
 * διαθεσιμότητα είναι **ερώτηση χρόνου**· η χωρητικότητα μόνη της δεν την κάνει.
 */
export function stayQueryOf(filters: ListingFilters): StayQuery | null {
  if (filters.stayWindow === null) return null;
  return {
    checkIn: filters.stayWindow.checkIn,
    checkOut: filters.stayWindow.checkOut,
    guests: filters.guests,
  };
}

// ============================================================================
// ΕΦΑΡΜΟΓΗ
// ============================================================================

/**
 * Είναι ο αριθμός μέσα στο εύρος; **Κενό εύρος = ναι· άγνωστος αριθμός = όχι.**
 *
 * 🔴 **Εξάγεται, και ο λόγος είναι ότι ο δεύτερος κανόνας είναι ΕΥΚΟΛΟ ΝΑ ΧΑΘΕΙ.**
 * Η μηχανή ταιριάσματος της ζήτησης (`lib/demand/demand-matching.ts`) ρωτά **το ίδιο
 * ακριβώς πράγμα** για τιμή, εμβαδόν και όροφο. Μια δεύτερη γραφή εκεί θα ήταν τρεις
 * γραμμές — και η πιθανότερη παραλλαγή τους (`value ?? 0`) θα έκανε κάθε αγγελία
 * **χωρίς** εμβαδόν να μετράει ως **0 τ.μ.**, δηλαδή να ταιριάζει σε κάθε «έως Χ» και
 * σε κανένα «από Χ». Δύο κριτές για ένα ερώτημα, με τη διαφορά ορατή **μόνο** στα
 * ελλιπή δεδομένα — που είναι ακριβώς τα δεδομένα που έχουμε.
 */
export function withinRange(
  value: number | null,
  min: number | null,
  max: number | null
): boolean {
  if (min === null && max === null) return true;
  // 🔑 Χωρίς αριθμό ΔΕΝ βαφτίζεται 0: μια αγγελία χωρίς εμβαδόν δεν «είναι 0 τ.μ.»,
  // απλώς δεν μπορεί να απαντήσει στο ερώτημα — και άρα δεν ταιριάζει σε εύρος.
  if (value === null) return false;
  return (min === null || value >= min) && (max === null || value <= max);
}

/**
 * Ταιριάζει αυτή η αγγελία; **Καθαρή συνάρτηση** — ίδια απάντηση σε χάρτη και λίστα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΧΡΟΝΟΣ ΚΑΙ ΤΑ ΑΤΟΜΑ **ΔΕΝ ΦΙΛΤΡΑΡΟΥΝ ΕΔΩ** — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτή η συνάρτηση **εξαφανίζει** ό,τι δεν ταιριάζει. Είναι σωστό για τιμή, εμβαδόν
 * και είδος — και θα ήταν **καταστροφικό** για τον χρόνο, γιατί θα έκανε ακριβώς αυτό
 * που το ADR-835 §4.6 υπάρχει για να **μην** κάνουμε:
 *
 *   «*the search algorithm **completely hides** unavailable listings rather than
 *   suggesting nearby dates or showing partially available properties*»
 *
 * Ένα `return false` για «κρατημένο» θα εξαφάνιζε **και** τα καταλύματα χωρίς δηλωμένο
 * ημερολόγιο, **και** εκείνα που είναι ελεύθερα 5 από τις 7 νύχτες σου, **και** κάθε
 * ακίνητο που δεν είναι κατάλυμα — δηλαδή θα ισοπέδωνε σε σιωπή **και τους εννέα**
 * κάδους που το `lib/stay/stay-availability-vocabulary.ts` υπάρχει για να ονομάσει.
 *
 * ✅ **Ο χρόνος απαντιέται με ΟΝΟΜΑ και μετριέται στη ΛΟΓΙΣΤΙΚΗ**
 * (`lib/listings/stay-ledger.ts`), ποτέ με εξαφάνιση. Δύο διαφορετικές πράξεις:
 * *«ποια δείχνουμε»* (εδώ) και *«τι απαντά η καθεμιά στις ημερομηνίες σου»* (εκεί).
 *
 * ⚠️ Το **ίδιο** ισχύει για το `guests`, με τον ίδιο ακριβώς λόγο: ένα κατάλυμα που
 * **δεν δήλωσε** χωρητικότητα δεν είναι «δεν χωράει» — και η εξαφάνισή του θα
 * τιμωρούσε τον κάτοχο για πεδίο που κανείς δεν του ζήτησε (N.12).
 */
export function matchesListingFilters(listing: PublicListing, filters: ListingFilters): boolean {
  if (filters.offerKinds.length > 0) {
    if (!listing.offerKinds.some((k) => filters.offerKinds.includes(k))) return false;
  }
  if (filters.types.length > 0 && !filters.types.includes(listing.type)) return false;

  if (filters.priceMin !== null || filters.priceMax !== null) {
    const resolved = getEffectivePrice(listing);
    if (!withinRange(resolved?.amount ?? null, filters.priceMin, filters.priceMax)) return false;
  }
  if (!withinRange(listing.areaSqm, filters.areaMin, filters.areaMax)) return false;

  // 🔴 **Η ΓΗ ΔΕΝ ΚΡΙΝΕΤΑΙ ΣΕ ΥΠΝΟΔΩΜΑΤΙΑ** (ADR-777 §8.32).
  //
  // Το βρήκε **η οθόνη**, όχι πύλη: η φόρμα ζήτησης έχει «Υπνοδωμάτια, τουλάχιστον»
  // **δίπλα** στο «Οικόπεδο», και το βοηθητικό της κείμενο λέει *«το 0 σημαίνει
  // “δέξου και γκαρσονιέρα”»* — δηλαδή ο άνθρωπος που γράφει `0` νομίζει ότι
  // **χαλαρώνει** το φίλτρο. Ένα οικόπεδο όμως έχει `bedrooms: null` εκ κατασκευής,
  // οπότε ο έλεγχος «`null` ⇒ έξω» **εξαφάνιζε ΚΑΘΕ οικόπεδο** — μετρημένο: `false`.
  //
  // ⚠️ Ο έλεγχος `null` **μένει** για τα υπόλοιπα είδη, και είναι σωστός εκεί: αν
  // κάποιος ζητά ρητά «≥2 υπνοδωμάτια», ένα διαμέρισμα που **δεν το λέει** δεν
  // απαντά στην ερώτηση. Η διαφορά δεν είναι η τιμή — είναι το **αν το είδος σηκώνει
  // την ερώτηση**.
  if (filters.bedroomsMin !== null && !isLandProperty(listing.type)) {
    if (listing.bedrooms === null || listing.bedrooms < filters.bedroomsMin) return false;
  }

  // 🔴 Ο ΓΕΩΓΡΑΦΙΚΟΣ ΑΞΟΝΑΣ — τελευταίος επίτηδες: είναι ο **μόνος** που κοστίζει
  // τριγωνομετρία, και τα φθηνά φίλτρα έχουν ήδη αποκλείσει ό,τι μπορούσαν.
  if (filters.near !== null) {
    // ⚠️ **Η αγγελία ΧΩΡΙΣ θέση ΔΕΝ αποκλείεται εδώ — και αυτό δεν είναι παράλειψη.**
    // Είναι ο κανόνας Α5 §4.1 σε κώδικα: *«δεν φιλτράρονται όταν μετακινείς τον
    // χάρτη· δεν μπορούμε να τις αποκλείσουμε από περιοχή που δεν ξέρουμε αν τους
    // ανήκει»*. Ένα `return false` εδώ θα τις **εξαφάνιζε** — δηλαδή θα μετέτρεπε το
    // «δεν ξέρουμε πού είναι» σε «δεν είναι εδώ», που είναι διαφορετικός ισχυρισμός
    // και **ψευδής**. Μένουν, και τις μετρά η κλειστή λογιστική.
    if (listing.position.kind === 'known') {
      const metres = distanceMeters(filters.near.center, listing.position.point);
      if (metres > filters.near.radiusKm * 1000) return false;
    }
  }
  return true;
}

/**
 * Εφαρμογή σε σύνολο.
 *
 * 🔑 **Ο χάρτης και η λίστα καλούν ΑΥΤΟ, όχι ο καθένας το δικό του.** Είναι ο ίδιος
 * λόγος με το `listingMapShape`: δύο κριτήρια για την ίδια ερώτηση σημαίνει ότι μια
 * μέρα θα διαφωνήσουν, και η οθόνη θα δείχνει διαφορετικά αποτελέσματα δεξιά και
 * αριστερά — χωρίς κανείς να μπορεί να πει ποιο είναι σωστό.
 */
export function applyListingFilters(
  listings: readonly PublicListing[],
  filters: ListingFilters
): readonly PublicListing[] {
  return listings.filter((listing) => matchesListingFilters(listing, filters));
}
