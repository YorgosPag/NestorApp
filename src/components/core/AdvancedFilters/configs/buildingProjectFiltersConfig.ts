import type { BuildingFilterState, FilterPanelConfig, ProjectFilterState } from '../types';
import {
  BUILDING_PROJECT_STATUS_LABELS,
  COMMON_FILTER_LABELS,
  FL,
  FT,
  PRIORITY_LABELS,
  PROJECT_TYPE_LABELS,
  PROPERTY_BUILDING_TYPE_LABELS,
  SP,
  UNIFIED_STATUS_FILTER_LABELS,
} from './shared';

export const buildingFiltersConfig: FilterPanelConfig = {
  title: FT.buildings,
  searchPlaceholder: SP.buildings_search,
  i18nNamespace: "filters", // 🏢 ENTERPRISE: Filters domain namespace
  rows: [
    {
      id: "building-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: SP.buildings_search,
          ariaLabel: "Search buildings",
          width: 2,
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          ariaLabel: "Building status filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: "active", label: UNIFIED_STATUS_FILTER_LABELS.ACTIVE },
            { value: "inactive", label: UNIFIED_STATUS_FILTER_LABELS.INACTIVE },
            { value: "pending", label: UNIFIED_STATUS_FILTER_LABELS.PENDING },
            {
              value: "maintenance",
              label: UNIFIED_STATUS_FILTER_LABELS.MAINTENANCE,
            },
            { value: "sold", label: UNIFIED_STATUS_FILTER_LABELS.SOLD },
            {
              value: "construction",
              label: UNIFIED_STATUS_FILTER_LABELS.CONSTRUCTION,
            },
            { value: "planning", label: UNIFIED_STATUS_FILTER_LABELS.PLANNING },
          ],
        },
        {
          id: "priority",
          type: "select",
          label: FL.priority,
          placeholder: SP.priority_placeholder,
          ariaLabel: "Priority filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_PRIORITIES },
            { value: "high", label: PRIORITY_LABELS.high },
            { value: "medium", label: PRIORITY_LABELS.medium },
            { value: "low", label: PRIORITY_LABELS.low },
            { value: "urgent", label: PRIORITY_LABELS.urgent },
          ],
        },
      ],
    },
    {
      id: "building-details",
      fields: [
        {
          id: "type",
          type: "select",
          label: FL.type,
          placeholder: SP.type_placeholder,
          ariaLabel: "Building type filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_TYPES },
            {
              value: "residential",
              label: PROPERTY_BUILDING_TYPE_LABELS.residential,
            },
            {
              value: "commercial",
              label: PROPERTY_BUILDING_TYPE_LABELS.commercial,
            },
            {
              value: "industrial",
              label: PROPERTY_BUILDING_TYPE_LABELS.industrial,
            },
            { value: "office", label: PROPERTY_BUILDING_TYPE_LABELS.office },
            { value: "mixed", label: PROPERTY_BUILDING_TYPE_LABELS.mixed },
            {
              value: "warehouse",
              label: PROPERTY_BUILDING_TYPE_LABELS.warehouse,
            },
            { value: "retail", label: PROPERTY_BUILDING_TYPE_LABELS.retail },
            { value: "hotel", label: PROPERTY_BUILDING_TYPE_LABELS.hotel },
          ],
        },
        {
          id: "project",
          type: "select",
          label: FL.project,
          placeholder: SP.project_placeholder,
          ariaLabel: "Project filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_PROJECTS },
            { value: "project1", label: "filters.sampleProjects.projectA" },
            { value: "project2", label: "filters.sampleProjects.projectB" },
            { value: "project3", label: "filters.sampleProjects.projectC" },
          ],
        },
        {
          id: "location",
          type: "select",
          label: FL.location,
          placeholder: SP.location_placeholder,
          ariaLabel: "Location filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_LOCATIONS },
            { value: "main-city", label: "filters.sampleCities.athens" },
            {
              value: "alternative-city",
              label: "filters.sampleCities.thessaloniki",
            },
            { value: "city3", label: "filters.sampleCities.patras" },
            { value: "city4", label: "filters.sampleCities.heraklion" },
            { value: "city5", label: "filters.sampleCities.volos" },
            { value: "city6", label: "filters.sampleCities.kavala" },
            { value: "city7", label: "filters.sampleCities.lamia" },
          ],
        },
        {
          id: "company",
          type: "select",
          label: FL.company,
          placeholder: SP.company_placeholder,
          ariaLabel: "Company filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_COMPANIES },
            { value: "company1", label: "filters.sampleCompanies.companyA" },
            { value: "company2", label: "filters.sampleCompanies.companyB" },
            { value: "company3", label: "filters.sampleCompanies.companyC" },
          ],
        },
      ],
    },
    {
      id: "building-ranges",
      fields: [
        {
          id: "valueRange",
          type: "range",
          label: FL.value_range,
          ariaLabel: "Value range filter",
          width: 1,
          min: parseInt(process.env.NEXT_PUBLIC_FILTER_VALUE_MIN || "0"),
          max: parseInt(process.env.NEXT_PUBLIC_FILTER_VALUE_MAX || "10000000"),
        },
        {
          id: "areaRange",
          type: "range",
          label: FL.area_range,
          ariaLabel: "Area range filter",
          width: 1,
          min: parseInt(process.env.NEXT_PUBLIC_FILTER_AREA_MIN || "0"),
          max: parseInt(process.env.NEXT_PUBLIC_FILTER_AREA_MAX || "10000"),
        },
        {
          id: "unitsRange",
          type: "range",
          label: FL.units_range,
          ariaLabel: "Units count range filter",
          width: 1,
          min: parseInt(process.env.NEXT_PUBLIC_FILTER_UNITS_MIN || "1"),
          max: parseInt(process.env.NEXT_PUBLIC_FILTER_UNITS_MAX || "500"),
        },
        {
          id: "yearRange",
          type: "range",
          label: FL.year_range,
          ariaLabel: "Construction year range filter",
          width: 1,
          min: parseInt(process.env.NEXT_PUBLIC_FILTER_YEAR_MIN || "1950"),
          max: parseInt(process.env.NEXT_PUBLIC_FILTER_YEAR_MAX || "2030"),
        },
      ],
    },
    {
      id: "building-features",
      fields: [
        {
          id: "hasParking",
          type: "checkbox",
          label: FL.has_parking,
          ariaLabel: "Has parking filter",
          width: 1,
        },
        {
          id: "hasElevator",
          type: "checkbox",
          label: FL.has_elevator,
          ariaLabel: "Has elevator filter",
          width: 1,
        },
        {
          id: "hasGarden",
          type: "checkbox",
          label: FL.has_garden,
          ariaLabel: "Has garden filter",
          width: 1,
        },
        {
          id: "hasPool",
          type: "checkbox",
          label: FL.has_pool,
          ariaLabel: "Has pool filter",
          width: 1,
        },
      ],
    },
    {
      id: "building-advanced",
      fields: [
        {
          id: "energyClass",
          type: "select",
          label: FL.energy_class,
          placeholder: SP.energy_class_placeholder,
          ariaLabel: "Energy class filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_ENERGY_CLASSES },
            { value: "A+", label: "filters.energyClass.aPlus" },
            { value: "A", label: "filters.energyClass.a" },
            { value: "B+", label: "filters.energyClass.bPlus" },
            { value: "B", label: "filters.energyClass.b" },
            { value: "C", label: "filters.energyClass.c" },
            { value: "D", label: "filters.energyClass.d" },
            { value: "E", label: "filters.energyClass.e" },
            { value: "F", label: "filters.energyClass.f" },
            { value: "G", label: "filters.energyClass.g" },
          ],
        },
        {
          id: "accessibility",
          type: "checkbox",
          label: FL.accessibility,
          ariaLabel: "Accessibility filter",
          width: 1,
        },
        {
          id: "furnished",
          type: "checkbox",
          label: FL.furnished,
          ariaLabel: "Furnished filter",
          width: 1,
        },
        {
          id: "renovation",
          type: "select",
          label: FL.renovation,
          placeholder: SP.renovation_placeholder,
          ariaLabel: "Renovation status filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_RENOVATIONS },
            {
              value: "excellent",
              label: BUILDING_PROJECT_STATUS_LABELS.excellent,
            },
            {
              value: "very-good",
              label: BUILDING_PROJECT_STATUS_LABELS["very-good"],
            },
            { value: "good", label: BUILDING_PROJECT_STATUS_LABELS.good },
            {
              value: "needs-renovation",
              label: BUILDING_PROJECT_STATUS_LABELS["needs-renovation"],
            },
            {
              value: "under-renovation",
              label: BUILDING_PROJECT_STATUS_LABELS["under-renovation"],
            },
          ],
        },
      ],
    },
  ],
};

