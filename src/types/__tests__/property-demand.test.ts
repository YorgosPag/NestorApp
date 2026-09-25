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
import { DEMAND_TITLE_MAX_LENGTH } from '@/lib/demand/demand-title';
import { MAX_DRAWN_SHAPES } from '@/lib/listings/listing-drawn-area';

/** Μικρό έγκυρο τετράγωνο στο γεωγραφικό πλάτος `lat`. */
function squareAt(lat: number) {
  return [
    { lat, lng: 22 },
    { lat, lng: 22.02 },
    { lat: lat + 0.02, lng: 22.02 },
    { lat: lat + 0.02, lng: 22 },
  ];
}

/** Δακτύλιος με τόσες κορυφές που δεν χωρά στο `MAX_DRAWN_URL_CHARS` του χάρτη. */
const JAGGED_RING = Array.from({ length: 600 }, (_, i) => ({
  lat: 40.6 + 0.05 * Math.sin((i / 600) * 2 * Math.PI) + (i % 7) * 1e-4,
  lng: 22.9 + 0.05 * Math.cos((i / 600) * 2 * Math.PI) + (i % 5) * 1e-4,
}));
import {
  DEMAND_INVARIANTS,
  DEMAND_LIFECYCLES,
  DEMAND_LIFE_CONTEXTS,
  DEMAND_PROXIMITY_KINDS,
  NO_AMOUNT_RANGE,
  NO_DEMAND_FEATURES,
  NO_NIGHTS_RANGE,
  PRICED_SEEK_KINDS,
  demandInvariantViolations,
  demandSeek,
  exchangeSeek,
  isAttributableDemand,
  isPricedSeekKind,
  seekKindsOf,
  shortStaySeek,
  isDemandLifeContext,
  isDemandLifecycle,
  isLiveDemand,
  type DemandInvariant,
  type PropertyDemand,
} from '../property-demand';
import { OFFER_KINDS } from '../property-offers';
import { seek } from '@/lib/demand/__tests__/demand-fixtures';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ
// =============================================================================

function demand(overrides: Partial<PropertyDemand> = {}): PropertyDemand {
  return {
    id: 'dmnd_test',
    authorUserId: 'usr_1',
    authorCompanyId: null,
    mandate: { kind: 'self' },
    seeks: [seek('sell')],
    place: { kind: 'anywhere' },
    timing: { kind: 'now' },
    features: NO_DEMAND_FEATURES,
    proximity: [],
    lifeContext: null,
    title: null,
    placeLabel: null,
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
      seeks: [seek('leaseOut')],
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
        shapes: [[
          { lat: 40.62, lng: 22.94 },
          { lat: 40.62, lng: 22.96 },
          { lat: 40.63, lng: 22.96 },
          { lat: 40.63, lng: 22.94 },
        ]],
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
      // ADR-777 §8.60.15 — το ποσό ζει στην εναλλακτική, στη μονάδα της.
      seeks: [seek('sell', { max: 250_000 })],
      features: {
        ...NO_DEMAND_FEATURES,
        types: ['apartment'],
        areaMin: 80,
        bedroomsMin: 3,
      },
    });
    expect(demandInvariantViolations(z8)).toEqual([]);
  });

  it('🔑 και ΟΛΕΣ μαζί σε ΕΝΑ έγγραφο — που είναι όλο το επιχείρημα', () => {
    const everything = demand({
      seeks: [seek('sell', { max: 300_000 }), seek('exchange')],
      place: { kind: 'place', landId: 'land_1', buildingId: 'pbld_1' },
      timing: { kind: 'window', fromDate: '2027-03-01', toDate: '2027-09-30' },
      features: { ...NO_DEMAND_FEATURES, floorMin: 3, floorMax: 5 },
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
    const all = demand({ seeks: OFFER_KINDS.map((kind) => seek(kind)) });
    expect(demandInvariantViolations(all)).toEqual([]);
    // ⚠️ **Χειρόγραφα, επίτηδες** — δεύτερη φωνή απέναντι στο `OFFER_KINDS`. Ένα
    // `toEqual([...OFFER_KINDS])` θα συνέκρινε τη σταθερά με τον εαυτό της και θα
    // έμενε πράσινο σε **οποιαδήποτε** αλλαγή του λεξιλογίου, ακόμη και σε διαγραφή.
    expect(seekKindsOf(all.seeks)).toEqual(['sell', 'leaseOut', 'exchange', 'leaseShort']);
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
    ['seeks-duplicated', { seeks: [seek('sell'), seek('sell')] }],
    [
      'window-inverted',
      { timing: { kind: 'window', fromDate: '2028-01-01', toDate: '2027-01-01' } },
    ],
    ['range-inverted', { features: { ...NO_DEMAND_FEATURES, areaMin: 200, areaMax: 50 } }],
    // ADR-777 §8.60.17 — «150% στον οικοπεδούχο» δεν είναι οροφή, είναι παρανόηση του πεδίου.
    ['exchange-share-out-of-range', { seeks: [exchangeSeek(150)] }],
    // ADR-777 §8.60.19 — οι όροι διαμονής: νύχτες που δεν είναι νύχτες · ελάχιστο που δεν χωρά · παρέα χωρίς ενήλικα.
    ['stay-nights-invalid', { seeks: [shortStaySeek(NO_AMOUNT_RANGE, { min: 0, max: null }, null)] }],
    [
      'stay-nights-exceed-window',
      {
        seeks: [shortStaySeek(NO_AMOUNT_RANGE, { min: 5, max: null }, null)],
        timing: { kind: 'window', fromDate: '2027-03-01', toDate: '2027-03-04' },
      },
    ],
    [
      'stay-party-invalid',
      { seeks: [shortStaySeek(NO_AMOUNT_RANGE, NO_NIGHTS_RANGE, { adults: 0, children: 1, infants: 0, pets: 0 })] },
    ],
    [
      'radius-not-positive',
      { place: { kind: 'near', center: { lat: 40, lng: 22 }, radiusKm: 0 } },
    ],
    [
      'outline-degenerate',
      {
        place: {
          kind: 'area',
          shapes: [[
            { lat: 40, lng: 22 },
            { lat: 41, lng: 23 },
          ]],
        },
      },
    ],
    // ADR-888 — η περιοχή με πολλά σχήματα: τα όρια του χάρτη (ADR-885).
    ['area-empty', { place: { kind: 'area', shapes: [] } }],
    [
      'area-too-many',
      { place: { kind: 'area', shapes: Array.from({ length: MAX_DRAWN_SHAPES + 1 }, (_, i) => squareAt(40 + i * 0.05)) } },
    ],
    ['area-too-large', { place: { kind: 'area', shapes: [JAGGED_RING] } }],
    [
      'axis-degenerate',
      {
        place: {
          kind: 'frontage',
          streetName: null,
          // 🔑 **Όλες οι κορυφές στο ίδιο σημείο** — άξονας χωρίς φορά, το ακριβές
          // γεγονός που ο κωδικός κρίνει (όχι «πολύ μικρός», αλλά «χωρίς διεύθυνση»).
          axis: [
            { lat: 40.6, lng: 22.9 },
            { lat: 40.6, lng: 22.9 },
          ],
          side: 'both',
          depthMetres: 20,
        },
      },
    ],
    [
      'depth-not-positive',
      {
        place: {
          kind: 'frontage',
          streetName: 'Μεγάλου Αλεξάνδρου',
          axis: [
            { lat: 40.6, lng: 22.9 },
            { lat: 40.6, lng: 23.0 },
          ],
          side: 'left',
          depthMetres: 0,
        },
      },
    ],
    ['proximity-not-positive', { proximity: [{ kind: 'school', maxMetres: 0 }] }],
    // ADR-886 — ένα όνομα πάνω από το όριο (ίδια σταθερά με φόρμα και κανόνες).
    ['title-too-long', { title: 'α'.repeat(DEMAND_TITLE_MAX_LENGTH + 1) }],
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
      // ADR-777 §8.60.15 — η τιμή ζει στην εναλλακτική, άρα με `seeks: []` το αντεστραμμένο εύρος
      // ασκείται στο **εμβαδόν**: ίδιος κωδικός, ίδιο «όλες μαζί».
      features: { ...NO_DEMAND_FEATURES, areaMin: 500, areaMax: 100 },
    });
    const found = demandInvariantViolations(broken);
    expect(found).toContain('seeks-empty');
    expect(found).toContain('proximity-not-positive');
    expect(found).toContain('range-inverted');
  });
});

