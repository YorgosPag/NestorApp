/**
 * Άγκυρες φίλτρων + GeoJSON (ADR-777 Α3 · Α20 · Α5).
 */

import {
  parseListingFilters,
  serializeListingFilters,
  applyListingFilters,
  EMPTY_LISTING_FILTERS,
} from '../listing-filters';
import { listingsToGeoJson } from '../listings-geojson';
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

describe('Φ1 — τα φίλτρα ζουν στη διεύθυνση και επιβιώνουν', () => {
  it('γράψιμο → ανάγνωση επιστρέφει την ΙΔΙΑ κατάσταση', () => {
    const filters = {
      offerKinds: ['sell', 'exchange'] as const,
      types: ['apartment'],
      priceMin: 100000, priceMax: 300000,
      areaMin: 50, areaMax: null,
      bedroomsMin: 2,
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
      commercial: { askingPrice: null, finalPrice: null, rentPrice: 500 },
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
