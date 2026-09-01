/**
 * @fileoverview **ΔΥΟ ΔΙΑΜΕΡΙΣΕΙΣ, ΕΝΑ ΣΥΝΟΛΟ** — η άγκυρα που κοκκινίζει (ADR-835 Φ3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ Η ΠΙΟ ΣΗΜΑΝΤΙΚΗ ΑΓΚΥΡΑ ΤΗΣ ΦΑΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **δύσκολη** απόφαση της Φ3 ήταν να μη γίνουν οι νέοι κάδοι πεδία του υπάρχοντος
 * `ListingLedger`. Αν είχαν γίνει, το `ledgerBalances` θα ήταν **ψευδές** — γιατί
 * *«στον χάρτη»* και *«ελεύθερο»* είναι **ανεξάρτητες διαμερίσεις του ίδιου συνόλου**,
 * και ένα ακίνητο είναι **ταυτόχρονα** `mapped` **και** `occupied`.
 *
 * Οι δοκιμές εδώ κρατούν και τα δύο σκέλη: ότι **η καθεμιά** κλείνει μόνη της, **και**
 * ότι κλείνουν **στο ίδιο σύνολο**.
 */

import {
  computeStayLedger,
  stayLedgerBalances,
  ledgersAgree,
  type StayLedger,
} from '@/lib/listings/stay-ledger';
import { computeListingLedger } from '@/services/realtime/hooks/usePublicListings';
import {
  STAY_AVAILABILITY_KINDS,
  type StayAvailabilityAnswer,
  type StayAvailabilityKind,
} from '@/lib/stay/stay-availability-vocabulary';
import { ledgerBalances, type PublicListing } from '@/types/public-listing';

// =============================================================================
// ΣΚΗΝΙΚΟ
// =============================================================================

function listing(id: string, mapped: boolean): PublicListing {
  return {
    id,
    commercialStatus: 'for-rent',
    commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: 80 },
    stay: { minNights: null, maxGuests: 4, nextAvailableFrom: null },
    coverImage: null,
    type: 'apartment',
    areaSqm: 60,
    offerKinds: ['leaseShort'],
    position: mapped
      ? { kind: 'known', provenance: 'manual', point: { lat: 40.6, lng: 22.9 }, locatedAt: '2026-08-01T00:00:00.000Z' }
      : { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: 1,
    bedrooms: 2,
    authorship: 'owner-declared',
    agencyName: null,
    agencyId: null,
    title: `Κατάλυμα ${id}`,
    legality: [],
    projectedAt: '2026-08-01T00:00:00.000Z',
  } as PublicListing;
}

const ANSWERS: Readonly<Record<string, StayAvailabilityAnswer>> = {
  a: { kind: 'free' },
  b: { kind: 'free' },
  c: { kind: 'occupied', nextFreeFrom: '2026-08-14', freeRuns: [] },
  d: { kind: 'unknown' },
  e: { kind: 'not-a-stay' },
};

/** Πέντε αγγελίες: **3 στον χάρτη**, 2 χωρίς θέση — και πέντε διαφορετικές απαντήσεις. */
const LISTINGS: readonly PublicListing[] = [
  listing('a', true),
  listing('b', true),
  listing('c', true),
  listing('d', false),
  listing('e', false),
];

const answerFor = (l: PublicListing): StayAvailabilityAnswer | undefined => ANSWERS[l.id];

// =============================================================================
// Α — ΚΑΘΕ ΚΑΔΟΣ ΥΠΑΡΧΕΙ, ΚΑΙ ΣΤΟ ΜΗΔΕΝ
// =============================================================================

describe('Α — η λογιστική τυπώνει το 0 αντί να το παραλείπει', () => {
  it('κενό σύνολο ⇒ και οι εννέα κάδοι υπάρχουν με τιμή 0', () => {
    const ledger = computeStayLedger([], answerFor);
    expect(ledger.total).toBe(0);
    for (const kind of STAY_AVAILABILITY_KINDS) {
      expect(ledger.byKind[kind]).toBe(0);
    }
    expect(stayLedgerBalances(ledger)).toBe(true);
  });

  it('🔴 οι κάδοι παράγονται από το ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ, όχι από χειρόγραφη λίστα', () => {
    const keys = Object.keys(computeStayLedger([], answerFor).byKind).sort();
    expect(keys).toEqual([...STAY_AVAILABILITY_KINDS].sort());
  });
});

// =============================================================================
// Β — Η ΜΕΤΡΗΣΗ ΤΟΥ §4.6
// =============================================================================

describe('Β — «5 αγγελίες · 2 ελεύθερα · 1 κρατημένο · 1 χωρίς ημερολόγιο · 1 μη κατάλυμα»', () => {
  const ledger = computeStayLedger(LISTINGS, answerFor);

  it('μετρά κάθε αγγελία σε ΕΝΑΝ κάδο', () => {
    expect(ledger.total).toBe(5);
    expect(ledger.byKind.free).toBe(2);
    expect(ledger.byKind.occupied).toBe(1);
    expect(ledger.byKind.unknown).toBe(1);
    expect(ledger.byKind['not-a-stay']).toBe(1);
  });

  it('🔴 ΤΟ ΑΘΡΟΙΣΜΑ ΚΛΕΙΝΕΙ', () => {
    expect(stayLedgerBalances(ledger)).toBe(true);
  });

  it('🔴 ΑΓΓΕΛΙΑ ΧΩΡΙΣ ΑΠΑΝΤΗΣΗ ΜΕΤΡΙΕΤΑΙ ΩΣ `unknown` — ποτέ δεν εξαφανίζεται', () => {
    // Η μία γραμμή που κρατά την υπόσχεση «δεν κρύβουμε τίποτα»: όσο ο διακομιστής
    // της Φ5 δεν απαντά, ΟΛΑ είναι `unknown` — και το άθροισμα εξακολουθεί να κλείνει.
    const blind = computeStayLedger(LISTINGS, () => undefined);
    expect(blind.total).toBe(5);
    expect(blind.byKind.unknown).toBe(5);
    expect(stayLedgerBalances(blind)).toBe(true);
  });
});