// =============================================================================
// Σ — ΟΙ ΕΝΑΛΛΑΚΤΙΚΕΣ ΚΑΙ Η ΤΙΜΗ ΤΟΥΣ (ADR-777 §8.60.15)
// =============================================================================

describe('🔴 Σ — η τιμή ζει ΑΝΑ ΕΝΑΛΛΑΚΤΙΚΗ, και τα αναλλοίωτα τη βλέπουν εκεί', () => {
  it('🔴 ίδιο είδος δύο φορές με ΔΙΑΦΟΡΕΤΙΚΗ τιμή ⇒ `seeks-duplicated` (η παγίδα του `Set` πάνω σε αντικείμενα)', () => {
    // Με `new Set(seeks)` δύο αντικείμενα είναι **πάντα** διαφορετικά ⇒ ο κωδικός θα σώπαινε για πάντα.
    const twice = demand({ seeks: [seek('leaseOut', { max: 900 }), seek('leaseOut', { max: 1_200 })] });
    expect(demandInvariantViolations(twice)).toContain('seeks-duplicated');
  });

  it('αντεστραμμένο εύρος σε ΜΙΑ από δύο εναλλακτικές ⇒ `range-inverted`', () => {
    const inverted = demand({
      seeks: [seek('sell', { max: 250_000 }), seek('leaseOut', { min: 1_500, max: 900 })],
    });
    expect(demandInvariantViolations(inverted)).toEqual(['range-inverted']);
  });

  it('🔑 η αντιπαροχή ΔΕΝ κρατά ποσό — ο κατασκευαστής το πετά, δεν το κρύβει', () => {
    // ADR-777 §8.60.17 — το εύρος ποσού πετιέται· η αντιπαροχή έχει μόνο **οροφή ποσοστού** (εδώ καμία).
    expect(demandSeek('exchange', { min: 1, max: 2 })).toEqual({ kind: 'exchange', landownerShareMax: null });
    // ADR-777 §8.60.19 — η διαμονή ξεκινά **χωρίς** όρους: καμία νύχτα, καμία παρέα.
    expect(demandSeek('leaseShort', { min: null, max: 80 })).toEqual({
      kind: 'leaseShort',
      price: { min: null, max: 80 },
      nights: { min: null, max: null },
      party: null,
    });
  });

  it('🔒 κάθε διάθεση εκτός της αντιπαροχής φέρει ποσό — η λίστα παράγεται, δεν γράφεται', () => {
    expect(OFFER_KINDS.filter((kind) => !isPricedSeekKind(kind))).toEqual(['exchange']);
    expect(PRICED_SEEK_KINDS).toEqual(['sell', 'leaseOut', 'leaseShort']);
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
