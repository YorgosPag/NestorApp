/**
 * Άγκυρες — **Η ΖΗΤΗΣΗ ΩΣ ΟΝΤΟΤΗΤΑ** (ADR-777 Α9).
 *
 * 🔑 **ΔΕΥΤΕΡΗ ΦΩΝΗ, ΕΠΙΤΗΔΕΣ.** Οι προσδοκίες είναι **χειρόγραφες**. Ένα test που
 * έχτιζε την προσδοκία καλώντας τα ίδια κατηγορήματα θα ήταν ο κριτής που κρίνει τον
 * εαυτό του — το σχήμα που το ADR-777 §8.7 πλήρωσε ήδη και που στη Φ.1 του ADR-771
 * άφησε **170 tests πράσινα πάνω σε αλλαγμένη συμπεριφορά**.
 *
 * 🔴 **Η ΠΡΩΤΗ ΟΜΑΔΑ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΗ.** Ολόκληρη η Α9 στηρίζεται σε έναν
 * ισχυρισμό — *«οι οκτώ μορφές δεν είναι οκτώ οντότητες, είναι **άξονες πάνω σε
 * μία**»*. Αν έστω **μία** από τις Ζ1–Ζ8 δεν εκφράζεται, ο ισχυρισμός είναι λάθος και
 * το σχήμα πρέπει να αλλάξει **πριν** γραφτεί οτιδήποτε πάνω του. Οι δοκιμές το
 * ελέγχουν **ονομαστικά**, μία ανά μορφή, με τα **παραδείγματα του ίδιου του Giorgio**
 * από το SPEC-777B §12.1 — όχι με αφηρημένα σχήματα που θα περνούσαν πάντα.
 */

import { MANDATE_CONFIRMATIONS } from '@/types/mandate';
import {
  DEMAND_INVARIANTS,
  DEMAND_LIFECYCLES,
  DEMAND_LIFE_CONTEXTS,
  DEMAND_PROXIMITY_KINDS,
  NO_DEMAND_FEATURES,
  demandInvariantViolations,
  isAttributableDemand,
  isDemandLifeContext,
  isDemandLifecycle,
  isLiveDemand,
  type DemandInvariant,
  type PropertyDemand,
} from '../property-demand';
import { OFFER_KINDS } from '../property-offers';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ
// =============================================================================

