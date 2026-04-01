import type { FilterPanelConfig, PropertyFilterState, PropertyListFilterState } from '../types';
import { AFO, COMMON_FILTER_LABELS, FL, FT, PROPERTY_FILTER_LABELS, SP, UNIFIED_STATUS_FILTER_LABELS } from './shared';

export const propertyListFiltersConfig: FilterPanelConfig = {
  title: FT.units,
  searchPlaceholder: SP.units_search,
  i18nNamespace: "properties", // 🏢 ENTERPRISE: Properties domain namespace (ADR-269)
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
            { value: "ready", label: "units.operationalStatus.ready" },
            {
              value: "under-construction",
              label: "units.operationalStatus.underConstruction",
            },
            {
              value: "inspection",
              label: "units.operationalStatus.inspection",
            },
            {
              value: "maintenance",
              label: "units.operationalStatus.maintenance",
            },
            { value: "draft", label: "units.operationalStatus.draft" },
          ],
        },
      ],
    },
    {
      id: "secondary-filters",
      fields: [
        {
          id: "project",
          type: "select",
          label: FL.project,
          placeholder: SP.project_placeholder,
          width: 1,
          ariaLabel: "Project filter",
          options: [
            { value: "all", label: PROPERTY_FILTER_LABELS.ALL_PROJECTS },
          ],
        },
        {
          id: "building",
          type: "select",
          label: FL.building,
          placeholder: SP.building_placeholder,
          width: 1,
          ariaLabel: "Building filter",
          options: [
            { value: "all", label: PROPERTY_FILTER_LABELS.ALL_BUILDINGS },
          ],
        },
        {
          id: "floor",
          type: "select",
          label: FL.floor,
          placeholder: SP.floor_placeholder,
          width: 1,
          ariaLabel: "Floor filter",
          options: [{ value: "all", label: PROPERTY_FILTER_LABELS.ALL_FLOORS }],
        },
        {
          id: "type",
          type: "select",
          label: FL.property_type,
          placeholder: SP.type_placeholder,
          width: 1,
          ariaLabel: "Property type filter",
          options: [{ value: "all", label: PROPERTY_FILTER_LABELS.ALL_TYPES }],
        },
      ],
    },
  ],
  advancedFilters: {
    show: true,
    title: FT.advanced,
    options: [
      { id: "parking", label: AFO.parking, category: "features" },
      { id: "storage", label: AFO.storage, category: "features" },
      { id: "fireplace", label: AFO.fireplace, category: "features" },
      { id: "view", label: AFO.view, category: "features" },
      { id: "pool", label: AFO.pool, category: "features" },
    ],
    categories: ["features"],
  },
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
        {
          id: "floor",
          type: "select",
          label: FL.floor,
          placeholder: SP.floor_placeholder,
          ariaLabel: "Floor filter",
          width: 1,
          options: [{ value: "all", label: PROPERTY_FILTER_LABELS.ALL_FLOORS }],
        },
      ],
    },
  ],
  advancedFilters: {
    show: true,
    title: FT.advanced,
    options: [
      { id: "parking", label: AFO.parking, category: "features" },
      { id: "storage", label: AFO.storage, category: "features" },
      { id: "view", label: AFO.view, category: "features" },
      { id: "fireplace", label: AFO.fireplace, category: "features" },
    ],
    categories: ["features"],
  },
};

// Default Property Filters
export const defaultPropertyFilters: PropertyFilterState = {
  searchTerm: "",
  propertyType: [],
  status: [],
  priceRange: { min: undefined, max: undefined },
  areaRange: { min: undefined, max: undefined },
  floor: [],
  features: [],
};

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

