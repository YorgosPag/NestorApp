// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
import type { StorageUnit, StorageType, StorageStatus } from './contracts';

// Export default storage unit template
export const defaultStorageUnit: Partial<StorageUnit> = {
  type: 'storage',
  status: 'available',
  floor: 'storage.floors.basement', // i18n key
  area: 0,
  price: 0,
  linkedProperty: null,
  coordinates: { x: 0, y: 0 },
  features: [],
  description: '',
  notes: ''
};

// Common storage features by type (i18n keys)
export const commonStorageFeatures: Record<StorageType, string[]> = {
  storage: [
    'storage.features.electricity',
    'storage.features.naturalLight',
    'storage.features.artificialLight',
    'storage.features.airChamber',
    'storage.features.security',
    'storage.features.elevatorAccess',
    'storage.features.plumbing',
    'storage.features.airConditioning',
    'storage.features.alarm'
  ],
  parking: [
    'storage.features.evCharger',
    'storage.features.enclosed',
    'storage.features.lighting',
    'storage.features.security',
    'storage.features.easyAccess'
  ]
};

// Status labels (i18n keys)
export const statusLabels: Record<StorageStatus, string> = {
  available: 'storage.status.available',
  sold: 'storage.status.sold',
  reserved: 'storage.status.reserved',
  maintenance: 'storage.status.maintenance'
};

// Type labels (i18n keys)
export const typeLabels: Record<StorageType, string> = {
  storage: 'storage.types.storage',
  parking: 'storage.types.parking'
};

// Standard floor names (i18n keys)
export const standardFloors: string[] = [
  'storage.floors.basement3',
  'storage.floors.basement2',
  'storage.floors.basement1',
  'storage.floors.basement',
  'storage.floors.ground',
  'storage.floors.floor1',
  'storage.floors.floor2',
  'storage.floors.floor3',
  'storage.floors.floor4',
  'storage.floors.floor5',
  'storage.floors.floor6',
  'storage.floors.floor7',
  'storage.floors.floor8',
  'storage.floors.floor9'
];

// 🗑️ REMOVED: STORAGE_FILTER_LABELS - Use @/constants/property-statuses-enterprise
//
// Migration completed to centralized system.
// All imports should use: import { STORAGE_FILTER_LABELS } from '@/constants/property-statuses-enterprise';
