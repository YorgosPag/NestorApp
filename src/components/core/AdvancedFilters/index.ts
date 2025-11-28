// Core Advanced Filters System
export { AdvancedFiltersPanel } from './AdvancedFiltersPanel';
export { FilterField } from './FilterField';
export { useGenericFilters } from './useGenericFilters';

// Configurations
export {
  unitFiltersConfig,
  contactFiltersConfig,
  buildingFiltersConfig,
  projectFiltersConfig,
  defaultUnitFilters,
  defaultContactFilters,
  defaultBuildingFilters,
  defaultProjectFilters
} from './configs';

// Types
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
  ProjectFilterState
} from './types';