/**
 * DESIGN TOKENS
 * Geo-Alert System - Phase 6: Enterprise Design System Foundation
 *
 * Centralized design tokens για consistent styling across το entire ecosystem.
 * Based on enterprise design standards (Material Design, Carbon Design, Fluent).
 */

// ============================================================================
// COLOR PALETTE
// ============================================================================

export const colors = {
  // Primary Brand Colors
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6', // Main brand color
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    950: '#172554'
  },

  // Secondary Colors
  secondary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E', // Secondary brand
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16'
  },

  // Semantic Colors
  semantic: {
    success: {
      light: '#DCFCE7',
      main: '#22C55E',
      dark: '#15803D',
      text: '#166534'
    },
    warning: {
      light: '#FEF3C7',
      main: '#F59E0B',
      dark: '#D97706',
      text: '#92400E'
    },
    error: {
      light: '#FEE2E2',
      main: '#EF4444',
      dark: '#DC2626',
      text: '#991B1B'
    },
    info: {
      light: '#DBEAFE',
      main: '#3B82F6',
      dark: '#1D4ED8',
      text: '#1E40AF'
    }
  },

  // Alert Severity Colors
  severity: {
    critical: {
      background: '#FEE2E2',
      border: '#FCA5A5',
      text: '#991B1B',
      icon: '#DC2626'
    },
    high: {
      background: '#FEF3C7',
      border: '#FCD34D',
      text: '#92400E',
      icon: '#F59E0B'
    },
    medium: {
      background: '#DBEAFE',
      border: '#93C5FD',
      text: '#1E40AF',
      icon: '#3B82F6'
    },
    low: {
      background: '#DCFCE7',
      border: '#86EFAC',
      text: '#166534',
      icon: '#22C55E'
    },
    info: {
      background: '#F0F9FF',
      border: '#7DD3FC',
      text: '#0C4A6E',
      icon: '#0EA5E9'
    }
  },

  // Neutral/Gray Scale
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    950: '#030712'
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    inverse: '#111827',
    overlay: 'rgba(0, 0, 0, 0.6)',
    disabled: '#F3F4F6'
  },

  // Text Colors
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    disabled: '#D1D5DB',
    link: '#3B82F6',
    linkHover: '#1D4ED8'
  },

  // Border Colors
  border: {
    primary: '#E5E7EB',
    secondary: '#D1D5DB',
    tertiary: '#9CA3AF',
    focus: '#3B82F6',
    error: '#F87171',
    success: '#4ADE80',
    warning: '#FBBF24'
  }
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    serif: ['Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif']
  },

  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem'  // 60px
  },

  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900
  },

  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em'
  }
} as const;

// ============================================================================
// SPACING
// ============================================================================

export const spacing = {
  0: '0px',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  7: '1.75rem',   // 28px
  8: '2rem',      // 32px
  9: '2.25rem',   // 36px
  10: '2.5rem',   // 40px
  11: '2.75rem',  // 44px
  12: '3rem',     // 48px
  14: '3.5rem',   // 56px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  28: '7rem',     // 112px
  32: '8rem',     // 128px
  36: '9rem',     // 144px
  40: '10rem',    // 160px
  44: '11rem',    // 176px
  48: '12rem',    // 192px
  52: '13rem',    // 208px
  56: '14rem',    // 224px
  60: '15rem',    // 240px
  64: '16rem',    // 256px
  72: '18rem',    // 288px
  80: '20rem',    // 320px
  96: '24rem'     // 384px
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',

  // Specialized shadows
  card: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  modal: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  dropdown: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  focus: '0 0 0 3px rgba(59, 130, 246, 0.3)',
  error: '0 0 0 3px rgba(239, 68, 68, 0.3)',
  success: '0 0 0 3px rgba(34, 197, 94, 0.3)'
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
  none: '0px',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px'
} as const;

// ============================================================================
// Z-INDEX
// ============================================================================

export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1020,
  banner: 1030,
  overlay: 1040,
  modal: 1050,
  popover: 1060,
  skipLink: 1070,
  toast: 1080,
  tooltip: 1090
} as const;

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
} as const;

// ============================================================================
// ANIMATIONS
// ============================================================================

