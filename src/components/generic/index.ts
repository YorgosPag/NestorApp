/**
 * 🔧 GENERIC COMPONENTS INDEX
 *
 * Centralized exports για όλα τα generic components
 * που διαβάζουν από centralized configurations
 */

// Form Components
export { GenericFormRenderer } from './GenericFormRenderer';
export type { GenericFormRendererProps } from './GenericFormRenderer';

// Tab Components
export { GenericTabRenderer } from './GenericTabRenderer';
export type { GenericTabRendererProps } from './GenericTabRenderer';

// Project Tab Components
export { GenericProjectTabsRenderer } from './GenericProjectTabsRenderer';
export type { GenericProjectTabsRendererProps } from './GenericProjectTabsRenderer';

// Building Tab Components
export { GenericBuildingTabsRenderer } from './GenericBuildingTabsRenderer';
export type { GenericBuildingTabsRendererProps } from './GenericBuildingTabsRenderer';

// Units Tab Components
export { GenericUnitsTabsRenderer } from './GenericUnitsTabsRenderer';
export type { GenericUnitsTabsRendererProps } from './GenericUnitsTabsRenderer';

// Helper Components
export {
  createTabsFromConfig,
  createIndividualTabsFromConfig,
  createTabFromSection,
  getIconComponent
} from './ConfigTabsHelper';
export type { TabConfig } from './ConfigTabsHelper';

// Re-export config for convenience
export {
  getSortedSections,
  getCompanySection,
  getCompanyField,
  getAllCompanyFields
} from '@/config/company-gemi-config';

export type {
  FieldConfig,
  SectionConfig,
  FieldType,
  SelectOption
} from '@/config/company-gemi-config';