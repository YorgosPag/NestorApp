export { PROPERTY_AREA_RANGE_PRESETS } from './configs/shared';
export {
  propertyListFiltersConfig,
  propertyFiltersConfig,
  defaultPropertyFilters,
  defaultUnitFilters,
} from './configs/propertyFiltersConfig';
export {
  contactFiltersConfig,
  defaultContactFilters,
} from './configs/contactFiltersConfig';
export {
  buildingFiltersConfig,
  projectFiltersConfig,
  defaultBuildingFilters,
  defaultProjectFilters,
} from './configs/buildingProjectFiltersConfig';
export {
  communicationsFiltersConfig,
  defaultCommunicationsFilters,
  taskFiltersConfig,
  defaultTaskFilters,
  crmDashboardFiltersConfig,
  defaultCrmDashboardFilters,
  aiInboxFiltersConfig,
  defaultAIInboxFilters,
  operatorInboxFiltersConfig,
  defaultOperatorInboxFilters,
} from './configs/workflowFiltersConfig';
export {
  fileFiltersConfig,
  defaultFileFilters,
} from './configs/fileFiltersConfig';

export type {
  CommunicationsFilterState,
  TaskFilterState,
  CrmDashboardFilterState,
  AIInboxFilterState,
  OperatorInboxFilterState,
} from './configs/workflowFiltersConfig';
export type { FileFilterState } from './configs/fileFiltersConfig';
