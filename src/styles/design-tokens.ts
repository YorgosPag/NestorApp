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

// Transition system για animations
export const transitions = {
  duration: {
    fast: '150ms',
    base: '300ms',
    slow: '500ms'
  },

  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out'
  }
} as const;

// Color system - Base colors για το design system
export const colors = {
  // Basic color palette
  background: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    hover: '#f1f5f9',
    overlay: 'rgba(0, 0, 0, 0.5)'
  },

  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    tertiary: '#94a3b8',
    inverse: '#ffffff'
  },

  border: {
    primary: '#e2e8f0',
    secondary: '#cbd5e1',
    tertiary: '#f1f5f9'
  },

  surface: {
    primary: '#ffffff',
    secondary: '#f8fafc'
  },

  // Semantic colors
  primary: {
    500: '#3b82f6'
  },

  // Accent colors
  accent: {
    primary: '#3b82f6'
  },

  // Status colors
  blue: { 300: '#93c5fd', 500: '#3b82f6', 600: '#2563eb' },
  green: { 300: '#86efac', 500: '#22c55e', 600: '#16a34a' },
  purple: { 300: '#c4b5fd', 500: '#8b5cf6', 600: '#7c3aed' },
  orange: { 300: '#fdba74', 500: '#f97316', 600: '#ea580c' },
  red: { 300: '#fca5a5', 500: '#ef4444', 600: '#dc2626' },
  teal: { 300: '#5eead4', 500: '#14b8a6', 600: '#0d9488' },
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 500: '#6b7280' }
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

  // Dynamic dropdown positioning για portals & overlays
  dropdown: {
    fixed: (top: number, left: number, width: number, zIndex: number = 9999) => ({
      position: 'fixed' as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      zIndex,
    }),
    portal: (position: { top: number; left: number; width: number }, zIndex: number = 9999) => ({
      position: 'fixed' as const,
      top: `${position.top}px`,
      left: `${position.left}px`,
      width: `${position.width}px`,
      zIndex,
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
    debugFloat: {
      main: {
        position: 'fixed' as const,
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: 'var(--spacing-2)',
        zIndex: 10000,
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
        border: '2px solid white',
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
    dropdown: {
      content: {
        zIndex: 9999,
        position: 'absolute' as const,
        backgroundColor: '#374151', // gray-700
        border: '1px solid #4B5563', // gray-600
        backdropFilter: 'none' as const,
        WebkitBackdropFilter: 'none' as const,
      },
      highZIndex: {
        zIndex: 9999,
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
export const portalComponents = {
  overlay: {
    fullscreen: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none' as const,
    },
    backdrop: (zIndex: number = 1000) => ({
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex,
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

  modal: {
    backdrop: {
      zIndex: (customZIndex?: number) => customZIndex || 2000,
    },
    content: {
      zIndex: (customZIndex?: number) => (customZIndex || 2000) + 1,
    },
  },

  zIndex: {
    dropdown: 1000,
    modal: 2000,
    tooltip: 3000,
    critical: 2147483647, // Maximum zIndex
    overlay: 1400, // Add overlay zIndex
  }
} as const;

// Extended portalComponents for dynamic zIndex functions
export const portalComponentsExtended = {
  ...portalComponents,
  overlay: {
    ...portalComponents.overlay,
    base: { zIndex: () => 1300 },
    fullscreen: { zIndex: () => 1400 },
    crosshair: { zIndex: () => 1450 },
    selection: { zIndex: () => 1460 },
    tooltip: { zIndex: () => 1470 },
    snap: { zIndex: () => 1480 },
    search: { zIndex: () => 1490 },
    searchResults: { zIndex: () => 1500 },
    controls: { zIndex: () => 1510 },
    zoom: { zIndex: () => 1520 }
  },
  canvas: {
    fullscreen: { zIndex: () => 1400 },
    layers: {
      dxf: { zIndex: () => 1200 },
      layer: { zIndex: () => 1210 }
    }
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

/**
 * Performance Components για High-Performance UI Elements
 * Enterprise-class virtualized tables, metrics dashboards, and analytics
 *
 * Optimized για smooth 60fps rendering με minimal repaints
 *
 * @example
 * ```tsx
 * <div style={performanceComponents.virtualizedTable.container} />
 * <span style={performanceComponents.metrics.label} />
 * ```
 */
export const performanceComponents = {
  // Virtualized Table System
  virtualizedTable: {
    // Main container
    container: {
      position: 'relative' as const,
      overflow: 'hidden' as const,
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      willChange: 'scroll-position' as const // Performance optimization
    },

    // Header section
    header: {
      position: 'sticky' as const,
      top: 0,
      backgroundColor: colors.background.secondary,
      borderBottom: `1px solid ${colors.border.primary}`,
      zIndex: 1,
      padding: spacing[3],
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.sm,
      color: colors.text.primary
    },

    // Scrollable content area
    scrollableContent: {
      position: 'relative' as const,
      overflow: 'auto' as const,
      willChange: 'scroll-position, contents' as const // Performance hint
    },

    // Row styling
    row: {
      base: {
        display: 'flex',
        alignItems: 'center',
        padding: `${spacing[2]} ${spacing[3]}`,
        borderBottom: `1px solid ${colors.border.secondary}`,
        transition: `background-color ${animation.duration.fast}`,
        cursor: 'default' as const
      },

      interactive: {
        cursor: 'pointer' as const,
        '&:hover': {
          backgroundColor: colors.background.hover
        }
      }
    },

    // Cell styling
    cell: {
      base: {
        display: 'flex',
        alignItems: 'center',
        minWidth: 0, // Allow text truncation
        padding: `0 ${spacing[2]}`,
        color: colors.text.primary,
        fontSize: typography.fontSize.sm
      },

      flexible: {
        flex: 1,
        minWidth: 0
      }
    }
  },

  // Performance Metrics Components
  metrics: {
    // Individual metric card
    card: {
      padding: spacing[4],
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.border.secondary}`
    },

    // Metric labels and values
    label: {
      primary: {
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary
      },

      secondary: {
        color: colors.text.secondary
      },

      tertiary: {
        color: colors.text.tertiary
      }
    },

    // Metric values με severity colors
    value: {
      primary: {
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.lg,
        color: colors.text.primary
      },

      success: { color: colors.green[600] },
      warning: { color: colors.orange[600] },
      error: { color: colors.red[600] },
      info: { color: colors.blue[600] }
    }
  },

  // Loading and States
  states: {
    loading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing[8],
      color: colors.text.secondary
    }
  },

  // Performance Optimizations
  optimizations: {
    willChangeTransform: { willChange: 'transform' as const },
    willChangeScroll: { willChange: 'scroll-position' as const },
    gpuAccelerated: { transform: 'translateZ(0)' }
  },

  // Chart Components
  chartComponents: {
    // Legend Components
    legend: {
      container: {
        display: 'flex' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        gap: spacing[4]
      },

      item: {
        base: {
          display: 'flex' as const,
          alignItems: 'center' as const,
          gap: spacing[1.5]
        },

        icon: {
          height: spacing[3],
          width: spacing[3],
          color: colors.text.tertiary
        }
      },

      indicator: {
        base: {
          height: spacing[2],
          width: spacing[2],
          flexShrink: 0,
          borderRadius: borderRadius.sm
        }
      },

      // Top/Bottom positioned legends
      positioning: {
        top: { paddingBottom: spacing[3] },
        bottom: { paddingTop: spacing[3] },
        left: { paddingRight: spacing[3] },
        right: { paddingLeft: spacing[3] }
      }
    },

    // Tooltip Components
    tooltip: {
      indicator: {
        dot: {
          height: '10px',
          width: '10px',
          flexShrink: 0,
          borderRadius: borderRadius.sm
        },

        line: {
          width: '4px',
          flexShrink: 0,
          borderRadius: borderRadius.sm
        },

        dashed: {
          width: 0,
          border: '1.5px dashed',
          backgroundColor: 'transparent',
          flexShrink: 0
        },

        // Base styling με CSS variables
        cssVariables: {
          border: `1px solid var(--color-border)`,
          backgroundColor: `var(--color-bg)`
        }
      },

      container: {
        base: {
          backgroundColor: colors.surface.primary,
          border: `1px solid ${colors.border.primary}`,
          borderRadius: borderRadius.md,
          padding: spacing[3],
          boxShadow: shadows.md
        },

        content: {
          fontSize: typography.fontSize.sm,
          color: colors.text.primary
        }
      }
    },

    // Chart Colors Palette
    colors: {
      // Primary data series
      primary: [
        colors.blue[500],
        colors.green[500],
        colors.purple[500],
        colors.orange[500],
        colors.red[500],
        colors.teal[500]
      ],

      // Status-based colors
      status: {
        success: colors.green[500],
        warning: colors.orange[500],
        error: colors.red[500],
        info: colors.blue[500],
        neutral: colors.gray[500]
      }
    }
  }
} as const;

// ============================================================================
// CHART COMPONENTS
// ============================================================================

/**
 * Chart components design tokens για data visualization
 *
 * ✅ ENTERPRISE REFACTORED: Inline styles → Centralized tokens
 * ✅ Type-safe chart styling patterns
 * ✅ Dynamic color management για chart elements
 * ✅ Fortune 500 grade data visualization standards
 *
 * Usage:
 * - ChartLegend.tsx: Legend colors, indicators, tooltips
 * - ChartTooltip.tsx: Tooltip indicators, backgrounds
 * - Chart containers: Sizing, spacing, responsive patterns
 */
export const chartComponents = {
  // Legend Components
  legend: {
    container: {
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing[4]
    },

    item: {
      base: {
        display: 'flex' as const,
        alignItems: 'center' as const,
        gap: spacing[1.5]
      },

      icon: {
        height: spacing[3],
        width: spacing[3],
        color: colors.text.tertiary
      }
    },

    indicator: {
      base: {
        height: spacing[2],
        width: spacing[2],
        flexShrink: 0,
        borderRadius: borderRadius.sm
      },

      /**
       * Dynamic color utility για chart legend indicators
       * Replaces: style={{ backgroundColor: item.color }}
       */
      withColor: (color: string): React.CSSProperties => ({
        backgroundColor: color
      })
    },

    // Top/Bottom positioned legends
    positioning: {
      top: { paddingBottom: spacing[3] },
      bottom: { paddingTop: spacing[3] },
      left: { paddingRight: spacing[3] },
      right: { paddingLeft: spacing[3] }
    }
  },

  // Tooltip Components
  tooltip: {
    indicator: {
      dot: {
        height: '10px',
        width: '10px',
        flexShrink: 0,
        borderRadius: borderRadius.sm
      },

      line: {
        width: '4px',
        flexShrink: 0,
        borderRadius: borderRadius.sm
      },

      dashed: {
        width: 0,
        border: '1.5px dashed',
        backgroundColor: 'transparent',
        flexShrink: 0
      },

      /**
       * CSS Variables approach για dynamic colors
       * Replaces: { "--color-bg": color, "--color-border": color }
       */
      withColor: (color: string | undefined): React.CSSProperties => ({
        '--color-bg': color,
        '--color-border': color
      } as React.CSSProperties),

      // Base styling με CSS variables
      cssVariables: {
        border: `1px solid var(--color-border)`,
        backgroundColor: `var(--color-bg)`
      }
    },

    container: {
      base: {
        backgroundColor: colors.surface.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: borderRadius.md,
        padding: spacing[3],
        boxShadow: shadows.md
      },

      content: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary
      }
    }
  },

  // Chart Container Components
  container: {
    base: {
      position: 'relative' as const,
      width: '100%',
      height: '100%'
    },

    responsive: {
      width: '100%',
      height: 'auto',
      aspectRatio: '16/9'
    },

    // Size variants
    sizes: {
      sm: { height: '200px' },
      md: { height: '300px' },
      lg: { height: '400px' },
      xl: { height: '500px' }
    }
  },

  // Chart Title & Layout Components (ENTERPRISE ADDITION - 2025-12-16)
  title: {
    container: {
      textAlign: 'center' as const,
      marginBottom: spacing[2]
    },

    main: {
      margin: 0,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },

    subtitle: {
      margin: '4px 0 0 0',
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    }
  },

  // Chart Layout & Positioning
  layout: {
    // Main chart containers με dynamic dimensions
    container: (width?: number, height?: number): React.CSSProperties => ({
      position: 'relative',
      width: width || '100%',
      height: height || '100%'
    }),

    // Interactive cursor patterns
    interactive: (enabled: boolean): React.CSSProperties => ({
      cursor: enabled ? 'pointer' : 'default'
    }),

    // Chart content styling for tooltips
    tooltip: {
      fontWeight: 'bold' as const
    }
  },

  // Chart Axis Components
  axis: {
    line: {
      stroke: colors.border.secondary,
      strokeWidth: 1
    },

    tick: {
      fontSize: typography.fontSize.xs,
      fill: colors.text.secondary
    },

    label: {
      fontSize: typography.fontSize.sm,
      fill: colors.text.primary,
      fontWeight: typography.fontWeight.medium
    }
  },

  // Chart Colors Palette (για consistent data visualization)
  colors: {
    // Primary data series
    primary: [
      colors.blue[500],
      colors.green[500],
      colors.purple[500],
      colors.orange[500],
      colors.red[500],
      colors.teal[500]
    ],

    // Secondary data series
    secondary: [
      colors.blue[300],
      colors.green[300],
      colors.purple[300],
      colors.orange[300],
      colors.red[300],
      colors.teal[300]
    ],

    // Status-based colors
    status: {
      success: colors.green[500],
      warning: colors.orange[500],
      error: colors.red[500],
      info: colors.blue[500],
      neutral: colors.gray[500]
    },

    // Grid lines
    grid: {
      major: colors.border.secondary,
      minor: colors.border.tertiary
    }
  },

  // Animation & Transitions
  animations: {
    fadeIn: {
      opacity: 1,
      transition: `opacity ${transitions.duration.base} ${transitions.easing.easeOut}`
    },

    slideUp: {
      transform: 'translateY(0)',
      transition: `transform ${transitions.duration.base} ${transitions.easing.easeOut}`
    },

    scale: {
      transform: 'scale(1)',
      transition: `transform ${transitions.duration.fast} ${transitions.easing.easeOut}`
    }
  }
} as const;

// ============================================================================
// CANVAS UTILITIES - DXF & GEO-CANVAS SYSTEMS
// ============================================================================

/**
 * 🎯 ENTERPRISE CANVAS UTILITIES
 *
 * ✅ CRITICAL REFACTORING: 478+ inline styles → Centralized Canvas System
 * ✅ Single Source of Truth για όλα τα Canvas & Overlay components
 * ✅ Type-safe, Fortune 500-grade canvas management
 *
 * TARGETS:
 * - DXF Canvas & Overlays: 50+ instances (DxfCanvas, LayerCanvas, CrosshairOverlay, etc.)
 * - Geo-Canvas InteractiveMap: 30+ instances (SearchSystem, FloorPlanCanvas, etc.)
 * - Settings Components: 25+ instances (Color previews, dynamic styling)
 *
 * PATTERNS REPLACED:
 * - style={{ zIndex: 999, position: 'absolute', pointerEvents: 'none' }}
 * - style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
 * - style={{ backgroundColor: color, opacity: 0.5 }}
 * - style={{ position: 'fixed', inset: 0 }}
 *
 * @author Claude Enterprise Architect
 * @date 2025-12-16
 */
export const canvasUtilities = {
  // ============================================================================
  // DXF CANVAS CORE PATTERNS
  // ============================================================================

  /**
   * DXF Canvas Base Containers
   * Replaces: style={{ position: 'relative', width: '100%', height: '100%' }}
   */
  container: {
    base: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    },

    fullscreen: {
      position: 'fixed' as const,
      inset: 0,
      zIndex: portalComponentsExtended.canvas.fullscreen.zIndex(),
      overflow: 'hidden'
    },

    /**
     * Dynamic container με custom dimensions
     * Replaces: style={{ width: `${width}px`, height: `${height}px` }}
     */
    withDimensions: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`,
      position: 'relative' as const,
      overflow: 'hidden'
    })
  },

  // ============================================================================
  // CANVAS LAYERS & Z-INDEX MANAGEMENT
  // ============================================================================

  /**
   * Canvas Layer Z-Index System
   * Replaces: style={{ zIndex: 15 }}, style={{ zIndex: 10 }}, etc.
   */
  layers: {
    // Main canvas layers
    dxfCanvas: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: portalComponentsExtended.canvas.layers.dxf.zIndex(),
      pointerEvents: 'auto' as const
    },

    layerCanvas: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: portalComponentsExtended.canvas.layers.layer.zIndex(),
      pointerEvents: 'auto' as const
    },

    // Overlay layers
    overlayBase: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: portalComponentsExtended.overlay.base.zIndex(),
      pointerEvents: 'none' as const
    },

    /**
     * Custom z-index με pointer events control
     * Replaces: style={{ zIndex: customZ, pointerEvents: 'none' }}
     */
    withZIndex: (zIndex: number, pointerEvents: 'none' | 'auto' = 'none'): React.CSSProperties => ({
      position: 'absolute' as const,
      inset: 0,
      zIndex,
      pointerEvents
    })
  },

  // ============================================================================
  // OVERLAY POSITIONING PATTERNS
  // ============================================================================

  /**
   * Overlay Position Management
   * Replaces: style={{ left: x, top: y }}, style={{ transform: 'translate(...)' }}
   */
  positioning: {
    /**
     * Absolute positioning με coordinates
     * Replaces: style={{ position: 'absolute', left: x, top: y }}
     */
    absolute: (x: number, y: number): React.CSSProperties => ({
      position: 'absolute' as const,
      left: `${x}px`,
      top: `${y}px`
    }),

    /**
     * Centered positioning με offset
     * Replaces: style={{ left: x - 10, top: y - 10 }}
     */
    centered: (x: number, y: number, offsetX: number = 0, offsetY: number = 0): React.CSSProperties => ({
      position: 'absolute' as const,
      left: `${x + offsetX}px`,
      top: `${y + offsetY}px`,
      transform: 'translate(-50%, -50%)'
    }),

    /**
     * Transform-based positioning
     * Replaces: style={{ transform: `translate(${x}px, ${y}px)` }}
     */
    transform: (x: number, y: number): React.CSSProperties => ({
      transform: `translate(${x}px, ${y}px)`
    }),

    /**
     * Fixed positioning for full-screen overlays
     * Replaces: style={{ position: 'fixed', inset: 0 }}
     */
    fullscreenOverlay: {
      position: 'fixed' as const,
      inset: 0,
      zIndex: portalComponentsExtended.overlay.fullscreen.zIndex(),
      pointerEvents: 'auto' as const
    }
  },

  // ============================================================================
  // DYNAMIC STYLING PATTERNS
  // ============================================================================

  /**
   * Dynamic Canvas Styles
   * Replaces complex dynamic inline styles με props
   */
  dynamic: {
    /**
     * Background color με opacity
     * Replaces: style={{ backgroundColor: color, opacity: alpha }}
     */
    background: (color: string, opacity: number = 1): React.CSSProperties => ({
      backgroundColor: color,
      opacity
    }),

    /**
     * Border styling με dynamic color
     * Replaces: style={{ border: `2px solid ${color}` }}
     */
    border: (color: string, width: number = 1, style: string = 'solid'): React.CSSProperties => ({
      border: `${width}px ${style} ${color}`
    }),

    /**
     * Dynamic sizing patterns
     * Replaces: style={{ width: `${size}%`, height: `${height}px` }}
     */
    size: (width: string | number, height: string | number): React.CSSProperties => ({
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height
    }),

    /**
     * CSS Variables για runtime values
     * Replaces: style={{ '--custom-var': value }}
     */
    cssVars: (vars: Record<string, string | number>): React.CSSProperties => {
      const cssProps: Record<string, string> = {};
      Object.entries(vars).forEach(([key, value]) => {
        const varKey = key.startsWith('--') ? key : `--${key}`;
        cssProps[varKey] = typeof value === 'number' ? `${value}px` : value;
      });
      return cssProps as React.CSSProperties;
    }
  },

  // ============================================================================
  // SPECIALIZED OVERLAY TYPES
  // ============================================================================

  /**
   * Specialized Overlay Patterns
   */
  overlays: {
    /**
     * Crosshair Overlay Styling
     * Replaces: CrosshairOverlay.tsx inline styles
     */
    crosshair: {
      container: {
        position: 'absolute' as const,
        inset: 0,
        pointerEvents: 'none' as const,
        zIndex: portalComponentsExtended.overlay.crosshair.zIndex()
      },

      line: {
        position: 'absolute' as const,
        backgroundColor: colors.primary[500],
        opacity: 0.7
      },

      horizontal: (y: number): React.CSSProperties => ({
        ...canvasUtilities.overlays.crosshair.line,
        left: 0,
        right: 0,
        top: `${y}px`,
        height: '1px'
      }),

      vertical: (x: number): React.CSSProperties => ({
        ...canvasUtilities.overlays.crosshair.line,
        top: 0,
        bottom: 0,
        left: `${x}px`,
        width: '1px'
      })
    },

    /**
     * Selection Marquee Overlay
     * Replaces: SelectionMarqueeOverlay.tsx inline styles
     */
    marquee: {
      container: {
        position: 'absolute' as const,
        inset: 0,
        pointerEvents: 'none' as const,
        zIndex: portalComponentsExtended.overlay.selection.zIndex()
      },

      /**
       * Dynamic marquee rectangle με window/crossing modes
       * Replaces: style={{ left: x, top: y, width: w, height: h, border: ... }}
       */
      rectangle: (
        x: number,
        y: number,
        width: number,
        height: number,
        kind: 'window' | 'crossing' = 'window'
      ): React.CSSProperties => {
        const isWindow = kind === 'window';
        const borderColor = isWindow ? colors.blue[500] : colors.green[500];
        const backgroundColor = isWindow ? `${colors.blue[100]}33` : `${colors.green[100]}33`; // 20% opacity

        return {
          position: 'absolute' as const,
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
          border: `2px solid ${borderColor}`,
          backgroundColor,
          pointerEvents: 'none' as const,
          zIndex: portalComponentsExtended.overlay.selection.zIndex()
        };
      }
    },

    /**
     * Tooltip Overlays
     * Replaces: CursorTooltipOverlay.tsx inline styles
     */
    tooltip: {
      container: {
        position: 'absolute' as const,
        padding: spacing[2],
        backgroundColor: colors.surface.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: borderRadius.md,
        boxShadow: shadows.md,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        pointerEvents: 'none' as const,
        zIndex: portalComponentsExtended.overlay.tooltip.zIndex()
      },

      /**
       * Positioned tooltip
       * Replaces: style={{ left: x + 10, top: y - 30 }}
       */
      positioned: (x: number, y: number, offsetX: number = 10, offsetY: number = -30): React.CSSProperties => ({
        ...canvasUtilities.overlays.tooltip.container,
        left: `${x + offsetX}px`,
        top: `${y + offsetY}px`
      })
    },

    /**
     * Snap Indicator Overlays
     * Replaces: SnapIndicatorOverlay.tsx inline styles
     */
    snapIndicator: {
      point: (x: number, y: number, size: number = 8): React.CSSProperties => ({
        position: 'absolute' as const,
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: colors.accent.primary,
        border: `2px solid ${colors.surface.primary}`,
        pointerEvents: 'none' as const,
        zIndex: portalComponentsExtended.overlay.snap.zIndex()
      }),

      line: {
        base: {
          position: 'absolute' as const,
          backgroundColor: colors.accent.primary,
          opacity: 0.8,
          pointerEvents: 'none' as const,
          zIndex: portalComponentsExtended.overlay.snap.zIndex()
        },

        horizontal: (x1: number, x2: number, y: number): React.CSSProperties => ({
          ...canvasUtilities.overlays.snapIndicator.line.base,
          left: `${Math.min(x1, x2)}px`,
          top: `${y}px`,
          width: `${Math.abs(x2 - x1)}px`,
          height: '1px'
        }),

        vertical: (x: number, y1: number, y2: number): React.CSSProperties => ({
          ...canvasUtilities.overlays.snapIndicator.line.base,
          left: `${x}px`,
          top: `${Math.min(y1, y2)}px`,
          width: '1px',
          height: `${Math.abs(y2 - y1)}px`
        })
      }
    }
  },

  // ============================================================================
  // GEO-CANVAS SPECIFIC PATTERNS
  // ============================================================================

  /**
   * Geo-Canvas InteractiveMap Patterns
   * Replaces: SearchSystem.tsx, FloorPlanCanvas.tsx inline styles
   */
  geoCanvas: {
    /**
     * Interactive Map Container
     * Replaces: style={{ position: 'relative', width: '100%', height: '100vh' }}
     */
    mapContainer: {
      position: 'relative' as const,
      width: '100%',
      height: '100vh',
      overflow: 'hidden'
    },

    /**
     * Search Overlay Positioning
     * Replaces: SearchSystem.tsx positioning patterns
     */
    searchOverlay: {
      base: {
        position: 'absolute' as const,
        top: spacing[4],
        left: spacing[4],
        right: spacing[4],
        zIndex: portalComponentsExtended.overlay.search.zIndex(),
        pointerEvents: 'auto' as const
      },

      results: {
        position: 'absolute' as const,
        top: '100%',
        left: 0,
        right: 0,
        marginTop: spacing[2],
        backgroundColor: colors.surface.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: borderRadius.md,
        boxShadow: shadows.lg,
        maxHeight: '400px',
        overflowY: 'auto' as const,
        zIndex: portalComponentsExtended.overlay.searchResults.zIndex()
      }
    },

    /**
     * Floor Plan Control Patterns
     * Replaces: FloorPlanControls.tsx inline styles
     */
    controls: {
      panel: {
        position: 'absolute' as const,
        top: spacing[4],
        right: spacing[4],
        backgroundColor: colors.surface.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: borderRadius.md,
        padding: spacing[3],
        boxShadow: shadows.md,
        zIndex: portalComponentsExtended.overlay.controls.zIndex()
      },

      button: {
        base: {
          padding: `${spacing[2]} ${spacing[3]}`,
          backgroundColor: colors.surface.secondary,
          border: `1px solid ${colors.border.primary}`,
          borderRadius: borderRadius.sm,
          fontSize: typography.fontSize.sm,
          color: colors.text.primary,
          cursor: 'pointer'
        },

        active: {
          backgroundColor: colors.primary[100],
          borderColor: colors.primary[500],
          color: colors.primary[700]
        }
      }
    }
  },

  // ============================================================================
  // ZOOM & INTERACTION OVERLAYS
  // ============================================================================

  /**
   * Zoom Window & Interactive Overlays
   */
  zoom: {
    /**
     * Zoom Window Overlay
     * Replaces: ZoomWindowOverlay.tsx inline styles
     */
    window: {
      container: {
        position: 'absolute' as const,
        inset: 0,
        pointerEvents: 'none' as const,
        zIndex: portalComponentsExtended.overlay.zoom.zIndex()
      },

      /**
       * Zoom window rectangle με dashed border
       * Replaces: style={{ left: x, top: y, width: w, height: h, border: 'dashed blue' }}
       */
      rectangle: (x: number, y: number, width: number, height: number): React.CSSProperties => ({
        position: 'absolute' as const,
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        border: `2px dashed ${colors.blue[500]}`,
        backgroundColor: `${colors.blue[100]}33`, // 20% opacity
        pointerEvents: 'none' as const,
        zIndex: portalComponentsExtended.overlay.zoom.zIndex()
      })
    }
  }
} as const;