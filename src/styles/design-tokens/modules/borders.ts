// Design tokens — Borders module
// Border width, colors, style, radius, variants, utils, responsive

// ============================================================================
// BORDER TOKENS IMPLEMENTATION
// ============================================================================

export const borderWidth = {
  none: '0',
  hairline: '0.5px',
  default: '1px',
  medium: '2px',
  thick: '3px',
  heavy: '4px'
} as const;

export const borderColors = {
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

export const borderStyle = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
  double: 'double',
  hidden: 'hidden',
  none: 'none'
} as const;

export const coreBorderRadius = {
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

export const borderVariants = {
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
      className: 'border border-input rounded-md'
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

export const borderUtils = {
  createBorder: (width: string, color: string, style: string = 'solid') => `${width} ${style} ${color}`,
  getVariantClass: (variant: string) => variant,
  combineBorders: (...classes: string[]) => classes.join(' '),
  withDarkMode: (lightClass: string, darkClass: string) => `${lightClass} dark:${darkClass}`
} as const;

export const responsiveBorders = {
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

export const borders = {
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

// ✅ ENTERPRISE: borderRadius re-exports coreBorderRadius (Single Source of Truth)
// This ensures consistency across the entire application
// See: coreBorderRadius for the canonical definition
export const borderRadius = coreBorderRadius;
