/**
 * Άγκυρες — **Η ΜΗΧΑΝΗ ΤΑΙΡΙΑΣΜΑΤΟΣ** (ADR-777 Α9 · SPEC-777B §12.2 · §12.6).
 *
 * Τρεις ομάδες, και η καθεμία υπάρχει για διαφορετικό λόγο:
 *
 * **Θ — ΤΟ ΘΕΩΡΗΜΑ.** Ό,τι η μηχανή λέει `match`, τα **προβεβλημένα φίλτρα οφείλουν
 * να το δείχνουν**. Δεν είναι δείγμα: ελέγχεται **εξαντλητικά** πάνω σε πλέγμα
 * ζητήσεων × αγγελιών. Είναι το ίδιο ιδίωμα με το θεώρημα υποσυνόλου των **125**
 * σχημάτων της Α20 — και υπάρχει επειδή η εναλλακτική («*τα φίλτρα και η μηχανή
 * μάλλον συμφωνούν*») είναι ακριβώς το σχήμα που το `listingMapShape` απαγόρευσε:
 * *«δύο κριτήρια για την ίδια ερώτηση … μια μέρα θα διαφωνήσουν»*.
 *
 * **Ζ — ΑΠΟΔΕΙΞΗ ΖΩΗΣ.** Κάθε κωδικός του `DEMAND_BLOCKERS` παράγεται από **πραγματικό
 * σενάριο**. Ένα εμπόδιο που καμία είσοδος δεν πυροδοτεί είναι ένας από τους **606
 * αδρανείς φρουρούς** του ADR-749 §5, με άλλο όνομα.
 *
 * **Π — ΠΟΛΙΤΙΚΗ.** Η ετυμηγορία, με **χειρόγραφες** προσδοκίες — δεύτερη φωνή.
 */

import {
  DEMAND_BLOCKERS,
  NEAR_MISS_MAX_AXES,
  decideVerdict,
  isMeasurableBlocker,
  matchDemand,
  matchDemandAgainstListing,
  demandResultsBalance,
  type DemandBlocker,
  type ListingMatchFacts,
} from '../demand-matching';
import {
  axesLostProjectingDemand,
  listingFiltersFromDemand,
} from '../demand-listing-filters';
import { matchesListingFilters } from '@/lib/listings/listing-filters';
import { NO_DEMAND_FEATURES, type PropertyDemand } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ
// =============================================================================

/**
 * 🔴 **Τα fixtures ΕΞΗΧΘΗΣΑΝ** (`demand-fixtures.ts`) όταν τα χρειάστηκε η δεύτερη
 * σουίτα. Γραμμένα δύο φορές θα απέκλιναν — και μια δοκιμή που περνά επειδή το
 * **fixture** της είναι διαφορετικό δηλώνει κάλυψη που δεν υπάρχει.
 */
import { TODAY, demand, facts, listing } from './demand-fixtures';

// =============================================================================
// Θ — ΤΟ ΘΕΩΡΗΜΑ ΥΠΕΡΣΥΝΟΛΟΥ
// =============================================================================