// =============================================================================
// Γ — 🔴 Ο ΦΡΟΥΡΟΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΜΠΟΡΕΙ ΝΑ ΠΕΙ «ΟΧΙ»
// =============================================================================

describe('Γ — `stayLedgerBalances`: υπάρχει για να ΑΠΟΤΥΧΕΙ, όχι για να επιβεβαιώνει', () => {
  it('🔴 λογιστική που ΔΕΝ κλείνει επιστρέφει `false`', () => {
    // Ο παρονομαστής όλης της ομάδας Β: χωρίς αυτό, ένα `balances = () => true` θα
    // περνούσε κάθε δοκιμή παραπάνω.
    const broken: StayLedger = {
      total: 5,
      byKind: { ...computeStayLedger(LISTINGS, answerFor).byKind, free: 99 },
    };
    expect(stayLedgerBalances(broken)).toBe(false);
  });

  it('🔴 …και όταν το `total` λέει περισσότερα από όσα μετρήθηκαν', () => {
    const lost: StayLedger = { total: 6, byKind: computeStayLedger(LISTINGS, answerFor).byKind };
    expect(stayLedgerBalances(lost)).toBe(false);
  });

  it('🔴 ΚΑΘΕ κάδος μετράει στο άθροισμα — κανένας δεν αγνοείται σιωπηλά', () => {
    // Φυλάει το `reduce` πάνω στο κλειστό σύνολο: αν κάποιος έγραφε τους κάδους στο
    // χέρι και ξεχνούσε έναν, η λογιστική θα «έκλεινε» ενώ θα έλειπαν αγγελίες.
    for (const kind of STAY_AVAILABILITY_KINDS) {
      const zeroed = { ...computeStayLedger([], answerFor).byKind } as Record<StayAvailabilityKind, number>;
      zeroed[kind] = 1;
      expect(stayLedgerBalances({ total: 1, byKind: zeroed })).toBe(true);
      expect(stayLedgerBalances({ total: 0, byKind: zeroed })).toBe(false);
    }
  });
});

// =============================================================================
// Δ — 🔴 ΟΙ ΔΥΟ ΔΙΑΜΕΡΙΣΕΙΣ ΚΛΕΙΝΟΥΝ ΣΤΟ ΙΔΙΟ ΣΥΝΟΛΟ
// =============================================================================

describe('Δ — «πού;» και «πότε;» μετρούν το ΙΔΙΟ σύνολο', () => {
  it('🔴 και οι δύο κλείνουν, και συμφωνούν στο πλήθος', () => {
    const position = computeListingLedger(LISTINGS);
    const stay = computeStayLedger(LISTINGS, answerFor);

    // Η πρώτη διαμέριση: 3 στον χάρτη, 2 χωρίς.
    expect(position).toEqual({ total: 5, mapped: 3, unmapped: 2 });
    expect(ledgerBalances(position)).toBe(true);
    expect(stayLedgerBalances(stay)).toBe(true);
    expect(ledgersAgree(position, stay)).toBe(true);
  });

  it('🔴 ΤΟ ΙΔΙΟ ΑΚΙΝΗΤΟ ΕΙΝΑΙ ΤΑΥΤΟΧΡΟΝΑ `mapped` ΚΑΙ `occupied` — γι΄ αυτό ΔΥΟ τύποι', () => {
    // Η απόδειξη ότι ένας τύπος με έξι κάδους θα μετρούσε διπλά: το `c` είναι στον
    // χάρτη ΚΑΙ κρατημένο. Σε ενιαίο άθροισμα θα ήταν `mapped + occupied = 2` για
    // **μία** αγγελία, και το `balances` θα κοκκίνιζε μονίμως.
    const single = [listing('c', true)];
    const position = computeListingLedger(single);
    const stay = computeStayLedger(single, answerFor);
    expect(position.mapped).toBe(1);
    expect(stay.byKind.occupied).toBe(1);
    expect(position.total).toBe(1);
    expect(stay.total).toBe(1);
    expect(ledgersAgree(position, stay)).toBe(true);
  });

  it('🔴 ΔΙΑΦΟΡΕΤΙΚΑ ΣΥΝΟΛΑ ⇒ `false` — ο παρονομαστής της συμφωνίας', () => {
    // Το ρεαλιστικό σφάλμα: κάποιος περνά στη μία τις **φιλτραρισμένες** και στην
    // άλλη **όλες**. Η οθόνη θα έδειχνε δύο αριθμούς για το ίδιο πράγμα.
    const position = computeListingLedger(LISTINGS);
    const stay = computeStayLedger(LISTINGS.slice(0, 3), answerFor);
    expect(ledgersAgree(position, stay)).toBe(false);
  });

  it('🔴 …και όταν η ΠΡΩΤΗ διαμέριση δεν κλείνει μόνη της', () => {
    const stay = computeStayLedger(LISTINGS, answerFor);
    expect(ledgersAgree({ total: 5, mapped: 3, unmapped: 1 }, stay)).toBe(false);
  });

  it('🔴 …και όταν η ΔΕΥΤΕΡΗ δεν κλείνει μόνη της', () => {
    const position = computeListingLedger(LISTINGS);
    const broken: StayLedger = {
      total: 5,
      byKind: { ...computeStayLedger(LISTINGS, answerFor).byKind, free: 0 },
    };
    expect(ledgersAgree(position, broken)).toBe(false);
  });
});
