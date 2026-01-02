// ============================================================================
// 🎨 ENTERPRISE BORDER DESIGN SYSTEM
// ============================================================================
//
// ✨ Single Source of Truth for ALL border styling
// Based on Microsoft Fluent UI, Google Material Design, Apple HIG standards
// Zero hardcoded border values - everything flows from these tokens
//
// ============================================================================

/**
 * 📏 BORDER WIDTH TOKENS
 * Standardized border thickness following enterprise design systems
 */
export const borderWidth = {
  /** No border - for containers and layouts */
  none: '0',

  /** Hair-thin border - for subtle separations */
  hairline: '0.5px',

  /** Default border - for most UI elements (cards, inputs) */
  default: '1px',

  /** Medium border - for emphasis and selected states */
  medium: '2px',

  /** Thick border - for primary actions and alerts */
  thick: '3px',

  /** Heavy border - for high emphasis elements */
  heavy: '4px'
} as const;

/**
 * 🎨 BORDER COLOR TOKENS
 * Semantic color system that works across light/dark themes
 */
export const borderColors = {
  /** Default borders - subtle, non-intrusive */
  default: {
    light: 'rgb(229, 231, 235)', // gray-200
    dark: 'rgb(55, 65, 81)',     // gray-700
    css: 'hsl(var(--border))'    // CSS variable for dynamic theming
  },

  /** Muted borders - even more subtle */
  muted: {
    light: 'rgb(243, 244, 246)', // gray-100
    dark: 'rgb(75, 85, 99)',     // gray-600
    css: 'hsl(var(--border) / 0.5)'
  },

  /** Interactive borders - for hover states */
  interactive: {
    light: 'rgb(156, 163, 175)', // gray-400
    dark: 'rgb(107, 114, 128)',  // gray-500
    css: 'hsl(var(--border) / 0.8)'
  },

  /** Primary borders - brand color */
  primary: {
    light: 'rgb(59, 130, 246)',  // blue-500
    dark: 'rgb(96, 165, 250)',   // blue-400
    css: 'hsl(var(--primary))'
  },

  /** Success borders - positive states */
  success: {
    light: 'rgb(34, 197, 94)',   // green-500
    dark: 'rgb(74, 222, 128)',   // green-400
    css: 'hsl(var(--success))'
  },

  /** Warning borders - caution states */
  warning: {
    light: 'rgb(245, 158, 11)',  // amber-500
    dark: 'rgb(251, 191, 36)',   // amber-400
    css: 'hsl(var(--warning))'
  },

  /** Error borders - danger states */
  error: {
    light: 'rgb(239, 68, 68)',   // red-500
    dark: 'rgb(248, 113, 113)',  // red-400
    css: 'hsl(var(--destructive))'
  },

  /** Info borders - informational states */
  info: {
    light: 'rgb(59, 130, 246)',  // blue-500
    dark: 'rgb(96, 165, 250)',   // blue-400
    css: 'hsl(var(--info))'
  },

  /** Transparent borders - for layout without visual impact */
  transparent: 'transparent'
} as const;

/**
 * 🔘 BORDER RADIUS TOKENS
 * Extended from existing borderRadius in main design-tokens.ts
 * Following iOS/Material Design radius scales
 */
export const borderRadius = {
  /** No radius - sharp corners */
  none: '0',

  /** Tiny radius - subtle softness (2px) */
  xs: '0.125rem',

  /** Small radius - gentle corners (4px) */
  sm: '0.25rem',

  /** Default radius - balanced softness (6px) */
  default: '0.375rem',

  /** Medium radius - standard UI elements (8px) */
  md: '0.5rem',

  /** Large radius - cards and containers (12px) */
  lg: '0.75rem',

  /** Extra large radius - prominent elements (16px) */
  xl: '1rem',

  /** 2X large radius - hero elements (20px) */
  '2xl': '1.25rem',

  /** 3X large radius - special elements (24px) */
  '3xl': '1.5rem',

  /** Full radius - circular elements */
  full: '9999px'
} as const;