describe('🔴 Θ — `match` ⇒ τα προβεβλημένα φίλτρα ΤΟ ΔΕΙΧΝΟΥΝ (εξαντλητικά)', () => {
  /** Ζητήσεις που καλύπτουν **και τους πέντε** άξονες, με και χωρίς όρο. */
  const DEMANDS: readonly PropertyDemand[] = [
    demand(),
    demand({ seeks: ['leaseOut'] }),
    demand({ seeks: ['sell', 'exchange'] }),
    demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 150_000 } }),
    demand({ features: { ...NO_DEMAND_FEATURES, priceMin: 250_000 } }),
    demand({ features: { ...NO_DEMAND_FEATURES, areaMin: 120 } }),
    demand({ features: { ...NO_DEMAND_FEATURES, areaMax: 80 } }),
    demand({ features: { ...NO_DEMAND_FEATURES, bedroomsMin: 4 } }),
    demand({ features: { ...NO_DEMAND_FEATURES, floorMin: 3, floorMax: 5 } }),
    demand({ features: { ...NO_DEMAND_FEATURES, types: ['maisonette'] } }),
    demand({ place: { kind: 'near', center: { lat: 40.64, lng: 22.94 }, radiusKm: 1 } }),
    demand({ place: { kind: 'near', center: { lat: 37.98, lng: 23.73 }, radiusKm: 1 } }),
    demand({
      place: {
        kind: 'area',
        outline: [
          { lat: 40.63, lng: 22.93 },
          { lat: 40.63, lng: 22.95 },
          { lat: 40.65, lng: 22.95 },
          { lat: 40.65, lng: 22.93 },
        ],
      },
    }),
    demand({ place: { kind: 'place', landId: 'land_1', buildingId: null } }),
    demand({ timing: { kind: 'now' } }),
    demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-12-31' } }),
    demand({ proximity: [{ kind: 'school', maxMetres: 400 }] }),
  ];

  /** Αγγελίες που χτυπούν κάθε συνοριακή περίπτωση, μαζί με τα κενά δεδομένα. */
  const CANDIDATES: readonly ListingMatchFacts[] = [
    facts(),
    facts({ listing: listing({ offerKinds: ['leaseOut'], commercialStatus: 'for-rent' }) }),
    facts({ listing: listing({ offerKinds: ['exchange'], commercialStatus: 'unavailable' }) }),
    facts({ listing: listing({ type: 'maisonette' }) }),
    facts({ listing: listing({ areaSqm: null }) }),
    facts({ listing: listing({ bedrooms: null }) }),
    facts({ listing: listing({ floor: null }) }),
    facts({ listing: listing({ floor: 4 }) }),
    facts({
      listing: listing({ commercial: { askingPrice: null, finalPrice: null, rentPrice: null } }),
    }),
    facts({ listing: listing({ commercial: { askingPrice: 300_000, finalPrice: null, rentPrice: null } }) }),
    facts({ listing: listing({ position: { kind: 'unknown', reason: 'never-asked' } }) }),
    facts({
      listing: listing({
        position: {
          kind: 'known',
          provenance: 'manual',
          point: { lat: 37.98, lng: 23.73 },
          locatedAt: '2026-08-11T00:00:00.000Z',
        },
      }),
    }),
    facts({ place: { landId: 'land_1', buildingId: 'pbld_1' } }),
    facts({ place: { landId: 'land_other', buildingId: null } }),
    facts({ availability: { from: '2027-06-01', to: null } }),
    facts({ availability: { from: null, to: '2026-12-31' } }),
    facts({ proximityMetres: { school: 200 } }),
    facts({ proximityMetres: { school: 900 } }),
  ];

  it(`κανένα «match» δεν χάνεται από τα φίλτρα (${DEMANDS.length}×${CANDIDATES.length} συνδυασμοί)`, () => {
    let matches = 0;

    for (const d of DEMANDS) {
      const filters = listingFiltersFromDemand(d);
      for (const f of CANDIDATES) {
        const result = matchDemandAgainstListing(d, f, TODAY);
        if (result.verdict !== 'match') continue;
        matches += 1;

        // 🔴 ΤΟ ΘΕΩΡΗΜΑ: η προβολή είναι ΥΠΕΡΣΥΝΟΛΟ, ποτέ στένωση.
        expect(matchesListingFilters(f.listing, filters)).toBe(true);
      }
    }

    // ⚠️ **Χωρίς παρονομαστή το θεώρημα είναι κενό.** Ένα πλέγμα που δεν παράγει
    // κανένα `match` θα περνούσε τον βρόχο **μηδέν φορές** και θα έβαφε πράσινο ένα
    // test που δεν κοίταξε τίποτα — το σχήμα «0 = κανείς δεν κοίταξε», μέσα στην
    // ίδια την άγκυρα (μάθημα CHECK 3.40, `ast-runtime-divergence`).
    expect(matches).toBeGreaterThan(10);
  });

  it('🔑 και η ΑΝΤΙΣΤΡΟΦΗ ΔΕΝ ισχύει — τα φίλτρα είναι όντως ΠΛΑΤΥΤΕΡΑ', () => {
    // Αν ίσχυε και η αντίστροφη, η προβολή δεν θα έχανε τίποτα — και τότε ολόκληρη
    // η λίστα `DEMAND_AXES_LOST_IN_FILTERS` θα ήταν ψεύτικη.
    const d = demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-03-31' } });
    const f = facts({ availability: { from: '2028-01-01', to: null } });

    expect(matchesListingFilters(f.listing, listingFiltersFromDemand(d))).toBe(true);
    expect(matchDemandAgainstListing(d, f, TODAY).verdict).not.toBe('match');
    expect(axesLostProjectingDemand(d)).toContain('timing');
  });
});

