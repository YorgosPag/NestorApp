/**
 * 🏢 ENTERPRISE HEADER SYSTEM - CONSTANTS
 *
 * Κεντρικοποιημένα Constants για όλα τα header components
 * Single Source of Truth - Enterprise Configuration
 *
 * ΣΥΜΒΑΤΟ ΜΕ:
 * - Υπάρχοντα /constants/header.ts
 * - CompactToolbar configurations
 * - Theme system
 */

import type { HeaderTheme, ViewMode, HeaderVariant, HeaderLayout, HeaderSpacing } from '../types';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { borderVariants } from '@/styles/design-tokens';

// ============================================================================
// 🎨 HEADER THEMES - ENTERPRISE STYLING
// ============================================================================

export const HEADER_THEME: HeaderTheme = {
  // Variant classes with mobile-first design
  variants: {
    sticky: "border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50",
    static: "border-b bg-card",
    floating: "rounded-lg border bg-card shadow-sm",
    "sticky-rounded": "rounded-lg border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm mx-1 mt-1 sm:mx-4 sm:mt-4"
  },

  // Layout classes with responsive design
  layouts: {
    'single-row': "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
    'compact': "flex flex-row items-center justify-between gap-2",
    'multi-row': "flex flex-col gap-4"
  },

  // Spacing classes - UNIFIED MOBILE-FIRST SYSTEM
  spacing: {
    tight: "px-1 py-2 sm:px-2 sm:py-2",
    normal: "px-1 py-4 sm:px-4 sm:py-4",
    loose: "px-1 py-6 sm:px-6 sm:py-6",
    compact: "px-3 py-2 sm:px-4 sm:py-3"
  },

  // Component-specific themes
  components: {
    title: {
      large: "text-xl sm:text-2xl font-bold text-foreground",
      medium: "text-lg sm:text-xl font-semibold text-foreground",
      small: "text-base sm:text-lg font-medium text-foreground",
      subtitle: "text-sm text-muted-foreground mt-1"
    },
    search: {
      default: "w-full max-w-sm",
      mobile: "w-full",
      desktop: "w-80"
    },
    filters: {
      container: "flex flex-wrap items-center gap-2",
      button: "px-3 py-1.5 text-xs border rounded-full transition-colors",
      active: `bg-primary text-primary-foreground ${borderVariants.status.info.className}`,
      inactive: `bg-background border-border ${INTERACTIVE_PATTERNS.BORDER_SUBTLE}`
    },
    actions: {
      default: "flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end",
      container: "flex items-center gap-2",
      button: "h-9 px-3 text-sm",
      iconButton: "h-9 w-9"
    },
    viewToggle: {
      desktop: "flex border rounded-md bg-background",
      mobile: "h-8 px-2"
    }
  }
};

// ============================================================================
// 📱 RESPONSIVE BREAKPOINTS - ENTERPRISE STANDARDS
// ============================================================================

export const HEADER_BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280
} as const;

// ============================================================================
// 🔧 DEFAULT CONFIGURATIONS - ENTERPRISE PRESETS
// ============================================================================

export const DEFAULT_VIEW_MODES: ViewMode[] = ['list', 'grid'];

export const DEFAULT_HEADER_PROPS = {
  variant: 'sticky' as HeaderVariant,
  layout: 'multi-row' as HeaderLayout,
  spacing: 'normal' as HeaderSpacing,
  mobileCollapsed: true
} as const;

// ============================================================================
// 🎯 VIEW MODE CONFIGURATIONS - UI PATTERNS
// ============================================================================

export const VIEW_MODE_ICONS = {
  list: 'List',
  grid: 'LayoutGrid',
  byType: 'Filter',
  byStatus: 'BarChart3'
} as const;

export const VIEW_MODE_LABELS = {
  list: 'Λίστα',
  grid: 'Πλέγμα',
  byType: 'Κατά Τύπο',
  byStatus: 'Κατά Κατάσταση'
} as const;

export const VIEW_MODE_CONFIG = {
  labels: VIEW_MODE_LABELS,
  icons: VIEW_MODE_ICONS,
  mobile: {
    labels: {
      list: 'Προβολή λίστας',
      grid: 'Προβολή πλέγματος',
      byType: 'Ομαδοποίηση κατά τύπο',
      byStatus: 'Ομαδοποίηση κατά κατάσταση'
    }
  }
} as const;

// ============================================================================
// 🚀 ANIMATION CONSTANTS - SMOOTH UX
// ============================================================================

export const HEADER_ANIMATIONS = {
  transition: "transition-all duration-200 ease-in-out",
  slideIn: "animate-in slide-in-from-top-2 duration-200",
  slideOut: "animate-out slide-out-to-top-2 duration-200",
  fadeIn: "animate-in fade-in duration-200",
  fadeOut: "animate-out fade-out duration-200"
} as const;

// ============================================================================
// 📐 SIZE CONSTANTS - CONSISTENT SPACING
// ============================================================================

export const HEADER_SIZES = {
  icon: {
    small: 'h-4 w-4',          // h-4 w-4 - Synced with componentSizes.icon.sm
    medium: 'h-5 w-5',         // h-5 w-5 - Synced with componentSizes.icon.md
    large: 'h-6 w-6'           // h-6 w-6 - Synced with componentSizes.icon.lg
  },
  button: {
    small: "h-8 px-2 text-xs",
    medium: "h-9 px-3 text-sm",
    large: "h-10 px-4 text-sm"
  },
  input: {
    small: "h-8 text-xs",
    medium: "h-9 text-sm",
    large: "h-10 text-sm"
  }
} as const;

// ============================================================================
// 🔍 SEARCH CONFIGURATIONS - ENTERPRISE FEATURES
// ============================================================================

export const SEARCH_CONFIG = {
  debounceMs: 300,
  minLength: 2,
  maxLength: 100,
  placeholder: {
    default: "Αναζήτηση...",
    contacts: "Αναζήτηση επαφών...",
    projects: "Αναζήτηση έργων...",
    buildings: "Αναζήτηση κτιρίων...",
    files: "Αναζήτηση αρχείων..."
  }
} as const;

// ============================================================================
// 🎨 ICON VARIANTS - VISUAL CONSISTENCY
// ============================================================================

export const ICON_VARIANTS = {
  gradient: {
    base: "flex items-center justify-center rounded-lg shadow-lg",
    styles: "bg-gradient-to-br from-blue-500 to-purple-600 text-white h-10 w-10"
  },
  simple: {
    base: "flex items-center justify-center rounded-lg",
    styles: "bg-primary text-primary-foreground h-8 w-8"  // Synced with componentSizes.icon.xl
  }
} as const;

// ============================================================================
// 🔄 RE-EXPORT EXISTING CONSTANTS - BACKWARD COMPATIBILITY
// ============================================================================

// Re-export από υπάρχοντα constants για συμβατότητα
export { quickActions, getNotifications } from '@/constants/header';

// ============================================================================
// 🚀 ENTERPRISE DEFAULTS - PRODUCTION READY
// ============================================================================

export const ENTERPRISE_HEADER_CONFIG = {
  // Performance optimizations
  virtualization: {
    enabled: true,
    itemHeight: 48,
    overscan: 5
  },

  // Accessibility
  a11y: {
    announceChanges: true,
    keyboardNavigation: true,
    screenReaderLabels: true
  },

  // Analytics
  tracking: {
    enabled: true,
    events: ['search', 'filter', 'view_change', 'action_click']
  }
} as const;