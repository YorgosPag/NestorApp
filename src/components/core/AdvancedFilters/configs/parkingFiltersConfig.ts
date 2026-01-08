/**
 * 🅿️ ENTERPRISE PARKING FILTERS CONFIGURATION
 *
 * Single source of truth για όλα τα parking filter settings
 * Ακολουθεί το exact pattern από storageFiltersConfig.ts
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (REAL_ESTATE_HIERARCHY_DOCUMENTATION.md):
 * - Parking είναι παράλληλη κατηγορία με Units/Storage μέσα στο Building
 * - ΟΧΙ children των Units
 * - Ισότιμη οντότητα στην πλοήγηση
 */

import type { FilterPanelConfig } from '../types';
import {
  UNIFIED_STATUS_FILTER_LABELS,
  COMMON_FILTER_LABELS,
  PROPERTY_FILTER_LABELS,
  PARKING_FILTER_LABELS
} from '@/constants/property-statuses-enterprise';

// =============================================================================
// 🅿️ PARKING FILTER STATE TYPE
// =============================================================================

export interface ParkingFilterState {
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

// =============================================================================
// 🅿️ DEFAULT PARKING FILTERS
// =============================================================================

export const defaultParkingFilters: ParkingFilterState = {
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

// =============================================================================
// 🅿️ PARKING TYPE LABELS (Enterprise Centralized)
// =============================================================================

export const PARKING_TYPE_LABELS = {
  standard: 'Τυπική',
  handicapped: 'ΑμεΑ',
  motorcycle: 'Μηχανή/Σκούτερ',
  electric: 'Ηλεκτρικό Όχημα',
  visitor: 'Επισκέπτη'
} as const;

// =============================================================================
// 🅿️ PARKING STATUS LABELS (Enterprise Centralized)
// =============================================================================

export const PARKING_STATUS_LABELS = {
  available: 'Διαθέσιμη',
  occupied: 'Κατειλημμένη',
  reserved: 'Κρατημένη',
  sold: 'Πωλημένη',
  maintenance: 'Συντήρηση'
} as const;

// =============================================================================
// 🅿️ PARKING FLOOR LABELS (Enterprise Centralized)
// =============================================================================

export const PARKING_FLOOR_LABELS = {
  'basement-2': 'Υπόγειο -2',
  'basement-1': 'Υπόγειο -1',
  ground: 'Ισόγειο',
  pilotis: 'Πιλοτή',
  first: '1ος Όροφος',
  rooftop: 'Δώμα'
} as const;

// =============================================================================
// 🅿️ PARKING FILTERS CONFIGURATION
// =============================================================================

export const parkingFiltersConfig: FilterPanelConfig = {
  title: 'Φίλτρα Θέσεων Στάθμευσης',
  searchPlaceholder: 'Κωδικός, τοποθεσία, σημειώσεις...',
  rows: [
    {
      id: 'parking-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'Αναζήτηση',
          placeholder: 'Κωδικός, τοποθεσία, σημειώσεις...',
          ariaLabel: 'Αναζήτηση θέσεων στάθμευσης',
          width: 2
        },
        {
          id: 'status',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλέξτε κατάσταση',
          ariaLabel: 'Φίλτρο κατάστασης θέσης',
          width: 1,
          options: [
            { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: 'available', label: PARKING_STATUS_LABELS.available },
            { value: 'occupied', label: PARKING_STATUS_LABELS.occupied },
            { value: 'reserved', label: PARKING_STATUS_LABELS.reserved },
            { value: 'sold', label: PARKING_STATUS_LABELS.sold },
            { value: 'maintenance', label: PARKING_STATUS_LABELS.maintenance }
          ]
        },
        {
          id: 'type',
          type: 'select',
          label: 'Τύπος',
          placeholder: 'Επιλέξτε τύπο',
          ariaLabel: 'Φίλτρο τύπου θέσης',
          width: 1,
          options: [
            { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: 'standard', label: PARKING_TYPE_LABELS.standard },
            { value: 'handicapped', label: PARKING_TYPE_LABELS.handicapped },
            { value: 'motorcycle', label: PARKING_TYPE_LABELS.motorcycle },
            { value: 'electric', label: PARKING_TYPE_LABELS.electric },
            { value: 'visitor', label: PARKING_TYPE_LABELS.visitor }
          ]
        }
      ]
    },
    {
      id: 'parking-location',
      fields: [
        {
          id: 'building',
          type: 'select',
          label: 'Κτίριο',
          placeholder: 'Επιλέξτε κτίριο',
          ariaLabel: 'Φίλτρο κτιρίου',
          width: 1,
          options: [
            { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_BUILDINGS }
            // Dynamic options θα προστεθούν από τα buildings data
          ]
        },
        {
          id: 'floor',
          type: 'select',
          label: 'Επίπεδο',
          placeholder: 'Επιλέξτε επίπεδο',
          ariaLabel: 'Φίλτρο επιπέδου',
          width: 1,
          options: [
            { value: 'all', label: PARKING_FILTER_LABELS.ALL_LEVELS },
            { value: 'basement-2', label: PARKING_FLOOR_LABELS['basement-2'] },
            { value: 'basement-1', label: PARKING_FLOOR_LABELS['basement-1'] },
            { value: 'ground', label: PARKING_FLOOR_LABELS.ground },
            { value: 'pilotis', label: PARKING_FLOOR_LABELS.pilotis },
            { value: 'first', label: PARKING_FLOOR_LABELS.first },
            { value: 'rooftop', label: PARKING_FLOOR_LABELS.rooftop }
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
            { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_PROJECTS }
            // Dynamic options θα προστεθούν από τα projects data
          ]
        }
      ]
    },
    {
      id: 'parking-ranges',
      fields: [
        {
          id: 'ranges.areaRange',
          type: 'range',
          label: 'Εμβαδόν (m²)',
          placeholder: { min: 'Από', max: 'Έως' },
          ariaLabel: 'Φίλτρο εμβαδού',
          width: 1,
          range: { min: 0, max: 50, step: 1 }
        },
        {
          id: 'ranges.priceRange',
          type: 'range',
          label: 'Τιμή (€)',
          placeholder: { min: 'Από', max: 'Έως' },
          ariaLabel: 'Φίλτρο τιμής',
          width: 1,
          range: { min: 0, max: 50000, step: 1000 }
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
