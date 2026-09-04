/**
 * Άγκυρες — **ΖΗΤΗΣΗ → ΦΙΛΤΡΑ ΟΘΟΝΗΣ** (ADR-777 Α9 · Α3).
 *
 * Η προβολή έχει **ένα** συμβόλαιο: *χαλαρώνει, ποτέ δεν σφίγγει*. Το ίδιο το
 * θεώρημα ζει στο `demand-matching.test.ts` (χρειάζεται τη μηχανή)· εδώ ελέγχονται
 * τα **μέρη** του — και κυρίως ότι η **λίστα των απωλειών λέει την αλήθεια**, γιατί
 * είναι το συμβόλαιο ανάμεσα σε δύο αρχεία και το repo έχει πληρώσει **κατά 63** την
 * απόκλιση δύο χειρόγραφων λιστών (CHECK 3.34).
 */

import {
  DEMAND_AXES_LOST_IN_FILTERS,
  axesLostProjectingDemand,
  demandResultsHref,
  listingFiltersFromDemand,
} from '../demand-listing-filters';
import {
  parseListingFilters,
  serializeListingFilters,
  withinRange,
} from '@/lib/listings/listing-filters';
import { rangeOf, valuesOf } from '@/lib/criteria/listing-criteria';
import { NO_DEMAND_FEATURES, type PropertyDemand } from '@/types/property-demand';

function demand(overrides: Partial<PropertyDemand> = {}): PropertyDemand {
  return {
    id: 'dmnd_1',
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

/**
 * Απόσταση μεγίστου κύκλου με **σφαιρικό νόμο συνημιτόνων** — ανεξάρτητη υλοποίηση
 * από τη `distanceMeters` που χρησιμοποιεί ο κώδικας. Ίδια ακτίνα Γης, ώστε η
 * σύγκριση να μετρά τον **αλγόριθμο** και όχι τη σταθερά.
 */
function greatCircleKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const cosine =
    Math.sin(rad(a.lat)) * Math.sin(rad(b.lat)) +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng) - rad(a.lng));
  return (6_371_008.8 * Math.acos(Math.min(1, Math.max(-1, cosine)))) / 1000;
}

const SQUARE = [
  { lat: 40.63, lng: 22.93 },
  { lat: 40.63, lng: 22.95 },
  { lat: 40.65, lng: 22.95 },
  { lat: 40.65, lng: 22.93 },
];

// =============================================================================
// Τ — Ο ΑΞΟΝΑΣ ΣΥΝΑΛΛΑΓΗΣ ΕΙΝΑΙ ΤΑΥΤΟΤΗΤΑ
// =============================================================================

describe('🔴 Τ — καμία μετάφραση στον άξονα συναλλαγής', () => {
  it('το `seeks` περνά ΑΥΤΟΥΣΙΟ στα `offerKinds` — schema.org/Demand', () => {
    const filters = listingFiltersFromDemand(demand({ seeks: ['leaseOut', 'exchange'] }));
    expect(valuesOf(filters.criteria, 'offerKind')).toEqual(['leaseOut', 'exchange']);
  });
});

// =============================================================================
// Χ — Ο ΧΩΡΙΚΟΣ ΑΞΟΝΑΣ: ΤΟ ΠΟΛΥΓΩΝΟ ΓΙΝΕΤΑΙ ΚΥΚΛΟΣ ΠΟΥ ΤΟ ΠΕΡΙΚΛΕΙΕΙ
// =============================================================================

