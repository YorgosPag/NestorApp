/**
 * 🔧 GENERIC COMPONENTS INDEX
 *
 * Centralized exports για όλα τα generic components
 * που διαβάζουν από centralized configurations
 */

// Form Components
export { GenericFormRenderer } from './GenericFormRenderer';
export type { GenericFormRendererProps } from './GenericFormRenderer';

export { ServiceFormRenderer } from './ServiceFormRenderer';
export type { ServiceFormRendererProps } from './ServiceFormRenderer';

// Form Tab Components
export { GenericFormTabRenderer } from './GenericFormTabRenderer';
export type { GenericFormTabRendererProps } from './GenericFormTabRenderer';

export { ServiceFormTabRenderer } from './ServiceFormTabRenderer';
export type { ServiceFormTabRendererProps } from './ServiceFormTabRenderer';

// Tab Components
export { GenericTabRenderer } from './GenericTabRenderer';
export type { GenericTabRendererProps } from './GenericTabRenderer';

// 🚀 UNIVERSAL TABS RENDERER - Enterprise Centralized Solution
export { UniversalTabsRenderer } from './UniversalTabsRenderer';
export type { UniversalTabsRendererProps, UniversalTabConfig } from './UniversalTabsRenderer';
export { convertToUniversalConfig, isUniversalTabConfig } from './UniversalTabsRenderer';

// Component Mappings για Universal Renderer
export {
  PROJECT_COMPONENT_MAPPING,
  BUILDING_COMPONENT_MAPPING,
  STORAGE_COMPONENT_MAPPING,
  UNITS_COMPONENT_MAPPING,
  CONTACT_COMPONENT_MAPPING,
  PARKING_COMPONENT_MAPPING,
  MASTER_COMPONENT_MAPPING,
  getComponentMapping
} from './mappings';

export type {
  ProjectComponentName,
  BuildingComponentName,
  StorageComponentName,
  UnitsComponentName,
  ContactComponentName,
  ParkingComponentName,
  MasterComponentName
} from './mappings';

// ⚠️ LEGACY RENDERERS - DEPRECATED ⚠️
// These are kept for reference but should NOT be used in new code
// Use UniversalTabsRenderer instead
//
// export { GenericProjectTabsRenderer } from './GenericProjectTabsRenderer';
// export { GenericBuildingTabsRenderer } from './GenericBuildingTabsRenderer';
// export { GenericUnitsTabsRenderer } from './GenericUnitsTabsRenderer';

// CRM Dashboard Tab Components
export { GenericCRMDashboardTabsRenderer } from './GenericCRMDashboardTabsRenderer';
export type { GenericCRMDashboardTabsRendererProps } from './GenericCRMDashboardTabsRenderer';

// Period Selector Components
export { GenericPeriodSelector } from './GenericPeriodSelector';
export type { GenericPeriodSelectorProps } from './GenericPeriodSelector';

// Helper Components
export { getIconComponent } from './utils/IconMapping';

// Re-export config for convenience
export {
  getSortedSections,
  getCompanySection,
  getCompanyField,
  getAllCompanyFields
} from '@/config/company-gemi';

export type {
  FieldConfig,
  SectionConfig,
  FieldType,
  SelectOption
} from '@/config/company-gemi';