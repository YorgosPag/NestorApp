import type { FilterPanelConfig } from '../types';
import { GEOGRAPHIC_CONFIG } from '@/config/geo-constants';
import {
  UNIFIED_STATUS_FILTER_LABELS,
  COMMON_FILTER_LABELS,
  PROPERTY_FILTER_LABELS,
  STORAGE_LABELS
} from '@/constants/property-statuses-enterprise';

// Storage Filter State Type
export interface StorageFilterState {
  searchTerm?: string;
  status?: string[];
  type?: string[];
  building?: string[];
  floor?: string[];
  project?: string[];
  ranges?: {
    areaRange?: { min?: number; max?: number };
    priceRange?: { min?: number; max?: number };
    dateRange?: { start?: Date; end?: Date };
  };
}

// Default Storage Filters
export const defaultStorageFilters: StorageFilterState = {
  searchTerm: '',
  status: [],
  type: [],
  building: [],
  floor: [],
  project: [],
  ranges: {
    areaRange: { min: undefined, max: undefined },
    priceRange: { min: undefined, max: undefined },
    dateRange: { start: undefined, end: undefined }
  }
};

// Storage Filters Configuration
export const storageFiltersConfig: FilterPanelConfig = {
  title: 'Φίλτρα Αποθηκών',
  searchPlaceholder: 'Όνομα, περιγραφή, κτίριο...',
  rows: [
    {
      id: 'storage-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'Αναζήτηση',
          placeholder: 'Όνομα, περιγραφή, κτίριο...',
          ariaLabel: 'Αναζήτηση αποθηκών',
          width: 2
        },
        {
          id: 'status',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλέξτε κατάσταση',
          ariaLabel: 'Φίλτρο κατάστασης αποθήκης',
          width: 1,
          options: [
            { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: 'available', label: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE },
            { value: 'occupied', label: UNIFIED_STATUS_FILTER_LABELS.OCCUPIED },
            { value: 'maintenance', label: UNIFIED_STATUS_FILTER_LABELS.MAINTENANCE },
            { value: 'reserved', label: UNIFIED_STATUS_FILTER_LABELS.RESERVED }
          ]
        },
        {
          id: 'type',
          type: 'select',
          label: 'Τύπος',
          placeholder: 'Επιλέξτε τύπο',
          ariaLabel: 'Φίλτρο τύπου αποθήκης',
          width: 1,
          options: [
            { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: 'large', label: STORAGE_LABELS.LARGE },
            { value: 'small', label: STORAGE_LABELS.SMALL },
            { value: 'basement', label: STORAGE_LABELS.BASEMENT_STORAGE },
            { value: 'ground', label: STORAGE_LABELS.GROUND_STORAGE },
            { value: 'special', label: STORAGE_LABELS.SPECIAL_STORAGE }
          ]
        }
      ]
    },
    {
      id: 'storage-location',
      fields: [
        {
          id: 'building',
          type: 'select',
          label: 'Κτίριο',
          placeholder: 'Επιλέξτε κτίριο',
          ariaLabel: 'Φίλτρο κτιρίου',
          width: 1,
          options: [
            { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_BUILDINGS },
            { value: 'building-a', label: STORAGE_LABELS.BUILDING_A },
            { value: 'building-b', label: STORAGE_LABELS.BUILDING_B },
            { value: 'building-c', label: STORAGE_LABELS.BUILDING_C },
            { value: 'building-d', label: STORAGE_LABELS.BUILDING_D },
            { value: 'building-e', label: STORAGE_LABELS.BUILDING_E }
          ]
        },
        {
          id: 'floor',
          type: 'select',
          label: 'Όροφος',
          placeholder: 'Επιλέξτε όροφο',
          ariaLabel: 'Φίλτρο ορόφου',
          width: 1,
          options: [
            { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_FLOORS },
            { value: 'basement-2', label: STORAGE_LABELS.BASEMENT_MINUS_2 },
            { value: 'basement-1', label: STORAGE_LABELS.BASEMENT_MINUS_1 },
            { value: 'ground', label: STORAGE_LABELS.GROUND_FLOOR },
            { value: 'first', label: STORAGE_LABELS.FIRST_FLOOR },
            { value: 'second', label: STORAGE_LABELS.SECOND_FLOOR },
            { value: 'other', label: STORAGE_LABELS.OTHER_FLOORS }
          ]
        },
        {
          id: 'project',
          type: 'select',
          label: 'Έργο',
          placeholder: 'Επιλέξτε έργο',
          ariaLabel: 'Φίλτρο έργου',
          width: 1,
          options: [
            { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_PROJECTS },
            { value: 'project1', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_1_NAME || 'Έργο Α' },
            { value: 'project2', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_2_NAME || 'Έργο Β' },
            { value: 'project3', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_3_NAME || 'Έργο Γ' }
          ]
        }
      ]
    },
    {
      id: 'storage-ranges',
      fields: [
        {
          id: 'ranges.areaRange',
          type: 'range',
          label: 'Εμβαδόν (m²)',
          placeholder: { min: 'Από', max: 'Έως' },
          ariaLabel: 'Φίλτρο εμβαδού',
          width: 1,
          range: { min: 0, max: 200, step: 5 }
        },
        {
          id: 'ranges.priceRange',
          type: 'range',
          label: 'Τιμή (€)',
          placeholder: { min: 'Από', max: 'Έως' },
          ariaLabel: 'Φίλτρο τιμής',
          width: 1,
          range: { min: 0, max: 100000, step: 1000 }
        },
        {
          id: 'ranges.dateRange',
          type: 'dateRange',
          label: 'Ημερομηνία Ενημέρωσης',
          placeholder: { start: 'Από', end: 'Έως' },
          ariaLabel: 'Φίλτρο ημερομηνίας',
          width: 1
        }
      ]
    }
  ]
};