// =============================================================================
// Ζ — ΑΠΟΔΕΙΞΗ ΖΩΗΣ ΓΙΑ ΚΑΘΕ ΕΜΠΟΔΙΟ
// =============================================================================

describe('🔴 Ζ — κάθε εμπόδιο πυροδοτεί σε πραγματικό σενάριο', () => {
  const SCENARIOS: ReadonlyArray<
    readonly [DemandBlocker, PropertyDemand, ListingMatchFacts]
  > = [
    ['offer-kind', demand({ seeks: ['leaseOut'] }), facts()],
    ['property-type', demand({ features: { ...NO_DEMAND_FEATURES, types: ['land'] } }), facts()],
    [
      'other-place',
      demand({ place: { kind: 'place', landId: 'land_1', buildingId: null } }),
      facts({ place: { landId: 'land_2', buildingId: null } }),
    ],
    [
      'place-unresolved',
      demand({ place: { kind: 'place', landId: 'land_1', buildingId: null } }),
      facts({ place: null }),
    ],
    [
      'position-unknown',
      demand({ place: { kind: 'near', center: { lat: 40.64, lng: 22.94 }, radiusKm: 5 } }),
      facts({ listing: listing({ position: { kind: 'unknown', reason: 'owner-declined' } }) }),
    ],
    [
      'availability-unknown',
      demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-12-31' } }),
      facts({ availability: null }),
    ],
    [
      'proximity-unknown',
      demand({ proximity: [{ kind: 'supermarket', maxMetres: 300 }] }),
      facts({ proximityMetres: {} }),
    ],
    ['price-above', demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 100_000 } }), facts()],
    ['price-below', demand({ features: { ...NO_DEMAND_FEATURES, priceMin: 400_000 } }), facts()],
    ['area-below', demand({ features: { ...NO_DEMAND_FEATURES, areaMin: 200 } }), facts()],
    ['area-above', demand({ features: { ...NO_DEMAND_FEATURES, areaMax: 50 } }), facts()],
    ['bedrooms-below', demand({ features: { ...NO_DEMAND_FEATURES, bedroomsMin: 5 } }), facts()],
    [
      'floor-outside',
      demand({ features: { ...NO_DEMAND_FEATURES, floorMin: 5, floorMax: 9 } }),
      facts(),
    ],
    [
      'outside-radius',
      demand({ place: { kind: 'near', center: { lat: 37.98, lng: 23.73 }, radiusKm: 2 } }),
      facts(),
    ],
    [
      'outside-area',
      demand({
        place: {
          kind: 'area',
          outline: [
            { lat: 37.9, lng: 23.7 },
            { lat: 37.9, lng: 23.8 },
            { lat: 38.0, lng: 23.8 },
            { lat: 38.0, lng: 23.7 },
          ],
        },
      }),
      facts(),
    ],
    [
      'not-available-then',
      demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-06-30' } }),
      facts({ availability: { from: '2029-01-01', to: null } }),
    ],
    [
      'proximity-too-far',
      demand({ proximity: [{ kind: 'school', maxMetres: 300 }] }),
      facts({ proximityMetres: { school: 1200 } }),
    ],
  ];

  for (const [blocker, d, f] of SCENARIOS) {
    it(`«${blocker}» εμφανίζεται`, () => {
      expect(matchDemandAgainstListing(d, f, TODAY).blockers).toContain(blocker);
    });
  }

  it('🔑 ΚΑΘΕ κωδικός του κλειστού συνόλου καλύπτεται — κανένας αδρανής φρουρός', () => {
    const covered = new Set(SCENARIOS.map(([code]) => code));
    expect([...DEMAND_BLOCKERS].sort()).toEqual([...covered].sort());
  });
});

// =============================================================================
// Μ — ΤΟ «ΠΟΣΟ ΛΕΙΠΕΙ» (§12.6)
// =============================================================================

