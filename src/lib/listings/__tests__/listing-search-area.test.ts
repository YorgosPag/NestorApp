/**
 * ΑΓΚΥΡΕΣ — **ΤΟ ΟΠΤΙΚΟ ΠΕΔΙΟ ΩΣ ΕΡΩΤΗΜΑ, ΜΕ ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ** (ADR-777 §8.63).
 *
 * 🔴 **Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ ΕΙΝΑΙ ΤΟ Κ3**: η αγγελία που ξέρουμε μόνο την **πόλη** της
 * και της οποίας το σημείο πέφτει **μέσα** στο κάδρο. Ο παλιός φιλτραριστής την
 * έκρινε *«μέσα»* με σημειακή απόσταση — δηλαδή **μάντευε** και το έκρυβε, ενώ ο
 * χάρτης δίπλα ζωγράφιζε `shaded-city` λέγοντας ρητά ότι δεν την ξέρουμε.
 */

import {
  computeAreaLedger,
  areaLedgerBalances,
  areaLedgerMatchesVisible,
  listingAreaVerdict,
  readSearchAreaBox,
  writeSearchAreaBox,
  SEARCH_AREA_PARAM,
} from '@/lib/listings/listing-search-area';
import { applyListingFilters, EMPTY_LISTING_FILTERS } from '@/lib/listings/listing-filters';
import { listingSearchArea, LISTING_UNCERTAINTY_KM } from '@/lib/listings/listing-map-shape';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { GeoBoundingBox } from '@/types/geo/coordinates';
import type { ListingPosition } from '@/types/public-listing';

const AT = '2026-09-07T00:00:00.000Z';
/** Κέντρο του κάδρου — κάθε δείγμα κάθεται εδώ, ώστε να αλλάζει **μόνο** η ακρίβεια. */
const INSIDE_POINT = { lat: 37.9838, lng: 23.7275 };
const FAR_POINT = { lat: 40.64, lng: 22.94 };

/** ~2,2 χλμ. — κάδρο ζουμ γειτονιάς. */
const FRAME: GeoBoundingBox = {
  south: 37.974,
  west: 23.7155,
  north: 37.994,
  east: 23.7395,
};

type Accuracy = 'exact' | 'interpolated' | 'approximate' | 'center';

function geocoded(accuracy: Accuracy, point = INSIDE_POINT): ListingPosition {
  return { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy };
}

const NO_POSITION: ListingPosition = { kind: 'unknown', reason: 'never-asked' };

describe('Κ1 — η διεύθυνση κουβαλά το κάδρο σε ΕΝΑ κλειδί', () => {
  const params = (value: string) => new URLSearchParams(`${SEARCH_AREA_PARAM}=${value}`);

  it('γράφει και ξαναδιαβάζει το ίδιο ορθογώνιο', () => {
    const written = writeSearchAreaBox(FRAME);
    expect(readSearchAreaBox(params(written))).toEqual(FRAME);
  });

  it('στρογγυλοποιεί — αλλιώς κάθε εικονοστοιχείο θα γεννούσε νέα διεύθυνση', () => {
    const noisy: GeoBoundingBox = { ...FRAME, south: 37.9740000000001234 };
    expect(writeSearchAreaBox(noisy)).toBe(writeSearchAreaBox(FRAME));
  });

  it('χωρίς κλειδί ⇒ null («κανείς δεν ρώτησε»)', () => {
    expect(readSearchAreaBox(new URLSearchParams(''))).toBeNull();
  });

  it.each([
    ['λάθος πλήθος αριθμών', '37.9,23.7,37.99'],
    ['μη αριθμός', '37.9,23.7,abc,23.74'],
    ['πλάτος εκτός ορίων', '91,23.7,92,23.74'],
    ['μήκος εκτός ορίων', '37.9,181,37.99,182'],
    ['ανάποδο ορθογώνιο', '37.99,23.7,37.9,23.74'],
  ])('fail-closed: %s ⇒ null, ποτέ μερικό ορθογώνιο', (_label, raw) => {
    expect(readSearchAreaBox(params(raw))).toBeNull();
  });
});

