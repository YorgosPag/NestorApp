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

export const BLOCK_SIDE_KEYS: readonly BlockSideDirection[] = [
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'corner', 'internal',
] as const;
