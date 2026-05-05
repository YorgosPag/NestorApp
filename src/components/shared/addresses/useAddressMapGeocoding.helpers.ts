/**
 * Pure helpers extracted from `useAddressMapGeocoding.ts` to keep the hook
 * file under the 500-line Google SRP threshold (CLAUDE.md N.7.1).
 *
 *  - `reverseResultToAddress` — Nominatim reverse → form-friendly partial.
 *  - `findReferencePosition` — first available pin position for fallback fits.
 *  - `snapshotFields` / `fieldsEqual` — geocoding-relevant field diff used by
 *    the staleness detector (Google-style "your map is out of date" flag).
 */

import type { ProjectAddress, PartialProjectAddress } from '@/types/project/addresses';
import type {
  GeocodingServiceResult,
  ReverseGeocodingResult,
} from '@/lib/geocoding/geocoding-service';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import {
  ADDRESS_GEOCODING_FIELDS,
  type DragPosition,
} from '@/components/shared/addresses/address-map-config';

/**
 * ADR-277: keep `street` and `number` separate so downstream consumers
 * (`handleDragUpdate`) don't have to re-split a pre-concatenated string.
 */
export function reverseResultToAddress(
  result: ReverseGeocodingResult,
): Partial<PartialProjectAddress> {
  return {
    street: result.street,
    number: result.number || undefined,
    city: result.city,
    neighborhood: result.neighborhood || undefined,
    postalCode: result.postalCode,
    region: result.region || undefined,
    country: result.country || GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY,
    coordinates: { lat: result.lat, lng: result.lng },
  };
}

/** Find the first available reference position from addresses (drag > geocoded) */
export function findReferencePosition(
  addresses: ProjectAddress[],
  dragPositions: Map<string, DragPosition>,
  geocodedAddresses: Map<string, GeocodingServiceResult>,
): DragPosition | null {
  for (const addr of addresses) {
    const dp = dragPositions.get(addr.id);
    if (dp) return dp;
    const gc = geocodedAddresses.get(addr.id);
    if (gc) return { lng: gc.lng, lat: gc.lat };
  }
  return null;
}

/** Snapshot of geocoding-relevant fields for change detection. */
export type AddressFieldsSnapshot = Pick<
  ProjectAddress,
  (typeof ADDRESS_GEOCODING_FIELDS)[number]
>;

export function snapshotFields(addr: ProjectAddress): AddressFieldsSnapshot {
  const out = {} as AddressFieldsSnapshot;
  for (const key of ADDRESS_GEOCODING_FIELDS) {
    (out as Record<string, unknown>)[key] = addr[key];
  }
  return out;
}

export function fieldsEqual(a: AddressFieldsSnapshot, b: AddressFieldsSnapshot): boolean {
  for (const key of ADDRESS_GEOCODING_FIELDS) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
