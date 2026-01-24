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
  propertyFiltersConfig,
  fileFiltersConfig,
  defaultUnitFilters,
  defaultContactFilters,
  defaultBuildingFilters,
  defaultProjectFilters,
  defaultCommunicationsFilters,
  defaultPropertyFilters,
  defaultFileFilters
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
  ProjectFilterState,
  PropertyFilterState
} from './types';

// Communications Types (from configs.ts)
export type { CommunicationsFilterState, FileFilterState } from './configs';

// Storage Types
export type {
  StorageFilterState
} from './configs/storageFiltersConfig';