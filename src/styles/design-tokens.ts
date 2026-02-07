// Design tokens για το unified design system
// Αυτό το αρχείο περιέχει όλες τις τυποποιημένες τιμές για styling

import * as React from 'react';

// ✅ ENTERPRISE FIX: Direct color definitions since core module doesn't exist
const colors = {
  background: {
    primary: "#ffffff",
    secondary: "#f8fafc",
    tertiary: "#f1f5f9",
    hover: "#f1f5f9",
    overlay: "rgba(0, 0, 0, 0.5)",
    accent: "#e0f2fe", // ✅ ENTERPRISE FIX: Added missing accent color
    muted: "#f8fafc"   // ✅ ENTERPRISE FIX: Added missing muted color
  },
  text: {
    primary: "#1e293b",
    secondary: "#64748b",
    muted: "#94a3b8",
    inverse: "#ffffff",
    tertiary: "#9ca3af"
  },
  border: {
    primary: "#e2e8f0",
    secondary: "#cbd5e1",
    tertiary: "#f3f4f6",
    focus: "#3b82f6" // ✅ ENTERPRISE: Focus border color for AlertConfigurationInterface.styles.ts
  },
  primary: {
    "500": "#3b82f6"
  },
  blue: {
    "300": "#93c5fd", // ✅ ENTERPRISE FIX: Added missing 300 shade for design-tokens.ts usage
    "400": "#60a5fa",
    "500": "#3b82f6",
    "600": "#2563eb"
  },
  green: {
    "300": "#6ee7b7", // ✅ ENTERPRISE FIX: Added missing 300 shade for design-tokens.ts usage
    "400": "#4ade80", // 🏢 ENTERPRISE: Added for snap indicator overlay
    "500": "#22c55e", // ✅ Updated to match Tailwind standard
    "600": "#059669"
  },
  yellow: {
    "400": "#facc15", // 🏢 ENTERPRISE: Added for zoom window overlay
    "500": "#eab308"
  },
  red: {
    "300": "#fca5a5",
    "500": "#ef4444",
    "600": "#dc2626"
  },
  // ✅ ENTERPRISE FIX: Added error color palette (alias of red) for semantic usage
  error: {
    "50": "#fef2f2",
    "300": "#fca5a5",
    "500": "#ef4444",
    "600": "#dc2626"
  },
  orange: {
    "300": "#fdba74",
    "500": "#f97316",
    "600": "#ea580c"
  },
  gray: {
    "50": "#f9fafb",
    "100": "#f3f4f6",
    "500": "#6b7280"
  },
  // ✅ ENTERPRISE: Alert severity colors for AlertMonitoringDashboard.tsx
  severity: {
    critical: {
      background: "#fef2f2",  // red-50
      icon: "#ef4444",        // red-500
      border: "#fca5a5"       // red-300
    },
    high: {
      background: "#fff7ed",  // orange-50
      icon: "#f97316",        // orange-500
      border: "#fdba74"       // orange-300
    },
    medium: {
      background: "#fffbeb",  // amber-50
      icon: "#f59e0b",        // amber-500
      border: "#fcd34d"       // amber-300
    },
    low: {
      background: "#ecfdf5",  // green-50
      icon: "#22c55e",        // green-500
      border: "#6ee7b7"       // green-300
    },
    info: {
      background: "#eff6ff",  // blue-50
      icon: "#3b82f6",        // blue-500
      border: "#93c5fd"       // blue-300
    }
  }
} as const;

// Legacy design token definitions for backward compatibility
const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem",  // 8px
  md: "1rem",    // 16px
  lg: "1.5rem",  // 24px
  xl: "2rem",    // 32px
  "2xl": "3rem", // 48px ✅ ENTERPRISE FIX: Added for enterprise-token-bridge.ts
  "3xl": "4rem", // 64px ✅ ENTERPRISE FIX: Added for enterprise-token-bridge.ts
  component: {   // ✅ ENTERPRISE FIX: Added missing component spacing
    xs: "0.125rem", // 2px
    sm: "0.25rem",  // 4px
    md: "0.5rem",   // 8px
    lg: "0.75rem",  // 12px
    xl: "1rem",     // 16px
    // ✅ ENTERPRISE FIX: Added padding subcategory για enterprise-token-bridge.ts
    padding: {
      xs: "0.125rem", // 2px
      sm: "0.25rem",  // 4px
      md: "0.5rem",   // 8px
      lg: "0.75rem",  // 12px
      xl: "1rem"      // 16px
    },
    // ✅ ENTERPRISE FIX: Added gap subcategory for InteractiveMap.styles.ts
    gap: {
      xs: "0.25rem",  // 4px
      sm: "0.5rem",   // 8px
      md: "1rem",     // 16px
      lg: "1.5rem"    // 24px
    }
  }
} as const;

const typography = {
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem", // ✅ ENTERPRISE FIX: Added missing 3xl size for useTypography.ts
    "4xl": "2.25rem"   // ✅ ENTERPRISE FIX: Added missing 4xl size for useTypography.ts
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700"
  },
  lineHeight: {
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2"
  }
} as const;

// Shadow definitions for compatibility
const shadows = {
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  focus: "0 0 0 3px rgba(59, 130, 246, 0.3)" // ✅ ENTERPRISE: Focus ring shadow for AlertConfigurationInterface.styles.ts
} as const;

// Animation definitions for compatibility
const animation = {
  duration: {
    fast: "150ms",
    normal: "300ms",
    slow: "500ms"
  },
  easing: {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out"
  }
} as const;

const transitions = {
  all: "all 200ms ease",
  colors: "background-color 150ms ease, color 150ms ease",
  transform: "transform 200ms ease"
} as const;

// ============================================================================
// BORDER TOKENS IMPLEMENTATION
// ============================================================================

const borderWidth = {
  none: '0',
  hairline: '0.5px',
  default: '1px',
  medium: '2px',
  thick: '3px',
  heavy: '4px'
} as const;

const borderColors = {
  default: {
    light: '#e2e8f0',
    dark: '#374151'
  },
  muted: {
    light: '#cbd5e1',
    dark: '#4b5563'
  },
  success: {
    light: '#10b981',
    dark: '#065f46'
  },
  error: {
    light: '#ef4444',
    dark: '#991b1b'
  },
  warning: {
    light: '#f59e0b',
    dark: '#92400e'
  },
  info: {
    light: '#3b82f6',
    dark: '#1e40af'
  }
} as const;

const borderStyle = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
  double: 'double',
  hidden: 'hidden',
  none: 'none'
} as const;

const coreBorderRadius = {
  none: '0',
  xs: '0.125rem',
  sm: '0.25rem',
  default: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  full: '9999px'
} as const;

const borderVariants = {
  card: {
    className: 'border border-gray-200 rounded-lg'
  },
  button: {
    default: {
      className: 'border border-gray-300'
    }
  },
  input: {
    default: {
      className: 'border border-gray-300 rounded-md'
    }
  },
  modal: {
    className: 'border-0 rounded-lg shadow-lg'
  },
  container: {
    className: 'border-0'
  },
  separator: {
    horizontal: {
      className: 'border-t border-gray-200'
    },
    vertical: {
      className: 'border-l border-gray-200'
    }
  },
  status: {
    success: {
      className: 'border border-green-500'
    },
    error: {
      className: 'border border-red-500'
    },
    warning: {
      className: 'border border-yellow-500'
    },
    info: {
      className: 'border border-blue-500'
    },
    muted: {
      className: 'border border-gray-400'
    }
  },
  interactive: {
    hover: {
      className: 'hover:border-gray-400'
    },
    focus: {
      className: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
    },
    selected: {
      className: 'border-blue-500 bg-blue-50'
    }
  }
} as const;

const borderUtils = {
  createBorder: (width: string, color: string, style: string = 'solid') => `${width} ${style} ${color}`,
  getVariantClass: (variant: string) => variant,
  combineBorders: (...classes: string[]) => classes.join(' '),
  withDarkMode: (lightClass: string, darkClass: string) => `${lightClass} dark:${darkClass}`
} as const;

const responsiveBorders = {
  mobile: {
    card: 'border',
    button: 'border',
    input: 'border'
  },
  tablet: {
    card: 'sm:border',
    button: 'sm:border',
    input: 'sm:border'
  },
  desktop: {
    card: 'lg:border',
    button: 'lg:border',
    input: 'lg:border'
  }
} as const;

const borders = {
  width: borderWidth,
  colors: borderColors,
  radius: coreBorderRadius,
  style: borderStyle,
  variants: borderVariants,
  utils: borderUtils,
  responsive: responsiveBorders,
  // ✅ ENTERPRISE FIX: Direct access properties για form-effects.ts
  createBorder: borderUtils.createBorder,
  getVariantClass: borderUtils.getVariantClass,
  combineBorders: borderUtils.combineBorders,
  withDarkMode: borderUtils.withDarkMode
} as const;

// Re-export από modular αρχεία
export { spacing };

export { typography };

// ✅ ENTERPRISE: borderRadius re-exports coreBorderRadius (Single Source of Truth)
// This ensures consistency across the entire application
// See: coreBorderRadius (line ~202) for the canonical definition
export const borderRadius = coreBorderRadius;

// ============================================================================
// 🎨 ENTERPRISE BORDER SYSTEM - Main Exports
// ============================================================================

// Complete border system export
export { borders };

// Individual border token exports
export { borderWidth, borderColors, borderStyle, borderVariants, borderUtils, responsiveBorders };

// Enhanced border radius from the new system (more comprehensive)
export { coreBorderRadius };

export { shadows };

export { animation };

export { transitions };

export { colors };

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

// 🏢 ENTERPRISE Z-INDEX HIERARCHY - Single Source of Truth
// Synced with design-tokens.json (see ADR-002 in centralized_systems.md)
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
  // 🚨 CRITICAL: Use only for system-level overlays (debuggers, error handlers)
  critical: 2147483647,
} as const;