/**
 * 🎭 BORDER STYLE TOKENS
 * Different border styles for various UI contexts
 */
export const borderStyle = {
  /** Solid border - default for most elements */
  solid: 'solid',

  /** Dashed border - for drag zones and temporary states */
  dashed: 'dashed',

  /** Dotted border - for focus indicators and guides */
  dotted: 'dotted',

  /** Double border - for special emphasis */
  double: 'double',

  /** Hidden border - maintains layout without visual border */
  hidden: 'hidden',

  /** No border */
  none: 'none'
} as const;

/**
 * 🏢 SEMANTIC BORDER VARIANTS
 * Pre-configured border combinations for common UI patterns
 * Following enterprise design system principles
 */
export const borderVariants = {
  /** Default card border - subtle, non-intrusive */
  card: {
    width: borderWidth.default,
    color: borderColors.default.css,
    radius: borderRadius.lg,
    style: borderStyle.solid,
    className: `border-[${borderWidth.default}] border-[${borderColors.default.light}] rounded-lg`
  },

  /** Input field border - interactive, accessible */
  input: {
    default: {
      width: borderWidth.default,
      color: borderColors.default.css,
      radius: borderRadius.md,
      style: borderStyle.solid,
      className: `border-[${borderWidth.default}] border-[${borderColors.default.light}] rounded-md`
    },
    focus: {
      width: borderWidth.medium,
      color: borderColors.primary.css,
      radius: borderRadius.md,
      style: borderStyle.solid,
      className: 'border-2 border-primary rounded-md'
    },
    error: {
      width: borderWidth.medium,
      color: borderColors.error.css,
      radius: borderRadius.md,
      style: borderStyle.solid,
      className: 'border-2 border-destructive rounded-md'
    }
  },

  /** Button borders - various button states */
  button: {
    default: {
      width: borderWidth.default,
      color: borderColors.default.css,
      radius: borderRadius.md,
      style: borderStyle.solid,
      className: `border-[${borderWidth.default}] border-[${borderColors.default.light}] rounded-md`
    },
    primary: {
      width: borderWidth.default,
      color: borderColors.primary.css,
      radius: borderRadius.md,
      style: borderStyle.solid,
      className: 'border border-primary rounded-md'
    },
    ghost: {
      width: borderWidth.default,
      color: borderColors.transparent,
      radius: borderRadius.md,
      style: borderStyle.solid,
      className: 'border border-transparent rounded-md'
    }
  },

  /** Modal and dialog borders */
  modal: {
    width: borderWidth.none,
    color: borderColors.transparent,
    radius: borderRadius.lg,
    style: borderStyle.none,
    className: 'border-0 rounded-lg shadow-xl'
  },

  /** Container borders - for layout sections */
  container: {
    width: borderWidth.none,
    color: borderColors.transparent,
    radius: borderRadius.none,
    style: borderStyle.none,
    className: 'border-0'
  },

  /** Separator borders - for dividing content */
  separator: {
    horizontal: {
      width: borderWidth.hairline,
      color: borderColors.default.css,
      className: 'border-t border-border'
    },
    vertical: {
      width: borderWidth.hairline,
      color: borderColors.default.css,
      className: 'border-l border-border'
    }
  },

  /** Interactive states - hover, focus, active */
  interactive: {
    hover: {
      width: borderWidth.default,
      color: borderColors.interactive.css,
      className: 'hover:border-border/80'
    },
    focus: {
      width: borderWidth.medium,
      color: borderColors.primary.css,
      className: 'focus:border-2 focus:border-primary'
    },
    selected: {
      width: borderWidth.medium,
      color: borderColors.primary.css,
      className: 'border-2 border-primary'
    }
  },

  /** Status-based borders */
  status: {
    success: {
      width: borderWidth.default,
      color: borderColors.success.css,
      radius: borderRadius.md,
      className: 'border border-green-500 rounded-md'
    },
    warning: {
      width: borderWidth.default,
      color: borderColors.warning.css,
      radius: borderRadius.md,
      className: 'border border-amber-500 rounded-md'
    },
    error: {
      width: borderWidth.default,
      color: borderColors.error.css,
      radius: borderRadius.md,
      className: 'border border-red-500 rounded-md'
    },
    info: {
      width: borderWidth.default,
      color: borderColors.info.css,
      radius: borderRadius.md,
      className: 'border border-blue-500 rounded-md'
    },
    /** Muted border για DynamicInput components */
    muted: {
      width: borderWidth.default,
      color: borderColors.muted.css,
      radius: borderRadius.md,
      className: 'border border-gray-300 rounded-md'
    }
  },

  /** Form controls - checkboxes, radios, etc. */
  checkbox: {
    width: borderWidth.default,
    color: borderColors.default.css,
    radius: borderRadius.md,
    className: 'border-[1px] border-[rgb(229, 231, 235)] rounded-md'
  }
} as const;