describe('Κ2 — η βεβαιότητα απαντά ΔΥΑΔΙΚΑ, χωρίς ειδική περίπτωση', () => {
  it('ακριβής διεύθυνση μέσα στο κάδρο ⇒ inside', () => {
    expect(listingAreaVerdict(listing({ position: geocoded('exact') }), FRAME)).toBe('inside');
  });

  it('ακριβής διεύθυνση αλλού ⇒ outside', () => {
    const far = listing({ position: geocoded('exact', FAR_POINT) });
    expect(listingAreaVerdict(far, FRAME)).toBe('outside');
  });

  it('καμία ερώτηση περιοχής ⇒ inside — το ερώτημα δεν στενεύει τίποτα', () => {
    expect(listingAreaVerdict(listing({ position: geocoded('center') }), null)).toBe('inside');
  });
});

describe('Κ3 🔴 — Η ΤΡΙΤΗ ΚΑΤΗΓΟΡΙΑ: ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΔΙΟΡΘΩΝΕΤΑΙ', () => {
  it('«μόνο πόλη» με το σημείο ΜΕΣΑ στο κάδρο ⇒ maybe, ΟΧΙ inside', () => {
    // Η σημειακή απόσταση θα έλεγε «μέσα». Δεν ξέρουμε — ξέρουμε μόνο την πόλη.
    const cityOnly = listing({ position: geocoded('center') });
    expect(listingAreaVerdict(cityOnly, FRAME)).toBe('maybe');
  });

  it('«συνοικία» με το σημείο μέσα ⇒ maybe — η αβεβαιότητα ξεχειλίζει', () => {
    expect(listingAreaVerdict(listing({ position: geocoded('approximate') }), FRAME)).toBe('maybe');
  });

  it('«δρόμος χωρίς αριθμό» χωράει ολόκληρος ⇒ inside', () => {
    // 250 m μέσα σε κάδρο ~2,2 χλμ.: ό,τι κι αν ισχύει, το ακίνητο είναι στην οθόνη.
    expect(listingAreaVerdict(listing({ position: geocoded('interpolated') }), FRAME)).toBe('inside');
  });

  it('«μόνο πόλη» ΜΑΚΡΙΑ ⇒ outside — η αβεβαιότητα δεν κάνει τα πάντα «ίσως»', () => {
    const far = listing({ position: geocoded('center', FAR_POINT) });
    expect(listingAreaVerdict(far, FRAME)).toBe('outside');
  });

  it('🔴 αγγελία ΧΩΡΙΣ θέση ⇒ maybe, και ΠΟΤΕ outside (Α5 §4.1)', () => {
    const unknown = listing({ position: NO_POSITION });
    expect(listingAreaVerdict(unknown, FRAME)).toBe('maybe');
    expect(listingAreaVerdict(unknown, FRAME)).not.toBe('outside');
  });
});

