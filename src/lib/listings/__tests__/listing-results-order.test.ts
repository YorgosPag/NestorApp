/**
 * @fileoverview **Η ΣΕΙΡΑ ΤΗΣ ΟΘΟΝΗΣ 2** — δηλωμένη, ολική, και τίμια όπου δεν ξέρει.
 * @related ADR-777 §8.61 · lib/listings/listing-results-order.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ελάττωμα που γέννησε το αρχείο ήταν **αόρατο σε κάθε test**: η οθόνη ταξινομούσε
 * κατά `documentId`, δηλαδή —επειδή τα IDs είναι `ownp_…`/`prop_…`— **κατά τάξη
 * συντάκτη**, και η σειρά ήταν απολύτως **σταθερή**. Ένα test «η λίστα έχει 9 κάρτες»
 * θα ήταν πράσινο για πάντα.
 *
 * ⚠️ **Ο ΣΥΓΚΡΙΤΗΣ ΔΟΚΙΜΑΖΕΤΑΙ ΧΩΡΙΣ `sort`** (Α2 · Α3 · Α5): ένα tie-break που
 * ελέγχεται μόνο μέσω `Array#sort` κρύβεται πίσω από τη **σταθερότητα** εκείνης — θα
 * φαινόταν σωστό **και** αν έλειπε. *(«tie-break σκέλος = εμφάνιση, ΟΧΙ απόδειξη».)*
 */

import { UNASKED_LISTING_ATTRIBUTES, type ListedAt, type PublicListing } from '@/types/public-listing';
import {
  DEFAULT_LISTING_ORDER,
  LISTING_ORDERS,
  compareListingsByListedAt,
  compareListingsByPrice,
  orderResultsListings,
  parseListingOrder,
  writeListingOrder,
} from '../listing-results-order';

const AT = '2026-09-06T10:00:00.000Z';
const UNKNOWN: ListedAt = { kind: 'unknown', reason: 'predates-record' };

