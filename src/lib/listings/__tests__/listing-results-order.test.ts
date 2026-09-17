/**
 * @fileoverview **Η ΣΕΙΡΑ ΤΗΣ ΟΘΟΝΗΣ 2** — δηλωμένη, ολική, και τίμια όπου δεν ξέρει.
 * @related ADR-777 §8.61 · §8.60.14 · lib/listings/listing-results-order.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Δύο** ελαττώματα, και **κανένα** από τα δύο δεν ήταν ορατό σε test:
 *
 * 1. *(§8.61)* Η οθόνη ταξινομούσε κατά `documentId`, δηλαδή —επειδή τα IDs είναι
 *    `ownp_…`/`prop_…`— **κατά τάξη συντάκτη**, και η σειρά ήταν απολύτως **σταθερή**.
 *    Ένα test «η λίστα έχει 9 κάρτες» θα ήταν πράσινο για πάντα.
 * 2. *(§8.60.14)* Η «τιμή ↑» έβαζε `50 €/νύχτα`, `900 €/μήνα` και `170.000 €` σε **έναν**
 *    άξονα. Και αυτό ήταν πράσινο παντού: η έξοδος **ήταν** ταξινομημένη — απλώς κατά
 *    ένα μέγεθος που **δεν υπάρχει**.
 *
 * ⚠️ **Ο ΣΥΓΚΡΙΤΗΣ ΔΟΚΙΜΑΖΕΤΑΙ ΧΩΡΙΣ `sort`** (Α2 · Α3 · Α5): ένα tie-break που
 * ελέγχεται μόνο μέσω `Array#sort` κρύβεται πίσω από τη **σταθερότητα** εκείνης — θα
 * φαινόταν σωστό **και** αν έλειπε. *(«tie-break σκέλος = εμφάνιση, ΟΧΙ απόδειξη».)*
 *
 * 🔑 **Η ομάδα Ε δεν ελέγχει «υπάρχουν τμήματα».** Ελέγχει ότι μια **ακριβή**
 * διανυκτέρευση **δεν προσπερνά** μια φθηνή πώληση — δηλαδή ότι η σύγκριση ανάμεσα σε
 * κλάσεις **δεν εκτελείται ποτέ**. Χωρίς αυτό, η διαμέριση θα ήταν διακόσμηση.
 */

import elCommon from '@/i18n/locales/el/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { UNASKED_LISTING_ATTRIBUTES, type ListedAt, type PublicListing } from '@/types/public-listing';
import { PRICE_ROLE_ORDER, priceClassOf, type PriceRole } from '@/lib/properties/price-resolver';
import type { StayTotals } from '@/lib/listings/listing-stay-total';
import { PRICE_SECTION_KEY } from '../listing-price-keys';
import {
  countListingSections,
  flattenListingSections,
  type ListingSectionHeading,
  type ListingSections,
} from '../listing-price-sections';
import {
  DEFAULT_LISTING_ORDER,
  LISTING_ORDERS,
  compareListingsByListedAt,
  orderResultsListings,
  parseListingOrder,
  writeListingOrder,
  type ListingOrder,
} from '../listing-results-order';

const AT = '2026-09-06T10:00:00.000Z';
const UNKNOWN: ListedAt = { kind: 'unknown', reason: 'predates-record' };

/** Τι είδους ποσό κουβαλά η δοκιμαστική αγγελία — **ο ρόλος που θα κρίνει ο επιλυτής**. */
interface PriceShape {
  readonly commercialStatus: PublicListing['commercialStatus'];
  readonly commercial: PublicListing['commercial'];
  readonly offerKinds: PublicListing['offerKinds'];
}

const NO_AMOUNTS = { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null };

/** Πώληση — το επτάτιμο λεξιλόγιο απαντά πρώτο. */
const forSale = (amount: number | null): PriceShape => ({
  commercialStatus: 'for-sale',
  commercial: { ...NO_AMOUNTS, askingPrice: amount },
  offerKinds: ['sell'],
});

/** Μηνιαίο μίσθωμα. */
const forRent = (amount: number | null): PriceShape => ({
  commercialStatus: 'for-rent',
  commercial: { ...NO_AMOUNTS, rentPrice: amount },
  offerKinds: ['leaseOut'],
});

