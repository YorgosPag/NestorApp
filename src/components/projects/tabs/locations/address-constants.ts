/**
 * =============================================================================
 * Address Constants — SSOT for address type & block side option arrays
 * =============================================================================
 *
 * Used by: ProjectLocationsTab, AddressFormSection
 *
 * @module components/projects/tabs/locations/address-constants
 * @enterprise ADR-167
 */

import type { ProjectAddressType, BlockSideDirection } from '@/types/project/addresses';

export const ADDRESS_TYPE_KEYS: readonly ProjectAddressType[] = [
  'site', 'entrance', 'delivery', 'legal', 'postal', 'billing', 'correspondence', 'frontage', 'other',
] as const;

/**
 * Address types that may appear at most ONCE per project. `other` and
 * `frontage` are exempt: `other` is a free-form bucket; `frontage` is indexed
 * (one per πρόσωπο, up to 4) so multiple entries are expected. (ADR-167 Phase 2.5)
 */
export function isUniqueAddressType(type: ProjectAddressType): boolean {
  return type !== 'other' && type !== 'frontage';
}

export const BLOCK_SIDE_KEYS: readonly BlockSideDirection[] = [
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'internal',
] as const;
