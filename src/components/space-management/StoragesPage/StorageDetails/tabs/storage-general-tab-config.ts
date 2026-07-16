/**
 * storage-general-tab-config — types, option lists and form seeding for
 * `StorageGeneralTab`.
 *
 * Config-only counterpart of `parking-general-tab-config.ts` (same archetype,
 * different schema — ADR-588 keeps the two forms separate on purpose).
 *
 * @module components/space-management/StoragesPage/StorageDetails/tabs/storage-general-tab-config
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';
import type { SelectOption } from '@/components/shared/space-info/OptionSelectField';
import type { SpaceGeneralTabProps } from '@/components/shared/space-info/space-general-tab-contracts';

// ============================================================================
// INTERFACES
// ============================================================================

export interface StorageGeneralTabProps extends SpaceGeneralTabProps {
  storage: Storage;
}

export interface StorageFormState {
  name: string;
  /** ADR-233: Entity coding system */
  code: string;
  type: StorageType;
  status: StorageStatus;
  floor: string;
  floorId: string;
  area: string;
  price: string;
  description: string;
  notes: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_STORAGE_TYPE: StorageType = 'storage';
export const DEFAULT_STORAGE_STATUS: StorageStatus = 'available';

export const STORAGE_TYPES: SelectOption<StorageType>[] = [
  { value: 'large', labelKey: 'general.types.large' },
  { value: 'small', labelKey: 'general.types.small' },
  { value: 'basement', labelKey: 'general.types.basement' },
  { value: 'ground', labelKey: 'general.types.ground' },
  { value: 'special', labelKey: 'general.types.special' },
  { value: 'storage', labelKey: 'general.types.storage' },
  { value: 'garage', labelKey: 'general.types.garage' },
  { value: 'warehouse', labelKey: 'general.types.warehouse' },
];

export const STORAGE_STATUSES: SelectOption<StorageStatus>[] = [
  { value: 'available', labelKey: 'general.statuses.available' },
  { value: 'occupied', labelKey: 'general.statuses.occupied' },
  { value: 'maintenance', labelKey: 'general.statuses.maintenance' },
  { value: 'reserved', labelKey: 'general.statuses.reserved' },
  { value: 'sold', labelKey: 'general.statuses.sold' },
  { value: 'unavailable', labelKey: 'general.statuses.unavailable' },
];

// ============================================================================
// HELPERS
// ============================================================================

export function buildFormState(storage: Storage): StorageFormState {
  return {
    name: storage.name || '',
    code: storage.code || '',
    type: storage.type || DEFAULT_STORAGE_TYPE,
    status: storage.status || DEFAULT_STORAGE_STATUS,
    floor: storage.floor || '',
    floorId: storage.floorId || '',
    area: storage.area !== undefined ? String(storage.area) : '',
    price: storage.price !== undefined ? String(storage.price) : '',
    description: storage.description || '',
    notes: storage.notes || '',
  };
}