export const animations = {
  duration: {
    fast: '150ms',
    base: '250ms',
    slow: '350ms',
    slower: '500ms'
  },

  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  },

  keyframes: {
    spin: {
      from: { transform: 'rotate(0deg)' },
      to: { transform: 'rotate(360deg)' }
    },
    ping: {
      '75%, 100%': {
        transform: 'scale(2)',
        opacity: '0'
      }
    },
    pulse: {
      '0%, 100%': { opacity: '1' },
      '50%': { opacity: '0.5' }
    },
    bounce: {
      '0%, 100%': {
        transform: 'translateY(-25%)',
        animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)'
      },
      '50%': {
        transform: 'translateY(0)',
        animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)'
      }
    },
    fadeIn: {
      from: { opacity: '0' },
      to: { opacity: '1' }
    },
    slideDown: {
      from: { transform: 'translateY(-10px)', opacity: '0' },
      to: { transform: 'translateY(0)', opacity: '1' }
    },
    slideUp: {
      from: { transform: 'translateY(10px)', opacity: '0' },
      to: { transform: 'translateY(0)', opacity: '1' }
    }
  }
} as const;

// ============================================================================
// COMPONENT VARIANTS
// ============================================================================

export const componentVariants = {
  button: {
    size: {
      xs: {
        padding: `${spacing[1]} ${spacing[2]}`,
        fontSize: typography.fontSize.xs,
        borderRadius: borderRadius.sm
      },
      sm: {
        padding: `${spacing[2]} ${spacing[3]}`,
        fontSize: typography.fontSize.sm,
        borderRadius: borderRadius.base
      },
      md: {
        padding: `${spacing[3]} ${spacing[4]}`,
        fontSize: typography.fontSize.base,
        borderRadius: borderRadius.md
      },
      lg: {
        padding: `${spacing[4]} ${spacing[6]}`,
        fontSize: typography.fontSize.lg,
        borderRadius: borderRadius.lg
      }
    },
    variant: {
      primary: {
        backgroundColor: colors.primary[500],
        color: colors.text.inverse,
        border: `1px solid ${colors.primary[500]}`,
        hover: {
          backgroundColor: colors.primary[600]
        }
      },
      secondary: {
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        border: `1px solid ${colors.border.primary}`,
        hover: {
          backgroundColor: colors.gray[50]
        }
      },
      success: {
        backgroundColor: colors.semantic.success.main,
        color: colors.text.inverse,
        border: `1px solid ${colors.semantic.success.main}`,
        hover: {
          backgroundColor: colors.semantic.success.dark
        }
      },
      warning: {
        backgroundColor: colors.semantic.warning.main,
        color: colors.text.inverse,
        border: `1px solid ${colors.semantic.warning.main}`,
        hover: {
          backgroundColor: colors.semantic.warning.dark
        }
      },
      error: {
        backgroundColor: colors.semantic.error.main,
        color: colors.text.inverse,
        border: `1px solid ${colors.semantic.error.main}`,
        hover: {
          backgroundColor: colors.semantic.error.dark
        }
      }
    }
  },

  card: {
    variant: {
      elevated: {
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.card,
        border: 'none'
      },
      outlined: {
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.lg,
        boxShadow: 'none',
        border: `1px solid ${colors.border.primary}`
      },
      filled: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        boxShadow: 'none',
        border: 'none'
      }
    }
  },

  input: {
    size: {
      sm: {
        padding: `${spacing[2]} ${spacing[3]}`,
        fontSize: typography.fontSize.sm,
        borderRadius: borderRadius.base
      },
      md: {
        padding: `${spacing[3]} ${spacing[4]}`,
        fontSize: typography.fontSize.base,
        borderRadius: borderRadius.md
      },
      lg: {
        padding: `${spacing[4]} ${spacing[5]}`,
        fontSize: typography.fontSize.lg,
        borderRadius: borderRadius.lg
      }
    },
    state: {
      default: {
        borderColor: colors.border.primary,
        backgroundColor: colors.background.primary,
        color: colors.text.primary
      },
      focus: {
        borderColor: colors.border.focus,
        boxShadow: shadows.focus,
        outline: 'none'
      },
      error: {
        borderColor: colors.border.error,
        boxShadow: shadows.error
      },
      disabled: {
        backgroundColor: colors.background.disabled,
        color: colors.text.disabled,
        cursor: 'not-allowed'
      }
    }
  }
} as const;

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================

export const layout = {
  container: {
    xs: '100%',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  },

  sidebar: {
    width: '256px',
    collapsedWidth: '64px'
  },

  header: {
    height: '64px'
  },

  footer: {
    height: '48px'
  }
} as const;

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type ColorScale = typeof colors.primary;
export type SemanticColor = keyof typeof colors.semantic;
export type SeverityLevel = keyof typeof colors.severity;
export type FontSize = keyof typeof typography.fontSize;
export type FontWeight = keyof typeof typography.fontWeight;
export type Spacing = keyof typeof spacing;
export type Shadow = keyof typeof shadows;
export type BorderRadius = keyof typeof borderRadius;
export type ZIndex = keyof typeof zIndex;
export type Breakpoint = keyof typeof breakpoints;