describe('🔴 Χ — ο κύκλος ΠΕΡΙΚΛΕΙΕΙ το πολύγωνο, ποτέ το αντίστροφο', () => {
  it('`anywhere` → κανένα γεωγραφικό φίλτρο', () => {
    expect(listingFiltersFromDemand(demand()).near).toBeNull();
  });

  it('`near` → ταυτότητα', () => {
    const filters = listingFiltersFromDemand(
      demand({ place: { kind: 'near', center: { lat: 40.6, lng: 22.9 }, radiusKm: 3 } }),
    );
    expect(filters.near).toEqual({ center: { lat: 40.6, lng: 22.9 }, radiusKm: 3 });
  });

  it('🔑 `area` → κύκλος που περιέχει ΚΑΘΕ κορυφή του πολυγώνου', () => {
    const filters = listingFiltersFromDemand(demand({ place: { kind: 'area', outline: SQUARE } }));
    expect(filters.near).not.toBeNull();

    const { center, radiusKm } = filters.near!;
    // Δεύτερη φωνή: **σφαιρικός νόμος συνημιτόνων**, όχι haversine — άλλος τύπος,
    // ίδια τάξη ακρίβειας. Δεν καλείται ξανά η `geoOutlineBoundingCircle` για να
    // «επιβεβαιώσει τον εαυτό της».
    //
    // ⚠️ Η πρώτη γραφή αυτού του ελέγχου χρησιμοποιούσε **ισοαπέχουσα προσέγγιση**
    // (111,32 km/μοίρα) και **απέτυχε κατά 0,5 μέτρα** στα 1,4 χλμ. Ο κώδικας ήταν
    // σωστός· το **test** ήταν χονδρικότερο από αυτό που έκρινε. Μια δεύτερη φωνή
    // που είναι λιγότερο ακριβής από την πρώτη δεν ελέγχει — **θορυβεί**, και ο
    // πειρασμός τότε είναι να χαλαρώσει το κατώφλι, δηλαδή να σβήσει ο φρουρός.
    // ⚠️ Ανοχή **1 χιλιοστό**, και είναι το όριο της ΔΕΥΤΕΡΗΣ φωνής, όχι χαλάρωση
    // του κριτηρίου: ο νόμος συνημιτόνων χάνει ακρίβεια σε μικρές αποστάσεις επειδή
    // το `acos` είναι κακώς εξαρτημένο κοντά στο 1 — μετρημένη απόκλιση εδώ **1,6
    // μικρόμετρα**. Ο κώδικας είναι εξ ορισμού σωστός (παίρνει το `max` των ίδιων
    // αποστάσεων που ξαναμετρώνται)· αυτό που δοκιμάζεται είναι ότι **δεν διάλεξε
    // λάθος κέντρο ή λάθος κορυφή**, και για αυτό το χιλιοστό είναι έξι τάξεις
    // μεγέθους αυστηρότερο απ' όσο χρειάζεται.
    for (const vertex of SQUARE) {
      expect(greatCircleKm(center, vertex)).toBeLessThanOrEqual(radiusKm + 1e-6);
    }
  });

  it('🔴 `place` → ΚΑΝΕΝΑ γεωγραφικό φίλτρο, όχι μαντεψιά από συντεταγμένες', () => {
    // Η θέση της γης ζει στο επίπεδο Α· μια καθαρή συνάρτηση δεν την ξέρει, και μια
    // στένωση βασισμένη σε άγνοια είναι ακριβώς αυτό που το συμβόλαιο απαγορεύει.
    const filters = listingFiltersFromDemand(
      demand({ place: { kind: 'place', landId: 'land_1', buildingId: 'pbld_1' } }),
    );
    expect(filters.near).toBeNull();
  });

  it('🔑 `frontage` → κύκλος που περιέχει ΚΑΘΕ κορυφή του άξονα ΚΑΙ το βάθος', () => {
    const axis = [
      { lat: 40.6, lng: 22.9 },
      { lat: 40.6, lng: 23.0 },
    ] as const;
    const filters = listingFiltersFromDemand(
      demand({
        place: { kind: 'frontage', streetName: 'Εγνατίας', axis, side: 'both', depthMetres: 20 },
      }),
    );
    expect(filters.near).not.toBeNull();

    const { center, radiusKm } = filters.near!;
    // 🔴 Δεν αρκεί να περιέχει τις κορυφές του άξονα — πρέπει να περιέχει και τη ζώνη
    // βάθους γύρω τους. Χωρίς το `+ depth`, ένα σημείο ακριβώς στο όριο του μετώπου,
    // δίπλα σε άκρη του τμήματος, θα έμενε ΕΞΩ από τον κύκλο — δηλαδή η προβολή θα
    // ΣΤΕΝΕΥΕ, ακριβώς αυτό που το συμβόλαιο απαγορεύει.
    for (const vertex of axis) {
      // Ίδια ανοχή δεύτερης φωνής με το `area` παραπάνω (1 χιλιοστό) — εδώ προστίθεται
      // στο μετρημένο άθροισμα, όχι στο κατώφλι, γιατί το βάθος (20 μ.) προστίθεται
      // ήδη ΜΕΣΑ στο `radiusKm` που παράγει ο κώδικας.
      expect(greatCircleKm(center, vertex) + 0.02).toBeLessThanOrEqual(radiusKm + 1e-6);
    }
  });
});

// =============================================================================
// Α — ΟΙ ΑΠΩΛΕΙΕΣ ΛΕΝΕ ΤΗΝ ΑΛΗΘΕΙΑ
// =============================================================================