// Project Filters Configuration
// [ENTERPRISE]: 100% centralized labels - ZERO hardcoded values
export const projectFiltersConfig: FilterPanelConfig = {
  title: FT.projects,
  searchPlaceholder: SP.projects_search,
  i18nNamespace: "filters", // 🏢 ENTERPRISE: Filters domain namespace
  rows: [
    {
      id: "project-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: SP.projects_search,
          ariaLabel: "Search projects",
          width: 2,
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          ariaLabel: "Project status filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: "planning", label: UNIFIED_STATUS_FILTER_LABELS.PLANNING },
            {
              value: "in_progress",
              label: UNIFIED_STATUS_FILTER_LABELS.IN_PROGRESS,
            },
            {
              value: "completed",
              label: UNIFIED_STATUS_FILTER_LABELS.COMPLETED,
            },
            { value: "on_hold", label: UNIFIED_STATUS_FILTER_LABELS.ON_HOLD },
            { value: "cancelled", label: "filters.status.cancelled" },
            { value: "delayed", label: "filters.status.delayed" },
          ],
        },
        {
          id: "priority",
          type: "select",
          label: FL.priority,
          placeholder: SP.priority_placeholder,
          ariaLabel: "Priority filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_PRIORITIES },
            { value: "critical", label: PRIORITY_LABELS.critical },
            { value: "high", label: PRIORITY_LABELS.high },
            { value: "medium", label: PRIORITY_LABELS.medium },
            { value: "low", label: PRIORITY_LABELS.low },
          ],
        },
      ],
    },
    {
      id: "project-details",
      fields: [
        {
          id: "type",
          type: "select",
          label: FL.type,
          placeholder: SP.type_placeholder,
          ariaLabel: "Project type filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_TYPES },
            { value: "residential", label: PROJECT_TYPE_LABELS.residential },
            { value: "commercial", label: PROJECT_TYPE_LABELS.commercial },
            {
              value: "industrial",
              label: PROPERTY_BUILDING_TYPE_LABELS.industrial,
            },
            {
              value: "infrastructure",
              label: PROPERTY_BUILDING_TYPE_LABELS.infrastructure,
            },
            {
              value: "renovation",
              label: PROPERTY_BUILDING_TYPE_LABELS.renovation,
            },
            { value: "mixed", label: PROPERTY_BUILDING_TYPE_LABELS.mixed },
            { value: "public", label: PROPERTY_BUILDING_TYPE_LABELS.public },
          ],
        },
        {
          id: "company",
          type: "select",
          label: FL.company,
          placeholder: SP.company_placeholder,
          ariaLabel: "Company filter",
          width: 1,
          // [ENTERPRISE]: Dynamic options populated from Firestore projects data
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_COMPANIES },
          ],
        },
        {
          id: "location",
          type: "select",
          label: FL.location,
          placeholder: SP.location_placeholder,
          ariaLabel: "Location filter",
          width: 1,
          // [ENTERPRISE]: Dynamic options populated from Firestore projects data
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_LOCATIONS },
          ],
        },
        {
          id: "client",
          type: "select",
          label: FL.client,
          placeholder: SP.client_placeholder,
          ariaLabel: "Client filter",
          width: 1,
          // [ENTERPRISE]: Dynamic options populated from Firestore projects data
          options: [{ value: "all", label: COMMON_FILTER_LABELS.ALL_CLIENTS }],
        },
      ],
    },
  ],
};

