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

import { PARKING_TYPES } from '@/types/parking';
import type { FilterPanelConfig } from '../types';
import { DEFAULT_SPACE_FILTERS, type SpaceFilterState } from './space-filter-state';
import { spaceStatusFilterFields } from './unit-status-filter-options';
import {
  COMMON_FILTER_LABELS,
  PROPERTY_FILTER_LABELS,
  PARKING_FILTER_LABELS
} from '@/constants/property-statuses-enterprise';

// Κατάσταση + προεπιλογή: η ΜΙΑ δήλωση του βοηθητικού χώρου (N.18, ADR-777 §8.60.14.14).
export type ParkingFilterState = SpaceFilterState;
export const defaultParkingFilters: ParkingFilterState = DEFAULT_SPACE_FILTERS;

// =============================================================================
// 🅿️ PARKING TYPE LABELS (Enterprise Centralized)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// =============================================================================

export const PARKING_TYPE_LABELS = {
  standard: 'parking.types.standard',
  handicapped: 'parking.types.handicapped',
  motorcycle: 'parking.types.motorcycle',
  electric: 'parking.types.electric',
  visitor: 'parking.types.visitor'
} as const;

/**
 * Οι επιλογές τύπου θέσης — **μία** λίστα για panel **και** toolbar (ήταν γραμμένη δύο φορές,
 * CHECK 3.28). Παράγεται από το `PARKING_TYPES`, ώστε νέος τύπος να μπαίνει παντού μαζί.
 */
export const PARKING_TYPE_FILTER_OPTIONS = PARKING_TYPES.map((type) => ({
  value: type,
  label: PARKING_TYPE_LABELS[type],
}));

// 🧹 Εδώ ζούσε το `PARKING_STATUS_LABELS` πάνω στο παλιό ανάμεικτο `status` (ADR-777 §8.60.20).
// Οι επιλογές κατάστασης ζουν πλέον ΜΙΑ φορά: `unit-status-filter-options.ts`.

// =============================================================================
// 🅿️ PARKING FLOOR LABELS (Enterprise Centralized)
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// =============================================================================

// ADR-903 §6 — ο πίνακας `PARKING_FLOOR_LABELS` (σταθερές επιλογές ορόφου) διαγράφηκε: οι όροφοι
// προκύπτουν από τα δεδομένα (`useFloorFilterConfig`) με την ΕΝΑ ετικέτα (`useFloorLabel`).

// =============================================================================
// 🅿️ PARKING FILTERS CONFIGURATION
// =============================================================================

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
export const parkingFiltersConfig: FilterPanelConfig = {
  title: 'parking.title',
  searchPlaceholder: 'parking.searchPlaceholder',
  i18nNamespace: 'filters',
  rows: [
    {
      id: 'parking-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'filters.common.search',
          placeholder: 'filters.parking.searchPlaceholder',
          ariaLabel: 'filters.parking.ariaLabels.search',
          width: 2
        },
        // ADR-777 §8.60.20 — διάθεση + λειτουργία: οι ΔΥΟ όψεις από ΕΝΑ σημείο (ίδιες με τις αποθήκες/θέσεις).
        ...spaceStatusFilterFields('filters.parking.ariaLabels.status'),
        {
          id: 'type',
          type: 'select',
          label: 'filters.common.type',
          placeholder: 'filters.common.selectType',
          ariaLabel: 'filters.parking.ariaLabels.type',
          width: 1,
          options: [
            { value: 'all', label: COMMON_FILTER_LABELS.ALL_STATUSES },
            ...PARKING_TYPE_FILTER_OPTIONS,
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
          label: 'filters.common.building',
          placeholder: 'filters.common.selectBuilding',
          ariaLabel: 'filters.parking.ariaLabels.building',
          width: 1,
          options: [
            { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_BUILDINGS }
            // Dynamic options θα προστεθούν από τα buildings data
          ]
        },
        {
          id: 'floor',
          type: 'select',
          label: 'filters.common.level',
          placeholder: 'filters.common.selectLevel',
          ariaLabel: 'filters.parking.ariaLabels.level',
          width: 1,
          options: [
            // ADR-903 §6 — οι όροφοι ΠΡΟΚΥΠΤΟΥΝ από τα δεδομένα (`useFloorFilterConfig`)· η πυλωτή/το
            // δώμα ως ΖΩΝΗ θέσης φιλτράρονται από το `locationZone`, όχι εδώ.
            { value: 'all', label: PARKING_FILTER_LABELS.ALL_LEVELS },
          ]
        },
        {
          id: 'project',
          type: 'select',
          label: 'filters.common.project',
          placeholder: 'filters.common.selectProject',
          ariaLabel: 'filters.parking.ariaLabels.project',
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
          label: 'filters.common.area',
          placeholder: { min: 'filters.common.from', max: 'filters.common.to' },
          ariaLabel: 'filters.parking.ariaLabels.area',
          width: 1,
          range: { min: 0, max: 50, step: 1 }
        },
        {
          id: 'ranges.priceRange',
          type: 'priceRange',
          label: 'filters.common.price',
          placeholder: { min: 'filters.common.from', max: 'filters.common.to' },
          ariaLabel: 'filters.parking.ariaLabels.price',
          width: 1,
          range: { min: 0, max: 50000, step: 1000 }
        },
        {
          id: 'ranges.dateRange',
          type: 'daterange',
          label: 'filters.common.updateDate',
          placeholder: { start: 'filters.common.from', end: 'filters.common.to' },
          ariaLabel: 'filters.parking.ariaLabels.date',
          width: 1
        }
      ]
    }
  ]
};
