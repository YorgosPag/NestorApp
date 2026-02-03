// ============================================================================
// ADR-051: ENTERPRISE FILTER SYSTEM - CENTRAL EXPORT POINT
// Single source of truth for all filtering functionality
// ============================================================================

// Core Advanced Filters System
export { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
export { FilterField } from './FilterField';
export { useGenericFilters, usePropertyGridFilters } from './useGenericFilters';

// ADR-051: Type-safe hook return types
export type { UseGenericFiltersReturn } from './useGenericFilters';

// Configurations
export {
  unitFiltersConfig,
  contactFiltersConfig,
  buildingFiltersConfig,
  projectFiltersConfig,
  communicationsFiltersConfig,
  aiInboxFiltersConfig,
  propertyFiltersConfig,
  fileFiltersConfig,
  defaultUnitFilters,
  defaultContactFilters,
  defaultBuildingFilters,
  defaultProjectFilters,
  defaultCommunicationsFilters,
  defaultAIInboxFilters,
  defaultPropertyFilters,
  defaultFileFilters
} from './configs';

// Storage Configurations
export {
  storageFiltersConfig,
  defaultStorageFilters
} from './configs/storageFiltersConfig';

// ============================================================================
// ADR-051: UNIFIED TYPE SYSTEM
// ============================================================================

// Core Types
export type {
  FilterFieldType,
  FilterOption,
  FilterFieldConfig,
  FilterRowConfig,
  AdvancedFilterOption,
  AdvancedFiltersConfig,
  FilterPanelConfig,
  GenericFilterState,
  ContactFilterState,
  UnitFilterState,
  BuildingFilterState,
  ProjectFilterState,
  PropertyFilterState,
  // ADR-051: Unified range types
  NumericRange,
  DateRange,
  DateFromToRange,
  FilterRange
} from './types';

// ADR-051: Type guards and normalization utilities
export {
  isNumericRange,
  isDateRange,
  isDateFromToRange,
  normalizeNumericRange,
  normalizeDateFromToRange,
  hasActiveNumericRange,
  hasActiveDateRange,
  createEmptyNumericRange,
  createEmptyDateRange
} from './types';

// Communications Types (from configs.ts)
export type { CommunicationsFilterState, FileFilterState, AIInboxFilterState } from './configs';

// Storage Types
export type {
  StorageFilterState
} from './configs/storageFiltersConfig';

// ============================================================================
// ADR-051: CENTRALIZED APPLY FILTERS UTILITY
// ============================================================================

export {
  applyFilters,
  applyPropertyFilters,
  matchesSearchTerm,
  matchesNumericRange,
  matchesDateFromToRange,
  matchesDateRange,
  matchesArrayFilter,
  matchesFeatures
} from './utils/applyFilters';

export type {
  FilterableEntity,
  BaseFilterState,
  ApplyFiltersOptions
} from './utils/applyFilters';
