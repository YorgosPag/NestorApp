import type { FilterPanelConfig } from '../types';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import {
  UNIFIED_STATUS_FILTER_LABELS,
  COMMON_FILTER_LABELS,
  PROPERTY_FILTER_LABELS,
  STORAGE_LABELS
} from '@/constants/property-statuses-enterprise';

// Storage Filter State Type
// 🏢 ENTERPRISE: Added index signature for GenericFilterState compatibility
export interface StorageFilterState {
  [key: string]: unknown;
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
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const storageFiltersConfig: FilterPanelConfig = {
  title: 'filters.storage.title',
  searchPlaceholder: 'filters.storage.searchPlaceholder',
  rows: [
    {
      id: 'storage-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'filters.common.search',
          placeholder: 'filters.storage.searchPlaceholder',
          ariaLabel: 'filters.storage.ariaLabels.search',
          width: 2
        },
        {
          id: 'status',
          type: 'select',
          label: 'filters.common.status',
          placeholder: 'filters.common.selectStatus',
          ariaLabel: 'filters.storage.ariaLabels.status',
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
          label: 'filters.common.type',
          placeholder: 'filters.common.selectType',
          ariaLabel: 'filters.storage.ariaLabels.type',
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
          label: 'filters.common.building',
          placeholder: 'filters.common.selectBuilding',
          ariaLabel: 'filters.storage.ariaLabels.building',
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
          label: 'filters.common.floor',
          placeholder: 'filters.common.selectFloor',
          ariaLabel: 'filters.storage.ariaLabels.floor',
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
          label: 'filters.common.project',
          placeholder: 'filters.common.selectProject',
          ariaLabel: 'filters.storage.ariaLabels.project',
          width: 1,
          options: [
            { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_PROJECTS },
            { value: 'project1', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_1_NAME || 'storage.projects.projectA' },
            { value: 'project2', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_2_NAME || 'storage.projects.projectB' },
            { value: 'project3', label: process.env.NEXT_PUBLIC_SAMPLE_PROJECT_3_NAME || 'storage.projects.projectC' }
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
          label: 'filters.common.area',
          placeholder: { min: 'filters.common.from', max: 'filters.common.to' },
          ariaLabel: 'filters.storage.ariaLabels.area',
          width: 1,
          range: { min: 0, max: 200, step: 5 }
        },
        {
          id: 'ranges.priceRange',
          type: 'range',
          label: 'filters.common.price',
          placeholder: { min: 'filters.common.from', max: 'filters.common.to' },
          ariaLabel: 'filters.storage.ariaLabels.price',
          width: 1,
          range: { min: 0, max: 100000, step: 1000 }
        },
        {
          id: 'ranges.dateRange',
          type: 'dateRange',
          label: 'filters.common.updateDate',
          placeholder: { start: 'filters.common.from', end: 'filters.common.to' },
          ariaLabel: 'filters.storage.ariaLabels.date',
          width: 1
        }
      ]
    }
  ]
};