/**
 * parking-general-tab-config — types, option lists and form seeding for
 * `ParkingGeneralTab`.
 *
 * Config-only counterpart of `storage-general-tab-config.ts` (same archetype,
 * different schema — ADR-588 keeps the two forms separate on purpose).
 *
 * @module components/space-management/ParkingPage/ParkingDetails/tabs/parking-general-tab-config
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';
import type { SelectOption } from '@/components/shared/space-info/OptionSelectField';
import type { SpaceGeneralTabProps } from '@/components/shared/space-info/space-general-tab-contracts';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ParkingGeneralTabProps extends SpaceGeneralTabProps {
  parking: ParkingSpot;
}

export interface ParkingFormState {
  /**
   * Canonical form field, shared with the other space forms so they can reuse
   * `useSpaceNameSuggestion`. Persisted as the spot's `number` — the mapping
   * happens where the payload is built, not in the state.
   */
  name: string;
  /** ADR-233: Entity coding system */
  code: string;
  type: ParkingSpotType;
  status: ParkingSpotStatus;
  floor: string;
  location: string;
  area: string;
  description: string;
  notes: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_PARKING_TYPE: ParkingSpotType = 'standard';
export const DEFAULT_PARKING_STATUS: ParkingSpotStatus = 'available';

export const PARKING_TYPES: SelectOption<ParkingSpotType>[] = [
  { value: 'standard', labelKey: 'general.types.standard' },
  { value: 'handicapped', labelKey: 'general.types.handicapped' },
  { value: 'motorcycle', labelKey: 'general.types.motorcycle' },
  { value: 'electric', labelKey: 'general.types.electric' },
  { value: 'visitor', labelKey: 'general.types.visitor' },
];

export const PARKING_STATUSES: SelectOption<ParkingSpotStatus>[] = [
  { value: 'available', labelKey: 'general.statuses.available' },
  { value: 'occupied', labelKey: 'general.statuses.occupied' },
  { value: 'reserved', labelKey: 'general.statuses.reserved' },
  { value: 'sold', labelKey: 'general.statuses.sold' },
  { value: 'maintenance', labelKey: 'general.statuses.maintenance' },
];

// ============================================================================
// HELPERS
// ============================================================================

export function buildFormState(parking: ParkingSpot): ParkingFormState {
  return {
    name: parking.number || '',
    code: parking.code || '',
    type: parking.type || DEFAULT_PARKING_TYPE,
    status: parking.status || DEFAULT_PARKING_STATUS,
    floor: parking.floor || '',
    location: parking.location || '',
    area: parking.area !== undefined ? String(parking.area) : '',
    description: parking.description || '',
    notes: parking.notes || '',
  };
}