// ============================================================================
// 🏢 ENTERPRISE: DIALOG/MODAL SIZE TOKENS
// ============================================================================
// Centralized dialog sizing for consistent modal dimensions
// ADR-031: Zero hardcoded values - all dialog sizes from here
// ============================================================================
export const DIALOG_SIZES = {
  /** Small dialog (400px) - confirmations, simple forms */
  sm: 'sm:max-w-md',
  /** Medium dialog (600px) - standard forms, selections */
  md: 'sm:max-w-[600px]',
  /** Large dialog (800px) - complex forms */
  lg: 'sm:max-w-[800px]',
  /** Extra large dialog (900px) - contact forms, multi-tab dialogs */
  xl: 'sm:max-w-[900px]',
  /** Full width dialog (1200px) - dashboards, complex UIs */
  full: 'sm:max-w-[1200px]',
} as const;

export const DIALOG_HEIGHT = {
  /** Standard dialog height constraint */
  standard: 'max-h-[90vh]',
  /** Shorter dialog for simpler content */
  short: 'max-h-[70vh]',
  /** Auto height - content determines */
  auto: '',
} as const;

export const DIALOG_SCROLL = {
  /** Enable vertical scrolling */
  scrollable: 'overflow-y-auto',
  /** No scroll - fixed content */
  fixed: 'overflow-hidden',
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
  
  // Icon sizes - ENTERPRISE EXTENDED SYSTEM
  icon: {
    // ============================================================================
    // 🎯 CORE ICON SIZES - EXISTING (BACKWARD COMPATIBLE)
    // ============================================================================
    xxs: 'h-2 w-2',      // 8px  - Micro icons
    xs: 'h-3 w-3',       // 12px - Tiny icons
    sm: 'h-4 w-4',       // 16px - Standard icons (most common)
    md: 'h-5 w-5',       // 20px - Medium icons
    lg: 'h-6 w-6',       // 24px - Large icons
    xl: 'h-8 w-8',       // 32px - Extra large icons
    '2xl': 'h-10 w-10',  // 40px - Double extra large

    // ============================================================================
    // 🚀 ENTERPRISE EXTENDED SIZES - PROFESSIONAL GRADE
    // ============================================================================
    // Following Tailwind spacing scale for consistency with enterprise standards
    xl2: 'h-12 w-12',    // 48px - Card headers, feature icons
    xl3: 'h-14 w-14',    // 56px - Section icons, user avatars
    xl4: 'h-16 w-16',    // 64px - Hero icons, prominent displays
    xl5: 'h-20 w-20',    // 80px - Large feature displays
    xl6: 'h-24 w-24',    // 96px - Loading spinners, thumbnails
    xl8: 'h-32 w-32',    // 128px - Large avatars, placeholders
    xl12: 'h-48 w-48',   // 192px - Empty states, splash screens

    // ============================================================================
    // 🏢 NUMERIC SIZES - FOR LUCIDE-REACT & SVG ICONS (size prop)
    // ============================================================================
    // Enterprise-grade numeric values for libraries that require pixel values
    numeric: {
      xxs: 8,    // Micro icons
      xs: 12,    // Tiny icons
      sm: 16,    // Standard icons (most common)
      md: 20,    // Medium icons
      lg: 24,    // Large icons
      xl: 32,    // Extra large icons
      '2xl': 40, // Double extra large
      xl2: 48,   // Card headers
      xl3: 56,   // Section icons
      xl4: 64,   // Hero icons
      xl5: 80,   // Large displays
      xl6: 96,   // Loading spinners
    },
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
  transitions,
  colors,
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

  // Grid layout utilities για dynamic grid patterns
  grid: {
    templateColumns: (columns: number) => ({ gridTemplateColumns: `repeat(${columns}, 1fr)` }),
    templateColumnsCustom: (pattern: string) => ({ gridTemplateColumns: pattern }),
    autoColumns: (size: string) => ({ gridAutoColumns: size }),
    gap: (size: number, unit: 'px' | 'rem' = 'rem') => ({ gap: `${size}${unit}` }),
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

  // 🏢 ENTERPRISE: Content area dimensions
  // Based on: Material Design (Google), Carbon (IBM), Fluent UI (Microsoft)
  // These tokens define minimum heights for content containers to ensure
  // consistent UX across different screen sizes and content types
  contentAreas: {
    // Tab content minimum heights
    tabContent: {
      sm: '300px',   // Compact tabs (settings, forms)
      md: '450px',   // Standard tabs (lists, details)
      lg: '600px',   // Large content tabs (floorplans, viewers)
      xl: '800px',   // Full-screen content (CAD viewers, maps)
    },
    // Viewer/preview minimum heights
    viewer: {
      compact: '350px',  // Thumbnail previews
      standard: '450px', // Document/PDF viewers
      expanded: '600px', // Floorplan/CAD viewers
      fullscreen: '80vh', // Immersive viewers
    },
    // Tailwind class equivalents for direct className usage
    tailwind: {
      tabContentSm: 'min-h-[300px]',
      tabContentMd: 'min-h-[450px]',
      tabContentLg: 'min-h-[600px]',
      tabContentXl: 'min-h-[800px]',
      viewerCompact: 'min-h-[350px]',
      viewerStandard: 'min-h-[450px]',
      viewerExpanded: 'min-h-[600px]',
      viewerFullscreen: 'min-h-[80vh]',
    },
  },

  // Dynamic percentage generator για width/height
  percentage: (value: number): string => `${Math.max(0, Math.min(100, value))}%`,

  // Dynamic pixel value generator
  pixels: (value: number): string => `${value}px`,

  // Dynamic rem value generator
  rem: (value: number): string => `${value}rem`,

  // Random height generator για chart skeletons & data visualization
  randomHeight: (min: number = 20, max: number = 100): string => `${Math.random() * (max - min) + min}%`,

  // Dynamic height utilities για scroll containers & responsive sizing
  maxHeight: (value: string | number): string => typeof value === 'number' ? `${value}px` : value,

  // ✅ ENTERPRISE FIX: Z-index utilities για ComboBox.tsx
  zIndex: {
    dropdown: 'z-50',
    modal: 'z-[1000]',
    tooltip: 'z-[2000]',
  },

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

  // ✅ ENTERPRISE: Centralized dropdown positioning system (NO MORE INLINE STYLES)
  // 🏢 Z-INDEX VALUES: Use CSS variables from design-tokens.json (--z-index-dropdown = 1000)
  dropdown: {
    // CSS Variables-based positioning (NO inline styles)
    // NOTE: z-index parameter kept for legacy compatibility but defaults to enterprise value
    setCSSPositioning: (position: { top: number; left: number; width: number }, zIndexValue: number = 1000) => {
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        root.style.setProperty('--dropdown-top', `${position.top}px`);
        root.style.setProperty('--dropdown-left', `${position.left}px`);
        root.style.setProperty('--dropdown-width', `${position.width}px`);
        // 🏢 ENTERPRISE: Prefer CSS variable, fallback to parameter
        root.style.setProperty('--dropdown-z-index', `${zIndexValue}`);
      }
    },

    // CSS Classes που χρησιμοποιούν τα CSS variables
    getDropdownClasses: (theme: 'default' | 'dark' | 'modal' = 'default') => {
      const baseClasses = 'fixed pointer-events-auto';
      const positionClasses = '[top:var(--dropdown-top)] [left:var(--dropdown-left)] [width:var(--dropdown-width)] [z-index:var(--dropdown-z-index)]';

      const themeClasses = {
        default: 'bg-popover text-popover-foreground border border-border',
        dark: 'bg-background text-foreground border border-border',
        modal: 'bg-popover text-popover-foreground border border-border shadow-lg'
      };

      return `${baseClasses} ${positionClasses} ${themeClasses[theme]}`;
    },

    // Legacy support - ΘΑ ΔΙΑΓΡΑΦΕΙ σε επόμενη φάση
    // 🏢 ENTERPRISE: Default z-index updated to 1000 (from design-tokens.json)
    portal: (position: { top: number; left: number; width: number }, zIndexValue: number = 1000) => ({
      position: 'fixed' as const,
      top: `${position.top}px`,
      left: `${position.left}px`,
      width: `${position.width}px`,
      zIndex: zIndexValue,
      // ⚠️ DEPRECATED: Χρησιμοποίησε setCSSPositioning + getDropdownClasses
    }),
  },

  // CSS Custom Properties utilities για geo-canvas design system compatibility
  cssVars: {
    // Color utilities
    borderColor: (focused: boolean) => focused ? 'var(--color-border-focus)' : 'var(--color-border-primary)',
    textColor: (variant: 'primary' | 'secondary' | 'tertiary') => `var(--color-text-${variant})`,
    backgroundColor: (variant: 'primary' | 'secondary' | 'surface') => `var(--color-bg-${variant})`,

    // Spacing utilities
    spacing: (size: number | string) => `var(--spacing-${size})`,
    marginBottom: (size: number | string) => ({ marginBottom: `var(--spacing-${size})` }),
    padding: (vertical: number | string, horizontal?: number | string) =>
      horizontal ? `var(--spacing-${vertical}) var(--spacing-${horizontal})` : `var(--spacing-${vertical})`,

    // Shadow utilities
    boxShadow: (focused: boolean) => focused ? 'var(--shadow-focus)' : 'none',

    // Border utilities
    border: (variant: 'primary' | 'secondary' = 'primary') => `1px solid var(--color-border-${variant})`,
    borderRadius: (size: 'sm' | 'md' | 'lg' = 'sm') => `var(--radius-${size})`,

    // Typography utilities
    fontSize: (size: string | number) => typeof size === 'string' ? size : `${size}px`,

    // Empty state typography patterns
    emptyState: {
      icon: { fontSize: '48px', marginBottom: 'var(--spacing-2)' },
      title: { fontSize: '16px', marginBottom: 'var(--spacing-1)' },
      subtitle: { fontSize: '14px' },
    },

    // UI help text patterns
    helpText: {
      small: { fontSize: '12px', opacity: 0.8 },
      muted: { fontSize: '11px', color: 'var(--color-text-tertiary)' },
    },

    // Text styling utilities για preview buttons
    textStyle: {
      bold: { fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none' },
      italic: { fontWeight: 'normal', fontStyle: 'italic', textDecoration: 'none' },
      underline: { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'underline' },
      strikethrough: { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'line-through' },
      normal: { fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none' },

      // Typography effects για technical notation
      superscript: { fontSize: '60%', verticalAlign: 'super' as const },
      subscript: { fontSize: '60%', verticalAlign: 'sub' as const },

      // Dynamic style based on button type
      forButton: (styleKey: string) => ({
        fontWeight: styleKey === 'isBold' ? 'bold' : 'normal',
        fontStyle: styleKey === 'isItalic' ? 'italic' : 'normal',
        textDecoration:
          styleKey === 'isUnderline' ? 'underline' :
          styleKey === 'isStrikethrough' ? 'line-through' : 'none'
      }),
    },

    // Flex layout utilities με CSS custom properties
    flex: {
      column: (gap?: number | string) => ({
        display: 'flex',
        flexDirection: 'column' as const,
        gap: gap ? `var(--spacing-${gap})` : undefined,
      }),
      row: (gap?: number | string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: gap ? `var(--spacing-${gap})` : undefined,
      }),
      columnGap: (gap: number | string) => ({
        display: 'flex',
        flexDirection: 'column' as const,
        gap: `var(--spacing-${gap})`,
      }),
      rowGap: (gap: number | string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: `var(--spacing-${gap})`,
      }),
      // Dynamic flex basis for fixed-width flex items (replaces inline flex: '0 0 Npx')
      fixedWidth: (width: number) => ({
        flex: `0 0 ${width}px`,
      }),
      // Interactive label pattern for form controls
      labelRow: (gap: number | string) => ({
        display: 'flex',
        alignItems: 'center',
        gap: `var(--spacing-${gap})`,
        fontSize: '12px',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
      }),
    },

    // Layout utilities για common patterns
    fullWidth: { width: '100%' },
    contentContainer: {
      padding: 'var(--spacing-4)',
      overflowY: 'auto' as const,
      flex: 1
    },

    // Debug/Calibration overlays enterprise patterns
    debugPanel: {
      base: {
        minWidth: 380,
        maxWidth: 450,
        maxHeight: '90vh',
        overflowY: 'auto' as const
      },
      tooltip: {
        position: 'absolute' as const,
        top: 20,
        left: -10,
        fontSize: 10,
        color: 'white',
        background: 'rgba(0,0,0,0.8)',
        padding: '1px 4px',
        borderRadius: 2,
        whiteSpace: 'nowrap' as const
      }
    },

    // Test components styling (temporary utilities)
    testContainer: {
      padding: 'var(--spacing-5)',
      border: '1px solid var(--color-border-secondary)',
      margin: 'var(--spacing-2)',
      borderRadius: 'var(--radius-md)',
      backgroundColor: 'var(--color-bg-secondary)'
    },

    // Debug floating panels
    // 🏢 ENTERPRISE: Uses centralized zIndex.tooltip for debug overlays
    debugFloat: {
      main: {
        position: 'fixed' as const,
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: 'var(--spacing-2)',
        zIndex: zIndex.tooltip, // Enterprise: centralized z-index
        fontSize: '12px',
        borderRadius: 'var(--radius-sm)'
      },
      button: {
        margin: 'var(--spacing-1)',
        padding: 'var(--spacing-1)',
        fontSize: '10px',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer'
      }
    },

    // Interactive elements patterns
    interactive: {
      auto: { pointerEvents: 'auto' as const },
      none: { pointerEvents: 'none' as const },
      minHeight: (height: string | number) => ({
        minHeight: typeof height === 'number' ? `${height}px` : height
      }),
      maxHeight: (height: string | number) => ({
        maxHeight: typeof height === 'number' ? `${height}px` : height
      }),
      // Combined min and max height utility (replaces inline minHeight + maxHeight patterns)
      heightRange: (minHeight: string | number, maxHeight: string | number) => ({
        minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight
      })
    },
    inputBase: {
      border: '1px solid var(--color-border-primary)',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--color-bg-primary)',
      color: 'var(--color-text-primary)',
    },

    // Transform utilities
    transform: {
      centerY: 'translateY(-50%)',
      centerX: 'translateX(-50%)',
      center: 'translate(-50%, -50%)',
    },

    // Common positioning patterns με CSS vars
    absoluteCenter: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    },

    absoluteCenterY: {
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
    },
  },

  // DXF-specific utilities για cursor, crosshair, και settings components
  dxf: {
    // Crosshair line utilities
    crosshairLine: {
      solid: (width: number, color: string) => ({
        height: `${width}px`,
        backgroundColor: color,
      }),

      dashed: (width: number, color: string) => ({
        height: `${width}px`,
        background: `repeating-linear-gradient(to right, ${color} 0, ${color} ${width * 6}px, transparent ${width * 6}px, transparent ${width * 12}px)`,
      }),

      dotted: (width: number, color: string) => ({
        height: `${width}px`,
        background: `repeating-linear-gradient(to right, ${color} 0, ${color} ${width}px, transparent ${width}px, transparent ${width * 8}px)`,
      }),

      dashDot: (width: number, color: string) => ({
        height: `${width}px`,
        background: `repeating-linear-gradient(to right,
          ${color} 0, ${color} ${width * 6}px,
          transparent ${width * 6}px, transparent ${width * 8}px,
          ${color} ${width * 8}px, ${color} ${width * 10}px,
          transparent ${width * 10}px, transparent ${width * 18}px)`,
      }),
    },

    // Dynamic dimension utilities για DXF settings
    dimensions: {
      lineWidth: (width: number) => ({ height: `${width}px` }),
      dynamicHeight: (value: number, unit: 'px' | '%' = 'px') => ({ height: `${value}${unit}` }),
      dynamicWidth: (value: number, unit: 'px' | '%' = 'px') => ({ width: `${value}${unit}` }),
    },

    // Color utilities για dynamic cursor colors
    colors: {
      backgroundColor: (color: string) => ({ backgroundColor: color }),
      borderColor: (color: string) => ({ borderColor: color }),
      color: (color: string) => ({ color }),
    },

    // Composite utilities για common DXF patterns
    composite: {
      coloredBar: (height: number, color: string) => ({
        height: `${height}px`,
        backgroundColor: color,
      }),
    },

    // Color swatch utilities για palette systems
    swatch: {
      square: (size: number, color: string) => ({
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
      }),
      withDimensions: (width: number, height: number, color: string) => ({
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: color,
      }),
      withOpacity: (color: string, opacity: number = 1) => ({
        backgroundColor: color,
        opacity,
      }),
    },

    // Grid utilities για color palette layouts
    grid: {
      swatchGrid: (columns: number, swatchSize: number) => ({
        gridTemplateColumns: `repeat(${columns}, ${swatchSize}px)`,
      }),
    },

    // Line preview utilities για style visualization
    linePreview: {
      withHeight: (height: number | string, background: string) => ({
        height: typeof height === 'number' ? `${height}px` : height,
        background,
      }),
      thin: (background: string) => ({
        height: '2px',
        background,
      }),
    },

    // Canvas utilities για DXF viewport styling
    canvas: {
      fullSize: {
        display: 'block' as const,
        width: '100%',
        height: '100%',
      },
      interactive: {
        display: 'block' as const,
        width: '100%',
        height: '100%',
        touchAction: 'none' as const,
      },
      withBackground: (backgroundColor: string) => ({
        display: 'block' as const,
        width: '100%',
        height: '100%',
        backgroundColor,
      }),
      overlay: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        pointerEvents: 'none' as const,
      },
    },

    // Cursor utilities για DXF interaction modes
    cursor: {
      none: { cursor: 'none' as const },
      crosshair: { cursor: 'crosshair' as const },
      pointer: { cursor: 'pointer' as const },
      grab: { cursor: 'grab' as const },
      grabbing: { cursor: 'grabbing' as const },
      move: { cursor: 'move' as const },
      default: { cursor: 'default' as const },
    },

    // Dynamic positioning utilities για calibration overlays
    positioning: {
      absoluteAt: (x: number, y: number, width: number = 16, height: number = 16) => ({
        position: 'absolute' as const,
        left: `${x - width / 2}px`,
        top: `${y - height / 2}px`,
        width: `${width}px`,
        height: `${height}px`,
      }),
      absoluteTopLeft: (x: number, y: number) => ({
        position: 'absolute' as const,
        left: `${x}px`,
        top: `${y}px`,
      }),
      tooltip: (x: number, y: number, offsetX: number = 15, offsetY: number = -35) => ({
        position: 'absolute' as const,
        left: `${x + offsetX}px`,
        top: `${y + offsetY}px`,
      }),

      // ✅ ENTERPRISE FIX: Status bar overlay positioning για ColorManager.tsx
      statusBarOverlays: {
        colorManagerContainer: (x: number, y: number) => ({
          position: 'absolute' as const,
          left: `${x}px`,
          top: `${y}px`,
          zIndex: zIndex.dropdown, // Enterprise: centralized z-index
        }),
      },
    },

    // Debugging utilities για calibration και testing
    debug: {
      testMarker: (x: number, y: number, isSuccess: boolean) => ({
        position: 'absolute' as const,
        left: `${x - 8}px`,
        top: `${y - 8}px`,
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: isSuccess ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)',
        border: '2px solid var(--color-background-primary)',
        boxShadow: `0 0 10px ${isSuccess ? 'rgba(0,255,0,0.8)' : 'rgba(255,165,0,0.8)'}`,
        pointerEvents: 'none' as const,
        animation: 'pulse 2s infinite',
      }),
      tooltip: {
        position: 'absolute' as const,
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '10px',
        whiteSpace: 'nowrap' as const,
        pointerEvents: 'none' as const,
      },
    },

    // Dropdown utilities για settings components
    // 🏢 ENTERPRISE: Uses centralized zIndex values
    dropdown: {
      content: {
        zIndex: zIndex.tooltip, // Enterprise: centralized z-index
        position: 'absolute' as const,
        backgroundColor: 'var(--color-background-tertiary)',
        border: '1px solid var(--color-border-secondary)',
        backdropFilter: 'none' as const,
        WebkitBackdropFilter: 'none' as const,
      },
      highZIndex: {
        zIndex: zIndex.tooltip, // Enterprise: centralized z-index
        position: 'absolute' as const,
      },
    },

    // Animation utilities για interactive elements
    animation: {
      delay: (seconds: number) => ({ animationDelay: `${seconds}s` }),
      duration: (milliseconds: number) => ({ animationDuration: `${milliseconds}ms` }),
      pingWithDelay: (delaySeconds: number) => ({
        animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        animationDelay: `${delaySeconds}s`
      }),
    },

    // Label utilities για forms και controls
    labels: {
      inverse: {
        color: 'var(--color-text-inverse)',
        fontSize: '0.875rem', // sm equivalent
      },
      primary: {
        color: 'var(--color-text-primary)',
        fontSize: '0.875rem',
      },
      small: {
        fontSize: '0.75rem', // xs equivalent
        color: 'var(--color-text-secondary)',
      },
      extraSmall: {
        fontSize: '0.75rem', // xs equivalent
        color: 'var(--color-text-primary)',
      },
    },

    // Dynamic color utilities για enterprise styling patterns
    dynamicColor: {
      text: (color: string): React.CSSProperties => ({ color }),
      background: (color: string): React.CSSProperties => ({ backgroundColor: color }),
      border: (color: string): React.CSSProperties => ({ borderColor: color }),
    },

    // Typography utilities για enterprise components
    typography: {
      alertTitle: {
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary
      } as React.CSSProperties,
    },
  },
} as const;

