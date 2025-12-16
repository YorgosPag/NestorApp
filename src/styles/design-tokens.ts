// Design tokens για το unified design system
// Αυτό το αρχείο περιέχει όλες τις τυποποιημένες τιμές για styling

export const spacing = {
  // Base spacing scale (σε rem)
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
  
  // Component-specific spacing
  component: {
    padding: {
      xs: '0.5rem',     // 8px - tight padding
      sm: '0.75rem',    // 12px - small padding
      md: '1rem',       // 16px - default padding
      lg: '1.5rem',     // 24px - large padding
      xl: '2rem',       // 32px - extra large padding
    },
    gap: {
      xs: '0.25rem',    // 4px - tight gap
      sm: '0.5rem',     // 8px - small gap
      md: '1rem',       // 16px - default gap
      lg: '1.5rem',     // 24px - large gap
    },
    margin: {
      xs: '0.25rem',    // 4px
      sm: '0.5rem',     // 8px
      md: '1rem',       // 16px
      lg: '1.5rem',     // 24px
      xl: '2rem',       // 32px
    }
  }
} as const;

export const typography = {
  // Font sizes (σε rem)
  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },
  
  // Line heights
  lineHeight: {
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
  
  // Font weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  // Letter spacing
  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  }
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.125rem',    // 2px
  default: '0.25rem', // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  full: '9999px',
} as const;