/**
 * Διανυκτέρευση — **η μόνη μορφή** που οδηγεί τον επιλυτή στον ρόλο `nightly`
 * (ADR-835 §4.4): το `leaseShort` **δεν** προβάλλεται στο παλιό λεξιλόγιο, άρα η
 * εμπορική κατάσταση είναι `unavailable` και ο τρίτος άξονας ρωτιέται.
 */
const forStay = (amount: number | null): PriceShape => ({
  commercialStatus: 'unavailable',
  commercial: { ...NO_AMOUNTS, nightlyRate: amount },
  offerKinds: ['leaseShort'],
});

/** Όσο χρειάζεται η **σειρά**, με τον πραγματικό τύπο — ποτέ `as PublicListing`. */
function listingOf(
  id: string,
  title: string,
  listedAt: ListedAt,
  price: PriceShape = forSale(100_000),
): PublicListing {
  return {
    id,
    title,
    listedAt,
    projectedAt: AT,
    commercialStatus: price.commercialStatus,
    commercial: price.commercial,
    stay: null,
    coverImage: null,
    gallery: [],
    floorplans: [],
    type: 'apartment',
    areaSqm: 90,
    offerKinds: price.offerKinds,
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
const flatIds = (s: ListingSections): readonly string[] => idsOf(flattenListingSections(s));
const headings = (s: ListingSections): readonly (ListingSectionHeading | null)[] =>
  s.map((section) => section.heading);

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

describe('Β. Η ΚΛΑΣΗ ΜΙΑΣ ΑΓΓΕΛΙΑΣ — ο ΕΝΑΣ κριτής, κοινός με το φίλτρο εύρους', () => {
  it('Β1 — κάθε ρόλος αναγνωρίζεται από τον ίδιο επιλυτή που ζωγραφίζει την τιμή', () => {
    expect(priceClassOf(listingOf('a', 'Α', known(AT), forSale(170_000)))).toBe('sale');
    expect(priceClassOf(listingOf('b', 'Β', known(AT), forRent(900)))).toBe('rent');
    expect(priceClassOf(listingOf('c', 'Γ', known(AT), forStay(50)))).toBe('nightly');
  });

  it('🔴 Β2 — ΑΠΟΥΣΙΑ ΤΙΜΗΣ είναι ΚΛΑΣΗ, όχι «υπόλοιπο»', () => {
    expect(priceClassOf(listingOf('d', 'Δ', known(AT), forSale(null)))).toBe('unpriced');
  });

  it('Β3 — κάθε κλάση έχει θέση στη δηλωμένη σειρά, και η απουσία είναι ΤΕΛΕΥΤΑΙΑ', () => {
    // Φυλάει ότι το `PRICE_ROLE_ORDER` είναι **η μία** δήλωση: αν κάποιος ξαναγράψει
    // τοπικό πίνακα εδώ ή στον χάρτη, χάρτης και λίστα θα διαφωνήσουν για την ίδια
    // αναζήτηση.
    expect(PRICE_ROLE_ORDER.sale).toBeLessThan(PRICE_ROLE_ORDER.rent);
    expect(PRICE_ROLE_ORDER.rent).toBeLessThan(PRICE_ROLE_ORDER.nightly);
  });
});

describe('Γ. ΟΜΟΙΟΓΕΝΗ ΑΠΟΤΕΛΕΣΜΑΤΑ — η οθόνη ΔΕΝ αλλάζει', () => {
  const CHEAP = listingOf('prop_cheap', 'Φθηνή', known(AT), forSale(50_000));
  const RICH = listingOf('prop_rich', 'Ακριβή', known(AT), forSale(500_000));

  it('🔴 Γ1 — ΕΝΑ τμήμα, ΧΩΡΙΣ επιγραφή: μία κλάση δεν χρειάζεται ανακοίνωση', () => {
    const sections = orderResultsListings([RICH, CHEAP], 'priceAsc');
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeNull();
  });

  it('Γ2 — αύξουσα και φθίνουσα, μέσα στη μία κλάση', () => {
    expect(flatIds(orderResultsListings([RICH, CHEAP], 'priceAsc'))).toEqual([
      'prop_cheap',
      'prop_rich',
    ]);
    expect(flatIds(orderResultsListings([CHEAP, RICH], 'priceDesc'))).toEqual([
      'prop_rich',
      'prop_cheap',
    ]);
  });

  it('🔴 Γ3 — επιστρέφει ΝΕΟΥΣ πίνακες· η είσοδος του `onSnapshot` ΔΕΝ μεταβάλλεται', () => {
    const input = [OLD, NEW, NEVER];
    const before = idsOf(input);

    const sections = orderResultsListings(input, 'newest');

    expect(sections[0].listings).not.toBe(input);
    expect(idsOf(input)).toEqual(before);
  });

  it('Γ4 — «νεότερες»: νέα → παλιά → άγνωστη', () => {
    expect(flatIds(orderResultsListings([NEVER, OLD, NEW], 'newest'))).toEqual([
      'prop_new',
      'prop_old',
      'prop_never',
    ]);
  });

  it('🔴 Γ5 — Ο ΧΡΟΝΟΣ ΔΕΝ ΤΜΗΜΑΤΟΠΟΙΕΙΤΑΙ ΠΟΤΕ — έχει ΜΙΑ μονάδα', () => {
    // Ακόμη και με τρεις ρόλους ανάμεικτους, η «νεότερες» δίνει **ένα** τμήμα: οι
    // επιγραφές ανήκουν στην ερώτηση «πόσο;», όχι στη λίστα.
    const mixed = [
      listingOf('prop_s', 'Πώληση', known(AT), forSale(170_000)),
      listingOf('prop_r', 'Ενοίκιο', known(AT), forRent(900)),
      listingOf('prop_n', 'Διαμονή', known(AT), forStay(50)),
    ];
    const sections = orderResultsListings(mixed, 'newest');
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBeNull();
  });

  it('Γ6 — κάθε δηλωμένη σειρά ΕΧΕΙ συγκριτή που τρέχει', () => {
    // Φυλάει τον κλειστό κατάλογο: μια σειρά στο μενού που δεν κάνει τίποτα είναι
    // χειρότερη από σειρά που δεν προσφέρεται.
    for (const order of LISTING_ORDERS) {
      expect(countListingSections(orderResultsListings([NEVER, OLD, NEW], order))).toBe(3);
    }
  });
});

describe('🔴 Δ. ΑΝΑΜΕΙΚΤΑ — Η ΣΥΓΚΡΙΣΗ ΑΝΑΜΕΣΑ ΣΕ ΚΛΑΣΕΙΣ ΔΕΝ ΕΚΤΕΛΕΙΤΑΙ ΠΟΤΕ', () => {
  const SALE_CHEAP = listingOf('prop_sale_cheap', 'Πώληση φθηνή', known(AT), forSale(120_000));
  const SALE_RICH = listingOf('prop_sale_rich', 'Πώληση ακριβή', known(AT), forSale(450_000));
  const RENT = listingOf('prop_rent', 'Ενοίκιο', known(AT), forRent(900));
  const STAY = listingOf('prop_stay', 'Διαμονή', known(AT), forStay(50));

  const MIXED = [STAY, SALE_RICH, RENT, SALE_CHEAP];

  it('Δ1 — τρεις κλάσεις ⇒ τρία τμήματα, στη ΔΗΛΩΜΕΝΗ σειρά (προβολή του `OFFER_KINDS`)', () => {
    expect(headings(orderResultsListings(MIXED, 'priceAsc'))).toEqual(['sale', 'rent', 'nightly']);
  });

  it('🔴 Δ2 — Η ΑΚΡΙΒΗ ΠΩΛΗΣΗ ΠΡΟΗΓΕΙΤΑΙ ΤΗΣ ΦΘΗΝΗΣ ΔΙΑΝΥΚΤΕΡΕΥΣΗΣ — η καρδιά του §8.60.14', () => {
    // Με **έναν** άξονα η έξοδος θα ήταν `50 → 900 → 120.000 → 450.000`, δηλαδή η
    // διανυκτέρευση των 50 € θα ήταν «το φθηνότερο ακίνητο της αγοράς».
    expect(flatIds(orderResultsListings(MIXED, 'priceAsc'))).toEqual([
      'prop_sale_cheap',
      'prop_sale_rich',
      'prop_rent',
      'prop_stay',
    ]);
  });

  it('🔴 Δ3 — και στη ΦΘΙΝΟΥΣΑ οι κλάσεις ΔΕΝ αντιστρέφονται· αντιστρέφεται ο ΑΡΙΘΜΟΣ μέσα τους', () => {
    // Η κατεύθυνση είναι ιδιότητα της **τιμής**, όχι της κλάσης. Αν αντιστρεφόταν και η
    // σειρά των τμημάτων, η οθόνη θα έλεγε «η διανυκτέρευση είναι το ακριβότερο».
    expect(headings(orderResultsListings(MIXED, 'priceDesc'))).toEqual(['sale', 'rent', 'nightly']);
    expect(flatIds(orderResultsListings(MIXED, 'priceDesc'))).toEqual([
      'prop_sale_rich',
      'prop_sale_cheap',
      'prop_rent',
      'prop_stay',
    ]);
  });

  it('🔴 Δ4 — ΧΩΡΙΣ ΤΙΜΗ: δική της κλάση, ΤΕΛΕΥΤΑΙΑ, και στις ΔΥΟ κατευθύνσεις', () => {
    const NO_PRICE = listingOf('prop_none', 'Χωρίς τιμή', known(AT), forSale(null));
    const withNone = [NO_PRICE, ...MIXED];

    for (const order of ['priceAsc', 'priceDesc'] as const) {
      const sections = orderResultsListings(withNone, order);
      expect(headings(sections)).toEqual(['sale', 'rent', 'nightly', 'unpriced']);
      expect(flatIds(sections).at(-1)).toBe('prop_none');
    }
  });

  it('Δ5 — το τμήμα της απουσίας έχει ΟΛΙΚΗ σειρά (δεν ταξινομείται κατά τιμή που δεν έχει)', () => {
    const a = listingOf('prop_b', 'Ίδια', known(AT), forSale(null));
    const b = listingOf('prop_a', 'Ίδια', known(AT), forSale(null));
    expect(flatIds(orderResultsListings([a, b], 'priceAsc'))).toEqual(['prop_a', 'prop_b']);
    expect(flatIds(orderResultsListings([b, a], 'priceAsc'))).toEqual(['prop_a', 'prop_b']);
  });

  it('🔴 Δ6 — ΝΤΕΤΕΡΜΙΝΙΣΜΟΣ: κάθε αναδιάταξη της εισόδου δίνει ΤΗΝ ΙΔΙΑ έξοδο', () => {
    const permutations = [
      [STAY, SALE_RICH, RENT, SALE_CHEAP],
      [SALE_CHEAP, SALE_RICH, RENT, STAY],
      [RENT, STAY, SALE_CHEAP, SALE_RICH],
      [SALE_RICH, RENT, STAY, SALE_CHEAP],
    ];
    const outputs = permutations.map((p) => flatIds(orderResultsListings(p, 'priceAsc')));
    for (const out of outputs) expect(out).toEqual(outputs[0]);
  });

  it('🔴 Δ7 — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ: τα τμήματα αθροίζουν στην είσοδο, σε ΚΑΘΕ σειρά', () => {
    // Φυλάει το αναλλοίωτο του §8.62: ο μετρητής της οθόνης διαβάζει
    // `countListingSections`. Μια αγγελία που έπεφτε έξω από κάθε κλάση θα εξαφανιζόταν
    // **σιωπηλά** και ο μετρητής θα έμενε συνεπής με τον εαυτό του.
    const withNone = [...MIXED, listingOf('prop_none', 'Χωρίς τιμή', known(AT), forSale(null))];
    for (const order of LISTING_ORDERS) {
      const sections = orderResultsListings(withNone, order);
      expect(countListingSections(sections)).toBe(withNone.length);
      expect(new Set(flatIds(sections)).size).toBe(withNone.length);
    }
  });

  it('Δ8 — κενή είσοδος ⇒ κανένα τμήμα (ποτέ ένα άδειο με επιγραφή)', () => {
    expect(orderResultsListings([], 'priceAsc')).toEqual([]);
    expect(orderResultsListings([], 'newest')).toEqual([]);
  });
});

describe('🔴 Ε. ΤΟ ΣΥΝΟΛΟ ΔΙΑΜΟΝΗΣ ΑΛΛΑΖΕΙ ΤΗ ΜΟΝΑΔΑ ΤΟΥ ΤΜΗΜΑΤΟΣ — ΟΛΟ Ή ΤΙΠΟΤΑ', () => {
  /** Ακριβότερη **νύχτα**, φθηνότερη **διαμονή** — μία νύχτα έναντι πέντε. */
  const PRICEY_NIGHT = listingOf('prop_pricey_night', 'Ακριβή νύχτα', known(AT), forStay(200));
  const CHEAP_NIGHT = listingOf('prop_cheap_night', 'Φθηνή νύχτα', known(AT), forStay(50));

  const TOTALS: StayTotals = {
    prop_pricey_night: { totalMinor: 20_000, nights: 1 }, // 200 € · 1 νύχτα
    prop_cheap_night: { totalMinor: 25_000, nights: 5 }, // 250 € · 5 νύχτες
  };

  it('🔴 Ε1 — με ημερομηνίες ταξινομεί κατά ΣΥΝΟΛΟ, ΟΧΙ κατά τιμή νύχτας', () => {
    // Χωρίς σύνολα η σειρά θα ήταν «φθηνή νύχτα πρώτη» (50 < 200). Με σύνολα είναι
    // **αντίστροφη** (200 € < 250 €) — γι' αυτό τα νούμερα διαλέχτηκαν έτσι: η ισοδυναμία
    // θα έκρυβε τη μετάλλαξη.
    const sections = orderResultsListings([CHEAP_NIGHT, PRICEY_NIGHT], 'priceAsc', {
      stayTotals: TOTALS,
    });
    expect(flatIds(sections)).toEqual(['prop_pricey_night', 'prop_cheap_night']);
  });

  it('Ε2 — ΧΩΡΙΣ ημερομηνίες ταξινομεί κατά τιμή νύχτας', () => {
    expect(flatIds(orderResultsListings([PRICEY_NIGHT, CHEAP_NIGHT], 'priceAsc'))).toEqual([
      'prop_cheap_night',
      'prop_pricey_night',
    ]);
  });

  it('🔴 Ε3 — κατάλυμα ΧΩΡΙΣ σύνολο ΔΕΝ είναι απάντηση: τέλος, και στις ΔΥΟ κατευθύνσεις', () => {
    // Κατειλημμένο / χωρίς δηλωμένο ημερολόγιο / κάτω από ελάχιστες νύχτες ⇒ ο
    // `stayTotalOf` δεν δίνει σύνολο. Ένα «50 €/νύχτα» ανακατεμένο με «250 € σύνολο»
    // θα ήταν η ίδια αμαρτία **ένα επίπεδο πιο κάτω**.
    const BOOKED = listingOf('prop_booked', 'Κρατημένο', known(AT), forStay(10));

    for (const order of ['priceAsc', 'priceDesc'] as const) {
      const sections = orderResultsListings([BOOKED, CHEAP_NIGHT, PRICEY_NIGHT], order, {
        stayTotals: TOTALS,
      });
      expect(flatIds(sections).at(-1)).toBe('prop_booked');
    }
  });

  it('Ε4 — τα σύνολα ΔΕΝ αγγίζουν τις άλλες κλάσεις', () => {
    const SALE = listingOf('prop_sale', 'Πώληση', known(AT), forSale(120_000));
    const sections = orderResultsListings([SALE, CHEAP_NIGHT, PRICEY_NIGHT], 'priceAsc', {
      stayTotals: TOTALS,
    });
    expect(headings(sections)).toEqual(['sale', 'nightly']);
    expect(idsOf(sections[0].listings)).toEqual(['prop_sale']);
  });
});

describe('ΣΤ. ΤΟ ΙΣΙΩΜΑ — γραμμική επέκταση, ποτέ ισχυρισμός κατάταξης', () => {
  it('ΣΤ1 — η συνένωση διατηρεί τη σειρά των τμημάτων και τη σειρά μέσα τους', () => {
    const sections: ListingSections = [
      { heading: 'sale', listings: [listingOf('a', 'Α', known(AT), forSale(1))] },
      { heading: 'nightly', listings: [listingOf('b', 'Β', known(AT), forStay(2))] },
    ];
    expect(idsOf(flattenListingSections(sections))).toEqual(['a', 'b']);
    expect(countListingSections(sections)).toBe(2);
  });
});

describe('🔴 Ζ. ΟΙ ΕΠΙΓΡΑΦΕΣ — ολικές, και ΛΥΝΟΝΤΑΙ στα ΠΡΑΓΜΑΤΙΚΑ locales', () => {
  type Locale = Record<string, unknown>;

  /** `ns:a.b.c` → τιμή του locale. Μηδενική ICU — εδώ κρίνεται η **ύπαρξη**. */
  function lookup(locale: Locale, key: string): unknown {
    const path = key.split(':')[1] ?? key;
    return path
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale);
  }

  const ALL_HEADINGS: readonly ListingSectionHeading[] = [
    ...(Object.keys(PRICE_ROLE_ORDER) as PriceRole[]),
    'unpriced',
  ];

  it('Ζ1 — ο πίνακας είναι ΟΛΙΚΟΣ πάνω στις κλάσεις (καμία σιωπηλή παράλειψη)', () => {
    for (const heading of ALL_HEADINGS) {
      expect(PRICE_SECTION_KEY[heading]).toEqual(expect.any(String));
    }
    expect(Object.keys(PRICE_SECTION_KEY).sort()).toEqual([...ALL_HEADINGS].sort());
  });

  it('🔴 Ζ2 — κάθε κλειδί ΥΠΑΡΧΕΙ στα el ΚΑΙ στα en — ωμό κλειδί δεν φτάνει σε οθόνη', () => {
    for (const heading of ALL_HEADINGS) {
      const key = PRICE_SECTION_KEY[heading];
      for (const locale of [elCommon as Locale, enCommon as Locale]) {
        expect(typeof lookup(locale, key)).toBe('string');
      }
    }
  });

  it('🔴 Ζ3 — κάθε επιγραφή ΜΕΤΡΑ: το `{count}` με ICU plural, και στις δύο γλώσσες', () => {
    // Η επιγραφή είναι η **μόνη** δήλωση του κανόνα κατάταξης (Καν. ΕΕ 2019/1150 ·
    // Οδηγία 2019/2161). Μια επιγραφή χωρίς πλήθος ονομάζει την κλάση αλλά δεν λέει
    // **πόσο** προσπερνά ο άνθρωπος.
    for (const heading of ALL_HEADINGS) {
      const key = PRICE_SECTION_KEY[heading];
      for (const locale of [elCommon as Locale, enCommon as Locale]) {
        expect(String(lookup(locale, key))).toMatch(/\{count, plural,/);
      }
    }
  });

  it('Ζ4 — καμία κλάση δεν μοιράζεται κείμενο με άλλη (η επιγραφή ΞΕΧΩΡΙΖΕΙ)', () => {
    const keys = ALL_HEADINGS.map((h) => PRICE_SECTION_KEY[h]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of [elCommon as Locale, enCommon as Locale]) {
      const texts = keys.map((k) => String(lookup(locale, k)));
      expect(new Set(texts).size).toBe(texts.length);
    }
  });
});

describe('Η. Η ΔΙΕΥΘΥΝΣΗ', () => {
  it('Η1 — άδεια διεύθυνση ⇒ η προεπιλογή', () => {
    expect(parseListingOrder(new URLSearchParams())).toBe(DEFAULT_LISTING_ORDER);
  });

  it('🔴 Η2 — ΑΓΝΩΣΤΗ τιμή αγνοείται, δεν σκάει η οθόνη', () => {
    expect(parseListingOrder(new URLSearchParams('sort=cheapest-sponsored'))).toBe(
      DEFAULT_LISTING_ORDER,
    );
  });

  it('Η3 — δηλωμένη τιμή διαβάζεται', () => {
    expect(parseListingOrder(new URLSearchParams('sort=priceDesc'))).toBe('priceDesc');
  });

  it('🔴 Η4 — η ΠΡΟΕΠΙΛΟΓΗ ΔΕΝ γράφεται: δύο ίδιες αναζητήσεις, μία διεύθυνση', () => {
    const params = new URLSearchParams('bedmin=2');
    writeListingOrder(DEFAULT_LISTING_ORDER, params);
    expect(params.toString()).toBe('bedmin=2');
  });

  it('Η5 — μη προεπιλεγμένη γράφεται ΔΙΠΛΑ στα φίλτρα, χωρίς να τα πειράξει', () => {
    const params = new URLSearchParams('bedmin=2');
    writeListingOrder('priceAsc', params);

    expect(params.get('sort')).toBe('priceAsc');
    expect(params.get('bedmin')).toBe('2');
  });

  it('🔑 Η6 — επιστροφή στην προεπιλογή ΚΑΘΑΡΙΖΕΙ την παράμετρο', () => {
    const params = new URLSearchParams('sort=priceAsc');
    writeListingOrder(DEFAULT_LISTING_ORDER, params);
    expect(params.has('sort')).toBe(false);
  });

  it('Η7 — ό,τι γράφεται, ξαναδιαβάζεται (round-trip σε κάθε δηλωμένη σειρά)', () => {
    for (const order of LISTING_ORDERS as readonly ListingOrder[]) {
      const params = new URLSearchParams();
      writeListingOrder(order, params);
      expect(parseListingOrder(params)).toBe(order);
    }
  });
});
