/**
 * Άγκυρες φίλτρων + GeoJSON (ADR-777 Α3 · Α20 · Α5).
 */

import {
  parseListingFilters,
  serializeListingFilters,
  applyListingFilters,
  EMPTY_LISTING_FILTERS,
  DEFAULT_SEARCH_RADIUS_KM,
} from '../listing-filters';
import { listingsToGeoJson } from '../listings-geojson';
import type { PublicListing } from '@/types/public-listing';

const AT = '2026-08-10T10:00:00.000Z';

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l1',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
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

describe('Φ1 — τα φίλτρα ζουν στη διεύθυνση και επιβιώνουν', () => {
  it('γράψιμο → ανάγνωση επιστρέφει την ΙΔΙΑ κατάσταση', () => {
    const filters = {
      offerKinds: ['sell', 'exchange'] as const,
      types: ['apartment'],
      priceMin: 100000, priceMax: 300000,
      areaMin: 50, areaMax: null,
      bedroomsMin: 2,
      // ⚠️ Ρητό `null`, ποτέ παραλειπόμενο: ο γεωγραφικός άξονας (ADR-777 Α3, οθόνη 1)
      // είναι **υποχρεωτικό** πεδίο του κλειστού σχήματος. Ένα `undefined` εδώ θα
      // περνούσε τον έλεγχο `!== null` και θα έσκαγε στη σειριοποίηση — που είναι
      // ακριβώς ό,τι έκανε την πρώτη φορά, και γι' αυτό γράφεται.
      near: null,
    };
    expect(parseListingFilters(serializeListingFilters(filters))).toEqual(filters);
  });

  it('τα κενά φίλτρα ΔΕΝ γράφονται — δύο ίδιες αναζητήσεις έχουν ΜΙΑ διεύθυνση', () => {
    expect(serializeListingFilters(EMPTY_LISTING_FILTERS).toString()).toBe('');
  });

  it('άγνωστη διάθεση στη διεύθυνση αγνοείται — η οθόνη δεν σκάει από ξένο σύνδεσμο', () => {
    const parsed = parseListingFilters(new URLSearchParams('offer=sell&offer=telepathy'));
    expect(parsed.offerKinds).toEqual(['sell']);
  });

  it('🔴 σκουπίδι σε αριθμό γίνεται null, ΟΧΙ 0 — το 0 θα φιλτράριζε τα πάντα', () => {
    const parsed = parseListingFilters(new URLSearchParams('pmin=abc&amin='));
    expect(parsed.priceMin).toBeNull();
    expect(parsed.areaMin).toBeNull();
  });
});

// ============================================================================
// Γ — Ο ΓΕΩΓΡΑΦΙΚΟΣ ΑΞΟΝΑΣ (ADR-777 Α3, η οθόνη 1 μιλά στην οθόνη 2)
// ============================================================================

/** Θεσσαλονίκη, κέντρο. Οι αποστάσεις παρακάτω μετρήθηκαν από αυτό το σημείο. */
const THESSALONIKI = { lat: 40.6403, lng: 22.9439 } as const;

function atPoint(id: string, lat: number, lng: number): PublicListing {
  return listing({
    id,
    position: { kind: 'known', provenance: 'manual', point: { lat, lng }, locatedAt: AT },
  });
}

describe('Γ1 — διεύθυνση ⇄ γεωγραφικό φίλτρο', () => {
  it('γράψιμο → ανάγνωση επιστρέφει το ΙΔΙΟ σημείο και την ίδια ακτίνα', () => {
    const near = { center: THESSALONIKI, radiusKm: 25 };
    const parsed = parseListingFilters(
      serializeListingFilters({ ...EMPTY_LISTING_FILTERS, near })
    );
    expect(parsed.near).toEqual(near);
  });

  it('🔴 ΜΙΣΟ ζεύγος συντεταγμένων αγνοείται — δεν γίνεται σημείο στον Ατλαντικό', () => {
    // `lat` χωρίς `lng` θα σήμαινε μεσημβρινός μηδέν. Ο χάρτης θα το ζωγράφιζε με
    // απόλυτη σιγουριά — το ίδιο ελάττωμα που ο τύπος `PlacePosition` απαγορεύει
    // με το ρητό `unknown`.
    expect(parseListingFilters(new URLSearchParams('lat=40.64')).near).toBeNull();
    expect(parseListingFilters(new URLSearchParams('lng=22.94')).near).toBeNull();
  });

  it('🔴 ακτίνα ≤ 0 ΑΚΥΡΩΝΕΙ το φίλτρο, δεν «διορθώνεται» σε 0 χλμ', () => {
    // Ακτίνα μηδέν φιλτράρει τα πάντα: ο επισκέπτης θα έβλεπε άδεια οθόνη χωρίς να
    // ξέρει ότι έφταιγε μια παράμετρος στη διεύθυνση.
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=22.94&r=0')).near).toBeNull();
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=22.94&r=-5')).near).toBeNull();
  });

  it('χωρίς ακτίνα ⇒ η προεπιλογή, όχι «άπειρο» ούτε «μηδέν»', () => {
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=22.94')).near?.radiusKm)
      .toBe(DEFAULT_SEARCH_RADIUS_KM);
  });

  it('αδύνατη συντεταγμένη αγνοείται — ξένος σύνδεσμος δεν σκάει την οθόνη', () => {
    expect(parseListingFilters(new URLSearchParams('lat=91&lng=22.94')).near).toBeNull();
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=181')).near).toBeNull();
  });
});

