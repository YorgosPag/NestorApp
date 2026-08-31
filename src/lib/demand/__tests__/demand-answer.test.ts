/**
 * Άγκυρες — **Η ΑΠΑΝΤΗΣΗ ΟΤΑΝ Η ΑΠΑΝΤΗΣΗ ΕΙΝΑΙ «ΤΙΠΟΤΑ»** (ADR-777 Α9 · SPEC-777B §12.6).
 *
 * **Σ — ΤΑ ΣΧΗΜΑΤΑ.** Και τα **έξι** παράγονται από πραγματικό σενάριο. Ένα σχήμα που
 * καμία είσοδος δεν πυροδοτεί είναι ένας από τους **606 αδρανείς φρουρούς** του
 * ADR-749 §5 — με τη διαφορά ότι εδώ θα ήταν **μήνυμα που κανείς δεν βλέπει ποτέ**.
 *
 * **Λ — Η ΛΟΓΙΣΤΙΚΗ.** Δύο ανεξάρτητα αθροίσματα, και το `demandAnswerBalances`
 * υπάρχει **για να αποτύχει**.
 *
 * **Κ — ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ ΤΟΥ GIORGIO**, ως εκτελέσιμη πρόταση.
 */

import {
  DEMAND_ANSWER_SHAPES,
  IGNORANCE_BLOCKERS,
  NO_LISTING_KNOWLEDGE,
  answerDemand,
  demandAnswerBalances,
  demandAnswerShape,
  ignoranceShare,
  listingFactsFrom,
} from '../demand-answer';
import { NO_DEMAND_FEATURES, type PropertyDemand } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';
import { NOW_ISO, TODAY, demand, listing } from './demand-fixtures';

/** Συντομογραφία: ζήτηση + αγγελίες + **μηδέν** γνώση (η σημερινή πραγματικότητα). */
function answer(d: PropertyDemand, listings: readonly PublicListing[], others: readonly PropertyDemand[] = []) {
  return answerDemand({
    demand: d,
    listings,
    knowledge: NO_LISTING_KNOWLEDGE,
    otherDemands: others,
    todayDate: TODAY,
    nowIso: NOW_ISO,
  });
}

/** Αγγελία πάνω από την οροφή κατά `over` — η μοναδική διαφορά. */
function overBy(over: number, id: string): PublicListing {
  return listing({
    id,
    commercial: { askingPrice: 250_000 + over, finalPrice: null, rentPrice: null, nightlyRate: null },
  });
}

// =============================================================================
// Κ — ΤΟ ΚΡΙΤΗΡΙΟ ΟΛΟΚΛΗΡΩΣΗΣ
// =============================================================================

describe('🔴 Κ — «δεν βρέθηκε τίποτα, αλλά με +20.000 € υπάρχουν 6, και άλλοι Ν ζητούν το ίδιο»', () => {
  it('η ΜΙΑ απάντηση κουβαλά **και τα τρία** σκέλη ταυτόχρονα', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } });
    const listings = [5_000, 8_000, 12_000, 15_000, 18_000, 20_000].map((over) =>
      overBy(over, `prop_${over}`),
    );
    // Οκτώ άλλοι άνθρωποι ζητούν κάτι που τέμνεται — πάνω από το κατώφλι των 5.
    const others = Array.from({ length: 8 }, (_, index) =>
      demand({ id: `dmnd_other_${index}`, authorUserId: `usr_${index}` }),
    );

    const result = answer(d, listings, others);

    // 1. «δεν βρέθηκε τίποτα»
    expect(result.matchedCount).toBe(0);
    // 2. «με +20.000 € υπάρχουν 6»
    const ladder = result.concessions.ladders.find((l) => l.concession === 'price-ceiling');
    expect(ladder?.headline).toEqual({ amount: 20_000, unlocks: 6 });
    // 3. «και άλλοι 8 ζητούν το ίδιο»
    expect(result.competition.count).toBe(8);

    expect(demandAnswerShape(result)).toBe('has-concession');
    expect(demandAnswerBalances(result)).toBe(true);
  });
});

// =============================================================================
// Σ — ΚΑΘΕ ΣΧΗΜΑ ΠΥΡΟΔΟΤΕΙ
// =============================================================================