// ============================================================================
// PORTAL COMPONENTS - ENTERPRISE OVERLAY SYSTEM
// ============================================================================

/**
 * Portal Components για Overlay & Dropdown Systems
 * Enterprise-class portal management με z-index hierarchy και positioning
 */
// Base portal components (kept for compatibility)
// 🏢 ENTERPRISE: Portal components with centralized z-index
const portalComponentsBase = {
  overlay: {
    fullscreen: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none' as const,
    },
    backdrop: (zIndexValue: number = zIndex.dropdown) => ({
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: zIndexValue,
      pointerEvents: 'auto' as const,
    }),
  },

  dropdown: {
    absolute: (top: number, left: number, width: number, height?: number | string) => ({
      position: 'absolute' as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: height ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
      pointerEvents: 'auto' as const,
    }),
    custom: (config: {
      top: number;
      left: number;
      width: number;
      height?: number | string;
      minHeight?: string;
      maxHeight?: string
    }) => ({
      position: 'absolute' as const,
      top: `${config.top}px`,
      left: `${config.left}px`,
      width: `${config.width}px`,
      height: config.height ? (typeof config.height === 'number' ? `${config.height}px` : config.height) : 'auto',
      minHeight: config.minHeight || undefined,
      maxHeight: config.maxHeight || undefined,
      pointerEvents: 'auto' as const,
    }),
  },

  // 🏢 ENTERPRISE: Modal z-index uses centralized values
  modal: {
    backdrop: {
      zIndex: (customZIndex?: number) => customZIndex || zIndex.modal,
    },
    content: {
      zIndex: (customZIndex?: number) => (customZIndex || zIndex.modal) + 1,
    },
  },

  // 🏢 ENTERPRISE: Reference to centralized zIndex (no duplicates!)
  // All values come from the main zIndex object defined at line ~382
  // Property name kept as 'zIndex' for backward compatibility
  zIndex
} as const;