/**
 * 🎯 UTILITY FUNCTIONS
 * Helper functions for dynamic border generation
 */
export const borderUtils = {
  /**
   * Create a complete border style from tokens
   */
  createBorder: (
    width: keyof typeof borderWidth = 'default',
    color: string = borderColors.default.css,
    style: keyof typeof borderStyle = 'solid'
  ): string => {
    return `${borderWidth[width]} ${borderStyle[style]} ${color}`;
  },

  /**
   * Get CSS class for border variant
   * ✅ ENTERPRISE: No 'any' - uses proper type narrowing
   */
  getVariantClass: (variant: keyof typeof borderVariants): string => {
    // ✅ ENTERPRISE: Use Record<string, unknown> instead of 'any' for type-safe access
    const variantConfig = borderVariants[variant] as Record<string, unknown>;
    if ('className' in variantConfig && typeof variantConfig.className === 'string') {
      return variantConfig.className;
    }
    return '';
  },

  /**
   * Combine multiple border classes safely
   */
  combineBorders: (...classes: string[]): string => {
    return classes.filter(Boolean).join(' ');
  },

  /**
   * Apply dark mode border automatically
   */
  withDarkMode: (lightColor: string, darkColor: string): string => {
    return `${lightColor} dark:${darkColor}`;
  }
} as const;

/**
 * 📱 RESPONSIVE BORDER UTILITIES
 * Responsive border patterns for different screen sizes
 */
export const responsiveBorders = {
  /** Mobile-first border patterns */
  mobile: {
    card: 'border border-border rounded-lg',
    button: 'border border-border rounded-md',
    input: 'border border-input rounded-md'
  },

  /** Tablet-optimized borders */
  tablet: {
    card: 'sm:border sm:border-border sm:rounded-xl',
    button: 'sm:border sm:border-border sm:rounded-lg',
    input: 'sm:border sm:border-input sm:rounded-lg'
  },

  /** Desktop-enhanced borders */
  desktop: {
    card: 'lg:border lg:border-border lg:rounded-2xl',
    button: 'lg:border lg:border-border lg:rounded-xl',
    input: 'lg:border lg:border-input lg:rounded-xl'
  }
} as const;

/**
 * 🎨 EXPORT EVERYTHING FOR CLEAN IMPORTS
 * Structured exports for easy consumption
 */
export const borders = {
  width: borderWidth,
  colors: borderColors,
  radius: borderRadius,
  style: borderStyle,
  variants: borderVariants,
  utils: borderUtils,
  responsive: responsiveBorders
} as const;

// Individual exports for granular imports
export type BorderWidth = keyof typeof borderWidth;
export type BorderColor = keyof typeof borderColors;
export type BorderRadius = keyof typeof borderRadius;
export type BorderStyle = keyof typeof borderStyle;
export type BorderVariant = keyof typeof borderVariants;

// Default export for convenience
export default borders;