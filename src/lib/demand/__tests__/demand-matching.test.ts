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
  isCategoricalBlocker,
  isMeasurableBlocker,
  isUncertainBlocker,
  ABSENCE_BLOCKERS,
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
import { EARTH_RADIUS_METERS } from '@/lib/geo/geo-distance';
import { NO_DEMAND_FEATURES, type FrontageSide, type PropertyDemand } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';
import { IGNORANCE_BLOCKERS } from '../demand-answer';

// =============================================================================
// ΒΟΗΘΗΤΙΚΑ
// =============================================================================

/**
 * 🔴 **Τα fixtures ΕΞΗΧΘΗΣΑΝ** (`demand-fixtures.ts`) όταν τα χρειάστηκε η δεύτερη
 * σουίτα. Γραμμένα δύο φορές θα απέκλιναν — και μια δοκιμή που περνά επειδή το
 * **fixture** της είναι διαφορετικό δηλώνει κάλυψη που δεν υπάρχει.
 */
import { NOW_ISO, TODAY, demand, facts, listing } from './demand-fixtures';

/**
 * Άξονας δρόμου Δύση→Ανατολή (ίδιο πλάτος `lat`), για τα σενάρια της **Ζ4
 * δομημένης**. Με αυτή τη φορά, «βόρεια του άξονα» είναι πάντα `'left'` και «νότια»
 * πάντα `'right'` — βλ. τη σύμβαση προσήμου του `sideOfPolyline` (`geo-line.ts`).
 */
