/**
 * 🏢 UNIFIED HEADER SYSTEM - EXPORTS
 *
 * Κεντρικό σημείο εισαγωγής για όλα τα header components
 * Single Source of Truth - Enterprise Implementation
 */

// Main Components - Enterprise System Migration
export {
  PageHeader,
  SectionHeader, // 🏢 Enterprise section header με count support
  HeaderIcon,
  HeaderTitle,
  HeaderSearch,
  HeaderFilters,
  HeaderActions,
  HeaderViewToggle,
  MobileHeaderViewToggle as MobileCompactHeader
} from './enterprise-system';

// Backward compatibility aliases
export {
  PageHeader as UnifiedHeader
  // SectionHeader is now its own component με count support
} from './enterprise-system';

// Types & Interfaces - Enterprise System
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
} from './enterprise-system';

// Default export - Enterprise System
export { default } from './enterprise-system';