// ============================================================================
// 🏢 ENTERPRISE ENTITY LIST TOKENS - Centralized List Column Configuration
// ============================================================================
/**
 * 🏢 ENTITY LIST PRIMITIVES - RAW NUMERIC VALUES
 *
 * Single Source of Truth for all entity list dimensions.
 * ALL derived values (classes, CSS) MUST reference these primitives.
 *
 * @enterprise Fortune 500 compliant - Autodesk/Bentley standard
 * @immutable These values should NEVER be duplicated or hardcoded elsewhere
 */
const ENTITY_LIST_PRIMITIVES = {
  /** Minimum width of entity list column in pixels */
  MIN_WIDTH: 300,
  /** Maximum width of entity list column in pixels */
  MAX_WIDTH: 420,
  /** Space reserved for scrollbar appearance on hover in pixels */
  SCROLLBAR_SPACE: 8,
} as const;

/**
 * 🏢 ENTITY_LIST_TOKENS
 *
 * Centralized tokens for entity list columns (Buildings, Contacts, Units, etc.)
 *
 * ⚠️ CRITICAL: Tailwind classes MUST be STATIC strings (not template literals)!
 * Template literals like `min-w-[${VALUE}px]` are NOT detected by Tailwind JIT
 * and no CSS will be generated - causing full-width layouts.
 *
 * ✅ SOLUTION: Use CSS variables with static class names:
 *    min-w-[var(--entity-list-min)] instead of min-w-[${VALUE}px]
 *
 * CSS Variables defined in: src/app/globals.css
 *   --entity-list-min: 300px
 *   --entity-list-max: 420px
 *   --entity-list-scrollbar-space: 8px
 *
 * @enterprise Fortune 500 compliant - Autodesk/Bentley/Google standard
 * @see ENTITY_LIST_PRIMITIVES for numeric values (kept for reference)
 * @see src/app/globals.css for CSS variable definitions
 * @see src/core/containers/EntityListColumn.tsx - Component that uses these tokens
 * @author Enterprise Architecture Team
 * @since 2026-01-09
 */
export const ENTITY_LIST_TOKENS = {
  /** 🏢 RAW NUMERIC VALUES - Direct access to primitives (for reference only) */
  values: ENTITY_LIST_PRIMITIVES,

  /**
   * Width constraints for list columns
   * ✅ STATIC class names using CSS variables - Tailwind JIT compatible
   */
  width: {
    min: 'min-w-[var(--entity-list-min)]',
    max: 'max-w-[var(--entity-list-max)]',
    /** Combined width classes */
    combined: 'min-w-[var(--entity-list-min)] max-w-[var(--entity-list-max)]',
  },

  /**
   * 🏢 CARD DIMENSIONS - For items inside list
   * ✅ STATIC class names using CSS variables - Tailwind JIT compatible
   */
  card: {
    /** Width accounting for scrollbar space on hover */
    width: 'w-[calc(100%-var(--entity-list-scrollbar-space))]',
    /** Full width without scrollbar compensation */
    fullWidth: 'w-full',
  },

  /** Layout configuration - Standard flexbox patterns */
  layout: {
    display: 'flex',
    direction: 'flex-col',
    shrink: 'shrink-0',
    /** Combined layout classes */
    combined: 'flex flex-col shrink-0',
  },

  /** Visual styling - Semantic token references */
  visual: {
    background: 'bg-card',
    shadow: 'shadow-sm',
    overflow: 'overflow-hidden',
    maxHeight: 'max-h-full',
    heightFit: 'h-fit',
  },
} as const;

/** Type for ENTITY_LIST_TOKENS for external usage */
export type EntityListTokens = typeof ENTITY_LIST_TOKENS;

// 🏢 ENTERPRISE: Extended portal components with centralized z-index hierarchy
// All values derived from centralized zIndex object (ADR-002)
export const portalComponentsExtended = {
  ...portalComponentsBase,
  // 🏢 ENTERPRISE: Extended dropdown variants for EnterprisePortalSystem
  dropdown: {
    ...portalComponentsBase.dropdown,
    // Base positioned dropdown style - used as default for all variants
    positioned: {
      position: 'fixed' as const,
      zIndex: zIndex.dropdown,
      backgroundColor: colors.background.primary,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      border: `1px solid ${colors.border.primary}`,
      overflow: 'hidden',
    },
    // Relationship dropdown variant (for relationship/entity selectors)
    relationship: {
      maxHeight: '300px',
      overflowY: 'auto' as const,
    },
    // Generic selector variant (for form selects, filters)
    selector: {
      minWidth: '200px',
      maxHeight: '400px',
      overflowY: 'auto' as const,
    },
  },
  overlay: {
    ...portalComponentsBase.overlay,
    // CAD Overlay Hierarchy: Uses zIndex.overlay (1300) as base, with +50 increments
    base: { zIndex: () => zIndex.overlay },                    // 1300
    fullscreen: { zIndex: () => zIndex.modal },                // 1400
    crosshair: { zIndex: () => zIndex.modal + 50 },            // 1450
    selection: { zIndex: () => zIndex.modal + 60 },            // 1460
    tooltip: { zIndex: () => zIndex.modal + 70 },              // 1470
    snap: { zIndex: () => zIndex.modal + 80 },                 // 1480
    search: { zIndex: () => zIndex.modal + 90 },               // 1490
    searchResults: { zIndex: () => zIndex.popover },           // 1500
    controls: { zIndex: () => zIndex.popover + 10 },           // 1510
    zoom: { zIndex: () => zIndex.popover + 20 },               // 1520
    calibration: { zIndex: () => zIndex.popover + 30 },        // 1530
    // ✅ ENTERPRISE FIX: Debug overlays above calibration
    debug: {
      zIndex: () => zIndex.popover + 40,                       // 1540
      info: { zIndex: () => zIndex.popover + 41 },             // 1541
      main: { zIndex: () => zIndex.popover + 42 },             // 1542
      controls: { zIndex: () => zIndex.popover + 43 }          // 1543
    },
    floatingPanel: { zIndex: () => zIndex.popover + 50 }       // 1550
  },
  canvas: {
    fullscreen: { zIndex: () => zIndex.modal },                // 1400
    layers: {
      dxf: { zIndex: () => zIndex.banner },                    // 1200
      layer: { zIndex: () => zIndex.banner + 10 }              // 1210
    }
  },
  // 🏢 ENTERPRISE: Positioning utilities for dropdown/portal placement
  positioning: {
    dropdownOffset: { top: 4, left: 0, bottom: 4 },
    tooltipOffset: { top: 8, left: 0, bottom: 8 },
    modalOffset: { top: 0, left: 0, bottom: 0 }
  }
};