// ====================================================================
// [ENTERPRISE] Property Filters Configuration
// For public property viewer (/properties page)
// ====================================================================

export const defaultBuildingFilters: BuildingFilterState = {
  searchTerm: "",
  project: [],
  status: [],
  type: [],
  location: [],
  company: [],
  priority: [],
  energyClass: [],
  renovation: [],
  ranges: {
    valueRange: { min: undefined, max: undefined },
    areaRange: { min: undefined, max: undefined },
    unitsRange: { min: undefined, max: undefined },
    yearRange: { min: undefined, max: undefined },
  },
  hasParking: false,
  hasElevator: false,
  hasGarden: false,
  hasPool: false,
  accessibility: false,
  furnished: false,
};

export const defaultProjectFilters: ProjectFilterState = {
  searchTerm: "",
  status: [],
  type: [],
  company: [],
  location: [],
  client: [],
  priority: [],
  riskLevel: [],
  complexity: [],
  budgetRange: { min: undefined, max: undefined },
  durationRange: { min: undefined, max: undefined },
  progressRange: { min: undefined, max: undefined },
  yearRange: { min: undefined, max: undefined },
  dateRange: { from: undefined, to: undefined },
  hasPermits: false,
  hasFinancing: false,
  isEcological: false,
  hasSubcontractors: false,
  isActive: false,
  hasIssues: false,
};

// Communications Filters Configuration
// [ENTERPRISE]: 100% centralized labels - ZERO hardcoded values
