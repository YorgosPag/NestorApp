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

import type { ParkingSpot, ParkingSpotType } from '@/hooks/useFirestoreParkingSpots';
import {
  operationalDraftOf,
  type OperationalStatusDraft,
} from '@/lib/spaces/space-operational-draft';
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
  /** ADR-777 §8.60.20 — λειτουργική κατάσταση (`''` = αδήλωτη). */
  operationalStatus: OperationalStatusDraft;
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

export const PARKING_TYPES: SelectOption<ParkingSpotType>[] = [
  { value: 'standard', labelKey: 'general.types.standard' },
  { value: 'handicapped', labelKey: 'general.types.handicapped' },
  { value: 'motorcycle', labelKey: 'general.types.motorcycle' },
  { value: 'electric', labelKey: 'general.types.electric' },
  { value: 'visitor', labelKey: 'general.types.visitor' },
];

// ============================================================================
// HELPERS
// ============================================================================

export function buildFormState(parking: ParkingSpot): ParkingFormState {
  return {
    name: parking.number || '',
    code: parking.code || '',
    type: parking.type || DEFAULT_PARKING_TYPE,
    operationalStatus: operationalDraftOf(parking),
    floor: parking.floor || '',
    location: parking.location || '',
    area: parking.area !== undefined ? String(parking.area) : '',
    description: parking.description || '',
    notes: parking.notes || '',
  };
}