describe('Γ2 — η εφαρμογή του φίλτρου', () => {
  const near = { center: THESSALONIKI, radiusKm: 10 };

  it('μέσα στην ακτίνα ⇒ περνά· έξω ⇒ κόβεται', () => {
    const inside = atPoint('in', 40.6503, 22.9539);   // ~1,3 χλμ
    const outside = atPoint('out', 41.0, 23.5);        // ~60 χλμ
    const result = applyListingFilters([inside, outside], { ...EMPTY_LISTING_FILTERS, near });
    expect(result.map((l) => l.id)).toEqual(['in']);
  });

  it('🔴 Η ΑΓΓΕΛΙΑ ΧΩΡΙΣ ΘΕΣΗ **ΔΕΝ** ΕΞΑΦΑΝΙΖΕΤΑΙ — Α5 §4.1, η σημαντικότερη άγκυρα', () => {
    // *«Δεν φιλτράρονται όταν μετακινείς τον χάρτη: δεν μπορούμε να τις αποκλείσουμε
    // από περιοχή που δεν ξέρουμε αν τους ανήκει.»* Ένα `return false` εκεί θα
    // μετέτρεπε το «δεν ξέρουμε πού είναι» σε «δεν είναι εδώ» — άλλος ισχυρισμός,
    // και ψευδής. Είναι και ο λόγος που η λογιστική έχει ΔΥΟ κάδους, όχι έναν.
    const unlocated = listing({ id: 'nowhere' });
    const far = atPoint('far', 41.0, 23.5);
    const result = applyListingFilters([unlocated, far], { ...EMPTY_LISTING_FILTERS, near });
    expect(result.map((l) => l.id)).toEqual(['nowhere']);
  });

  it('χωρίς `near` ⇒ ο άξονας δεν κρίνει τίποτα', () => {
    const far = atPoint('far', 41.0, 23.5);
    expect(applyListingFilters([far], EMPTY_LISTING_FILTERS)).toHaveLength(1);
  });
});

describe('Φ2 — φιλτράρεται ο ΣΩΣΤΟΣ άξονας (Α20)', () => {
  it('🔑 ακίνητο μόνο προς ΑΝΤΙΠΑΡΟΧΗ βρίσκεται από το offerKinds', () => {
    const exchange = listing({ commercialStatus: 'unavailable', offerKinds: ['exchange'] });
    const found = applyListingFilters([exchange], { ...EMPTY_LISTING_FILTERS, offerKinds: ['exchange'] });
    expect(found).toHaveLength(1);
  });

  it('κενό φίλτρο διαθέσεων σημαίνει «όλες», όχι «καμία»', () => {
    expect(applyListingFilters([listing()], EMPTY_LISTING_FILTERS)).toHaveLength(1);
  });

  it('η τιμή περνά από τον SSoT — ενοίκιο κρίνεται ως ενοίκιο, όχι ως τιμή πώλησης', () => {
    const rental = listing({
      commercialStatus: 'for-rent',
      commercial: { askingPrice: null, finalPrice: null, rentPrice: 500, nightlyRate: null },
      offerKinds: ['leaseOut'],
    });
    expect(applyListingFilters([rental], { ...EMPTY_LISTING_FILTERS, priceMax: 600 })).toHaveLength(1);
    expect(applyListingFilters([rental], { ...EMPTY_LISTING_FILTERS, priceMin: 600 })).toHaveLength(0);
  });

  it('🔴 χωρίς εμβαδόν ΔΕΝ βαφτίζεται 0 τ.μ. — δεν ταιριάζει σε εύρος, δεν ψεύδεται', () => {
    const noArea = listing({ areaSqm: null });
    expect(applyListingFilters([noArea], { ...EMPTY_LISTING_FILTERS, areaMin: 0 })).toHaveLength(0);
    expect(applyListingFilters([noArea], EMPTY_LISTING_FILTERS)).toHaveLength(1);
  });
});

describe('Φ3 — GeoJSON: η γεωμετρία κουβαλά το νόημα', () => {
  const point = { lat: 40.64, lng: 22.94 } as const;

  it('οι αγγελίες ΧΩΡΙΣ θέση δεν μπαίνουν στον χάρτη — δεν έχουν γεωμετρία', () => {
    expect(listingsToGeoJson([listing()]).features).toHaveLength(0);
  });

  it('το σχήμα ταξιδεύει ως ΙΔΙΟΤΗΤΑ — ο ζωγράφος το διαβάζει, δεν το επιλέγει', () => {
    const city = listing({
      position: { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy: 'center' },
    });
    const fc = listingsToGeoJson([city]);
    expect(fc.features[0].properties.shape).toBe('shaded-city');
  });

  it('🔴 [lng, lat] — η αντίστροφη σειρά γίνεται ΜΙΑ φορά, στο σύνορο εξόδου', () => {
    const exact = listing({
      position: { kind: 'known', provenance: 'manual', point, locatedAt: AT },
    });
    const geom = listingsToGeoJson([exact]).features[0].geometry as GeoJSON.Point;
    expect(geom.coordinates).toEqual([22.94, 40.64]);
  });

  it('το περίγραμμα ΚΛΕΙΝΕΙ (πρώτη κορυφή == τελευταία), όπως απαιτεί το GeoJSON', () => {
    const drawn = listing({
      position: {
        kind: 'known', provenance: 'drawn', point, locatedAt: AT,
        outline: [point, { lat: 40.641, lng: 22.945 }, { lat: 40.642, lng: 22.94 }],
      },
    });
    const geom = listingsToGeoJson([drawn]).features[0].geometry as GeoJSON.Polygon;
    const ring = geom.coordinates[0];
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});
