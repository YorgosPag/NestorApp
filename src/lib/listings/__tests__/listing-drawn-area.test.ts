/**
 * ΑΓΚΥΡΕΣ — **Η ΣΧΕΔΙΑΣΜΕΝΗ ΠΕΡΙΟΧΗ ΣΤΗ ΔΙΕΥΘΥΝΣΗ** (ADR-885).
 *
 * Κωδικοποιητής polyline (δοκιμασμένος με το επίσημο παράδειγμα της Google), γύρος
 * διεύθυνσης ταυτοδύναμος, fail-closed σε κάθε παραμόρφωση, και η ΜΙΑ πόρτα
 * `drawnAreaFromShapes` με τον ίδιο κριτή σχήματος που ρωτά ο server.
 */

import { RESERVED_SEARCH_PARAMS } from '@/lib/criteria/listing-criteria-url';
import { decodeGeoPolyline, encodeGeoPolyline, quantizeGeoPoint } from '@/lib/geo/geo-polyline-codec';
import {
  drawnAreaFromShapes,
  drawnAreaKey,
  MAX_DRAWN_SHAPES,
  readSearchDrawnArea,
  SEARCH_DRAWN_PARAM,
} from '@/lib/listings/listing-drawn-area';
import { EMPTY_LISTING_FILTERS, parseListingFilters, serializeListingFilters } from '@/lib/listings/listing-filters';
import { listingAreaKey } from '@/lib/listings/listing-geo-query';
import type { GeoOutline } from '@/types/geo/coordinates';

const square = (south: number, west: number, size: number): GeoOutline => [
  { lat: south, lng: west },
  { lat: south, lng: west + size },
  { lat: south + size, lng: west + size },
  { lat: south + size, lng: west },
];

const ATHENS = square(37.97, 23.72, 0.02);
const PIRAEUS = square(37.93, 23.63, 0.015);

describe('Google Encoded Polyline', () => {
  it('το επίσημο παράδειγμα της Google, και προς τις δύο κατευθύνσεις', () => {
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodeGeoPolyline(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodeGeoPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(points);
  });

  it('🔒 κείμενο κομμένο στη μέση ζεύγους ⇒ null', () => {
    expect(decodeGeoPolyline('_p~iF~ps|U_ulL')).toBeNull();
  });

  it('🔒 χαρακτήρας εκτός αλφαβήτου ⇒ null', () => {
    expect(decodeGeoPolyline('_p~iF ~ps|U')).toBeNull();
  });

  it('η κβάντιση είναι ό,τι επιστρέφει ο γύρος encode → decode', () => {
    const raw = { lat: 37.9838123, lng: 23.7275987 };
    expect(decodeGeoPolyline(encodeGeoPolyline([raw]))).toEqual([quantizeGeoPoint(raw)]);
  });
});

describe('drawnAreaFromShapes — η ΜΙΑ πόρτα', () => {
  it('δύο έγκυρα σχήματα ⇒ περιοχή με bbox της ένωσης', () => {
    const area = drawnAreaFromShapes([ATHENS, PIRAEUS]);
    expect(area?.shapes).toHaveLength(2);
    expect(area?.bbox).toEqual({ south: 37.93, west: 23.63, north: 37.99, east: 23.74 });
  });

  it('🔒 σχήμα με αυτοτομή ακυρώνει ΟΛΗ την περιοχή', () => {
    const bowtie: GeoOutline = [
      { lat: 37.97, lng: 23.72 },
      { lat: 37.99, lng: 23.74 },
      { lat: 37.97, lng: 23.74 },
      { lat: 37.99, lng: 23.72 },
    ];
    expect(drawnAreaFromShapes([ATHENS, bowtie])).toBeNull();
  });

  it('🔒 εκτός χώρας εξυπηρέτησης ⇒ null (ίδιος κριτής με τον server)', () => {
    expect(drawnAreaFromShapes([square(48.85, 2.35, 0.02)])).toBeNull();
  });

  it('🔒 κανένα σχήμα ή πάνω από το ταβάνι ⇒ null', () => {
    expect(drawnAreaFromShapes([])).toBeNull();
    const many = Array.from({ length: MAX_DRAWN_SHAPES + 1 }, (_, i) => square(37.5 + i * 0.03, 23.5, 0.02));
    expect(drawnAreaFromShapes(many)).toBeNull();
  });
});

describe('διεύθυνση ⇄ σχεδιασμένη περιοχή', () => {
  const area = drawnAreaFromShapes([ATHENS, PIRAEUS]);

  it('γύρος ταυτοδύναμος: ένα `draw` ανά σχήμα, ίδια περιοχή πίσω', () => {
    const params = serializeListingFilters({ ...EMPTY_LISTING_FILTERS, near: area });
    expect(params.getAll(SEARCH_DRAWN_PARAM)).toHaveLength(2);
    expect(parseListingFilters(params).near).toEqual(area);
    expect(serializeListingFilters(parseListingFilters(params)).toString()).toBe(params.toString());
  });

  it('🔒 ένα χαλασμένο `draw` αγνοεί ΟΛΗ τη σχεδιασμένη περιοχή', () => {
    const params = new URLSearchParams();
    params.append(SEARCH_DRAWN_PARAM, encodeGeoPolyline(ATHENS));
    params.append(SEARCH_DRAWN_PARAM, '_p~iF~ps|U_ulL');
    expect(readSearchDrawnArea(params)).toBeNull();
  });

  it('το σχέδιο προηγείται του ορθογωνίου, η περιοχή προηγείται του σχεδίου', () => {
    const drawn = `${SEARCH_DRAWN_PARAM}=${encodeURIComponent(encodeGeoPolyline(ATHENS))}`;
    expect(parseListingFilters(new URLSearchParams(`${drawn}&box=37,23,38,24`)).near).toHaveProperty('shapes');
    expect(parseListingFilters(new URLSearchParams(`area=municipality:0708&${drawn}`)).near).toEqual({
      adminId: 'municipality:0708',
    });
  });

  it('το `draw` είναι δεσμευμένο — κανένα κριτήριο δεν μπορεί να το πάρει', () => {
    expect(RESERVED_SEARCH_PARAMS).toContain(SEARCH_DRAWN_PARAM);
  });

  it('η ταυτότητα της ανάγνωσης είναι σταθερή και ονομάζει το σχήμα', () => {
    if (area === null) throw new Error('fixture');
    expect(listingAreaKey(area)).toBe(`drawn:${drawnAreaKey(area)}`);
    expect(listingAreaKey({ ...area })).toBe(listingAreaKey(area));
  });
});
