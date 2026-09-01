import type { FilterPanelConfig, PropertyListFilterState } from '../types';
import {
  BUILDING_FILTER_FIELD,
  FLOOR_FILTER_FIELD,
  PROJECT_FILTER_FIELD,
  PROPERTY_FEATURE_FILTERS,
  propertyTypeFilterField,
} from './property-filter-fields';
import { COMMON_FILTER_LABELS, FL, FT, PROPERTY_FILTER_LABELS, SP, UNIFIED_STATUS_FILTER_LABELS } from './shared';

export const propertyListFiltersConfig: FilterPanelConfig = {
  title: FT.units,
  searchPlaceholder: SP.units_search,
  i18nNamespace: "filters", // 🏢 ENTERPRISE: Labels (AFO/SP/FT/RL/FL) all prefix "filters." → load from filters.json. Cross-namespace keys use explicit "ns:key" syntax.
  rows: [
    {
      id: "basic-filters",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: SP.general,
          width: 1,
          ariaLabel: "Search by name or description",
        },
        // ❌ REMOVED: priceRange filter (commercial data - domain separation)
        // {
        //   id: 'priceRange',
        //   type: 'range',
        //   label: FL.price_range,
        //   width: 1,
        //   ariaLabel: 'Price range filter'
        // },
        // Migration: PR1.1 - Units Filter Cleanup
        {
          id: "areaRange",
          type: "range",
          label: FL.area_range,
          width: 1,
          ariaLabel: "Area range filter",
          // 🏢 ENTERPRISE: Enable dropdown mode με predefined area values
          dropdownMode: true,
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          width: 1,
          ariaLabel: "Operational status filter",
          // ✅ DOMAIN SEPARATION: Operational statuses (physical truth)
          // Removed sales statuses (for-sale/sold/reserved)
          // 🏢 PR1.2: i18n keys directly (avoid circular dependency)
          options: [
            { value: "all", label: "filters.allStatuses" },
            { value: "ready", label: "properties-enums:operationalStatus.ready" },
            {
              value: "under-construction",
              label: "properties-enums:operationalStatus.underConstruction",
            },
            {
              value: "inspection",
              label: "properties-enums:operationalStatus.inspection",
            },
            {
              value: "maintenance",
              label: "properties-enums:operationalStatus.maintenance",
            },
            { value: "draft", label: "properties-enums:operationalStatus.draft" },
          ],
        },
      ],
    },
    {
      id: "secondary-filters",
      fields: [
        PROJECT_FILTER_FIELD,
        BUILDING_FILTER_FIELD,
        FLOOR_FILTER_FIELD,
        propertyTypeFilterField("type"),
      ],
    },
  ],
  advancedFilters: PROPERTY_FEATURE_FILTERS,
};

// Contact Filters Configuration
// [ENTERPRISE]: 100% centralized labels - ZERO hardcoded values

export const propertyFiltersConfig: FilterPanelConfig = {
  title: "propertiesTitle",
  searchPlaceholder: "placeholders.propertiesSearch",
  i18nNamespace: "filters", // 🏢 ENTERPRISE: Filters domain namespace (filter labels live in filters.json)
  rows: [
    {
      id: "property-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: "placeholders.propertiesSearch",
          ariaLabel: "Search properties",
          width: 1,
        },
        {
          id: "propertyType",
          type: "select",
          label: FL.property_type,
          placeholder: SP.type_placeholder,
          ariaLabel: "Property type filter",
          width: 1,
          options: [
            { value: "all", label: PROPERTY_FILTER_LABELS.ALL_TYPES },
            { value: "apartment", label: "properties.types.apartment" },
            { value: "maisonette", label: "properties.types.maisonette" },
            { value: "studio", label: "properties.types.studio" },
            { value: "shop", label: "properties.types.shop" },
            { value: "office", label: "properties.types.office" },
          ],
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          ariaLabel: "Property status filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_STATUSES },
            {
              value: "available",
              label: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE,
            },
            { value: "reserved", label: UNIFIED_STATUS_FILTER_LABELS.RESERVED },
            { value: "sold", label: UNIFIED_STATUS_FILTER_LABELS.SOLD },
          ],
        },
      ],
    },
    {
      /**
       * ADR-840 §4.1 — **Η ΣΕΙΡΑ ΠΟΥ ΕΛΕΙΠΕ.** Ο πίνακας αυτός δεν είχε «έργο» ούτε
       * «κτίριο»: όχι από απόφαση, αλλά επειδή ο τύπος του δεν είχε τα πεδία, άρα ο
       * χειρόγραφος μεταφραστής δεν είχε τι να μεταφέρει. Η μηχανή από κάτω τα
       * υποστήριζε **πάντα** (`FilterState.project` / `.building`).
       *
       * ⚠️ Οι επιλογές εδώ είναι **μόνο η βάση**: τις πραγματικές τις εγχέει το
       * `usePropertyFiltersConfig` από τα ίδια τα ακίνητα. Πίνακας με μοναδική επιλογή
       * «όλα» είναι διακοσμητικός — ζήτα τον hook, μη χρησιμοποιείς τη σταθερά ωμή.
       */
      id: "property-location",
      fields: [PROJECT_FILTER_FIELD, BUILDING_FILTER_FIELD],
    },
    {
      id: "property-ranges",
      fields: [
        {
          id: "priceRange",
          type: "range",
          label: FL.price_range,
          ariaLabel: "Price range filter",
          width: 1,
          min: parseInt(process.env.NEXT_PUBLIC_FILTER_PRICE_MIN || "0"),
          max: parseInt(process.env.NEXT_PUBLIC_FILTER_PRICE_MAX || "2000000"),
        },
        {
          id: "areaRange",
          type: "range",
          label: FL.area_range,
          ariaLabel: "Area range filter",
          width: 1,
          dropdownMode: true,
          min: parseInt(process.env.NEXT_PUBLIC_FILTER_AREA_MIN || "0"),
          max: parseInt(process.env.NEXT_PUBLIC_FILTER_AREA_MAX || "500"),
        },
        FLOOR_FILTER_FIELD,
      ],
    },
  ],
  advancedFilters: PROPERTY_FEATURE_FILTERS,
};

/**
 * 🔴 **ΤΟ `defaultPropertyFilters` ΔΙΑΓΡΑΦΗΚΕ** (ADR-840 Σ1).
 *
 * Ήταν **δεύτερη μηδενική τιμή** για την ίδια έννοια: το `DEFAULT_FILTERS` του
 * `types/property-viewer.ts` υπάρχει ήδη, δίπλα στον τύπο του, και είναι **υπερσύνολο**
 * (έχει `project` · `building` · `coverage`). Δύο μηδενικές τιμές σημαίνουν δύο
 * απαντήσεις στο *«τι σημαίνει άδειο φίλτρο;»*, και ο «καθαρισμός» κατέληγε σε άλλη
 * κατάσταση ανάλογα με το ποια από τις δύο ρώτησε ο καλών.
 *
 * ➜ Ζήτα το `DEFAULT_FILTERS` από το `@/types/property-viewer`.
 */

// Default filter states - unchanged for backward compatibility
export const defaultUnitFilters: PropertyListFilterState = {
  searchTerm: "",
  project: [],
  building: [],
  floor: [],
  type: [],
  status: [],
  priceRange: { min: undefined, max: undefined },
  areaRange: { min: undefined, max: undefined },
  features: [],
};

