/**
 * 🏢 UNIFIED HEADER SYSTEM - EXPORTS
 *
 * Κεντρικό σημείο εισαγωγής για όλα τα header components
 * Single Source of Truth - Enterprise Implementation
 */

// Main Components
export {
  PageHeader,
  UnifiedHeader,
  SectionHeader,
  HeaderIcon,
  HeaderTitle,
  HeaderSearch,
  HeaderFilters,
  HeaderActions,
  HeaderViewToggle,
  MobileCompactHeader
} from './UnifiedHeaderSystem';

// Types & Interfaces
export type {
  ViewMode,
  HeaderIconProps,
  HeaderTitleProps,
  HeaderSearchProps,
  HeaderFilterOption,
  HeaderFiltersProps,
  HeaderActionsProps,
  PageHeaderProps,
  SectionHeaderProps,
  MobileCompactHeaderProps
} from './UnifiedHeaderSystem';

// Default export
export { default } from './UnifiedHeaderSystem';