describe('🔴 Σ — και τα έξι σχήματα παράγονται από πραγματικό σενάριο', () => {
  it('`has-matches` — υπάρχει ταίριασμα', () => {
    expect(demandAnswerShape(answer(demand(), [listing()]))).toBe('has-matches');
  });

  it('`has-concession` — τίποτα δεν ταιριάζει, αλλά υπάρχει πρόταση με ποσό', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } });
    expect(demandAnswerShape(answer(d, [overBy(10_000, 'prop_a')]))).toBe('has-concession');
  });

  it('`near-but-unreachable` — κοντινές, αλλά η υποχώρηση είναι μεγάλη', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } });
    // +100.000 = 40% πάνω από την οροφή ⇒ πάνω από το κατώφλι του 15%.
    expect(demandAnswerShape(answer(d, [overBy(100_000, 'prop_far')]))).toBe(
      'near-but-unreachable',
    );
  });

  it('`blocked-by-unknowns` — δεν ξέρουμε, ΔΕΝ σημαίνει «δεν υπάρχει»', () => {
    // Ζήτηση Ζ3: το επίπεδο Α είναι άδειο ⇒ `place-unresolved` σε **κάθε** αγγελία.
    const d = demand({ place: { kind: 'place', landId: 'land_1', buildingId: null } });
    const result = answer(d, [listing(), listing({ id: 'prop_2' })]);

    expect(demandAnswerShape(result)).toBe('blocked-by-unknowns');
    expect(result.blockedBy.get('place-unresolved')).toBe(2);
    expect(ignoranceShare(result)).toBe(1);
  });

  it('`no-match` — κρίθηκαν, και κανένα δεν πλησιάζει', () => {
    // Κατηγορικό εμπόδιο που **δεν** είναι άγνοια: άλλο είδος συναλλαγής.
    const d = demand({ seeks: ['leaseOut'] });
    const result = answer(d, [listing()]);

    expect(demandAnswerShape(result)).toBe('no-match');
    expect(ignoranceShare(result)).toBe(0);
  });

  it('`nothing-to-judge` — άδειος κατάλογος (ψυχρή εκκίνηση §25.7)', () => {
    expect(demandAnswerShape(answer(demand(), []))).toBe('nothing-to-judge');
  });

  it('🔑 το κλειστό σύνολο δεν έχει σχήμα χωρίς σενάριο', () => {
    // Ο παρονομαστής: αν προστεθεί έβδομο σχήμα, αυτό το test **σπάει** και ζητά
    // σενάριο — αντί να προσγειωθεί μήνυμα που κανείς δεν βλέπει ποτέ.
    expect(DEMAND_ANSWER_SHAPES).toHaveLength(6);
  });
});

