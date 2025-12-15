/**
 * 🏢 ENTERPRISE HEADER COMPONENTS - INDEX
 *
 * Κεντρικοποιημένα Components exports
 * Single Source of Truth για όλα τα header components
 */

// Basic components
export { HeaderIcon, default as HeaderIconComponent } from './HeaderIcon';
export { HeaderTitle, default as HeaderTitleComponent } from './HeaderTitle';
export { HeaderSearch, default as HeaderSearchComponent } from './HeaderSearch';

// Advanced components - ENTERPRISE IMPLEMENTATION
export { HeaderFilters, default as HeaderFiltersComponent } from './HeaderFilters';
export { HeaderViewToggle, default as HeaderViewToggleComponent } from './HeaderViewToggle';
export { MobileHeaderViewToggle, default as MobileHeaderViewToggleComponent } from './MobileHeaderViewToggle';
export { HeaderActions, default as HeaderActionsComponent } from './HeaderActions';

// Main composition components
export { PageHeader, default as PageHeaderComponent } from './PageHeader';
export { SectionHeader, default as SectionHeaderComponent } from './SectionHeader'; // 🏢 Enterprise section header με count support

// Re-export types για convenience
export type {
  HeaderIconProps,
  HeaderTitleProps,
  HeaderSearchProps,
  // HeaderFiltersProps,
  // HeaderViewToggleProps,
  // HeaderActionsProps
} from '../types';