export const shadows = {
  // Box shadows για elevation
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  
  // Drop shadows για επιφάνειες
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

export const animation = {
  // Animation durations
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  
  // Easing functions
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    custom: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Semantic color mapping για application-specific χρώματα
export const semanticColors = {
  // Status colors (χρησιμοποιώντας CSS variables)
  status: {
    success: 'hsl(var(--status-success))',
    info: 'hsl(var(--status-info))',
    warning: 'hsl(var(--status-warning))',
    error: 'hsl(var(--status-error))',
    purple: 'hsl(var(--status-purple))',
  },
  
  // Property status colors
  propertyStatus: {
    'for-sale': 'hsl(var(--status-success))',     // Green
    'for-rent': 'hsl(var(--status-info))',       // Blue
    'reserved': 'hsl(var(--status-warning))',    // Orange
    'sold': 'hsl(var(--status-error))',          // Red
    'landowner': 'hsl(var(--status-purple))',    // Purple
  },
  
  // Building status colors
  buildingStatus: {
    active: 'hsl(var(--status-success))',
    construction: 'hsl(var(--status-warning))',
    planned: 'hsl(var(--status-info))',
    completed: 'hsl(var(--status-purple))',
  }
} as const;

// Z-index scale για layering
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// Grid patterns για layout consistency
export const gridPatterns = {
  // Stats grids
  stats: {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-2',
    desktop: 'lg:grid-cols-4',
    gap: 'gap-4',
    full: 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
  },
  
  // Action buttons
  actions: {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-3',
    gap: 'gap-4',
    full: 'grid gap-4 grid-cols-1 sm:grid-cols-3'
  },
  
  // Card grids
  cards: {
    mobile: 'grid-cols-1',
    tablet: 'md:grid-cols-2',
    desktop: 'lg:grid-cols-3',
    gap: 'gap-6',
    full: 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  },
  
  // Form layouts
  form: {
    single: 'grid-cols-1',
    double: 'md:grid-cols-2',
    triple: 'lg:grid-cols-3',
    gap: 'gap-4',
    fullDouble: 'grid gap-4 grid-cols-1 md:grid-cols-2',
    fullTriple: 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }
} as const;

// Component size variants
export const componentSizes = {
  // Button sizes
  button: {
    xs: 'h-6 px-2 text-xs',
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    xl: 'h-14 px-8 text-lg',
  },
  
  // Input sizes
  input: {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  },
  
  // Icon sizes
  icon: {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
    '2xl': 'h-10 w-10',
  },
  
  // Avatar sizes
  avatar: {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  }
} as const;

// Responsive breakpoints (matching Tailwind defaults)
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Interactive states για consistent hover/focus patterns
export const interactiveStates = {
  // Card interactions
  card: {
    base: 'transition-all duration-200',
    hover: 'hover:shadow-md hover:scale-[1.02]',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2',
    active: 'active:scale-[0.98]',
    full: 'transition-all duration-200 hover:shadow-md hover:scale-[1.02] focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-[0.98]'
  },
  
  // Button interactions
  button: {
    base: 'transition-colors duration-200',
    hover: 'hover:opacity-90',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2',
    active: 'active:scale-95',
    full: 'transition-colors duration-200 hover:opacity-90 focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95'
  },
  
  // Link interactions
  link: {
    base: 'transition-colors duration-200',
    hover: 'hover:text-primary hover:underline',
    focus: 'focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm',
    full: 'transition-colors duration-200 hover:text-primary hover:underline focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:rounded-sm'
  }
} as const;

// Helper functions για type-safe access
export const getSpacing = (size: keyof typeof spacing) => spacing[size];
export const getTypography = (property: keyof typeof typography, size: string) =>
  typography[property][size as keyof typeof typography[typeof property]];
export const getShadow = (size: keyof typeof shadows) => shadows[size];
export const getAnimation = (property: keyof typeof animation, value: string) =>
  animation[property][value as keyof typeof animation[typeof property]];

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS - LEGACY SUPPORT
// ============================================================================

/**
 * 🔄 LEGACY COMPATIBILITY EXPORTS
 *
 * Re-export advanced tokens από το modular system για backward compatibility
 * με existing geo-canvas code.
 */

// Note: Advanced tokens are available via './design-tokens/index' import
// Removed re-export to prevent circular dependency


// Export all tokens as a single object για convenience
export const designTokens = {
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
  semanticColors,
  zIndex,
  gridPatterns,
  componentSizes,
  breakpoints,
  interactiveStates,
} as const;

// Layout utilities για positioning, dimensions, και display states
export const layoutUtilities = {
  // Positioning patterns για dynamic placement
  positioning: {
    absolute: 'absolute' as const,
    relative: 'relative' as const,
    fixed: 'fixed' as const,
    sticky: 'sticky' as const,
  },

  // Dimension utilities για responsive sizing
  dimensions: {
    auto: 'auto' as const,
    full: '100%' as const,
    screen: '100vw' as const,
    screenHeight: '100vh' as const,
    fitContent: 'fit-content' as const,
    minContent: 'min-content' as const,
    maxContent: 'max-content' as const,
  },

  // Display state utilities για visibility control
  display: {
    block: 'block' as const,
    inline: 'inline' as const,
    inlineBlock: 'inline-block' as const,
    flex: 'flex' as const,
    grid: 'grid' as const,
    none: 'none' as const,
  },

  // Visibility utilities για show/hide patterns
  visibility: {
    visible: 'visible' as const,
    hidden: 'hidden' as const,
    collapse: 'collapse' as const,
  },

  // Overflow utilities για content handling
  overflow: {
    visible: 'visible' as const,
    hidden: 'hidden' as const,
    scroll: 'scroll' as const,
    auto: 'auto' as const,
  },

  // Dynamic percentage generator για width/height
  percentage: (value: number): string => `${Math.max(0, Math.min(100, value))}%`,

  // Dynamic pixel value generator
  pixels: (value: number): string => `${value}px`,

  // Dynamic rem value generator
  rem: (value: number): string => `${value}rem`,

  // Dynamic positioning utilities για absolute/relative positioning
  position: (top: string, left: string): { top: string; left: string } => ({ top, left }),

  // Position preset patterns για common use cases
  positionPresets: {
    centerAbsolute: { top: '50%', left: '50%' },
    topLeft: { top: '0', left: '0' },
    topRight: { top: '0', right: '0' },
    bottomLeft: { bottom: '0', left: '0' },
    bottomRight: { bottom: '0', right: '0' },
  },
} as const;

// ============================================================================
// MODULAR DESIGN TOKENS INTEGRATION
// ============================================================================

/**
 * 🏢 ENTERPRISE DESIGN TOKENS V2
 *
 * @description Για πρόσβαση στα επεκταμένα design tokens (alerts, dashboard, maps, dialogs),
 * χρησιμοποιήστε το modular system:
 *
 * @example
 * ```typescript
 * // Single import για όλα τα tokens
 * import { unifiedDesignTokens } from '@/styles/design-tokens';
 *
 * // Specific imports για performance
 * import { alertSeverityColors } from '@/styles/design-tokens';
 * import { dashboardLayoutTokens } from '@/styles/design-tokens';
 * import { mapButtonTokens } from '@/styles/design-tokens';
 *
 * // Legacy compatibility
 * import { colors, dashboardComponents } from '@/styles/design-tokens';
 * ```
 *
 * @see ./design-tokens/index.ts - Πλήρης documentation & API
 */
export const DESIGN_TOKENS_V2_INFO = {
  version: '2.0.0',
  description: 'Enterprise-class modular design tokens με backward compatibility',
  migrationGuide: 'See ./design-tokens/index.ts for full API documentation',
  modules: [
    'semantic/alert-tokens.ts - Alert severity, status, AutoSave indicators',
    'components/dashboard-tokens.ts - Dashboard layouts, metrics, charts',
    'components/map-tokens.ts - Map interfaces, polygons, drawing tools',
    'components/dialog-tokens.ts - Modals, forms, wizards, steps'
  ]
} as const;