/** Όσο χρειάζεται η **σειρά**, με τον πραγματικό τύπο — ποτέ `as PublicListing`. */
function listingOf(
  id: string,
  title: string,
  listedAt: ListedAt,
  askingPrice: number | null = 100_000,
): PublicListing {
  return {
    id,
    title,
    listedAt,
    projectedAt: AT,
    commercialStatus: 'for-sale',
    commercial: { askingPrice, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    floorplans: [],
    type: 'apartment',
    areaSqm: 90,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: null,
    bedrooms: null,
    ...UNASKED_LISTING_ATTRIBUTES,
    legality: [],
    authorship: 'agency',
    agencyName: 'ΑΛΦΑ',
    agencyId: 'comp_alfa',
  };
}

const known = (at: string): ListedAt => ({ kind: 'known', at });
const idsOf = (l: readonly PublicListing[]): readonly string[] => l.map((x) => x.id);

const OLD = listingOf('prop_old', 'Παλιά', known('2026-01-01T00:00:00.000Z'));
const NEW = listingOf('prop_new', 'Νέα', known('2026-09-01T00:00:00.000Z'));
const NEVER = listingOf('prop_never', 'Άγνωστη', UNKNOWN);

describe('Α. Ο ΣΥΓΚΡΙΤΗΣ ΧΡΟΝΟΥ — χωρίς `sort`, ώστε το tie-break να ΑΠΟΔΕΙΚΝΥΕΤΑΙ', () => {
  it('Α1 — νεότερη πρώτη', () => {
    expect(compareListingsByListedAt(NEW, OLD)).toBeLessThan(0);
    expect(compareListingsByListedAt(OLD, NEW)).toBeGreaterThan(0);
  });

  it('🔴 Α2 — η ΑΓΝΩΣΤΗ πάει τελευταία, με ΟΠΟΙΑΔΗΠΟΤΕ σειρά ορισμάτων', () => {
    // ⚠️ **ΜΕΤΡΗΜΕΝΟ ΟΡΙΟ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ, γραμμένο για να μην «διορθωθεί» ψεύτικα.**
    //
    // Η μετάλλαξη «`listedAtKey` επιστρέφει `''` αντί για `null`» **ΔΕΝ κοκκινίζει εδώ**,
    // και μετρήθηκε (2026-09-06). Ο λόγος δεν είναι αδυναμία του test: είναι ότι η
    // μετάλλαξη είναι **ΙΣΟΔΥΝΑΜΗ** σήμερα. Το `''` είναι η λεξικογραφικά μικρότερη
    // συμβολοσειρά, και η **μόνη** διάταξη χρόνου που προσφέρουμε είναι φθίνουσα ⇒ και οι
    // δύο διαδρομές βγάζουν την άγνωστη τελευταία.
    //
    // 🔑 **Το `null` μένει, και ΔΕΝ είναι διακόσμηση**: εκφράζει *«άγνωστο»*, όχι *«πολύ
    // παλιό»*, και το `compareSortValues` το κρατά τελευταίο **ανεξαρτήτως κατεύθυνσης**.
    // Την ημέρα που προστεθεί «παλαιότερες πρώτα», το `''` θα έφερνε τις άγνωστες
    // **πρώτες** — και τότε αυτή η μετάλλαξη παύει να είναι ισοδύναμη.
    expect(compareListingsByListedAt(NEVER, NEW)).toBeGreaterThan(0);
    expect(compareListingsByListedAt(NEVER, OLD)).toBeGreaterThan(0);
    expect(compareListingsByListedAt(NEW, NEVER)).toBeLessThan(0);
    expect(compareListingsByListedAt(OLD, NEVER)).toBeLessThan(0);
  });

  it('🔴 Α3 — ΙΣΟΠΑΛΙΑ χρόνου ⇒ αποφασίζει ο τερματισμός, ποτέ η τύχη', () => {
    const a = listingOf('prop_b', 'Ίδια', known(AT));
    const b = listingOf('prop_a', 'Ίδια', known(AT));

    // Ίδιος χρόνος, ίδιος τίτλος ⇒ μένει **μόνο** η ταυτότητα. Χωρίς τερματισμό η
    // απάντηση θα ήταν `0`, δηλαδή «ό,τι σειρά έδωσε το `onSnapshot`».
    expect(compareListingsByListedAt(a, b)).toBeGreaterThan(0);
    expect(compareListingsByListedAt(b, a)).toBeLessThan(0);
  });

  it('Α4 — δύο ΑΓΝΩΣΤΕΣ έχουν κι αυτές ολική σειρά', () => {
    const a = listingOf('prop_b', 'Ίδια', UNKNOWN);
    const b = listingOf('prop_a', 'Ίδια', UNKNOWN);

    expect(compareListingsByListedAt(a, b)).toBeGreaterThan(0);
    expect(compareListingsByListedAt(a, a)).toBe(0);
  });
});

describe('Β. Ο ΣΥΓΚΡΙΤΗΣ ΤΙΜΗΣ — το ΥΠΑΡΧΟΝ κλειδί, καμία δεύτερη μηχανή', () => {
  const CHEAP = listingOf('prop_cheap', 'Φθηνή', known(AT), 50_000);
  const RICH = listingOf('prop_rich', 'Ακριβή', known(AT), 500_000);
  const NO_PRICE = listingOf('prop_none', 'Χωρίς τιμή', known(AT), null);

  it('Β1 — αύξουσα και φθίνουσα', () => {
    expect(compareListingsByPrice(CHEAP, RICH, 'asc')).toBeLessThan(0);
    expect(compareListingsByPrice(CHEAP, RICH, 'desc')).toBeGreaterThan(0);
  });

  it('🔴 Β2 — ΧΩΡΙΣ ΤΙΜΗ τελευταία ΚΑΙ ΣΤΙΣ ΔΥΟ κατευθύνσεις — ποτέ «η φθηνότερη»', () => {
    expect(compareListingsByPrice(NO_PRICE, CHEAP, 'asc')).toBeGreaterThan(0);
    expect(compareListingsByPrice(NO_PRICE, RICH, 'desc')).toBeGreaterThan(0);
  });

  it('Β3 — ίδια τιμή ⇒ τερματισμός', () => {
    const a = listingOf('prop_b', 'Ίδια', known(AT), 100);
    const b = listingOf('prop_a', 'Ίδια', known(AT), 100);
    expect(compareListingsByPrice(a, b, 'asc')).toBeGreaterThan(0);
  });
});

describe('Γ. Ο ΠΙΝΑΚΑΣ', () => {
  it('🔴 Γ1 — επιστρέφει ΝΕΟ πίνακα· η είσοδος του `onSnapshot` ΔΕΝ μεταβάλλεται', () => {
    const input = [OLD, NEW, NEVER];
    const before = idsOf(input);

    const out = orderResultsListings(input, 'newest');

    expect(out).not.toBe(input);
    expect(idsOf(input)).toEqual(before);
  });

  it('Γ2 — «νεότερες»: νέα → παλιά → άγνωστη', () => {
    expect(idsOf(orderResultsListings([NEVER, OLD, NEW], 'newest'))).toEqual([
      'prop_new',
      'prop_old',
      'prop_never',
    ]);
  });

  it('🔴 Γ3 — ΝΤΕΤΕΡΜΙΝΙΣΜΟΣ: κάθε αναδιάταξη της εισόδου δίνει την ΙΔΙΑ έξοδο', () => {
    const permutations = [
      [OLD, NEW, NEVER],
      [NEW, NEVER, OLD],
      [NEVER, OLD, NEW],
      [NEW, OLD, NEVER],
    ];
    const outputs = permutations.map((p) => idsOf(orderResultsListings(p, 'newest')));

    for (const out of outputs) expect(out).toEqual(outputs[0]);
  });

  it('Γ4 — κάθε δηλωμένη σειρά ΕΧΕΙ συγκριτή που τρέχει', () => {
    // Φυλάει το `Record<ListingOrder, …>`: μια σειρά στο μενού που δεν κάνει τίποτα
    // είναι χειρότερη από σειρά που δεν προσφέρεται.
    for (const order of LISTING_ORDERS) {
      expect(idsOf(orderResultsListings([NEVER, OLD, NEW], order))).toHaveLength(3);
    }
  });
});

describe('Δ. Η ΔΙΕΥΘΥΝΣΗ', () => {
  it('Δ1 — άδεια διεύθυνση ⇒ η προεπιλογή', () => {
    expect(parseListingOrder(new URLSearchParams())).toBe(DEFAULT_LISTING_ORDER);
  });

  it('🔴 Δ2 — ΑΓΝΩΣΤΗ τιμή αγνοείται, δεν σκάει η οθόνη', () => {
    expect(parseListingOrder(new URLSearchParams('sort=cheapest-sponsored'))).toBe(
      DEFAULT_LISTING_ORDER,
    );
  });

  it('Δ3 — δηλωμένη τιμή διαβάζεται', () => {
    expect(parseListingOrder(new URLSearchParams('sort=priceDesc'))).toBe('priceDesc');
  });

  it('🔴 Δ4 — η ΠΡΟΕΠΙΛΟΓΗ ΔΕΝ γράφεται: δύο ίδιες αναζητήσεις, μία διεύθυνση', () => {
    const params = new URLSearchParams('bedmin=2');
    writeListingOrder(DEFAULT_LISTING_ORDER, params);
    expect(params.toString()).toBe('bedmin=2');
  });

  it('Δ5 — μη προεπιλεγμένη γράφεται ΔΙΠΛΑ στα φίλτρα, χωρίς να τα πειράξει', () => {
    const params = new URLSearchParams('bedmin=2');
    writeListingOrder('priceAsc', params);

    expect(params.get('sort')).toBe('priceAsc');
    expect(params.get('bedmin')).toBe('2');
  });

  it('🔑 Δ6 — επιστροφή στην προεπιλογή ΚΑΘΑΡΙΖΕΙ την παράμετρο', () => {
    const params = new URLSearchParams('sort=priceAsc');
    writeListingOrder(DEFAULT_LISTING_ORDER, params);
    expect(params.has('sort')).toBe(false);
  });

  it('Δ7 — ό,τι γράφεται, ξαναδιαβάζεται (round-trip σε κάθε δηλωμένη σειρά)', () => {
    for (const order of LISTING_ORDERS) {
      const params = new URLSearchParams();
      writeListingOrder(order, params);
      expect(parseListingOrder(params)).toBe(order);
    }
  });
});