function demand(overrides: Partial<PropertyDemand> = {}): PropertyDemand {
  return {
    id: 'dmnd_test',
    authorUserId: 'usr_1',
    authorCompanyId: null,
    mandate: { kind: 'self' },
    seeks: ['sell'],
    place: { kind: 'anywhere' },
    timing: { kind: 'now' },
    features: NO_DEMAND_FEATURES,
    proximity: [],
    lifeContext: null,
    lifecycle: 'active',
    affirmedAt: '2026-08-11T00:00:00.000Z',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

// =============================================================================
// Ζ — ΟΙ ΟΚΤΩ ΜΟΡΦΕΣ ΕΙΝΑΙ ΕΚΦΡΑΣΙΜΕΣ ΠΑΝΩ ΣΕ ΜΙΑ ΟΝΤΟΤΗΤΑ
// =============================================================================

describe('🔴 Ζ1–Ζ8 — οκτώ μορφές, ΜΙΑ οντότητα, τέσσερις άξονες', () => {
  it('Ζ1 — τωρινή: «τι υπάρχει σήμερα»', () => {
    const z1 = demand({
      place: { kind: 'near', center: { lat: 40.6, lng: 22.95 }, radiusKm: 5 },
      timing: { kind: 'now' },
    });
    expect(demandInvariantViolations(z1)).toEqual([]);
    expect(z1.timing.kind).toBe('now');
  });

  it('Ζ2 — μελλοντική με παράθυρο: «από Μάρτιο 2027 έως Ιούνιο 2028»', () => {
    const z2 = demand({
      seeks: ['leaseOut'],
      timing: { kind: 'window', fromDate: '2027-03-01', toDate: '2028-06-30' },
    });
    expect(demandInvariantViolations(z2)).toEqual([]);
  });

  it('Ζ3 — «το κατάστημα στη γωνία, ΟΠΟΤΕ κι αν βγει»', () => {
    const z3 = demand({
      place: { kind: 'place', landId: 'land_corner', buildingId: 'pbld_corner' },
      timing: { kind: 'whenever' },
    });
    expect(demandInvariantViolations(z3)).toEqual([]);
    // 🔑 Η Ζ3 είναι ΣΥΝΔΥΑΣΜΟΣ δύο αξόνων — αυτό ακριβώς λέει το §12.1.
    expect(z3.place.kind).toBe('place');
    expect(z3.timing.kind).toBe('whenever');
  });

  it('Ζ4 — γεωμετρική: «Μεγάλου Αλεξάνδρου, μόνο ΑΥΤΟ το κομμάτι»', () => {
    const z4 = demand({
      place: {
        kind: 'area',
        outline: [
          { lat: 40.62, lng: 22.94 },
          { lat: 40.62, lng: 22.96 },
          { lat: 40.63, lng: 22.96 },
          { lat: 40.63, lng: 22.94 },
        ],
      },
    });
    expect(demandInvariantViolations(z4)).toEqual([]);
  });

  it('Ζ5 — συγκεκριμένη οικοδομή ΚΑΙ όροφος', () => {
    const z5 = demand({
      place: { kind: 'place', landId: 'land_1', buildingId: 'pbld_1' },
      features: { ...NO_DEMAND_FEATURES, floorMin: 3, floorMax: 3 },
    });
    expect(demandInvariantViolations(z5)).toEqual([]);
  });

  it('Ζ6 — απαιτήσεις γειτονιάς σε απόσταση', () => {
    const z6 = demand({
      proximity: [
        { kind: 'school', maxMetres: 500 },
        { kind: 'trainStation', maxMetres: 1500 },
      ],
    });
    expect(demandInvariantViolations(z6)).toEqual([]);
  });

  it('Ζ7 — πλαίσιο ζωής: ΔΗΛΩΝΕΤΑΙ, και δεν είναι πέμπτος άξονας', () => {
    const z7 = demand({ lifeContext: 'student' });
    expect(demandInvariantViolations(z7)).toEqual([]);

    // 🔴 Η ΑΓΚΥΡΑ: το πλαίσιο ζωής ΔΕΝ εμφανίζεται στη λίστα απωλειών προβολής —
    // γιατί δεν ήταν ποτέ κριτήριο. Αν κάποτε μπει εκεί, αυτό το test πέφτει και
    // αναγκάζει την απόφαση να γραφτεί, αντί να συμβεί.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DEMAND_AXES_LOST_IN_FILTERS } = require('@/lib/demand/demand-listing-filters');
    expect(DEMAND_AXES_LOST_IN_FILTERS).not.toContain('lifeContext');
    expect(DEMAND_AXES_LOST_IN_FILTERS).not.toContain('life-context');
  });

  it('Ζ8 — χαρακτηριστικά ακινήτου', () => {
    const z8 = demand({
      features: {
        ...NO_DEMAND_FEATURES,
        types: ['apartment'],
        priceMax: 250_000,
        areaMin: 80,
        bedroomsMin: 3,
      },
    });
    expect(demandInvariantViolations(z8)).toEqual([]);
  });

  it('🔑 και ΟΛΕΣ μαζί σε ΕΝΑ έγγραφο — που είναι όλο το επιχείρημα', () => {
    const everything = demand({
      seeks: ['sell', 'exchange'],
      place: { kind: 'place', landId: 'land_1', buildingId: 'pbld_1' },
      timing: { kind: 'window', fromDate: '2027-03-01', toDate: '2027-09-30' },
      features: { ...NO_DEMAND_FEATURES, floorMin: 3, floorMax: 5, priceMax: 300_000 },
      proximity: [{ kind: 'busStop', maxMetres: 300 }],
      lifeContext: 'family',
    });
    expect(demandInvariantViolations(everything)).toEqual([]);
  });
});

// =============================================================================
// Λ — ΤΟ ΛΕΞΙΛΟΓΙΟ ΣΥΝΑΛΛΑΓΗΣ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΜΕ ΤΗΣ ΠΡΟΣΦΟΡΑΣ
// =============================================================================

describe('🔴 Λ — καμία δεύτερη αλήθεια στον άξονα συναλλαγής', () => {
  it('το `seeks` δέχεται ΑΚΡΙΒΩΣ τα `OFFER_KINDS` — schema.org/Demand', () => {
    // Αν κάποτε γεννηθεί καθρεφτισμένο λεξιλόγιο (`buy`/`leaseIn`), αυτό το test
    // δεν θα μεταγλωττίζεται καν — και αυτό είναι το ζητούμενο.
    const all = demand({ seeks: [...OFFER_KINDS] });
    expect(demandInvariantViolations(all)).toEqual([]);
    // ⚠️ **Χειρόγραφα, επίτηδες** — δεύτερη φωνή απέναντι στο `OFFER_KINDS`. Ένα
    // `toEqual([...OFFER_KINDS])` θα συνέκρινε τη σταθερά με τον εαυτό της και θα
    // έμενε πράσινο σε **οποιαδήποτε** αλλαγή του λεξιλογίου, ακόμη και σε διαγραφή.
    expect(all.seeks).toEqual(['sell', 'leaseOut', 'exchange', 'leaseShort']);
  });
});

// =============================================================================
// Ε — ΕΓΚΥΡΟΤΗΤΑ: κάθε invariant ΜΠΟΡΕΙ να πυροδοτήσει
// =============================================================================

describe('🔴 Ε — κλειστό σύνολο invariants, και κανένα αδρανές', () => {
  /**
   * Ένα προς ένα, με **χειρόγραφη** είσοδο ανά κωδικό.
   *
   * 🔑 Ο πίνακας είναι η **απόδειξη ζωής** που το ADR-749 §5 απαιτεί: **606 αδρανείς
   * φρουροί** μετρήθηκαν σε αυτό το repo — patterns που ούτε πιάνουν κάτι ούτε έχουν
   * παράδειγμα. Ένας κωδικός invariant που καμία είσοδος δεν παράγει είναι ακριβώς
   * αυτό, και εδώ **δεν μπορεί να προσγειωθεί**.
   */
  const CASES: ReadonlyArray<readonly [DemandInvariant, Partial<PropertyDemand>]> = [
    ['seeks-empty', { seeks: [] }],
    ['seeks-duplicated', { seeks: ['sell', 'sell'] }],
    [
      'window-inverted',
      { timing: { kind: 'window', fromDate: '2028-01-01', toDate: '2027-01-01' } },
    ],
    ['range-inverted', { features: { ...NO_DEMAND_FEATURES, areaMin: 200, areaMax: 50 } }],
    [
      'radius-not-positive',
      { place: { kind: 'near', center: { lat: 40, lng: 22 }, radiusKm: 0 } },
    ],
    [
      'outline-degenerate',
      {
        place: {
          kind: 'area',
          outline: [
            { lat: 40, lng: 22 },
            { lat: 41, lng: 23 },
          ],
        },
      },
    ],
    ['proximity-not-positive', { proximity: [{ kind: 'school', maxMetres: 0 }] }],
    [
      'proximity-duplicated',
      {
        proximity: [
          { kind: 'school', maxMetres: 300 },
          { kind: 'school', maxMetres: 900 },
        ],
      },
    ],
  ];

  for (const [invariant, overrides] of CASES) {
    it(`«${invariant}» πυροδοτεί σε πραγματική είσοδο`, () => {
      expect(demandInvariantViolations(demand(overrides))).toContain(invariant);
    });
  }

  it('🔑 ΚΑΘΕ κωδικός του κλειστού συνόλου καλύπτεται — καμία αδρανής τιμή', () => {
    const covered = new Set(CASES.map(([code]) => code));
    expect([...DEMAND_INVARIANTS].sort()).toEqual([...covered].sort());
  });

  it('έγκυρη ζήτηση δεν παράγει καμία παραβίαση', () => {
    expect(demandInvariantViolations(demand())).toEqual([]);
  });

  it('🔑 επιστρέφει ΟΛΕΣ τις παραβιάσεις, όχι την πρώτη', () => {
    const broken = demand({
      seeks: [],
      proximity: [{ kind: 'school', maxMetres: -1 }],
      features: { ...NO_DEMAND_FEATURES, priceMin: 500_000, priceMax: 100_000 },
    });
    const found = demandInvariantViolations(broken);
    expect(found).toContain('seeks-empty');
    expect(found).toContain('proximity-not-positive');
    expect(found).toContain('range-inverted');
  });
});

// =============================================================================
// Μ — Η ΕΝΤΟΛΗ ΤΟΥ ΜΕΣΙΤΗ (απόφαση Giorgio 2026-08-11)
// =============================================================================

describe('🔴 Μ — ο φρουρός του Ε2: μόνο επιβεβαιωμένες ζητήσεις μετράνε', () => {
  it('ζήτηση που έγραψε ο ίδιος ο άνθρωπος → αποδίδεται', () => {
    expect(isAttributableDemand(demand({ mandate: { kind: 'self' } }))).toBe(true);
  });

  it('🔴 ζήτηση μεσίτη ΕΚΚΡΕΜΗΣ → ΔΕΝ αποδίδεται (αλλιώς φουσκώνει ο θερμοχάρτης)', () => {
    const brokered = demand({
      mandate: {
        kind: 'brokered',
        clientContactId: 'cont_1',
        confirmation: 'pending',
        confirmedByUserId: null,
      },
    });
    expect(isAttributableDemand(brokered)).toBe(false);
  });

  it('ζήτηση μεσίτη ΕΠΙΒΕΒΑΙΩΜΕΝΗ → αποδίδεται', () => {
    const brokered = demand({
      mandate: {
        kind: 'brokered',
        clientContactId: 'cont_1',
        confirmation: 'confirmed',
        confirmedByUserId: 'usr_client',
      },
    });
    expect(isAttributableDemand(brokered)).toBe(true);
  });

  it('ζήτηση μεσίτη ΑΠΟΡΡΙΦΘΕΙΣΑ → δεν αποδίδεται, αλλά ΥΠΑΡΧΕΙ ακόμη', () => {
    const brokered = demand({
      mandate: {
        kind: 'brokered',
        clientContactId: 'cont_1',
        confirmation: 'declined',
        confirmedByUserId: null,
      },
    });
    expect(isAttributableDemand(brokered)).toBe(false);
    expect(brokered.lifecycle).toBe('active');
  });

  it('🔑 και οι τρεις καταστάσεις έγκρισης καλύπτονται', () => {
    expect([...MANDATE_CONFIRMATIONS].sort()).toEqual(
      ['confirmed', 'declined', 'pending'].sort(),
    );
  });
});

// =============================================================================
// Κ — ΚΥΚΛΟΣ ΖΩΗΣ ΚΑΙ ΦΡΟΥΡΟΙ ΤΥΠΟΥ
// =============================================================================

describe('Κ — κύκλος ζωής', () => {
  it('μόνο η `active` είναι ζωντανή· η `paused` ΔΕΝ είναι', () => {
    expect(isLiveDemand(demand({ lifecycle: 'active' }))).toBe(true);
    for (const lifecycle of ['paused', 'fulfilled', 'withdrawn'] as const) {
      expect(isLiveDemand(demand({ lifecycle }))).toBe(false);
    }
  });

  it('🔑 δεν υπάρχει `expired` — η Ζ3 («όποτε κι αν βγει») το απαγορεύει', () => {
    expect(DEMAND_LIFECYCLES).not.toContain('expired');
  });

  it('φρουροί τύπου δέχονται μόνο γνωστές τιμές', () => {
    expect(isDemandLifecycle('active')).toBe(true);
    expect(isDemandLifecycle('expired')).toBe(false);
    expect(isDemandLifecycle(42)).toBe(false);

    for (const context of DEMAND_LIFE_CONTEXTS) {
      expect(isDemandLifeContext(context)).toBe(true);
    }
    expect(isDemandLifeContext('other')).toBe(false);
  });

  it('🔑 τα είδη γειτονιάς είναι ΑΚΡΙΒΩΣ τα τέσσερα του §12.1 — κανένα «για πληρότητα»', () => {
    expect([...DEMAND_PROXIMITY_KINDS].sort()).toEqual(
      ['busStop', 'school', 'supermarket', 'trainStation'].sort(),
    );
  });
});
