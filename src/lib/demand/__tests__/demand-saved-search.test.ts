/**
 * ADR-888 — «✓ Αποθηκευμένη αναζήτηση»: η ζήτηση που γεννήθηκε από μια αναζήτηση την αναγνωρίζει ξανά.
 */

import { savedDemandForSearch } from '../demand-saved-search';
import { listingFiltersFromDemand } from '../demand-listing-filters';
import { serializeListingFilters } from '@/lib/listings/listing-filters';
import type { GeoOutline } from '@/types/geo/coordinates';
import { demand } from './demand-fixtures';

const A: GeoOutline = [
  { lat: 40.58, lng: 22.9 },
  { lat: 40.58, lng: 23.0 },
  { lat: 40.68, lng: 23.0 },
  { lat: 40.68, lng: 22.9 },
];

const saved = demand({ id: 'dmnd_saved', place: { kind: 'area', shapes: [A] } });
const query = serializeListingFilters(listingFiltersFromDemand(saved)).toString();

describe('savedDemandForSearch', () => {
  it('η αναζήτηση από την οποία σώθηκε η ζήτηση την αναγνωρίζει — και με παραμέτρους που δεν είναι φίλτρα', () => {
    expect(savedDemandForSearch([saved], query)?.id).toBe('dmnd_saved');
    expect(savedDemandForSearch([saved], `${query}&selected=prop_1&save=1`)?.id).toBe('dmnd_saved');
  });

  it('άλλη αναζήτηση → null', () => {
    expect(savedDemandForSearch([saved], 'offer=leaseOut')).toBeNull();
  });

  it('αποσυρμένη ζήτηση δεν μετρά ως αποθηκευμένη', () => {
    expect(savedDemandForSearch([{ ...saved, lifecycle: 'withdrawn' }], query)).toBeNull();
  });
});