// =============================================================================
// Η ΣΕΙΡΑ ΤΩΝ ΕΡΩΤΗΣΕΩΝ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('🔴 η σειρά των ερωτήσεων είναι συμβόλαιο, όχι τύχη', () => {
  it('το ΤΑΙΡΙΑΣΜΑ νικά την πρόταση — κανείς δεν θέλει συμβουλή όταν βρήκε', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } });
    const result = answer(d, [
      listing({ id: 'prop_ok', commercial: { askingPrice: 200_000, finalPrice: null, rentPrice: null, nightlyRate: null } }),
      overBy(10_000, 'prop_near'),
    ]);

    expect(result.matchedCount).toBe(1);
    expect(result.concessions.ladders.some((l) => l.headline !== null)).toBe(true);
    expect(demandAnswerShape(result)).toBe('has-matches');
  });

  it('🔴 η ΑΓΝΟΙΑ ρωτιέται ΠΡΙΝ την άρνηση — αλλιώς κάθε Ζ2/Ζ3/Ζ6 θα έλεγε «δεν υπάρχει»', () => {
    const d = demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-12-31' } });
    const result = answer(d, [listing(), listing({ id: 'prop_2' })]);

    expect(result.blockedBy.get('availability-unknown')).toBe(2);
    expect(demandAnswerShape(result)).toBe('blocked-by-unknowns');
  });

  it('η ΠΛΕΙΟΨΗΦΙΑ, όχι «έστω μία» — μία αγγελία χωρίς θέση δεν βάφει όλη την απάντηση', () => {
    const d = demand({
      seeks: ['sell'],
      place: { kind: 'near', center: { lat: 40.64, lng: 22.94 }, radiusKm: 1 },
    });
    const result = answer(d, [
      // Μία με άγνωστη θέση…
      listing({ id: 'prop_unknown', position: { kind: 'unknown', reason: 'never-asked' } }),
      // …και τρεις που κρίθηκαν κανονικά και είπαν όχι (άλλο είδος συναλλαγής).
      listing({ id: 'prop_a', offerKinds: ['leaseOut'] }),
      listing({ id: 'prop_b', offerKinds: ['leaseOut'] }),
      listing({ id: 'prop_c', offerKinds: ['leaseOut'] }),
    ]);

    expect(ignoranceShare(result)).toBeLessThan(0.5);
    expect(demandAnswerShape(result)).toBe('no-match');
  });

  it('🔑 κάθε εμπόδιο άγνοιας είναι ΚΑΤΗΓΟΡΙΚΟ — αλλιώς θα γινόταν «κοντινό»', () => {
    // Ένα εμπόδιο «δεν ξέρουμε» που λογιζόταν μετρήσιμο θα εμφάνιζε την αγγελία ως
    // κοντινή, δηλαδή θα υποσχόταν ότι μια υποχώρηση την ξεκλειδώνει.
    const d = demand({ place: { kind: 'place', landId: 'land_1', buildingId: null } });
    const result = answer(d, [listing()]);
    expect(result.results.nearMissed).toHaveLength(0);
    expect(IGNORANCE_BLOCKERS.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('🔴 Λ — δύο ανεξάρτητα αθροίσματα, και τα δύο κλείνουν', () => {
  it('κλείνει σε πλούσιο σενάριο', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } });
    const result = answer(d, [
      listing({ id: 'a', commercial: { askingPrice: 100_000, finalPrice: null, rentPrice: null, nightlyRate: null } }),
      overBy(5_000, 'b'),
      listing({ id: 'c', offerKinds: ['leaseOut'] }),
    ]);
    expect(demandAnswerBalances(result)).toBe(true);
    expect(result.results.considered).toBe(3);
  });

  it('κλείνει και στο ΜΗΔΕΝ', () => {
    expect(demandAnswerBalances(answer(demand(), []))).toBe(true);
  });

  it('⚠️ ο ανταγωνισμός ΔΕΝ μετράει τον εαυτό του', () => {
    const d = demand({ id: 'dmnd_me' });
    // Πέντε άλλοι + ο εαυτός του = 6 έγγραφα· η αποκάλυψη πρέπει να πει **5**.
    const others = [
      d,
      ...Array.from({ length: 5 }, (_, i) => demand({ id: `dmnd_${i}`, authorUserId: `usr_${i}` })),
    ];
    expect(answer(d, [], others).competition.count).toBe(5);
  });

  it('🔴 κάτω από το κατώφλι ⇒ `null`, ΠΟΤΕ 0 — «δεν το λέμε» ≠ «κανένας»', () => {
    const d = demand({ id: 'dmnd_me' });
    const others = [demand({ id: 'dmnd_1', authorUserId: 'usr_1' })];
    const disclosure = answer(d, [], others).competition;

    expect(disclosure.count).toBeNull();
    expect(disclosure.minCount).toBe(5);
  });
});

// =============================================================================
// ΤΑ ΤΡΙΑ ΔΗΛΩΜΕΝΑ ΚΕΝΑ
// =============================================================================

describe('🔶 τα τρία δηλωμένα κενά είναι ΟΡΑΤΑ, όχι υποτιθέμενα', () => {
  it('`NO_LISTING_KNOWLEDGE` δίνει `null` σε place/availability και κενό σε proximity', () => {
    const [built] = listingFactsFrom([listing()], NO_LISTING_KNOWLEDGE);
    expect(built.place).toBeNull();
    expect(built.availability).toBeNull();
    expect(built.proximityMetres).toEqual({});
  });

  it('🔑 η μηχανή ΔΕΝ μαντεύει «άγνωστη διαθεσιμότητα = διαθέσιμο»', () => {
    // Θα ήταν εύκολο, τα νούμερα θα φαίνονταν καλύτερα σήμερα, και θα κατέρρεε τη
    // μέρα που θα υπήρχαν αληθινές ημερομηνίες.
    const d = demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-12-31' } });
    expect(answer(d, [listing()]).matchedCount).toBe(0);
  });

  it('όταν η γνώση **υπάρχει**, το ίδιο κενό γίνεται ταίριασμα', () => {
    const d = demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-12-31' } });
    const result = answerDemand({
      demand: d,
      listings: [listing()],
      knowledge: {
        ...NO_LISTING_KNOWLEDGE,
        availability: new Map([['prop_1', { from: '2027-03-01', to: null }]]),
      },
      otherDemands: [],
      todayDate: TODAY,
      nowIso: NOW_ISO,
    });
    expect(result.matchedCount).toBe(1);
  });
});
