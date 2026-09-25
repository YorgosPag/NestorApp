/**
 * 🔁 **Φίλτρα αναζήτησης → φόρμα ζήτησης** — η ΑΝΤΙΣΤΡΟΦΗ του `listingFiltersFromDemand` (ADR-888).
 *
 * 🔑 **Παράγει ΤΙΜΕΣ ΦΟΡΜΑΣ, όχι ζήτηση.** Το «Αποθήκευση αναζήτησης» του χάρτη και η πλήρης φόρμα
 * (`/demands/new?from=…`) περνούν από τον **ίδιο** δρόμο: `validateDemandForm` → `demandDraftFrom` →
 * invariants. Ένας δεύτερος κατασκευαστής ζήτησης εδώ θα ήταν δεύτερος κριτής εγκυρότητας.
 *
 * 🏆 **Η τίμια λογιστική που οι μεγάλοι κρύβουν**: ό,τι η οθόνη ρωτά αλλά η ζήτηση **δεν** εκφράζει
 * (μπάνια, έτος ανακαίνισης, όριο περιοχής…) επιστρέφεται **ονομαστικά** στο `notCarried`, για να το πει
 * το παράθυρο πριν την αποθήκευση — όχι να το ανακαλύψει ο άνθρωπος όταν η ειδοποίηση φέρει «λάθος» σπίτι.
 *
 * ✅ **Συμβόλαιο (δοκιμή round-trip)**: για κάθε άξονα που ΔΕΝ είναι στο `notCarried`,
 * `listingFiltersFromDemand(ζήτηση(φόρμα(φίλτρα)))` δίνει τον **ίδιο** άξονα.
 */

import { rangeOf, valuesOf, type ListingCriteria } from '@/lib/criteria/listing-criteria';
import { LISTING_CRITERION_KEYS, type CriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { PRICE_AXIS_OF_OFFER_KIND } from '@/lib/criteria/listing-criterion-reading';
import type { ListingSearch } from '@/lib/listings/listing-filters';
import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';
import { PRICED_SEEK_KINDS, type PricedSeekKind } from '@/types/property-demand';
import { EMPTY_DEMAND_FORM, type DemandFormValues } from './demand-form-values';

/** Ό,τι δεν ταξιδεύει: ένα κριτήριο της οθόνης, ή η περιοχή όταν είναι όριο/ορθογώνιο χάρτη. */
export type FiltersNotCarried = CriterionKey | 'region';

export interface DemandFormFromFilters {
  readonly values: DemandFormValues;
  readonly notCarried: readonly FiltersNotCarried[];
}

/** Τα κριτήρια που η ζήτηση εκφράζει **ολόκληρα**. Τα υπνοδωμάτια κρίνονται χωριστά (μόνο `min`). */
const CARRIED: ReadonlySet<CriterionKey> = new Set<CriterionKey>([
  'offerKind',
  'type',
  'areaSqm',
  'floor',
  'priceSale',
  'priceRent',
  'priceNightly',
]);

export function demandFormFromListingFilters(filters: ListingSearch): DemandFormFromFilters {
  const seeks = offerKindsOf(filters.criteria);
  const place = placeOf(filters.near);
  const bedrooms = rangeOf(filters.criteria, 'bedrooms');
  const area = rangeOf(filters.criteria, 'areaSqm');
  const floor = rangeOf(filters.criteria, 'floor');

  const values: DemandFormValues = {
    ...EMPTY_DEMAND_FORM,
    ...place.values,
    ...stayOf(filters),
    seeks,
    seekPrices: seekPricesOf(filters.criteria),
    types: [...(valuesOf(filters.criteria, 'type') ?? [])],
    areaMin: area?.min ?? null,
    areaMax: area?.max ?? null,
    bedroomsMin: bedrooms?.min ?? null,
    floorMin: floor?.min ?? null,
    floorMax: floor?.max ?? null,
  };

  const notCarried: FiltersNotCarried[] = LISTING_CRITERION_KEYS.filter(
    (key) => filters.criteria[key] !== undefined && !isCarried(key, filters.criteria, seeks),
  );
  if (place.lost) notCarried.push('region');
  return { values, notCarried };
}

/** Ένα κριτήριο ταξιδεύει όταν η ζήτηση το εκφράζει — και η τιμή μόνο για διάθεση που ζητήθηκε. */
function isCarried(key: CriterionKey, criteria: ListingCriteria, seeks: readonly OfferKind[]): boolean {
  if (key === 'bedrooms') return (rangeOf(criteria, 'bedrooms')?.max ?? null) === null;
  if (!CARRIED.has(key)) return false;
  const seekOfAxis = PRICED_SEEK_KINDS.find((kind) => PRICE_AXIS_OF_OFFER_KIND[kind] === key);
  return seekOfAxis === undefined || seeks.includes(seekOfAxis);
}

function offerKindsOf(criteria: ListingCriteria): OfferKind[] {
  const asked = valuesOf(criteria, 'offerKind') ?? [];
  return OFFER_KINDS.filter((kind) => asked.includes(kind));
}

function seekPricesOf(criteria: ListingCriteria): DemandFormValues['seekPrices'] {
  const priceOf = (kind: PricedSeekKind) => {
    const axis = PRICE_AXIS_OF_OFFER_KIND[kind];
    const range = axis === undefined ? undefined : rangeOf(criteria, axis);
    return { min: range?.min ?? null, max: range?.max ?? null };
  };
  return { sell: priceOf('sell'), leaseOut: priceOf('leaseOut'), leaseShort: priceOf('leaseShort') };
}

/**
 * Η περιοχή: κύκλος → `near` · σχέδιο → `area` (αυτούσιο, ADR-888) · όριο διοικητικής περιοχής ή
 * ορθογώνιο χάρτη → `anywhere` **με δηλωμένη απώλεια** (η ζήτηση δεν κρατά όρια — ADR-777 Α9).
 */
function placeOf(near: ListingSearch['near']): {
  readonly values: Partial<DemandFormValues>;
  readonly lost: boolean;
} {
  if (near === null) return { values: {}, lost: false };
  if ('shapes' in near) {
    return { values: { placeKind: 'area', placeShapes: near.shapes.map((shape) => [...shape]) }, lost: false };
  }
  if ('center' in near && 'radiusKm' in near) {
    return { values: { placeKind: 'near', placeCenter: near.center, radiusKm: near.radiusKm }, lost: false };
  }
  return { values: {}, lost: true };
}

/**
 * Διαμονή: οι ημερομηνίες γίνονται παράθυρο· οι επισκέπτες γίνονται ενήλικες **ώστε το πλήθος να
 * επιστρέφει ίδιο** (`stayHeadcount`) — η αναζήτηση δεν ξεχωρίζει παιδιά, άρα δεν τα επινοούμε.
 */
function stayOf(filters: ListingSearch): Partial<DemandFormValues> {
  const window =
    filters.stayWindow === null
      ? {}
      : { timingKind: 'window' as const, fromDate: filters.stayWindow.checkIn, toDate: filters.stayWindow.checkOut };
  const party =
    filters.guests === null
      ? {}
      : { stayParty: { adults: filters.guests, children: null, infants: null, pets: filters.pets } };
  return { ...window, ...party };
}
