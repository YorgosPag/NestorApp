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
  'site', 'entrance', 'delivery', 'legal', 'postal', 'billing', 'correspondence', 'other',
] as const;

/**
 * Address types that may appear at most ONCE per project. Only `other` may
 * appear multiple times (free-form bucket for arbitrary additional addresses).
 * Used by ProjectLocationsTab to filter the type dropdown and suggest the next
 * unused type when opening the add form.
 */
export function isUniqueAddressType(type: ProjectAddressType): boolean {
  return type !== 'other';
}

export const BLOCK_SIDE_KEYS: readonly BlockSideDirection[] = [
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'internal',
] as const;
