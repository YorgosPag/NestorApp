/**
 * @fileoverview **Από την αγγελία στη ρίζα της περιήγησης** — η δημόσια σελίδα ξέρει μόνο το `listingId` (ADR-884 Κ3β).
 * @related `lib/listings/listing-families.ts` (η ΑΥΘΕΝΤΙΑ των οικογενειών) · Φ0.1 (ρίζα με είδος)
 * @module lib/spatial-tour/tour-subject-of-listing
 *
 * 🔑 Η ταυτότητα της αγγελίας **είναι** η ταυτότητα του ακινήτου (1:1, `PublicListing.id`), και το πρόθεμα λέει
 * την οικογένεια **πριν** τη βάση (`familyOfListingId`). Εδώ ζει μόνο η αντιστοίχιση οικογένεια → είδος ρίζας.
 *
 * ⚠️ `Record<ListingFamily, …>`: τρίτη οικογένεια αγγελιών **δεν μεταγλωττίζεται** μέχρι να δηλώσει πού δένεται
 * η περιήγησή της — αντί να απαντά σιωπηλά «δεν έχει περιήγηση».
 */

import { ENTITY_TYPES, type EntityType } from '@/config/domain-constants';
import type { PlaceSource } from '@/constants/place-sources';
import { familyOfListingId, type ListingFamily } from '@/lib/listings/listing-families';
import type { TourSubject } from '@/types/spatial-tour';

const TOUR_ROOT_OF_FAMILY: Readonly<Record<ListingFamily, PlaceSource>> = {
  agency: 'company-property',
  owner: 'owner-property',
};

/**
 * **Σε ποια οντότητα δένονται τα αρχεία της ρίζας** (πανοράματα, κατόψεις — ADR-884 Φ2στ-β): η ΜΙΑ αντιστοίχιση. Ως
 * 2026-09-27 ζούσε inline στο `tour-capture-finalize.ts`, και ο κριτής κατόψεων θα τη χρειαζόταν δεύτερη φορά.
 */
const FILE_ENTITY_OF_ROOT: Readonly<Record<PlaceSource, EntityType>> = {
  'company-property': ENTITY_TYPES.PROPERTY,
  'owner-property': ENTITY_TYPES.OWNER_PROPERTY,
};

export function tourSubjectFileEntityType(subject: Pick<TourSubject, 'kind'>): EntityType {
  return FILE_ENTITY_OF_ROOT[subject.kind];
}

/** `null` ⇒ δεν είναι ταυτότητα αγγελίας (απορρίπτεται χωρίς κόστος βάσης). */
export function tourSubjectOfListing(listingId: string): TourSubject | null {
  const family = familyOfListingId(listingId);
  return family === null ? null : { kind: TOUR_ROOT_OF_FAMILY[family], id: listingId };
}
