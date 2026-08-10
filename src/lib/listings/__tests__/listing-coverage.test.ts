/**
 * Άγκυρες για την **κάλυψη της οθόνης 1** (ADR-777 Α3 · Α9 · SPEC-777-RESEARCH §25.7).
 *
 * 🔑 Η σημαντικότερη ομάδα **δεν** είναι οι τρεις καταστάσεις — είναι η **Κ3**: ότι η
 * κάλυψη διαβάζει την **ίδια** λογιστική με την οθόνη 2. Αν αποκτήσει δική της, η
 * οθόνη 1 θα μπορεί να λέει «6 ακίνητα» και η οθόνη 2 «5», χωρίς τίποτα να το ρωτά —
 * το σχήμα του ADR-749 (τέσσερις μηχανές, τρεις αριθμοί), σε δύο οθόνες αυτή τη φορά.
 */

import {
  computeListingCoverage,
  coverageStateOf,
  coverageAnswersWhere,
  type CoverageState,
} from '../listing-coverage';
import { computeListingLedger } from '@/services/realtime/hooks/usePublicListings';
import type { PublicListing } from '@/types/public-listing';

const AT = '2026-08-10T10:00:00.000Z';

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l1',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null },
    coverImage: null,
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    floor: 1,
    bedrooms: 3,
    title: 'Δοκιμή',
    projectedAt: AT,
    ...over,
  };
}

/** Αγγελία **με** θέση — γεωκωδικοποιημένη ακριβής, το απλούστερο `known`. */
function located(id: string): PublicListing {
  return listing({
    id,
    position: {
      kind: 'known',
      provenance: 'geocoded',
      point: { lat: 40.64, lng: 22.94 },
      locatedAt: AT,
      accuracy: 'exact',
    },
  });
}

// ============================================================================
// Κ1 — ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΙ Η ΣΕΙΡΑ ΤΟΥΣ
// ============================================================================

describe('Κ1 — κλειστό σύνολο τριών καταστάσεων', () => {
  it('καμία αγγελία ⇒ `no-supply`', () => {
    expect(computeListingCoverage([]).state).toBe<CoverageState>('no-supply');
  });

  it('αγγελίες χωρίς καμία θέση ⇒ `no-location` — η ΖΩΝΤΑΝΗ κατάσταση της 10/08', () => {
    // Μετρημένο στην οθόνη 2: «6 ακίνητα · 0 στον χάρτη · 6 χωρίς δηλωμένη θέση».
    const six = Array.from({ length: 6 }, (_, i) => listing({ id: `l${i}` }));
    const coverage = computeListingCoverage(six);
    expect(coverage.state).toBe<CoverageState>('no-location');
    expect(coverage.ledger).toEqual({ total: 6, mapped: 0, unmapped: 6 });
  });

  it('έστω μία με θέση ⇒ `partial`', () => {
    expect(computeListingCoverage([listing(), located('l2')]).state).toBe<CoverageState>('partial');
  });

  it('🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: το κενό κρίνεται ΠΡΙΝ ρωτηθεί η θέση', () => {
    // Με άδεια βάση, `mapped === 0` είναι **επίσης** αληθές. Αν ο έλεγχος της θέσης
    // προηγούνταν, η οθόνη θα έλεγε «καμία δεν έχει δηλωμένη θέση» — αριθμητικά
    // αληθές, **παραπλανητικό**: το πρόβλημα δεν είναι η θέση, είναι η απουσία.
    expect(coverageStateOf({ total: 0, mapped: 0, unmapped: 0 })).toBe<CoverageState>('no-supply');
  });

  it('⛔ ΔΕΝ υπάρχει κατάσταση «πλήρης» — ούτε στο 100%', () => {
    // Ακόμη κι όταν κάθε αγγελία έχει θέση, η σωστή δήλωση παραμένει «τόσα ξέρουμε»,
    // ποτέ «τα ξέρουμε όλα»: το δεύτερο είναι ισχυρισμός για τον ΚΟΣΜΟ, όχι για τα
    // δεδομένα μας — δηλαδή το χειρόγραφο μάρκετινγκ που το αρχείο αρνείται.
    expect(computeListingCoverage([located('a'), located('b')]).state).toBe<CoverageState>('partial');
  });
});

// ============================================================================
// Κ2 — Η ΥΠΟΣΧΕΣΗ
// ============================================================================

