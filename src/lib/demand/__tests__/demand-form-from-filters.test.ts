/**
 * ADR-888 — φίλτρα αναζήτησης → φόρμα ζήτησης (η αντίστροφη του `listingFiltersFromDemand`).
 *
 * Άγκυρα round-trip: ό,τι ΔΕΝ είναι στο `notCarried` επιστρέφει ίδιο από την ορθή προβολή.
 */

import { demandFormFromListingFilters } from '../demand-form-from-filters';
import { validateDemandForm } from '../demand-form-validation';
import { listingFiltersFromDemand } from '../demand-listing-filters';
import { EMPTY_LISTING_CRITERIA, withRange, withValues } from '@/lib/criteria/listing-criteria';
import {
  EMPTY_LISTING_FILTERS,
  parseListingFilters,
  serializeListingFilters,
} from '@/lib/listings/listing-filters';
import { drawnAreaFromShapes } from '@/lib/listings/listing-drawn-area';
import type { PropertyDemand } from '@/types/property-demand';
import type { GeoOutline } from '@/types/geo/coordinates';
import { demand } from './demand-fixtures';

const A: GeoOutline = [
  { lat: 40.63, lng: 22.93 },
  { lat: 40.63, lng: 22.95 },
  { lat: 40.65, lng: 22.95 },
  { lat: 40.65, lng: 22.93 },
];
const B: GeoOutline = [
  { lat: 40.68, lng: 22.98 },
  { lat: 40.68, lng: 23.0 },
  { lat: 40.7, lng: 23.0 },
  { lat: 40.7, lng: 22.98 },
];

/** Διεύθυνση → φόρμα → ζήτηση (ο ΙΔΙΟΣ δρόμος με το παράθυρο αποθήκευσης). */
function demandFromQuery(params: URLSearchParams): PropertyDemand {
  const { values } = demandFormFromListingFilters(parseListingFilters(params));
  const validation = validateDemandForm(values);
  if (validation.kind !== 'ready') throw new Error(`όχι έτοιμη: ${JSON.stringify(validation)}`);
  return demand(validation.draft);
}

describe('demandFormFromListingFilters', () => {
  it('σχέδιο με ΔΥΟ σχήματα → `area` με τα ίδια σχήματα, και πίσω ίδιο `?draw=`', () => {
    const drawn = drawnAreaFromShapes([A, B]);
    if (drawn === null) throw new Error('έγκυρα σχήματα');
    let criteria = withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['sell']);
    criteria = withRange(criteria, 'priceSale', { min: null, max: 250_000 });
    const params = serializeListingFilters({ ...EMPTY_LISTING_FILTERS, criteria, near: drawn });

    const saved = demandFromQuery(params);
    expect(saved.place).toEqual({ kind: 'area', shapes: drawn.shapes });
    expect(listingFiltersFromDemand(saved).near).toEqual(drawn);
  });

  it('round-trip: τα μεταφερόμενα κριτήρια επιστρέφουν ίδια', () => {
    const original = listingFiltersFromDemand(
      demand({
        features: { types: ['apartment'], areaMin: 60, areaMax: 120, bedroomsMin: 2, floorMin: 1, floorMax: 4 },
        place: { kind: 'near', center: { lat: 40.64, lng: 22.94 }, radiusKm: 3 },
      }),
    );
    const params = serializeListingFilters(original);
    const { notCarried } = demandFormFromListingFilters(parseListingFilters(params));
    expect(notCarried).toEqual([]);
    expect(serializeListingFilters(listingFiltersFromDemand(demandFromQuery(params))).toString()).toBe(
      params.toString(),
    );
  });

  it('ό,τι η ζήτηση δεν εκφράζει δηλώνεται ονομαστικά', () => {
    const from = listingFiltersFromDemand(demand());
    let criteria = withRange(from.criteria, 'bathrooms', { min: 2, max: null });
    criteria = withRange(criteria, 'bedrooms', { min: 1, max: 3 });
    const params = serializeListingFilters({ ...from, criteria });
    const { notCarried } = demandFormFromListingFilters(parseListingFilters(params));
    expect(notCarried).toEqual(expect.arrayContaining(['bathrooms', 'bedrooms']));
  });

  it('χωρίς διάθεση στην αναζήτηση η φόρμα ΔΕΝ μαντεύει — `seeks: []`', () => {
    const { values } = demandFormFromListingFilters(parseListingFilters(new URLSearchParams()));
    expect(values.seeks).toEqual([]);
    expect(values.placeKind).toBe('anywhere');
  });
});