describe('Κ4 — ο φιλτραριστής κόβει ΜΟΝΟ το «έξω»', () => {
  const filters = { ...EMPTY_LISTING_FILTERS, near: FRAME };

  it('κρατά inside και maybe, πετά μόνο outside', () => {
    const here = listing({ id: 'a', position: geocoded('exact') });
    const perhaps = listing({ id: 'b', position: geocoded('center') });
    const nowhere = listing({ id: 'c', position: NO_POSITION });
    const elsewhere = listing({ id: 'd', position: geocoded('exact', FAR_POINT) });

    const survivors = applyListingFilters([here, perhaps, nowhere, elsewhere], filters);
    expect(survivors.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('χωρίς ερώτηση περιοχής δεν κόβεται τίποτα', () => {
    const far = listing({ position: geocoded('exact', FAR_POINT) });
    expect(applyListingFilters([far], EMPTY_LISTING_FILTERS)).toHaveLength(1);
  });
});

describe('Κ5 — η τέταρτη λογιστική κλείνει, και ελέγχεται ΔΥΟ φορές', () => {
  const sample = [
    listing({ id: 'a', position: geocoded('exact') }),
    listing({ id: 'b', position: geocoded('center') }),
    listing({ id: 'c', position: NO_POSITION }),
    listing({ id: 'd', position: geocoded('exact', FAR_POINT) }),
  ];

  it('διαμερίζει σε τρία και το άθροισμα κλείνει', () => {
    const ledger = computeAreaLedger(sample, FRAME);
    expect(ledger).toEqual({ total: 4, inside: 1, maybe: 2, outside: 1 });
    expect(areaLedgerBalances(ledger)).toBe(true);
  });

  it('συμφωνεί με ό,τι ΕΠΕΖΗΣΕ πράγματι από τον φιλτραριστή', () => {
    const ledger = computeAreaLedger(sample, FRAME);
    const visible = applyListingFilters(sample, { ...EMPTY_LISTING_FILTERS, near: FRAME });
    expect(areaLedgerMatchesVisible(ledger, visible.length)).toBe(true);
  });

  it('🔴 φωνάζει όταν ο μετρητής μιλά για ΑΛΛΟ σύνολο από τη λίστα', () => {
    const ledger = computeAreaLedger(sample, FRAME);
    expect(areaLedgerMatchesVisible(ledger, 99)).toBe(false);
  });

  it('🔴 φωνάζει όταν το άθροισμα δεν κλείνει μέσα του', () => {
    expect(areaLedgerBalances({ total: 10, inside: 1, maybe: 1, outside: 1 })).toBe(false);
  });

  it('χωρίς ερώτηση περιοχής, όλα μετρώνται «εδώ» και τίποτα δεν κόπηκε', () => {
    const ledger = computeAreaLedger(sample, null);
    expect(ledger).toEqual({ total: 4, inside: 4, maybe: 0, outside: 0 });
  });
});

describe('Κ6 — ο πίνακας αβεβαιότητας είναι ΕΞΑΝΤΛΗΤΙΚΟΣ, και το ξέρει θορυβωδώς', () => {
  it('κάθε σχήμα με θέση δηλώνει ακτίνα· μόνο το «κανένα σχήμα» δηλώνει null', () => {
    const declared = Object.entries(LISTING_UNCERTAINTY_KM)
      .filter(([, radius]) => radius === null)
      .map(([shape]) => shape);
    expect(declared).toEqual(['none']);
  });

  it('η βεβαιότητα δηλώνεται ως ΜΗΔΕΝ, ποτέ ως απουσία', () => {
    expect(LISTING_UNCERTAINTY_KM.pin).toBe(0);
    expect(LISTING_UNCERTAINTY_KM.outline).toBe(0);
  });

  it('οι ακτίνες μεγαλώνουν με την άγνοια — αλλιώς η ιεραρχία λέει ψέματα', () => {
    const pin = LISTING_UNCERTAINTY_KM.pin ?? 0;
    const street = LISTING_UNCERTAINTY_KM['pin-with-ring'] ?? 0;
    const area = LISTING_UNCERTAINTY_KM['shaded-circle'] ?? 0;
    const city = LISTING_UNCERTAINTY_KM['shaded-city'] ?? 0;
    expect(pin).toBeLessThan(street);
    expect(street).toBeLessThan(area);
    expect(area).toBeLessThan(city);
  });

  it('🔴 σχήμα ΧΩΡΙΣ δηλωμένη αβεβαιότητα πετά με ΟΝΟΜΑ, ποτέ σιωπηλό null', () => {
    // Ο κλάδος είναι δομικά ανέφικτος με έγκυρη είσοδο — γι' αυτό ακριβώς έπρεπε να
    // εκτελεστεί εδώ, αλλιώς θα ήταν κώδικας που καμία άγκυρα δεν κοκκινίζει.
    // Ίδιο ιδίωμα με τα rogue casts του `listing-map-shape.test.ts`.
    const rogue = {
      kind: 'known',
      provenance: 'geocoded',
      point: INSIDE_POINT,
      locatedAt: AT,
      accuracy: 'exact',
    } as unknown as ListingPosition;

    const table = LISTING_UNCERTAINTY_KM as unknown as Record<string, number | null>;
    const saved = table.pin;
    table.pin = null;
    try {
      expect(() => listingSearchArea(rogue)).toThrow(/without declared uncertainty/);
    } finally {
      table.pin = saved;
    }
  });
});