describe('Κ2 — το «πού;» υπόσχεται μόνο όταν μπορεί να το τηρήσει', () => {
  it.each<[CoverageState, boolean]>([
    ['no-supply', false],
    ['no-location', false],
    ['partial', true],
  ])('%s ⇒ answersWhere = %s', (state, expected) => {
    const ledger =
      state === 'no-supply'
        ? { total: 0, mapped: 0, unmapped: 0 }
        : state === 'no-location'
          ? { total: 3, mapped: 0, unmapped: 3 }
          : { total: 3, mapped: 1, unmapped: 2 };
    expect(coverageAnswersWhere({ ledger, state })).toBe(expected);
  });
});

// ============================================================================
// Κ3 — 🔑 ΜΙΑ ΛΟΓΙΣΤΙΚΗ. Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΑΓΚΥΡΑ ΤΟΥ ΑΡΧΕΙΟΥ.
// ============================================================================

describe('Κ3 — η οθόνη 1 και η οθόνη 2 ΔΕΝ μπορούν να δώσουν διαφορετικό αριθμό', () => {
  it('το `coverage.ledger` είναι ΤΑΥΤΟΣΗΜΟ με το `computeListingLedger` της οθόνης 2', () => {
    const mixed = [listing({ id: 'a' }), located('b'), listing({ id: 'c' }), located('d')];
    expect(computeListingCoverage(mixed).ledger).toEqual(computeListingLedger(mixed));
  });

  it('🔴 …και σε ΚΑΘΕ μέγεθος συνόλου, όχι μόνο σε ένα δείγμα', () => {
    for (let unlocated = 0; unlocated <= 4; unlocated++) {
      for (let withPlace = 0; withPlace <= 4; withPlace++) {
        const set = [
          ...Array.from({ length: unlocated }, (_, i) => listing({ id: `u${i}` })),
          ...Array.from({ length: withPlace }, (_, i) => located(`k${i}`)),
        ];
        expect(computeListingCoverage(set).ledger).toEqual(computeListingLedger(set));
      }
    }
  });
});

// ============================================================================
// Κ4 — ΤΟ `state` ΔΕΝ ΕΙΝΑΙ ΑΝΕΞΑΡΤΗΤΟ ΔΕΔΟΜΕΝΟ
// ============================================================================

describe('Κ4 — το `state` παράγεται από το `ledger`, πάντα', () => {
  it('η αναλλοίωτη `coverageStateOf(c.ledger) === c.state` ισχύει σε κάθε σύνθεση', () => {
    for (let unlocated = 0; unlocated <= 3; unlocated++) {
      for (let withPlace = 0; withPlace <= 3; withPlace++) {
        const coverage = computeListingCoverage([
          ...Array.from({ length: unlocated }, (_, i) => listing({ id: `u${i}` })),
          ...Array.from({ length: withPlace }, (_, i) => located(`k${i}`)),
        ]);
        expect(coverageStateOf(coverage.ledger)).toBe(coverage.state);
      }
    }
  });
});

// ============================================================================
// Κ5 — ΤΟ ΚΡΙΤΗΡΙΟ ΘΕΣΗΣ ΕΙΝΑΙ ΔΑΝΕΙΣΜΕΝΟ, ΟΧΙ ΞΑΝΑΓΡΑΜΜΕΝΟ
// ============================================================================

describe('Κ5 — «έχει θέση;» απαντιέται από το σχήμα του χάρτη, όχι από το `kind`', () => {
  it('🔴 μια `shaded-city` (μόνο πόλη) ΜΕΤΡΑΕΙ ως θέση — δεν είναι πινέζα, αλλά είναι σχήμα', () => {
    // Το σκαλί που το ADR-777 Α5 ονόμασε κρίσιμο: το `'center'` ζωγραφίζεται ως
    // σκιασμένη πόλη, **ποτέ** πινέζα — αλλά **υπάρχει** στον χάρτη. Ένα χειρόγραφο
    // κριτήριο «είναι ακριβής;» θα το έβγαζε από τη λογιστική και ο χάρτης θα
    // έδειχνε περισσότερα από όσα η οθόνη 1 παραδέχεται ότι ξέρει.
    const cityOnly = listing({
      id: 'city',
      position: {
        kind: 'known',
        provenance: 'geocoded',
        point: { lat: 40.64, lng: 22.94 },
        locatedAt: AT,
        accuracy: 'center',
      },
    });
    const coverage = computeListingCoverage([cityOnly]);
    expect(coverage.ledger.mapped).toBe(1);
    expect(coverage.state).toBe<CoverageState>('partial');
  });
});
