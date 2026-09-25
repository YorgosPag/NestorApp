/**
 * ΑΓΚΥΡΕΣ — **«N ΑΓΓΕΛΙΕΣ ΜΕΣΑ» ΠΡΙΝ ΤΗΝ ΕΦΑΡΜΟΓΗ** (ADR-885).
 *
 * 🔑 Ο αριθμός πριν την Εφαρμογή πρέπει να είναι **ο ίδιος** με τη λίστα μετά — και να
 * ομολογεί «τουλάχιστον» όταν δεν τα έχει δει όλα.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { drawnAreaFromShapes } from '@/lib/listings/listing-drawn-area';
import { drawnPreviewCount } from '@/lib/listings/listing-drawn-preview';
import { applyListingFilters, EMPTY_LISTING_FILTERS } from '@/lib/listings/listing-filters';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import type { ListingPosition } from '@/types/public-listing';

const AT = '2026-09-25T00:00:00.000Z';

const exact = (point: GeoPoint): ListingPosition => ({
  kind: 'known',
  provenance: 'geocoded',
  point,
  locatedAt: AT,
  accuracy: 'exact',
});

const square = (south: number, west: number, size: number): GeoOutline => [
  { lat: south, lng: west },
  { lat: south, lng: west + size },
  { lat: south + size, lng: west + size },
  { lat: south + size, lng: west },
];

const SHAPE = drawnAreaFromShapes([square(37.97, 23.72, 0.02)]);
const LISTINGS = [
  listing({ id: 'in-1', position: exact({ lat: 37.975, lng: 23.725 }) }),
  listing({ id: 'in-2', position: exact({ lat: 37.985, lng: 23.735 }) }),
  listing({ id: 'out', position: exact({ lat: 37.95, lng: 23.70 }) }),
];
const COMPLETE = { kind: 'complete' } as const;

describe('drawnPreviewCount', () => {
  if (SHAPE === null) throw new Error('fixture');

  it('μετρά με τον ΙΔΙΟ φιλτραριστή που θα δείξει η λίστα μετά την Εφαρμογή', () => {
    const preview = drawnPreviewCount(LISTINGS, EMPTY_LISTING_FILTERS, SHAPE, COMPLETE);
    const after = applyListingFilters(LISTINGS, { ...EMPTY_LISTING_FILTERS, near: SHAPE });
    expect(preview).toEqual({ count: 2, exact: true });
    expect(preview.count).toBe(after.length);
  });

  it('🔴 αγγελία ΧΩΡΙΣ θέση δεν μετρά — η ανάγνωση της εφαρμοσμένης περιοχής δεν τη φέρνει ποτέ', () => {
    const unlocated = listing({ id: 'nowhere', position: { kind: 'unknown', reason: 'never-asked' } });
    expect(drawnPreviewCount([...LISTINGS, unlocated], EMPTY_LISTING_FILTERS, SHAPE, COMPLETE).count).toBe(2);
  });

  it('σχήμα που βγαίνει έξω από ό,τι διαβάστηκε ⇒ «τουλάχιστον»', () => {
    // ⚠️ Το ορθογώνιο ανάγνωσης διευρύνεται κατά τη μέγιστη αβεβαιότητα (10 χλμ.) — άρα
    //    «έξω» σημαίνει πραγματικά αλλού: η ανάγνωση έγινε στη Θεσσαλονίκη.
    const readFrame = { south: 40.6, west: 22.9, north: 40.68, east: 23.0 };
    const preview = drawnPreviewCount(LISTINGS, { ...EMPTY_LISTING_FILTERS, near: readFrame }, SHAPE, COMPLETE);
    expect(preview.exact).toBe(false);
  });

  it('κομμένη ανάγνωση ⇒ «τουλάχιστον», ακόμη κι αν το σχήμα καλύπτεται', () => {
    const capped = { kind: 'capped', shown: 500, total: null } as const;
    expect(drawnPreviewCount(LISTINGS, EMPTY_LISTING_FILTERS, SHAPE, capped).exact).toBe(false);
  });
});
