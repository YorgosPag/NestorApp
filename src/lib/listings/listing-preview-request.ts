/**
 * @fileoverview **Η προεπισκόπηση «όπως θα τη δει ο αγοραστής»** — η διαδρομή και το συμβόλαιό της, κοινά σε browser και
 * server (ADR-898 Φ3β-3). Ίδιο ιδίωμα με το `lib/market/value-zone-request.ts`.
 * @related `app/api/listings/preview/route.ts` · `hooks/listings/useListingPreview.ts` ·
 *   `services/listings/owned-listing-projection.ts` (`readOwnedListingPreview`)
 * @module lib/listings/listing-preview-request
 */

import type { PublicListing } from '@/types/public-listing';

const ROUTE = '/api/listings/preview';
const PROPERTY_ID = 'propertyId';
/** Ίδιο άνω όριο με τα αναγνωριστικά εγγράφων της διαδρομής PATCH (`max(128)`). */
const MAX_PROPERTY_ID_LENGTH = 128;

export interface ListingPreviewResponse {
  /** Εφήμερη — σχήμα + γεγονότα δημοσίευσης, ποτέ αποθηκευμένη. Μόνο για τον θεματοφύλακα. */
  readonly listing: PublicListing;
}

export function listingPreviewPath(propertyId: string): string {
  return `${ROUTE}?${new URLSearchParams({ [PROPERTY_ID]: propertyId }).toString()}`;
}

/** Αυστηρή: κενό, με κενά γύρω ή υπερβολικά μακρύ ⇒ `null`. */
export function readListingPreviewPropertyId(params: URLSearchParams): string | null {
  const raw = params.get(PROPERTY_ID);
  if (raw === null || raw.length === 0 || raw.length > MAX_PROPERTY_ID_LENGTH || raw.trim() !== raw) return null;
  return raw;
}