// ============================================================================
// SVG UTILITIES - GRAPHICS RENDERING SYSTEM
// ============================================================================

/**
 * SVG Utilities για Canvas & Graphics Rendering
 * Enterprise-class SVG styling με text effects και shape patterns
 */
export const svgUtilities = {
  text: {
    withStroke: (strokeColor: string = 'white', strokeWidth: number = 4) => ({
      paintOrder: 'stroke' as const,
      stroke: strokeColor,
      strokeWidth: `${strokeWidth}px`,
      strokeLinejoin: 'round' as const,
    }),
    outlined: (strokeColor: string = 'white', strokeWidth: number = 2) => ({
      paintOrder: 'stroke' as const,
      stroke: strokeColor,
      strokeWidth: `${strokeWidth}px`,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    }),
  },

  shapes: {
    backgroundRect: (color: string, opacity: number = 1) => ({
      fill: color,
      opacity,
      pointerEvents: 'none' as const,
    }),
  },
} as const;

// ============================================================================
// INTERACTION UTILITIES - USER INTERFACE CONTROL
// ============================================================================

/**
 * Interaction Utilities για User Input & Selection Control
 * Enterprise-class interaction management με cross-browser compatibility
 */
export const interactionUtilities = {
  pointerEvents: {
    none: { pointerEvents: 'none' as const },
    auto: { pointerEvents: 'auto' as const },
    all: { pointerEvents: 'all' as const },
  },

  userSelect: {
    none: {
      userSelect: 'none' as const,
      WebkitUserSelect: 'none' as const,
      MozUserSelect: 'none' as const,
      msUserSelect: 'none' as const,
    },
    text: { userSelect: 'text' as const },
    all: { userSelect: 'all' as const },
  },

  // Combined interaction patterns για common use cases
  nonInteractive: {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    MozUserSelect: 'none' as const,
    msUserSelect: 'none' as const,
  },

  overlay: {
    position: 'absolute' as const,
    pointerEvents: 'auto' as const,
    userSelect: 'text' as const,
  },
} as const;

// ============================================================================
// MODULAR DESIGN TOKENS INTEGRATION
// ============================================================================

// ============================================================================
// ✅ ENTERPRISE FIX: PORTAL COMPONENTS EXPORT
// ============================================================================

/**
 * 🏢 ENTERPRISE PHOTO PREVIEW COMPONENTS
 * Centralized styling for photo preview states
 */
export const photoPreviewComponents = {
  container: {
    base: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.lg,
      overflow: 'hidden' as const,
      transition: 'all 0.2s ease-in-out'
    },
    uploading: {
      opacity: 0.7,
      cursor: 'wait'
    },
    error: {
      borderColor: colors.error['500'],
      backgroundColor: colors.error['50']
    },
    withPhoto: {
      border: `2px solid ${colors.primary['500']}`,
      backgroundColor: colors.background.primary
    },
    empty: {
      border: `2px dashed ${colors.border.primary}`,
      backgroundColor: colors.background.secondary
    }
  },
  colors: {
    emptyStateBackground: colors.background.secondary,
    emptyStateBorder: colors.border.primary,
    withPhotoBorder: colors.primary['500'],
    // 🏢 ENTERPRISE: Additional colors for migration-utilities (2026-01-19)
    uploadingBackground: '#f8fafc', // Slate-50 - uploading state
    errorBackground: colors.error['50'] // Error state background
  }
} as const;

export const photoPreviewLayout = {
  dialog: {
    mobile: 'fixed inset-x-0 top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)] max-w-none w-screen rounded-none border-0 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] pb-[max(env(safe-area-inset-bottom),5rem)]',
    desktop: 'fixed inset-0 max-w-none w-screen h-screen rounded-none border-0'
  },
  image: {
    base: 'max-w-full max-h-full object-contain'
  }
} as const;

/**
 * 🏢 ENTERPRISE PORTAL COMPONENTS - MAIN EXPORT
 * Export extended portal components as main portalComponents για backward compatibility
 * This ensures that CoordinateCalibrationOverlay can access calibration.zIndex()
 */
export const portalComponents = portalComponentsExtended;

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
  version: '2.1.0',
  description: 'Enterprise-class modular design tokens με performance optimization support',
  migrationGuide: 'See ./design-tokens/index.ts for full API documentation',
  modules: [
    'semantic/alert-tokens.ts - Alert severity, status, AutoSave indicators',
    'components/dashboard-tokens.ts - Dashboard layouts, metrics, charts',
    'components/map-tokens.ts - Map interfaces, polygons, drawing tools',
    'components/dialog-tokens.ts - Modals, forms, wizards, steps',
    'performance/performance-tokens.ts - Virtualized tables, metrics, analytics'
  ]
} as const;

// ============================================================================
// PERFORMANCE COMPONENTS - ENTERPRISE VIRTUALIZATION SYSTEM
// ============================================================================

// ============================================================================
// PERFORMANCE COMPONENTS - MOVED TO MODULAR SYSTEM
// ============================================================================

/**
 * 🔄 MIGRATED: Performance components μετακινήθηκαν σε modular architecture
 *
 * @deprecated Use: import { performanceComponents } from './design-tokens/components/performance-tokens'
 * @see src/styles/design-tokens/components/performance-tokens.ts
 *
 * Note: Re-export removed to prevent circular dependency
 */

// ============================================================================
// CHART COMPONENTS - MOVED TO MODULAR SYSTEM
// ============================================================================

/**
 * 🔄 MIGRATED: Chart components μετακινήθηκαν σε modular architecture
 *
 * @deprecated Use: import { chartComponents } from './design-tokens/components/chart-tokens'
 * @see src/styles/design-tokens/components/chart-tokens.ts
 *
 * Note: Re-export removed to prevent circular dependency
 */

// ============================================================================
// CANVAS UTILITIES - MOVED TO MODULAR SYSTEM
// ============================================================================

/**
 * 🔄 MIGRATED: Canvas utilities μετακινήθηκαν σε modular architecture
 *
 * @deprecated Use: import { canvasUtilities } from './design-tokens/utilities/canvas-utilities'
 * @see src/styles/design-tokens/utilities/canvas-utilities.ts
 *
 * ⚠️ MASSIVE EXTRACTION: ~1,850 lines μεταφέρθηκαν σε dedicated module
 * Note: Re-export removed to prevent circular dependency
 */

// ============================================================================
// DIALOG COMPONENTS - MODULAR SYSTEM RE-EXPORTS
// ============================================================================

/**
 * 🔄 Re-export για backward compatibility
 * Από το νέο modular design tokens system
 *
 * Note: Re-exports removed to prevent circular dependency
 * Use direct imports: import { dialogComponents } from './design-tokens/index'
 */

// ============================================================================
// CANVAS UTILITIES RE-EXPORT - BACKWARD COMPATIBILITY FIX
// ============================================================================

/**
 * ROLE: LOW-LEVEL CANVAS ENGINE
 *
 * This module provides generic, reusable primitives for
 * canvas-based interactions (geo, DXF, generic shapes).
 *
 * ⚠️ DO NOT:
 * - Add domain-specific (map-only) logic here
 * - Rename APIs for UX clarity
 *
 * ✅ Allowed:
 * - Math
 * - Geometry
 * - Hit-testing
 *
 * Higher-level map logic MUST live in InteractiveMap.styles.ts
 */
