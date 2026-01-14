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
  communicationsFiltersConfig,
  defaultUnitFilters,
  defaultContactFilters,
  defaultBuildingFilters,
  defaultProjectFilters,
  defaultCommunicationsFilters
} from './configs';

// Storage Configurations
export {
  storageFiltersConfig,
  defaultStorageFilters
} from './configs/storageFiltersConfig';

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

// Communications Types (from configs.ts)
export type { CommunicationsFilterState } from './configs';

// Storage Types
export type {
  StorageFilterState
} from './configs/storageFiltersConfig';