describe('🔴 Μ — «με +20.000 € υπάρχουν 6» ΥΠΟΛΟΓΙΖΕΤΑΙ, δεν γράφεται', () => {
  it('το ακριβώς παράδειγμα του §12.6: οροφή 180.000, αγγελία 200.000', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 180_000 } });
    const result = matchDemandAgainstListing(d, facts(), TODAY);

    expect(result.verdict).toBe('near-miss');
    expect(result.blockers).toEqual(['price-above']);
    expect(result.gaps.priceOverBy).toBe(20_000);
  });

  it('εμβαδόν, υπνοδωμάτια και απόσταση δίνουν κι αυτά αριθμό', () => {
    const short = matchDemandAgainstListing(
      demand({ features: { ...NO_DEMAND_FEATURES, areaMin: 130 } }),
      facts(),
      TODAY,
    );
    expect(short.gaps.areaShortBy).toBe(30);

    const beds = matchDemandAgainstListing(
      demand({ features: { ...NO_DEMAND_FEATURES, bedroomsMin: 5 } }),
      facts(),
      TODAY,
    );
    expect(beds.gaps.bedroomsShortBy).toBe(2);

    const far = matchDemandAgainstListing(
      demand({ place: { kind: 'near', center: { lat: 40.64, lng: 22.94 }, radiusKm: 0.001 } }),
      facts({
        listing: listing({
          position: {
            kind: 'known',
            provenance: 'manual',
            point: { lat: 40.68, lng: 22.94 },
            locatedAt: '2026-08-11T00:00:00.000Z',
          },
        }),
      }),
      TODAY,
    );
    expect(far.gaps.distanceOverMetres).toBeGreaterThan(3000);
  });

  it('🔴 αγγελία ΧΩΡΙΣ τιμή δεν παράγει ψεύτικο «πόσο λείπει»', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 180_000 } });
    const f = facts({
      listing: listing({ commercial: { askingPrice: null, finalPrice: null, rentPrice: null } }),
    });
    const result = matchDemandAgainstListing(d, f, TODAY);

    expect(result.blockers).toContain('price-above');
    // ⚠️ Χωρίς τιμή ΔΕΝ υπάρχει απόσταση — ένα `0` εδώ θα διαβαζόταν ως «ταιριάζει
    // ακριβώς στην οροφή», που είναι υπαρκτή και ΔΙΑΦΟΡΕΤΙΚΗ απάντηση.
    expect(result.gaps.priceOverBy).toBeNull();
  });

  it('όταν ταιριάζει, ΚΑΜΙΑ απόσταση δεν είναι γεμάτη', () => {
    const result = matchDemandAgainstListing(demand(), facts(), TODAY);
    expect(result.verdict).toBe('match');
    expect(Object.values(result.gaps).every((gap) => gap === null)).toBe(true);
  });
});

// =============================================================================
// Π — Η ΠΟΛΙΤΙΚΗ ΕΤΥΜΗΓΟΡΙΑΣ (χειρόγραφες προσδοκίες)
// =============================================================================

describe('Π — πολιτική: πότε «κοντά» και πότε «όχι»', () => {
  it('κανένα εμπόδιο → match', () => {
    expect(decideVerdict([])).toBe('match');
  });

  it('ένα μετρήσιμο → near-miss', () => {
    expect(decideVerdict(['price-above'])).toBe('near-miss');
  });

  it(`${NEAR_MISS_MAX_AXES} μετρήσιμα → near-miss· ένα παραπάνω → no-match`, () => {
    expect(decideVerdict(['price-above', 'area-below'])).toBe('near-miss');
    expect(decideVerdict(['price-above', 'area-below', 'bedrooms-below'])).toBe('no-match');
  });

  it('🔴 ΕΝΑ κατηγορικό αρκεί για no-match, όσο λίγα κι αν είναι', () => {
    expect(decideVerdict(['offer-kind'])).toBe('no-match');
    // Μια αγγελία ενοικίασης δεν γίνεται πώληση με +20.000 €.
    expect(decideVerdict(['offer-kind', 'price-above'])).toBe('no-match');
  });

  it('🔑 ο χαρακτηρισμός μετρήσιμο/κατηγορικό είναι κλειστός', () => {
    const measurable = DEMAND_BLOCKERS.filter(isMeasurableBlocker);
    const categorical = DEMAND_BLOCKERS.filter((b) => !isMeasurableBlocker(b));
    expect(measurable.length + categorical.length).toBe(DEMAND_BLOCKERS.length);
    expect(categorical).toContain('position-unknown');
    expect(measurable).toContain('outside-radius');
  });
});

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ ΤΟΥ ΣΥΝΟΛΟΥ
// =============================================================================