export const canvasUtilities = {
  geoInteractive: {
    viewport: {
      padding: spacing.md,
      margin: spacing.lg
    },
    positioning: {
      center: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
      topRight: { position: 'absolute', top: spacing.md, right: spacing.md }
    },
    mobileSlideHeader: (): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border.primary}`,
      backgroundColor: colors.background.primary,
      minHeight: '48px',
      position: 'sticky',
      top: 0,
      zIndex: zIndex.docked // Enterprise: centralized z-index
    }),
    mobileSlideHeaderClass: 'flex items-center gap-2 px-2 py-2 border-b bg-card min-h-12 sticky top-0 z-10',
    mobileSlideContent: (): React.CSSProperties => ({
      flex: '1 1 auto',
      overflowY: 'auto',
      backgroundColor: colors.background.primary,
      padding: spacing.md,
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }),
    mobileSlideContentClass: 'flex-1 overflow-y-auto bg-card p-4 h-full flex flex-col',
    canvasFullDisplay: (): React.CSSProperties => ({
      width: '100%',
      height: '100%',
      display: 'block',
      backgroundColor: colors.background.secondary,
      border: 'none',
      outline: 'none'
    }),

    /**
     * 🎯 DRAGGABLE PANEL CONTAINER UTILITY
     * ENTERPRISE: Centralized draggable panel styling για geo interface
     * Replaces: inline styles in geo components
     */
    draggablePanelContainer: (
      position: { x: number; y: number },
      isDragging: boolean,
      width?: number
    ): React.CSSProperties => ({
      position: 'absolute',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: width ? `${width}px` : 'auto',
      minWidth: '200px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #e5e5e5',
      borderRadius: '8px',
      boxShadow: isDragging
        ? '0 8px 25px -5px rgba(0, 0, 0, 0.3)'
        : '0 4px 15px -3px rgba(0, 0, 0, 0.2)',
      zIndex: zIndex.dropdown, // Enterprise: centralized z-index
      cursor: isDragging ? 'grabbing' : 'auto',
      userSelect: 'none' as const,
      backdropFilter: 'blur(4px)',
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      transition: isDragging ? 'none' : 'all 0.2s ease-in-out'
    }),

    /**
     * 🎯 PDF FALLBACK CONTAINER UTILITY
     * ENTERPRISE: PDF fallback container styling
     */
    pdfFallbackContainer: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: '8px',
      color: colors.text.muted,
      fontSize: '14px'
    }),

    /**
     * 🎯 PDF DISPLAY WRAPPER UTILITY
     * ENTERPRISE: PDF display wrapper styling
     */
    pdfDisplayWrapper: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: colors.background.primary
    }),

    /**
     * 🎯 DEBUG CROSSHAIR POSITION UTILITY
     * ENTERPRISE: Debug crosshair positioning
     */
    debugCrosshairPosition: (x: number, y: number): React.CSSProperties => ({
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none' as const,
      zIndex: zIndex.tooltip // Enterprise: centralized z-index
    }),

    /**
     * 🎯 RESPONSIVE UTILITIES
     * ENTERPRISE: Responsive layout helpers for geo-canvas
     */
    responsive: {
      mobileBreakpoint: 768,
      tabletBreakpoint: 1024,
      desktopBreakpoint: 1280,
      containerPadding: (isMobile: boolean): string => isMobile ? spacing.sm : spacing.md,
      gridGap: (isMobile: boolean): string => isMobile ? spacing.sm : spacing.md,
      flexWrap: (isMobile: boolean): React.CSSProperties['flexWrap'] => isMobile ? 'wrap' : 'nowrap'
    }

    /**
     * NOTE:
     * Map-specific interaction utilities previously exposed here
     * have been intentionally removed.
     *
     * All map-related styling and interaction logic now lives in:
     * src/subapps/geo-canvas/components/InteractiveMap.styles.ts
     *
     * This engine module MUST remain map-agnostic.
     */
  },
  drawing: {
    strokeWidth: '2px',
    fillOpacity: 0.2
  }
};

/**
 * 🎯 STATUS INDICATOR COMPONENTS - ENTERPRISE AUTO-SAVE SYSTEM
 */
export const autoSaveStatusTokens = {
  base: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs
  },
  variants: {
    saving: {
      backgroundColor: semanticColors.status.warning,
      color: colors.text.inverse
    },
    saved: {
      backgroundColor: semanticColors.status.success,
      color: colors.text.inverse
    },
    error: {
      backgroundColor: semanticColors.status.error,
      color: colors.text.inverse
    },
    idle: {
      backgroundColor: colors.background.secondary,
      color: colors.text.secondary
    }
  }
} as const;

export const statusIndicatorComponents = {
  // Main container styles
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },

  // Text styles
  text: {
    primary: {
      color: colors.text.primary,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    secondary: {
      color: colors.text.secondary,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.normal
    }
  },

  // Status colors
  statusColors: {
    saving: {
      backgroundColor: semanticColors.status.warning,
      color: colors.text.inverse
    },
    success: {
      backgroundColor: semanticColors.status.success,
      color: colors.text.inverse
    },
    error: {
      backgroundColor: semanticColors.status.error,
      color: colors.text.inverse
    },
    idle: {
      backgroundColor: colors.background.secondary,
      color: colors.text.secondary
    }
  },

  // Status dot styles
  statusDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: borderRadius.full,
    flexShrink: 0,
    transition: 'background-color 150ms ease'
  },

  // Separator styles
  separator: {
    width: '1px',
    height: '1rem',
    backgroundColor: colors.border.secondary,
    opacity: 0.7
  }
} as const;

// ============================================================================
// 🎨 BRAND CONSISTENCY - CSS CLASS MAPPINGS
// ============================================================================

/**
 * ✅ ENTERPRISE: Centralized CSS class mappings για brand consistency
 * Replaces hardcoded Tailwind classes με design system values
 */
export const brandClasses = {
  // Primary brand colors
  primary: {
    text: 'text-blue-500',        // colors.blue[500]
    bg: 'bg-blue-50',            // light background
    bgDark: 'bg-blue-500',       // solid background
    border: 'border-blue-200',    // subtle border
    ring: 'ring-blue-100',       // focus ring

    // Interactive states
    hover: {
      text: 'hover:text-blue-600',
      bg: 'hover:bg-blue-100',
      border: 'hover:border-blue-500',
    },

    // Badge styles
    badge: 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full',

    // Focus states
    focus: 'focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0',
  },

  // Loading/spinner colors
  loading: {
    spinner: 'border-blue-600',
    spinnerLight: 'border-blue-400',
  },

  // Status indicators
  info: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',

    // Card styles
    card: 'bg-blue-50 rounded-lg p-4 border-2 border-blue-200',
    title: 'text-blue-700',
  },

  // Interactive elements
  interactive: {
    button: 'bg-blue-600 text-white font-medium',
    buttonHover: 'hover:bg-blue-700',
    link: 'text-blue-600 hover:text-blue-700',
  },

  // Effect classes
  effects: {
    shadow: 'hover:shadow-blue-500/20',
    borderGlow: 'hover:border-blue-500/50',
    scale: 'hover:scale-110',
  }
} as const;

/**
 * 🔧 Helper function να get brand classes dynamically
 * ✅ ENTERPRISE: No 'any' - uses proper type narrowing
 */
export const getBrandClass = (category: keyof typeof brandClasses, variant?: string): string => {
  const categoryClasses = brandClasses[category];

  if (variant && typeof categoryClasses === 'object' && variant in categoryClasses) {
    // ✅ ENTERPRISE: Use Record<string, unknown> instead of 'any' for type-safe access
    const value = (categoryClasses as Record<string, unknown>)[variant];
    return typeof value === 'string' ? value : '';
  }

  return typeof categoryClasses === 'string' ? categoryClasses : '';
};

// ============================================================================
// PERFORMANCE COMPONENTS - ENTERPRISE PERFORMANCE SYSTEM
// ============================================================================

interface PerformanceComponentsType {
  readonly performanceMonitor: {
    readonly dimensions: {
      readonly estimatedHeight: number;
      readonly maxWidth: string;
      readonly minWidth: string;
    };
    readonly colors: {
      readonly fps: {
        readonly excellent: string;
        readonly poor: string;
      };
      readonly alerts: {
        readonly background: string;
        readonly border: string;
        readonly text: string;
        readonly icon: string;
      };
    };
  };
}

export const performanceComponents: PerformanceComponentsType = {
  performanceMonitor: {
    dimensions: {
      estimatedHeight: 300,
      maxWidth: '400px',
      minWidth: '320px'
    },
    colors: {
      fps: {
        excellent: semanticColors.status.success,
        poor: semanticColors.status.error
      },
      alerts: {
        background: colors.background.secondary,
        border: colors.border.primary,
        text: colors.text.primary,
        icon: semanticColors.status.warning
      }
    }
  }
} as const;

// Floating system utilities
export const FloatingStyleUtils = {
  getPerformanceDashboardClasses: (isDragging: boolean) => `${isDragging ? 'opacity-70' : ''}`,
  getCornerButtonClasses: (position: string) => `absolute ${position === 'top-right' ? 'top-2 right-2' : ''}`
};

export const PerformanceDashboardTokens = {
  behavior: {
    autoCenter: true
  }
};

// Performance Monitor Utilities
// 🏢 ENTERPRISE: Draggable floating panels - OPAQUE backgrounds (no transparency!)
export const performanceMonitorUtilities = {
  // ✅ ENTERPRISE FIX: Use bg-card (standard Tailwind) instead of arbitrary bg-[hsl(...)]
  // This ensures solid, opaque backgrounds for draggable panels
  // ✅ CRITICAL: pointer-events-auto ensures panels work even when parent has pointer-events-none
  getOverlayContainerClasses: () => 'fixed bg-card border border-border rounded-lg shadow-lg pointer-events-auto',
  // ✅ ENTERPRISE FIX: Use higher z-index (1700) to ensure panels are ALWAYS above canvas overlays
  getOverlayContainerStyles: () => ({ zIndex: zIndex.toast }),  // 1700 - above all canvas elements
  // 🏢 ENTERPRISE: Standardized 8px padding (p-2) for consistent spacing across all floating panels
  getOverlayHeaderClasses: () => 'flex items-center justify-between p-2 border-b border-border cursor-grab pointer-events-auto',
  // ✅ ENTERPRISE FIX: Removed inline backgroundColor - using Tailwind classes for consistency
  getOverlayHeaderStyles: () => ({}),
  // ✅ ENTERPRISE FIX: Return empty objects - use Tailwind classes in components for theme-aware colors
  getOverlayIconStyles: (type: string) => ({}),
  getOverlayTitleStyles: () => ({}),
  getOverlayButtonStyles: () => ({
    color: colors.text.secondary,
    padding: spacing.xs
  }),
  // ✅ ENTERPRISE: Content styles - no maxHeight restriction for full content visibility
  getOverlayContentStyles: () => ({}),
  getMetricValueClasses: (type: string, value: number) =>
    value > 50 ? 'text-green-600' : 'text-red-600',
  getActionButtonClasses: (variant: string, fullWidth: boolean) =>
    `${variant === 'primary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} ${fullWidth ? 'w-full' : ''}`,
  getChartBarClasses: (value: number) =>
    value > 70 ? 'bg-green-500' : value > 40 ? 'bg-yellow-500' : 'bg-red-500',

  // 🏢 ENTERPRISE: Trend indicator color classes (NO inline styles!)
  // @since 2026-01-02 - Added for full centralization compliance
  getTrendColorClass: (direction: 'up' | 'down'): string =>
    direction === 'up' ? 'text-green-600' : 'text-red-600',

  // 🏢 ENTERPRISE: Success state classes for performance optimization panel
  // Returns consistent Tailwind classes instead of inline style={{ color }}
  getSuccessStateClasses: (): { icon: string; text: string } => ({
    icon: 'text-green-600',
    text: 'text-green-600'
  }),

  // 🏢 ENTERPRISE: Performance grade color classes
  // Maps performance grades to semantic Tailwind classes
  getPerformanceGradeClasses: (grade: 'excellent' | 'good' | 'fair' | 'poor'): string => {
    const gradeClassMap: Record<string, string> = {
      excellent: 'text-green-600',
      good: 'text-green-500',
      fair: 'text-yellow-600',
      poor: 'text-red-600'
    };
    return gradeClassMap[grade] || 'text-muted-foreground';
  }
};

// Canvas UI Components
export const canvasUI = {
  container: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.primary}`,
    borderRadius: borderRadius.md
  },
  overlay: {
    backgroundColor: colors.background.overlay,
    zIndex: zIndex.overlay,
    // 🏢 ENTERPRISE: Centralized overlay indicator colors (CAD-standard)
    colors: {
      /** Snap indicator - bright green for high visibility (AutoCAD standard) */
      snap: {
        border: colors.green["400"],
        background: colors.green["500"],
        glow: `0 0 4px ${colors.green["500"]}`
      },
      /** Zoom window - yellow for clear distinction (industry standard) */
      zoom: {
        border: 'rgba(250, 204, 21, 0.9)', // Yellow with high opacity
        background: 'rgba(250, 204, 21, 0.1)', // Yellow with low fill
        borderSolid: colors.yellow["400"]
      },
      /** Selection marquee - blue for selection operations */
      selection: {
        window: {
          border: 'rgba(59, 130, 246, 0.8)',   // Blue - left-to-right selection
          background: 'rgba(59, 130, 246, 0.1)'
        },
        crossing: {
          border: 'rgba(34, 197, 94, 0.8)',    // Green - right-to-left selection
          background: 'rgba(34, 197, 94, 0.1)'
        }
      }
    }
  },
  controls: {
    padding: spacing.md,
    gap: spacing.sm
  },
  // ✅ ENTERPRISE FIX: Added colorPicker property για EnterpriseColorArea.tsx
  colorPicker: {
    colorPickerArea: (size: string) => ({
      width: size,
      height: size,
      borderRadius: borderRadius.md
    } as React.CSSProperties),
    colorPickerThumb: (position: { x: number; y: number }, color: string) => ({
      left: `${position.x * 100}%`,
      top: `${position.y * 100}%`,
      backgroundColor: color
    } as React.CSSProperties)
  },
  positioning: {
    layers: {
      canvasOverlayWithPointerControl: (activeTool?: string): React.CSSProperties => ({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex.overlay,
        pointerEvents: activeTool === 'select' || activeTool === 'layering' ? 'auto' : 'none',
        // 🏢 FIX (2026-01-04): Select tool uses 'none' cursor - crosshair overlay is the only cursor
        cursor: activeTool === 'pan' ? 'grab' : 'none'
      }),
      layerCanvasWithTools: (activeTool?: string, crosshairEnabled?: boolean): React.CSSProperties => ({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex.base,
        pointerEvents: 'auto', // Layer canvas always captures events
        // 🏢 FIX (2026-01-04): Select tool uses 'none' cursor - crosshair overlay is the only cursor
        // Το σταυρόνημα εμφανίζεται μόνο από το CrosshairOverlay component
        cursor: activeTool === 'pan' ? 'grab' :
                activeTool === 'zoom' ? 'zoom-in' :
                'none', // ✅ CAD-GRADE: Always hide CSS cursor, crosshair is the only cursor
        touchAction: 'none', // Prevent browser touch gestures
        userSelect: 'none' as const
      }),
      dxfCanvasWithTools: (activeTool?: string, crosshairEnabled?: boolean): React.CSSProperties => ({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex.docked, // Higher than layer canvas for DXF content
        pointerEvents: 'auto', // DXF canvas captures events for drawing
        // 🏢 FIX (2026-01-04): Select tool uses 'none' cursor - crosshair overlay is the only cursor
        // Το σταυρόνημα εμφανίζεται μόνο από το CrosshairOverlay component
        cursor: activeTool === 'pan' ? 'grab' :
                activeTool === 'zoom' ? 'zoom-in' :
                'none', // ✅ CAD-GRADE: Always hide CSS cursor, crosshair is the only cursor
        touchAction: 'none', // Prevent browser touch gestures
        userSelect: 'none' as const
        // ❌ REMOVED: backgroundColor - ADR-004 requires CANVAS_THEME from color-config.ts
        // 📍 Background is now set separately using CANVAS_THEME.DXF_CANVAS
      })
    },

    // ✅ ENTERPRISE: Canvas overlay positioning utilities
    tooltip: {
      positioned: (x: number, y: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${x + 10}px`,
        top: `${y - 10}px`,
        zIndex: zIndex.tooltip,
        pointerEvents: 'none',
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        padding: spacing.xs,
        borderRadius: borderRadius.sm,
        fontSize: typography.fontSize.sm,
        border: `1px solid ${colors.border.primary}`,
        boxShadow: shadows.sm
      })
    },

    marquee: {
      positioned: (startX: number, startY: number, endX: number, endY: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${Math.min(startX, endX)}px`,
        top: `${Math.min(startY, endY)}px`,
        width: `${Math.abs(endX - startX)}px`,
        height: `${Math.abs(endY - startY)}px`,
        border: `2px dashed ${colors.primary[500]}`,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointerEvents: 'none',
        zIndex: zIndex.overlay
      })
    },

    snapIndicator: {
      positioned: (x: number, y: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${x - 5}px`,
        top: `${y - 5}px`,
        width: '10px',
        height: '10px',
        border: `2px solid ${colors.green["500"]}`,
        borderRadius: '50%',
        backgroundColor: colors.background.primary,
        pointerEvents: 'none',
        zIndex: zIndex.overlay,
        boxShadow: `0 0 4px ${colors.green["500"]}`
      })
    },

    zoomWindow: {
      positioned: (startX: number, startY: number, endX: number, endY: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${Math.min(startX, endX)}px`,
        top: `${Math.min(startY, endY)}px`,
        width: `${Math.abs(endX - startX)}px`,
        height: `${Math.abs(endY - startY)}px`,
        border: `2px solid ${colors.blue["600"]}`,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        pointerEvents: 'none',
        zIndex: zIndex.overlay
      })
    },

    // ✅ ENTERPRISE FIX: Missing floating panel positioning for TestResultsModal
    floatingPanel: {
      testModal: {
        backdrop: {
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: zIndex.modal
        },
        content: {
          position: 'relative' as const,
          maxWidth: '90vw',
          maxHeight: '90vh',
          minWidth: '600px',
          minHeight: '400px',
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          zIndex: zIndex.modal + 1
        }
      }
    },

    // ✅ ENTERPRISE FIX: Missing CAD status bar positioning for CadStatusBar
    cadStatusBar: {
      container: {
        position: 'fixed' as const,
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        backgroundColor: colors.background.primary,
        borderTop: `1px solid ${colors.border.primary}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        zIndex: zIndex.docked
      },
      statusInfo: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md
      },
      button: {
        padding: spacing.xs,
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: borderRadius.sm,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        transition: 'all 150ms ease'
      },
      buttonActive: {
        backgroundColor: colors.background.accent,
        color: colors.text.primary
      },
      label: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        fontWeight: typography.fontWeight.medium
      },
      functionKey: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        backgroundColor: colors.background.muted,
        padding: `${spacing.xs} ${spacing.sm}`,
        borderRadius: borderRadius.sm,
        border: `1px solid ${colors.border.secondary}`
      }
    },

    // ✅ ENTERPRISE FIX: Status bar overlays για ColorManager.tsx
    statusBarOverlays: {
      colorManagerContainer: (x: number, y: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: zIndex.modal,
        pointerEvents: 'auto'
      })
    },

    // ✅ ENTERPRISE FIX: Responsive grid utilities for ResponsiveDashboard
    responsive: {
      responsiveGrid: (columns: number, gap: number): React.CSSProperties => ({
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap * 4}px`,
        width: '100%',
      }),
      responsiveGridItem: (span: number, offset: number, order?: number): React.CSSProperties => ({
        gridColumn: offset > 0 ? `${offset + 1} / span ${span}` : `span ${span}`,
        ...(order !== undefined && { order }),
      }),
      responsiveCardGrid: (minWidth: number, maxWidth: number, gap: number): React.CSSProperties => ({
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, ${maxWidth}px))`,
        gap: `${gap * 4}px`,
        width: '100%',
        justifyContent: 'start',
      }),
      responsiveSidebar: (isCollapsed: boolean, width: number): React.CSSProperties => ({
        width: isCollapsed ? '64px' : `${width}px`,
        transition: 'width 200ms ease-in-out',
        flexShrink: 0,
      }),
      responsiveMainContent: (hasSidebar: boolean, sidebarWidth: number): React.CSSProperties => ({
        flex: 1,
        marginLeft: hasSidebar ? `${sidebarWidth}px` : 0,
        transition: 'margin-left 200ms ease-in-out',
      }),
    }
  }
};