describe('🔴 Α — η λίστα απωλειών: ούτε ψεύτικη προειδοποίηση, ούτε σιωπηλή απώλεια', () => {
  it('ζήτηση χωρίς ιδιαιτερότητες δεν χάνει ΤΙΠΟΤΑ', () => {
    const plain = demand({
      timing: { kind: 'now' },
      features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 },
    });
    // ⚠️ Ψεύτικη προειδοποίηση είναι θόρυβος που εκπαιδεύει τον χρήστη να αγνοεί
    // τις αληθινές — άρα το κενό αποτέλεσμα είναι εξίσου σημαντικό με τα υπόλοιπα.
    expect(axesLostProjectingDemand(plain)).toEqual([]);
  });

  const CASES: ReadonlyArray<readonly [string, Partial<PropertyDemand>]> = [
    ['timing', { timing: { kind: 'whenever' } }],
    ['area-outline', { place: { kind: 'area', outline: SQUARE } }],
    [
      'frontage-axis',
      {
        place: {
          kind: 'frontage',
          streetName: null,
          axis: [
            { lat: 40.6, lng: 22.9 },
            { lat: 40.6, lng: 23.0 },
          ],
          side: 'both',
          depthMetres: 20,
        },
      },
    ],
    ['place-identity', { place: { kind: 'place', landId: 'land_1', buildingId: null } }],
    ['proximity', { proximity: [{ kind: 'school', maxMetres: 400 }] }],
  ];

  for (const [axis, overrides] of CASES) {
    it(`«${axis}» αναφέρεται όταν είναι όντως δηλωμένος`, () => {
      expect(axesLostProjectingDemand(demand(overrides))).toContain(axis);
    });
  }

  it('🔑 ΚΑΘΕ άξονας του κλειστού συνόλου καλύπτεται — κανένας αδρανής', () => {
    const covered = new Set(CASES.map(([axis]) => axis));
    expect([...DEMAND_AXES_LOST_IN_FILTERS].sort()).toEqual([...covered].sort());
  });

  it('✅ ο ΟΡΟΦΟΣ ΔΕΝ είναι πια απώλεια — ταξιδεύει ως κριτήριο (2026-09-04)', () => {
    // 🏆 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΧΤΥΠΗΣΕ ΑΚΡΙΒΩΣ ΟΠΩΣ ΣΧΕΔΙΑΣΤΗΚΕ.** Η προηγούμενη μορφή
    // της έγραφε: *«Αν κάποτε προστεθεί όροφος στα φίλτρα, αυτό το test πέφτει και
    // αναγκάζει να αφαιρεθεί το `floor-range` από τις απώλειες — αντί να μείνει
    // ψεύτικο.»* Προστέθηκε· έπεσε· η γραμμή αφαιρέθηκε.
    const filters = listingFiltersFromDemand(
      demand({ features: { ...NO_DEMAND_FEATURES, floorMin: 3, floorMax: 5 } }),
    );
    expect(rangeOf(filters.criteria, 'floor')).toEqual({ min: 3, max: 5 });

    // ⚠️ Και η **αντίστροφη** φορά: η λίστα απωλειών δεν επιτρέπεται να το λέει πια.
    expect([...DEMAND_AXES_LOST_IN_FILTERS]).not.toContain('floor-range');
    expect(axesLostProjectingDemand(demand({ features: { ...NO_DEMAND_FEATURES, floorMax: 5 } })))
      .toEqual([]);
  });

  it('🔴 ΤΟ ΣΥΜΒΟΛΑΙΟ «ΥΠΕΡΣΥΝΟΛΟ» ΕΠΙΒΙΩΝΕΙ ΤΗΣ ΣΤΕΝΩΣΗΣ', () => {
    // Η προσθήκη του ορόφου **στενεύει** την προβολή, άρα μοιάζει να σπάει το
    // συμβόλαιο. Δεν το σπάει: η μηχανή αποκλείει αγγελία **χωρίς** δηλωμένο όροφο
    // (`withinRange(null, …) === false`), ενώ τα φίλτρα την **κρατούν** ως «δεν το
    // δήλωσε». Τα φίλτρα παραμένουν χαλαρότερα — που είναι ό,τι απαιτεί το συμβόλαιο.
    expect(withinRange(null, 3, null)).toBe(false);
  });
});

// =============================================================================
// Δ — Η ΔΙΕΥΘΥΝΣΗ ΤΑΞΙΔΕΥΕΙ ΚΑΙ ΓΥΡΙΖΕΙ
// =============================================================================

describe('Δ — ο σύνδεσμος «δες τι υπάρχει σήμερα»', () => {
  it('δείχνει στην οθόνη 2 με τα φίλτρα της ζήτησης', () => {
    const d = demand({
      seeks: ['sell'],
      features: { ...NO_DEMAND_FEATURES, priceMax: 250_000, bedroomsMin: 3 },
      place: { kind: 'near', center: { lat: 40.6, lng: 22.9 }, radiusKm: 4 },
    });
    const href = demandResultsHref(d);

    expect(href.startsWith('/search/results?')).toBe(true);
    expect(href).toContain('offer=sell');
    expect(href).toContain('pmax=250000');
    expect(href).toContain('bedsmin=3');
    expect(href).toContain('r=4');
  });

  it('🔑 ο κύκλος επιβιώνει της σειριοποίησης — round-trip', () => {
    const d = demand({
      features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 },
      place: { kind: 'near', center: { lat: 40.6, lng: 22.9 }, radiusKm: 4 },
    });
    const projected = listingFiltersFromDemand(d);
    const roundTripped = parseListingFilters(serializeListingFilters(projected));

    expect(roundTripped).toEqual(projected);
  });

  it('ζήτηση χωρίς κανένα φίλτρο δεν γράφει κενό «?»', () => {
    const bare = demand({ seeks: [] });
    expect(demandResultsHref(bare)).toBe('/search/results');
  });
});
