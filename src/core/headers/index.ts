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

// Custom actions SSoT — filter/trash toggles για το actions.customActions slot
export { buildHeaderCustomActions } from './header-custom-actions';
export type { HeaderCustomActionsOptions } from './header-custom-actions';

// Props contract SSoT για σελίδες-λίστες οντοτήτων
export type {
  ListPageHeaderProps,
  ListGridHeaderProps,
  ListGridViewMode
} from './list-page-header-props';
export { LIST_GRID_VIEW_MODES, LIST_PAGE_VIEW_MODES } from './list-page-header-props';

// Πλήρες header σελίδας-λίστας — SSoT για Parkings/Storages
export { ListPageHeader } from './ListPageHeader';
export type { ListPageHeaderLabels, ListPageHeaderComponentProps } from './ListPageHeader';

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