const FRONTAGE_AXIS = [
  { lat: 40.6, lng: 22.9 },
  { lat: 40.6, lng: 23.0 },
] as const;

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
    demand({
      place: { kind: 'frontage', streetName: 'Εγνατίας', axis: FRONTAGE_AXIS, side: 'both', depthMetres: 50 },
    }),
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
      listing: listing({ commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null } }),
    }),
    facts({ listing: listing({ commercial: { askingPrice: 300_000, finalPrice: null, rentPrice: null, nightlyRate: null } }) }),
    facts({ listing: listing({ position: { kind: 'unknown', reason: 'never-asked' } }) }),
    facts({
      listing: listing({
        // Κοντά στον `FRONTAGE_AXIS` — για να χτυπήσει και το `frontage` της
        // λίστας `DEMANDS` με πραγματικό `match`, όχι μόνο άρνηση.
        position: { kind: 'known', provenance: 'manual', point: { lat: 40.6005, lng: 22.95 }, locatedAt: NOW_ISO },
      }),
    }),
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
    // 🔴 ADR-777 §8.52 — ΤΑ ΤΕΣΣΕΡΑ ΕΜΠΟΔΙΑ ΑΠΟΥΣΙΑΣ. Η ΑΓΚΥΡΑ ΤΟΥ ΚΛΕΙΣΤΟΥ ΣΥΝΟΛΟΥ
    //    ΤΑ ΖΗΤΗΣΕ ΜΟΝΗ ΤΗΣ, και είχε δίκιο: εμπόδιο χωρίς σενάριο είναι κωδικός που
    //    **κανείς δεν έχει δει να παράγεται** — δηλαδή φρουρός που δεν ξέρουμε αν ζει.
    //    ⚠️ Το ΟΡΙΟ μπαίνει ΚΑΙ στη ζήτηση ΚΑΙ η αγγελία σιωπά: χωρίς το πρώτο δεν
    //    γεννιέται εμπόδιο (§8.52.4), χωρίς το δεύτερο γεννιέται το μετρήσιμο αδελφό του.
    [
      'price-undeclared',
      demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 100_000 } }),
      facts({
        listing: listing({
          commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null },
        }),
      }),
    ],
    [
      'area-undeclared',
      demand({ features: { ...NO_DEMAND_FEATURES, areaMin: 200 } }),
      facts({ listing: listing({ areaSqm: null }) }),
    ],
    [
      'bedrooms-undeclared',
      demand({ features: { ...NO_DEMAND_FEATURES, bedroomsMin: 5 } }),
      facts({ listing: listing({ bedrooms: null }) }),
    ],
    [
      'floor-undeclared',
      demand({ features: { ...NO_DEMAND_FEATURES, floorMin: 5, floorMax: 9 } }),
      facts({ listing: listing({ floor: null }) }),
    ],
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
      'outside-frontage',
      demand({
        place: { kind: 'frontage', streetName: 'Εγνατίας', axis: FRONTAGE_AXIS, side: 'both', depthMetres: 20 },
      }),
      facts({
        listing: listing({
          position: { kind: 'known', provenance: 'manual', point: { lat: 40.55, lng: 22.95 }, locatedAt: NOW_ISO },
        }),
      }),
    ],
    [
      'wrong-side',
      demand({
        place: { kind: 'frontage', streetName: 'Εγνατίας', axis: FRONTAGE_AXIS, side: 'right', depthMetres: 100 },
      }),
      facts({
        // Βόρεια του άξονα ⇒ `'left'` — η ζήτηση θέλει `'right'`.
        listing: listing({
          position: { kind: 'known', provenance: 'manual', point: { lat: 40.6005, lng: 22.95 }, locatedAt: NOW_ISO },
        }),
      }),
    ],
    [
      'side-unresolved',
      demand({
        place: { kind: 'frontage', streetName: 'Εγνατίας', axis: FRONTAGE_AXIS, side: 'left', depthMetres: 100 },
      }),
      facts({
        // `geocoded`/`approximate` δεν είναι αρκετά ακριβές για κρίση πλευράς.
        listing: listing({
          position: {
            kind: 'known',
            provenance: 'geocoded',
            accuracy: 'approximate',
            point: { lat: 40.6005, lng: 22.95 },
            locatedAt: NOW_ISO,
          },
        }),
      }),
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
      listing: listing({ commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null } }),
    });
    const result = matchDemandAgainstListing(d, f, TODAY);

    // 🔴 ADR-777 §8.52 — ΕΔΩ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΤΟ ΨΕΜΑ, ΜΕΣΑ ΣΕ ΑΓΚΥΡΑ.
    //    Η προηγούμενη εκδοχή απαιτούσε `price-above`, δηλαδή «είναι πιο ακριβή απ' όσο
    //    θέλεις» για ποσό που ΚΑΝΕΙΣ δεν ξέρει — άρα η άγκυρα ΚΛΕΙΔΩΝΕ την παραβίαση
    //    της Α5 αντί να την πιάνει. Μια δοκιμή που επικυρώνει το ελάττωμα το κάνει
    //    **μονιμότερο** από την απουσία δοκιμής.
    expect(result.blockers).toContain('price-undeclared');
    expect(result.blockers).not.toContain('price-above');
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

  it('🔑 ο χαρακτηρισμός σε ΤΡΕΙΣ τάξεις είναι κλειστός και τα σύνολα ξένα', () => {
    const measurable = DEMAND_BLOCKERS.filter(isMeasurableBlocker);
    const categorical = DEMAND_BLOCKERS.filter(isCategoricalBlocker);
    const uncertain = DEMAND_BLOCKERS.filter(isUncertainBlocker);

    // Κάλυψη: κάθε φραγμός ανήκει κάπου.
    expect(measurable.length + categorical.length + uncertain.length).toBe(DEMAND_BLOCKERS.length);
    // Ξένα σύνολα: κανένας φραγμός δεν ανήκει σε δύο τάξεις.
    for (const blocker of DEMAND_BLOCKERS) {
      const classes = [isMeasurableBlocker, isCategoricalBlocker, isUncertainBlocker].filter((is) =>
        is(blocker),
      );
      expect(classes).toHaveLength(1);
    }
    expect(categorical).toContain('position-unknown');
    expect(measurable).toContain('outside-radius');
    expect(uncertain).toContain('side-unresolved');
  });

  it('🔴 Η ΑΓΝΟΙΑ ΔΕΝ ΕΙΝΑΙ ΑΡΝΗΣΗ — «side-unresolved» ⇒ near-miss, ΠΟΤΕ no-match', () => {
    // 🔴 Η ΑΓΚΥΡΑ ΤΗΣ ΑΠΟΦΑΣΗΣ. Το `side-unresolved` γεννήθηκε κατηγορικό, και ήταν
    // λάθος: το ADR-777 μετρά **54%** των κτιρίων του κέντρου Θεσσαλονίκης χωρίς
    // διεύθυνση στο OSM ⇒ η άγνοια πλευράς είναι **ο κανόνας**, όχι η εξαίρεση. Ως
    // κατηγορικό, θα έκρυβε την πλειοψηφία της αγοράς από τον άνθρωπο που όρισε
    // προσεκτικά «νότια πλευρά» — και **χωρίς αυτό το test η επαναφορά του λάθους
    // θα ήταν αόρατη**: κάθε άλλη δοκιμή ελέγχει `blockers`, καμία την ετυμηγορία.
    expect(decideVerdict(['side-unresolved'])).toBe('near-miss');
    expect(decideVerdict(['side-unresolved', 'price-above'])).toBe('near-miss');

    // Αλλά η άγνοια ΔΕΝ ξεπλένει κλειστή υπόθεση: μαζί με κατηγορικό, no-match.
    expect(decideVerdict(['side-unresolved', 'offer-kind'])).toBe('no-match');
    // Και η «λάθος πλευρά» παραμένει κλειστή υπόθεση — ξέρουμε, και είναι όχι.
    expect(decideVerdict(['wrong-side'])).toBe('no-match');
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
      facts({ listing: listing({ commercial: { askingPrice: 150_000, finalPrice: null, rentPrice: null, nightlyRate: null } }) }), // match
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

// =============================================================================
// Ο — Η ΚΡΙΣΗ ΤΟΥ ΜΕΤΩΠΟΥ (Ζ4 δομημένη): σειρά, «both», provenance
// =============================================================================

/** Ζήτηση μετώπου με βολικές προεπιλογές, παρακάμπτοντας μόνο ό,τι χρειάζεται το σενάριο. */
function frontageDemand(overrides: {
  side?: FrontageSide;
  depthMetres?: number;
}): PropertyDemand {
  return demand({
    place: {
      kind: 'frontage',
      streetName: 'Εγνατίας',
      axis: FRONTAGE_AXIS,
      side: overrides.side ?? 'right',
      depthMetres: overrides.depthMetres ?? 20,
    },
  });
}

describe('🔴 Ο — «βάθος ΠΡΙΝ πλευρά» και «both» χωρίς εμπόδιο πλευράς', () => {
  it('🔑 σημείο ΕΞΩ από το βάθος ΚΑΙ στη λάθος πλευρά ⇒ ΜΟΝΟ outside-frontage', () => {
    // Βόρεια (`'left'`) — λάθος πλευρά για ζήτηση `'right'` — αλλά 5+ χλμ. μακριά,
    // πολύ πέρα από τα 20 μ. βάθος. Αν η πλευρά κρινόταν πρώτη, θα εμφανιζόταν και
    // «wrong-side» — και αυτό είναι ακριβώς το λάθος που η σειρά του τύπου απαγορεύει.
    const d = frontageDemand({ side: 'right', depthMetres: 20 });
    const f = facts({
      listing: listing({
        position: { kind: 'known', provenance: 'manual', point: { lat: 40.65, lng: 22.95 }, locatedAt: NOW_ISO },
      }),
    });
    expect(matchDemandAgainstListing(d, f, TODAY).blockers).toEqual(['outside-frontage']);
  });

  it('«both» δεν ρωτά ποτέ ποια πλευρά — καμία σε ΟΛΟΚΛΗΡΟ το εύρος περνάει', () => {
    const d = frontageDemand({ side: 'both', depthMetres: 100 });
    for (const point of [{ lat: 40.6005, lng: 22.95 }, { lat: 40.5995, lng: 22.95 }]) {
      const f = facts({
        listing: listing({ position: { kind: 'known', provenance: 'manual', point, locatedAt: NOW_ISO } }),
      });
      expect(matchDemandAgainstListing(d, f, TODAY).verdict).toBe('match');
    }
  });

  it('🔑 πάνω στη γραμμή ⇒ side-unresolved, ΑΚΟΜΗ ΚΑΙ με αξιόπιστη προέλευση', () => {
    // Η εμπιστοσύνη στην προέλευση απαντά «μπορώ να κρίνω πλευρά;» — όχι «ποια είναι
    // η πλευρά;». Πάνω στη γραμμή δεν υπάρχει πλευρά να κριθεί, ό,τι κι αν εμπιστευτούμε.
    const d = frontageDemand({ side: 'left', depthMetres: 20 });
    const f = facts({
      listing: listing({
        position: { kind: 'known', provenance: 'manual', point: { lat: 40.6, lng: 22.95 }, locatedAt: NOW_ISO },
      }),
    });
    expect(matchDemandAgainstListing(d, f, TODAY).blockers).toContain('side-unresolved');
  });

  it('η απόσταση του «outside-frontage» είναι ΑΚΡΙΒΩΣ distanceToPolyline − depth', () => {
    const d = frontageDemand({ side: 'both', depthMetres: 20 });
    const point = { lat: 40.55, lng: 22.95 };
    const f = facts({
      listing: listing({ position: { kind: 'known', provenance: 'manual', point, locatedAt: NOW_ISO } }),
    });

    const metresPerDegree = (Math.PI / 180) * EARTH_RADIUS_METERS;
    const expectedDistance = Math.abs(point.lat - FRONTAGE_AXIS[0].lat) * metresPerDegree - 20;

    const result = matchDemandAgainstListing(d, f, TODAY);
    expect(result.blockers).toContain('outside-frontage');
    expect(result.gaps.distanceOverMetres).toBeCloseTo(expectedDistance, 0);
  });
});

describe('🔴 Ο — ποιες προελεύσεις επιτρέπεται να κρίνουν πλευρά (ADR-777, §7 Ζ4 δομημένη)', () => {
  /** Βόρεια του άξονα (`'left'`), εντός βάθους — μόνο η ΑΞΙΟΠΙΣΤΙΑ ποικίλλει. */
  const NORTH_POINT = { lat: 40.6005, lng: 22.95 };

  const TRUSTED: ReadonlyArray<readonly [string, PublicListing['position']]> = [
    ['manual', { kind: 'known', provenance: 'manual', point: NORTH_POINT, locatedAt: NOW_ISO }],
    ['drawn', { kind: 'known', provenance: 'drawn', point: NORTH_POINT, locatedAt: NOW_ISO }],
    ['survey', { kind: 'known', provenance: 'survey', point: NORTH_POINT, locatedAt: NOW_ISO }],
    ['bim', { kind: 'known', provenance: 'bim', point: NORTH_POINT, locatedAt: NOW_ISO }],
    [
      'geocoded/exact',
      { kind: 'known', provenance: 'geocoded', accuracy: 'exact', point: NORTH_POINT, locatedAt: NOW_ISO },
    ],
  ];

  const UNTRUSTED: ReadonlyArray<readonly [string, PublicListing['position']]> = [
    [
      'geocoded/interpolated',
      { kind: 'known', provenance: 'geocoded', accuracy: 'interpolated', point: NORTH_POINT, locatedAt: NOW_ISO },
    ],
    [
      'geocoded/approximate',
      { kind: 'known', provenance: 'geocoded', accuracy: 'approximate', point: NORTH_POINT, locatedAt: NOW_ISO },
    ],
    [
      'geocoded/center',
      { kind: 'known', provenance: 'geocoded', accuracy: 'center', point: NORTH_POINT, locatedAt: NOW_ISO },
    ],
    [
      'osm',
      {
        kind: 'known',
        provenance: 'osm',
        point: NORTH_POINT,
        locatedAt: NOW_ISO,
        osmRef: { elementType: 'way', elementId: '123', seenAt: NOW_ISO },
      },
    ],
  ];

  for (const [label, position] of TRUSTED) {
    it(`🔑 «${label}» κρίνει πλευρά — σωστή πλευρά (\`'left'\`) περνάει ΧΩΡΙΣ side-unresolved`, () => {
      const d = frontageDemand({ side: 'left', depthMetres: 100 });
      const f = facts({ listing: listing({ position }) });
      expect(matchDemandAgainstListing(d, f, TODAY).blockers).not.toContain('side-unresolved');
    });

    it(`«${label}» κρίνει πλευρά — λάθος πλευρά (\`'right'\`) ⇒ wrong-side`, () => {
      const d = frontageDemand({ side: 'right', depthMetres: 100 });
      const f = facts({ listing: listing({ position }) });
      expect(matchDemandAgainstListing(d, f, TODAY).blockers).toContain('wrong-side');
    });
  }

  for (const [label, position] of UNTRUSTED) {
    it(`🔴 «${label}» ΔΕΝ κρίνει πλευρά ⇒ side-unresolved, όχι μάντεμα`, () => {
      const d = frontageDemand({ side: 'left', depthMetres: 100 });
      const f = facts({ listing: listing({ position }) });
      const result = matchDemandAgainstListing(d, f, TODAY);
      expect(result.blockers).toContain('side-unresolved');
      expect(result.blockers).not.toContain('wrong-side');
    });
  }
});

// ─── ADR-777 §8.52 — Η ΣΙΩΠΗ ΠΑΥΕΙ ΝΑ ΕΙΝΑΙ ΙΣΧΥΡΙΣΜΟΣ ─────────────────────────
//
// 🔴 ΔΥΟ ΕΛΑΤΤΩΜΑΤΑ, ΜΙΑ ΘΕΡΑΠΕΙΑ. Το `numericOutcome` ήταν **δεύτερος αναγνώστης**
// (8 ωμά `=== null`) δίπλα στον ΕΝΑΝ του `lib/criteria/`. Συνέπεια (α): η σιωπή
// γινόταν ισχυρισμός («πιο ακριβή απ' όσο θέλεις» για άγνωστη τιμή). Συνέπεια (β):
// η **γη κρινόταν σε υπνοδωμάτια**, ενώ η αναζήτηση την εξαιρεί ρητά για 24 άξονες.
//
// ⚠️ Η ομάδα Γ δεν δοκιμάζει «νέο κώδικα»: δοκιμάζει ότι **δεν γράφτηκε** δεύτερη
// φορά ο κανόνας της γης. Περνά επειδή ο ΕΝΑΣ αναγνώστης απαντά ήδη `not-applicable`.

describe('ADR-777 §8.52 — η ζήτηση ρωτά τον ΕΝΑΝ αναγνώστη', () => {
  const NOTHING = { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null };

  // ── Α. Η ΣΙΩΠΗ ΟΝΟΜΑΖΕΤΑΙ ─────────────────────────────────────────────────

  it('Α1 — χωρίς δηλωμένη τιμή: `price-undeclared`, ΠΟΤΕ `price-above`/`price-below`', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMin: 50_000, priceMax: 180_000 } });
    const result = matchDemandAgainstListing(d, facts({ listing: listing({ commercial: NOTHING }) }), TODAY);
    expect(result.blockers).toContain('price-undeclared');
    expect(result.blockers).not.toContain('price-above');
    expect(result.blockers).not.toContain('price-below');
    // Καμία απόσταση: δεν υπάρχει «πόσο λείπει» σε μια απουσία.
    expect(result.gaps.priceOverBy).toBeNull();
    expect(result.gaps.priceUnderBy).toBeNull();
  });

  it('Α2 — χωρίς δηλωμένο εμβαδόν: `area-undeclared`, ΠΟΤΕ `area-below`', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, areaMin: 200 } });
    const result = matchDemandAgainstListing(d, facts({ listing: listing({ areaSqm: null }) }), TODAY);
    expect(result.blockers).toContain('area-undeclared');
    expect(result.blockers).not.toContain('area-below');
    expect(result.gaps.areaShortBy).toBeNull();
  });

  it('Α3 — χωρίς δηλωμένα υπνοδωμάτια: `bedrooms-undeclared`, ΠΟΤΕ `bedrooms-below`', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, bedroomsMin: 5 } });
    const result = matchDemandAgainstListing(d, facts({ listing: listing({ bedrooms: null }) }), TODAY);
    expect(result.blockers).toContain('bedrooms-undeclared');
    expect(result.blockers).not.toContain('bedrooms-below');
    expect(result.gaps.bedroomsShortBy).toBeNull();
  });

  it('Α4 — χωρίς δηλωμένο όροφο: `floor-undeclared`, ΠΟΤΕ `floor-outside`', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, floorMin: 1, floorMax: 3 } });
    const result = matchDemandAgainstListing(d, facts({ listing: listing({ floor: null }) }), TODAY);
    expect(result.blockers).toContain('floor-undeclared');
    expect(result.blockers).not.toContain('floor-outside');
  });

  // ── Β. Η ΣΙΩΠΗ ΔΕΝ ΜΙΛΑΕΙ ΟΤΑΝ ΚΑΝΕΙΣ ΔΕΝ ΡΩΤΗΣΕ ─────────────────────────

  it('Β1 — αγγελία χωρίς ΚΑΝΕΝΑ αριθμητικό στοιχείο ταιριάζει, αν η ζήτηση δεν ρωτά τίποτα', () => {
    // 🔑 Ο κρίσιμος διαχωρισμός: το εμπόδιο απουσίας γεννιέται μόνο όταν ο άνθρωπος
    //    **έθεσε όριο**. Αλλιώς κάθε ελλιπής αγγελία θα αποκλειόταν από κάθε ζήτηση —
    //    δηλαδή θα τιμωρούσαμε τη σιωπή χωρίς να τη ρωτήσει κανείς.
    const bare = listing({ commercial: NOTHING, areaSqm: null, bedrooms: null, floor: null });
    const result = matchDemandAgainstListing(demand(), facts({ listing: bare }), TODAY);
    expect(result.blockers).toEqual([]);
    expect(result.verdict).toBe('match');
  });

  // ── Γ. Η ΓΗ ΔΕΝ ΚΡΙΝΕΤΑΙ ΣΕ ΥΠΝΟΔΩΜΑΤΙΑ (ΕΥΡΗΜΑ 4) ───────────────────────

  it('Γ1 — οικόπεδο ΔΕΝ αποκλείεται σε υπνοδωμάτια/όροφο: δεν σηκώνει την ερώτηση', () => {
    // 🔴 Πριν το §8.52 αυτό έβγαζε `bedrooms-below` ΚΑΙ `floor-outside`: η ζήτηση
    //    ζητούσε από κάτοχο γης να δηλώσει υπνοδωμάτια. Η αναζήτηση το ήξερε ήδη
    //    (`LAND_CANNOT_ANSWER`, 24 άξονες) — η ίδια αγγελία, δύο απαντήσεις.
    const d = demand({
      features: { ...NO_DEMAND_FEATURES, bedroomsMin: 3, floorMin: 1, floorMax: 5 },
    });
    const plot = listing({ type: 'plot', bedrooms: null, floor: null, areaSqm: 500 });
    const result = matchDemandAgainstListing(d, facts({ listing: plot }), TODAY);

    expect(result.blockers).not.toContain('bedrooms-below');
    expect(result.blockers).not.toContain('bedrooms-undeclared');
    expect(result.blockers).not.toContain('floor-outside');
    expect(result.blockers).not.toContain('floor-undeclared');
    expect(result.verdict).toBe('match');
  });

  it('Γ2 — το ΙΔΙΟ κενό σε ΚΤΙΣΜΑ παράγει εμπόδιο: η εξαίρεση είναι της ΓΗΣ, όχι του `null`', () => {
    // ⚠️ Η άγκυρα που κάνει το Γ1 να σημαίνει κάτι. Χωρίς αυτήν, ένα «πάντα σιωπή»
    //    θα περνούσε το Γ1 και θα έσβηνε ΟΛΑ τα εμπόδια απουσίας.
    const d = demand({ features: { ...NO_DEMAND_FEATURES, bedroomsMin: 3 } });
    const flat = listing({ type: 'apartment', bedrooms: null });
    const result = matchDemandAgainstListing(d, facts({ listing: flat }), TODAY);
    expect(result.blockers).toContain('bedrooms-undeclared');
  });

  it('Γ3 — το οικόπεδο ΑΠΑΝΤΑ κανονικά σε εμβαδόν: η εξαίρεση είναι ανά ΑΞΟΝΑ', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, areaMin: 1_000 } });
    const plot = listing({ type: 'plot', areaSqm: 500, bedrooms: null, floor: null });
    const result = matchDemandAgainstListing(d, facts({ listing: plot }), TODAY);
    expect(result.blockers).toContain('area-below');
    expect(result.gaps.areaShortBy).toBe(500);
  });

  // ── Δ. Η ΚΑΤΑΤΑΞΗ ΕΙΝΑΙ ΡΗΤΗ, ΣΕ ΚΑΘΕ ΜΙΑ ΑΠΟ ΤΙΣ ΤΡΕΙΣ ΘΕΣΕΙΣ ──────────

  it('Δ1 — τα τέσσερα είναι ΚΑΤΗΓΟΡΙΚΑ και ΜΗ μετρήσιμα, ποτέ σιωπηλά «μετρήσιμα»', () => {
    for (const blocker of ABSENCE_BLOCKERS) {
      expect(isCategoricalBlocker(blocker)).toBe(true);
      expect(isMeasurableBlocker(blocker)).toBe(false);
      expect(isUncertainBlocker(blocker)).toBe(false);
    }
  });

  it('Δ2 — και τα τέσσερα λογίζονται ΑΓΝΟΙΑ στο επίπεδο της ΑΠΑΝΤΗΣΗΣ', () => {
    // 🔑 Δεν είναι αντίφαση με το Δ1: κατηγορικό **ανά αγγελία** (χωρίς τιμή δεν
    //    κρίνεται προϋπολογισμός), άγνοια **ανά απάντηση** (ο λόγος που δεν βρέθηκε
    //    τίποτα δεν είναι ότι «δεν υπάρχει», αλλά ότι «δεν το δήλωσαν»).
    for (const blocker of ABSENCE_BLOCKERS) {
      expect((IGNORANCE_BLOCKERS as readonly string[]).includes(blocker)).toBe(true);
    }
  });

  // ⚠️ ΔΕΝ γράφεται εδώ άγκυρα «κάθε εμπόδιο έχει ετικέτα»: υπάρχει ΗΔΗ, και είναι
  //    καλύτερη — `first-contact-labels.test.ts` Σ1, πάνω στο `DEMAND_BLOCKERS`, **και
  //    στις δύο γλώσσες**, με παρονομαστή (Σ2). Δεύτερη θα ήταν το ίδιο ελάττωμα που
  //    αυτό το §8.52 διορθώνει: δύο αναγνώστες της ίδιας ερώτησης.
});
