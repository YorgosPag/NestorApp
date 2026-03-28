import type React from 'react';
import type { Storage, StorageType, StorageStatus } from '@/types/storage/contracts';

// ============================================================================
// INTERFACES
// ============================================================================

export interface StorageGeneralTabProps {
  storage: Storage;
  /** Inline editing active (from parent via globalProps) */
  isEditing?: boolean;
  /** Notify parent when editing state changes */
  onEditingChange?: (editing: boolean) => void;
  /** Ref for save delegation from header button */
  onSaveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  /** Create mode: POST new entity instead of PATCH existing */
  createMode?: boolean;
  /** Callback when entity is created successfully (create mode only) */
  onCreated?: (id: string) => void;
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

export interface StoragePatchResult {
  id: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const STORAGE_TYPES: { value: StorageType; labelKey: string }[] = [
  { value: 'large', labelKey: 'general.types.large' },
  { value: 'small', labelKey: 'general.types.small' },
  { value: 'basement', labelKey: 'general.types.basement' },
  { value: 'ground', labelKey: 'general.types.ground' },
  { value: 'special', labelKey: 'general.types.special' },
  { value: 'storage', labelKey: 'general.types.storage' },
  { value: 'garage', labelKey: 'general.types.garage' },
  { value: 'warehouse', labelKey: 'general.types.warehouse' },
];

export const STORAGE_STATUSES: { value: StorageStatus; labelKey: string }[] = [
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
    type: storage.type || 'storage',
    status: storage.status || 'available',
    floor: storage.floor || '',
    floorId: storage.floorId || '',
    area: storage.area !== undefined ? String(storage.area) : '',
    price: storage.price !== undefined ? String(storage.price) : '',
    description: storage.description || '',
    notes: storage.notes || '',
  };
}
