// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
import type { StorageUnit, StorageType } from './contracts';

const BASE_STORAGE_FEATURES = [
  'storage.features.electricity',
  'storage.features.naturalLight',
  'storage.features.artificialLight',
  'storage.features.airChamber',
  'storage.features.security',
  'storage.features.elevatorAccess',
  'storage.features.plumbing',
  'storage.features.airConditioning',
  'storage.features.alarm'
] as const;

// Common storage features by type (i18n keys)
export const commonStorageFeatures: Record<StorageType, string[]> = {
  storage: [...BASE_STORAGE_FEATURES],
  large: [...BASE_STORAGE_FEATURES],
  small: [...BASE_STORAGE_FEATURES],
  basement: [...BASE_STORAGE_FEATURES],
  ground: [...BASE_STORAGE_FEATURES],
  special: [...BASE_STORAGE_FEATURES],
  garage: [...BASE_STORAGE_FEATURES],
  warehouse: [...BASE_STORAGE_FEATURES],
  parking: [
    'storage.features.evCharger',
    'storage.features.enclosed',
    'storage.features.lighting',
    'storage.features.security',
    'storage.features.easyAccess'
  ]
};

// Type labels (i18n keys)
export const typeLabels: Record<StorageType, string> = {
  storage: 'storage.types.storage',
  parking: 'storage.types.parking',
  large: 'storage.types.large',
  small: 'storage.types.small',
  basement: 'storage.types.basement',
  ground: 'storage.types.ground',
  special: 'storage.types.special',
  garage: 'storage.types.garage',
  warehouse: 'storage.types.warehouse'
};

// ADR-903 §6 — εδώ ζούσε το `standardFloors` (κλειδιά `storage.floors.*` που δεν υπήρξαν ποτέ στα locales).
// Ο όροφος αποθήκης είναι ο όροφος του κτιρίου (`floorId`)· η ετικέτα από το `useFloorLabel`.

// 🗑️ REMOVED: STORAGE_FILTER_LABELS - Use @/constants/property-statuses-enterprise
//
// Migration completed to centralized system.
// All imports should use: import { STORAGE_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
