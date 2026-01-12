/**
 * 🏢 ENTERPRISE HEADER SYSTEM - TYPES
 *
 * Κεντρικοποιημένα Types για όλα τα header components
 * Single Source of Truth - Enterprise Implementation
 *
 * ΣΥΜΒΑΤΟ ΜΕ:
 * - Υπάρχοντα /constants/header.ts
 * - Υπάρχοντα /types/header.ts
 * - CompactToolbar system
 */

import type { LucideIcon } from 'lucide-react';
import type { QuickAction, Notification } from '@/types/header';
import type { CompactToolbarConfig, CompactToolbarProps } from '@/components/core/CompactToolbar/types';

// ============================================================================
// 🎯 CORE HEADER TYPES - ENTERPRISE PATTERNS
// ============================================================================

export type ViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

export type HeaderVariant = 'sticky' | 'static' | 'floating' | 'sticky-rounded';

export type HeaderLayout = 'single-row' | 'multi-row' | 'compact';

export type HeaderSpacing = 'tight' | 'normal' | 'loose' | 'compact';

// ============================================================================
// 🏗️ COMPONENT INTERFACES - MODULAR DESIGN
// ============================================================================

export interface HeaderIconProps {
  icon: LucideIcon;
  className?: string;
  variant?: 'gradient' | 'simple';
}

export interface HeaderTitleProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  variant?: 'large' | 'medium' | 'small';
  className?: string;
  hideSubtitle?: boolean; // 🏢 Enterprise support για conditional subtitle
}

export interface HeaderSearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export interface HeaderFilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface HeaderFiltersProps {
  options: HeaderFilterOption[];
  activeFilters: string[];
  onFiltersChange: (filters: string[]) => void;
  className?: string;
  disabled?: boolean;
  // Enterprise features
  showClearAll?: boolean;
  showCount?: boolean;
  maxVisible?: number;
}

export interface HeaderViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  availableViews?: ViewMode[];
  className?: string;
  disabled?: boolean;
}

export interface HeaderActionsProps {
  onNew?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onSettings?: () => void;
  className?: string;
  disabled?: boolean;
  // Enterprise customization
  customActions?: Array<{
    label: string;
    icon: LucideIcon;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  }>;
}

// ============================================================================
// 🏢 MAIN HEADER INTERFACES - ENTERPRISE COMPOSITION
// ============================================================================

export interface PageHeaderProps {
  // Core configuration
  variant?: HeaderVariant;
  layout?: HeaderLayout;
  spacing?: HeaderSpacing;
  className?: string;

  // Content
  title?: HeaderTitleProps;
  search?: HeaderSearchProps;
  filters?: HeaderFiltersProps;
  actions?: HeaderActionsProps;
  viewToggle?: HeaderViewToggleProps;

  // Enterprise features
  compactToolbar?: CompactToolbarProps;
  quickActions?: QuickAction[];
  notifications?: Notification[];

  // Responsive behavior
  mobileCollapsed?: boolean;
  onMobileToggle?: (collapsed: boolean) => void;
}

export interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  count?: number; // 🏢 Enterprise count display (e.g., "Κτίρια (5)")
  actions?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'minimal';
}

export interface MobileCompactHeaderProps {
  title: string;
  onBack?: () => void;
  onMenu?: () => void;
  actions?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'transparent' | 'elevated';
}

// ============================================================================
// 🎨 STYLING INTERFACES - THEME INTEGRATION
// ============================================================================

export interface HeaderTheme {
  variants: Record<HeaderVariant, string>;
  layouts: Record<HeaderLayout, string>;
  spacing: Record<HeaderSpacing, string>;
  components: {
    title: Record<string, string>;
    search: Record<string, string>;
    filters: Record<string, string>;
    actions: Record<string, string>;
  };
}

// ============================================================================
// 🔧 UTILITY TYPES - ADVANCED PATTERNS
// ============================================================================

export type HeaderComponent =
  | 'icon'
  | 'title'
  | 'search'
  | 'filters'
  | 'viewToggle'
  | 'actions'
  | 'compactToolbar';

export interface HeaderConfig {
  components: HeaderComponent[];
  layout: HeaderLayout;
  variant: HeaderVariant;
  spacing: HeaderSpacing;
  responsive: {
    mobile: HeaderComponent[];
    tablet: HeaderComponent[];
    desktop: HeaderComponent[];
  };
}

// ============================================================================
// 🔄 RE-EXPORTS - BACKWARD COMPATIBILITY
// ============================================================================

// Re-export existing types for compatibility
export type { QuickAction, Notification } from '@/types/header';
export type { CompactToolbarConfig, CompactToolbarProps } from '@/components/core/CompactToolbar/types';

// ============================================================================
// 🚀 FUTURE EXTENSIBILITY
// ============================================================================

// 🏢 ENTERPRISE: Generic props interface for header plugins
export interface HeaderPluginProps {
  className?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface HeaderPlugin<P extends HeaderPluginProps = HeaderPluginProps> {
  name: string;
  version: string;
  component: React.ComponentType<P>;
  dependencies?: string[];
}

export interface HeaderRegistry {
  registerPlugin: (plugin: HeaderPlugin) => void;
  getPlugin: (name: string) => HeaderPlugin | undefined;
  listPlugins: () => HeaderPlugin[];
}