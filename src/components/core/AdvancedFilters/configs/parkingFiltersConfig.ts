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

// 🔴 ADR-823 §14 — ΤΡΙΑ ΚΛΕΙΔΙΑ ΠΟΥ ΔΕΝ ΥΠΗΡΞΑΝ ΠΟΤΕ (μετρημένο 2026-08-27)
//
// Τα `building.floors.pilotis` · `.first` · `.rooftop` **δεν υπάρχουν** στο
// `building.json`, σε καμία από τις δύο γλώσσες. Έβγαιναν **ωμά** στην οθόνη.
//
// ⚠️ **ΔΕΝ προστέθηκαν νέα κλειδιά** — υπήρχαν ήδη, αλλού:
//   • `pilotis` / `rooftop` → `parking:locationZone.*`  («Πυλωτή» · «Δώμα»)
//     Σωστό και **σημασιολογικά**: για θέση στάθμευσης η πυλωτή και το δώμα είναι
//     **ζώνες θέσης**, όχι όροφοι κτιρίου.
//   • `first` → `building:floors.floor1`  («1ος Όροφος»)
//
// Νέο κλειδί εκεί που υπάρχει ήδη μετάφραση = διπλότυπο (N.12).
export const PARKING_FLOOR_LABELS = {
  'basement-2': 'building.floors.basementMinus2',
  'basement-1': 'building.floors.basementMinus1',
  ground: 'building.floors.ground',
  pilotis: 'parking.locationZone.pilotis',
  first: 'building.floors.floor1',
  rooftop: 'parking.locationZone.rooftop'
} as const;

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
