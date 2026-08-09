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
import { getEffectivePrice } from '@/lib/properties/price-resolver';

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
}

export const EMPTY_LISTING_FILTERS: ListingFilters = {
  offerKinds: [],
  types: [],
  priceMin: null,
  priceMax: null,
  areaMin: null,
  areaMax: null,
  bedroomsMin: null,
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
} as const;

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
  ];
  for (const [key, value] of numbers) {
    if (value !== null) params.set(key, String(value));
  }
  return params;
}

// ============================================================================
// ΕΦΑΡΜΟΓΗ
// ============================================================================

function withinRange(value: number | null, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  // 🔑 Χωρίς αριθμό ΔΕΝ βαφτίζεται 0: μια αγγελία χωρίς εμβαδόν δεν «είναι 0 τ.μ.»,
  // απλώς δεν μπορεί να απαντήσει στο ερώτημα — και άρα δεν ταιριάζει σε εύρος.
  if (value === null) return false;
  return (min === null || value >= min) && (max === null || value <= max);
}

/** Ταιριάζει αυτή η αγγελία; **Καθαρή συνάρτηση** — ίδια απάντηση σε χάρτη και λίστα. */
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

  if (filters.bedroomsMin !== null) {
    if (listing.bedrooms === null || listing.bedrooms < filters.bedroomsMin) return false;
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