describe('🔴 Λ — κλειστή λογιστική στα αποτελέσματα', () => {
  it('τα τρία σύνολα κλείνουν στο πλήθος των υποψηφίων', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 190_000 } });
    const candidates = [
      facts(), // 200.000 → near-miss (+10.000)
      facts({ listing: listing({ commercial: { askingPrice: 150_000, finalPrice: null, rentPrice: null } }) }), // match
      facts({ listing: listing({ offerKinds: ['leaseOut'] }) }), // no-match (κατηγορικό)
    ];

    const results = matchDemand(d, candidates, TODAY);

    expect(results.matched).toHaveLength(1);
    expect(results.nearMissed).toHaveLength(1);
    expect(results.rejected).toHaveLength(1);
    // 🔴 Η ΑΡΝΗΣΗ ΚΟΥΒΑΛΑ ΤΟ ΓΙΑΤΙ ΤΗΣ. Χωρίς αυτό, η οθόνη του §12.6 δομικά δεν
    // μπορεί να πει «τι το εμποδίζει» — δηλαδή το «0 αποτελέσματα» θα διαβαζόταν ως
    // «δεν υπάρχει» ενώ σημαίνει «δεν ξέρουμε ακόμη» (Α5).
    expect(results.rejected[0].match.blockers).toContain('offer-kind');
    expect(results.considered).toBe(3);
    expect(demandResultsBalance(results)).toBe(true);
  });

  it('το άθροισμα κλείνει και στο ΜΗΔΕΝ', () => {
    const results = matchDemand(demand(), [], TODAY);
    expect(results.considered).toBe(0);
    expect(demandResultsBalance(results)).toBe(true);
  });

  it('τα «κοντινά» κουβαλούν το ΓΙΑΤΙ μαζί τους', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 190_000 } });
    const results = matchDemand(d, [facts()], TODAY);
    expect(results.nearMissed[0].match.gaps.priceOverBy).toBe(10_000);
  });
});

// =============================================================================
// Χ — Ο ΧΡΟΝΟΣ (Ζ2) — ο άξονας που δεν έχει κανένα portal
// =============================================================================

describe('Χ — ο τέταρτος άξονας', () => {
  it('«όποτε κι αν βγει» δεν κοιτάζει καθόλου διαθεσιμότητα', () => {
    const d = demand({ timing: { kind: 'whenever' } });
    expect(matchDemandAgainstListing(d, facts({ availability: null })).verdict).toBe('match');
  });

  it('«τώρα» δέχεται αγγελία χωρίς δηλωμένη διαθεσιμότητα (είναι ήδη στην αγορά)', () => {
    const d = demand({ timing: { kind: 'now' } });
    expect(matchDemandAgainstListing(d, facts({ availability: null })).verdict).toBe('match');
  });

  it('🔴 «τώρα» ΑΠΟΡΡΙΠΤΕΙ αγγελία που ελευθερώνεται στο μέλλον', () => {
    const d = demand({ timing: { kind: 'now' } });
    const f = facts({ availability: { from: '2029-01-01', to: null } });
    expect(matchDemandAgainstListing(d, f, TODAY).blockers).toContain('not-available-then');
  });

  it('🔑 παράθυρο που ΕΠΙΚΑΛΥΠΤΕΤΑΙ μερικώς → ταιριάζει (§12.3: πουλάει πριν χτίσει)', () => {
    const d = demand({ timing: { kind: 'window', fromDate: '2027-06-01', toDate: '2027-12-31' } });
    const f = facts({ availability: { from: '2027-09-01', to: null } });
    expect(matchDemandAgainstListing(d, f, TODAY).verdict).toBe('match');
  });

  it('παράθυρο που ΔΕΝ επικαλύπτεται → not-available-then', () => {
    const d = demand({ timing: { kind: 'window', fromDate: '2027-01-01', toDate: '2027-03-31' } });
    const f = facts({ availability: { from: null, to: '2026-12-31' } });
    expect(matchDemandAgainstListing(d, f, TODAY).blockers).toContain('not-available-then');
  });
});