// Configuration Components
export const configurationComponents = {
  layout: {
    container: {
      padding: spacing.lg,
      backgroundColor: colors.background.primary
    },
    header: {
      marginBottom: spacing.lg,
      paddingBottom: spacing.md,
      borderBottom: `1px solid ${colors.border.primary}`
    },
    title: {
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.sm
    },
    subtitle: {
      fontSize: typography.fontSize.base,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed
    },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: spacing.xl,
      marginTop: spacing.lg
    },
    sidebar: {
      padding: spacing.lg,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md
    }
  },
  configurationCard: {
    base: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      cursor: 'pointer',
      transition: 'all 200ms ease'
    },
    selected: {
      backgroundColor: colors.background.hover,
      borderColor: colors.primary[500],
      transform: 'translateY(-1px)'
    },
    statusDot: {
      width: spacing.xs,
      height: spacing.xs,
      borderRadius: borderRadius.full,
      display: 'inline-block',
      marginRight: spacing.sm
    },
    // ✅ ENTERPRISE: Missing properties for AlertConfigurationInterface.styles.ts
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm
    },
    icon: {
      fontSize: typography.fontSize.xl,
      color: colors.text.secondary
    },
    titleContainer: {
      flex: 1,
      marginLeft: spacing.sm
    },
    title: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.xs
    },
    statusContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xs
    },
    statusText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    },
    description: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed,
      marginTop: spacing.sm
    }
  },
  buttons: {
    primary: {
      backgroundColor: colors.primary[500],
      color: colors.text.inverse,
      padding: `${spacing.sm} ${spacing.md}`,
      borderRadius: borderRadius.md,
      border: 'none',
      cursor: 'pointer',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    secondary: {
      backgroundColor: colors.background.secondary,
      color: colors.text.primary,
      padding: `${spacing.sm} ${spacing.md}`,
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.border.primary}`,
      cursor: 'pointer',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    small: {
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: typography.fontSize.xs
    }
  },
  ruleEditor: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.lg
    },
    header: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottom: `1px solid ${colors.border.secondary}`
    },
    section: {
      marginBottom: spacing.lg,
      paddingBottom: spacing.md,
      borderBottom: `1px solid ${colors.border.tertiary}`
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing.xs,
      display: 'block'
    },
    input: {
      width: '100%',
      padding: spacing.sm,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.sm,
      fontSize: typography.fontSize.sm,
      backgroundColor: colors.background.primary,
      color: colors.text.primary
    },
    textarea: {
      width: '100%',
      padding: spacing.sm,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.sm,
      fontSize: typography.fontSize.sm,
      backgroundColor: colors.background.primary,
      color: colors.text.primary,
      minHeight: '100px',
      resize: 'vertical' as const // ✅ ENTERPRISE: Proper type literal
    },
    select: {
      width: '100%',
      padding: spacing.sm,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.sm,
      fontSize: typography.fontSize.sm,
      backgroundColor: colors.background.primary,
      color: colors.text.primary
    },
    gridTwoColumns: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: spacing.md
    },
    checkboxContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs
    },
    checkboxLabel: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      cursor: 'pointer'
    },
    mockSection: {
      backgroundColor: colors.background.secondary,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      marginTop: spacing.md
    },
    mockText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      fontStyle: 'italic'
    },
    mockButtonContainer: {
      display: 'flex',
      gap: spacing.sm,
      marginTop: spacing.sm
    },
    actionButtons: {
      display: 'flex',
      gap: spacing.sm,
      justifyContent: 'flex-end',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTop: `1px solid ${colors.border.secondary}`
    }
  },
  notificationSettings: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      marginTop: spacing.md
    },
    header: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.md,
      paddingBottom: spacing.sm,
      borderBottom: `1px solid ${colors.border.secondary}`
    },
    sectionTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing.sm,
      marginTop: spacing.md
    },
    channelsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: spacing.md,
      marginBottom: spacing.lg
    },
    channelItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary
    },
    channelLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm
    },
    channelCheckbox: {
      width: '16px',
      height: '16px',
      cursor: 'pointer'
    },
    channelName: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary
    },
    channelRight: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xs
    },
    priorityLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      whiteSpace: 'nowrap' as const
    },
    priorityInput: {
      width: '60px',
      padding: spacing.xs,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.sm,
      fontSize: typography.fontSize.xs,
      backgroundColor: colors.background.primary,
      color: colors.text.primary,
      textAlign: 'center' as const
    },
    advancedGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.sm,
      border: `1px solid ${colors.border.secondary}`
    },
    saveButtonContainer: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTop: `1px solid ${colors.border.secondary}`
    }
  },
  rulesSection: {
    headerContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottom: `1px solid ${colors.border.secondary}`
    },
    title: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    rulesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: spacing.md,
      marginTop: spacing.md
    },
    ruleCard: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      cursor: 'pointer',
      transition: 'all 200ms ease',
      ':hover': {
        borderColor: colors.primary[500],
        boxShadow: `0 2px 8px rgba(0,0,0,0.1)`
      }
    },
    ruleHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm
    },
    ruleTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.xs
    },
    ruleMetadata: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    },
    priorityText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      padding: `${spacing.xs} ${spacing.sm}`,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary,
      color: colors.text.secondary
    },
    ruleDescription: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed,
      marginTop: spacing.sm
    }
  },
  loadingState: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.border.secondary}`
    },
    content: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: spacing.md
    },
    spinner: {
      width: '32px',
      height: '32px',
      border: `3px solid ${colors.border.secondary}`,
      borderTop: `3px solid ${colors.primary[500]}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    text: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center' as const
    }
  },
  placeholderSection: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      border: `1px dashed ${colors.border.secondary}`,
      marginTop: spacing.lg
    },
    title: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing.sm
    },
    text: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center' as const,
      lineHeight: typography.lineHeight.relaxed
    }
  }
};

// ============================================================================
// MAP INTERACTION TOKENS - GEO-CANVAS SYSTEM
// ============================================================================

/**
 * Map Interaction Tokens για geo-canvas interactive map system
 * Enterprise-grade styling για geographical interfaces
 */
export const mapInteractionTokens = {
  containers: {
    fullscreen: {
      position: 'absolute' as const,
      inset: 0,
      width: '100%',
      height: '100%',
      backgroundColor: colors.background.primary,
      overflow: 'hidden'
    },
    viewport: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }
  },
  getMapCursor: (isPickingCoordinates: boolean, systemIsDrawing: boolean): string => {
    if (isPickingCoordinates) return 'crosshair';
    if (systemIsDrawing) return 'crosshair';
    return 'default';
  }
} as const;

/**
 * Map Control Point Tokens για interactive polygon editing
 * Professional control point styling με state management
 */
export const mapControlPointTokens = {
  base: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    border: `2px solid ${colors.primary[500]}`,
    backgroundColor: colors.background.primary,
    cursor: 'pointer',
    transition: 'all 200ms ease',
    position: 'absolute' as const
  },
  states: {
    default: {
      zIndex: zIndex.docked,
      transform: 'scale(1)',
      opacity: 0.8
    },
    selected: {
      zIndex: zIndex.docked + 1,
      transform: 'scale(1.2)',
      backgroundColor: colors.primary[500],
      boxShadow: `0 0 8px ${colors.primary[500]}`,
      opacity: 1
    },
    highlight: {
      zIndex: zIndex.docked + 2,
      transform: 'scale(1.1)',
      borderColor: colors.blue["600"],
      backgroundColor: colors.blue["300"],
      opacity: 1
    },
    complete: {
      borderColor: colors.green["500"],
      backgroundColor: colors.green["300"]
    }
  },
  getControlPointStyle: (
    isSelected: boolean,
    shouldHighlight: boolean,
    isComplete: boolean
  ): React.CSSProperties => {
    const base = mapControlPointTokens.base;
    let state: React.CSSProperties = mapControlPointTokens.states.default as React.CSSProperties;

    if (isComplete) {
      state = { ...state, ...(mapControlPointTokens.states.complete as React.CSSProperties) };
    }
    if (shouldHighlight) {
      state = { ...state, ...(mapControlPointTokens.states.highlight as React.CSSProperties) };
    }
    if (isSelected) {
      state = { ...state, ...(mapControlPointTokens.states.selected as React.CSSProperties) };
    }

    return { ...base, ...state };
  }
};

// ============================================================================
// 🎨 TAILWIND CSS CLASS MAPPINGS - ENTERPRISE SYSTEM
// ============================================================================

/**
 * ENTERPRISE BACKGROUND UTILITY CLASSES
 * Maps semantic background concepts to Tailwind CSS classes
 * Used throughout DXF Viewer for consistent background styling
 */
export const bg = {
  // Core backgrounds
  primary: 'bg-background',
  secondary: 'bg-muted',
  card: 'bg-card',
  surface: 'bg-card',
  muted: 'bg-muted',
  tertiary: 'bg-slate-100',
  backgroundSecondary: 'bg-muted',

  // Skeleton loading states
  skeleton: 'bg-muted',

  // Accent backgrounds
  accent: 'bg-accent',

  // Selection states
  selection: 'bg-blue-100',

  // Status backgrounds
  success: 'bg-green-100',
  successHover: 'bg-green-200',
  warning: 'bg-yellow-100',
  error: 'bg-red-100',
  info: 'bg-blue-100',

  // Interactive states
  hover: 'bg-accent/10',

  // Overlay backgrounds
  overlay: 'bg-black/50',

  // Specialty colors
  violet: 'bg-violet-100',
  pink: 'bg-pink-100',
  indigo: 'bg-indigo-100',
  cyan: 'bg-cyan-100',
  emerald: 'bg-emerald-100',
  amber: 'bg-amber-100',
  lime: 'bg-lime-100',
  rose: 'bg-rose-100',
  sky: 'bg-sky-100',
  orange: 'bg-orange-100',
  teal: 'bg-teal-100',
  purple: 'bg-purple-100',
  yellow: 'bg-yellow-100',
  green: 'bg-green-100',
  blue: 'bg-blue-100',
  red: 'bg-red-100',
  gray: 'bg-gray-100',
  slate: 'bg-slate-100',
  stone: 'bg-stone-100',
  neutral: 'bg-neutral-100',
  zinc: 'bg-zinc-100',
  magenta: 'bg-pink-100'
} as const;
