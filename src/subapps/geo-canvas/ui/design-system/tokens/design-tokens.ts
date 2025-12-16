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
// DASHBOARD COMPONENTS
// ============================================================================

export const dashboardComponents = {
  metricsCard: {
    base: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      minHeight: '120px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: shadows.card
    },
    title: {
      margin: 0,
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      fontWeight: typography.fontWeight.medium
    },
    value: {
      fontSize: '1.75rem', // 28px
      fontWeight: typography.fontWeight.bold,
      lineHeight: typography.lineHeight.none
    },
    subtitle: {
      margin: 0,
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary
    },
    icon: {
      fontSize: '1.25rem' // 20px
    },
    trend: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary
    }
  },

  alertsList: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      boxShadow: shadows.card
    },
    header: {
      margin: `0 0 ${spacing[4]} 0`,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    scrollArea: {
      maxHeight: '400px',
      overflowY: 'auto' as const
    },
    item: {
      padding: spacing[3],
      borderBottom: `1px solid ${colors.gray[100]}`,
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing[3],
      transition: `background-color ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.gray[50]
      }
    }
  },

  eventsList: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      boxShadow: shadows.card
    },
    header: {
      margin: `0 0 ${spacing[4]} 0`,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    scrollArea: {
      maxHeight: '300px',
      overflowY: 'auto' as const
    },
    item: {
      padding: spacing[2],
      borderBottom: `1px solid ${colors.gray[100]}`,
      display: 'flex',
      alignItems: 'center',
      gap: spacing[3],
      fontSize: typography.fontSize.sm
    },
    eventIcon: {
      fontSize: typography.fontSize.sm
    },
    eventText: {
      flex: 1,
      color: colors.text.primary
    },
    timestamp: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary
    }
  },

  alertConfig: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      boxShadow: shadows.card
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2],
      marginBottom: spacing[3]
    },
    title: {
      margin: 0,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold
    },
    configList: {
      display: 'flex',
      flexDirection: 'column',
      gap: spacing[1]
    },
    configItem: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    }
  },

  loadingState: {
    container: {
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg,
      padding: spacing[8],
      textAlign: 'center' as const
    },
    spinner: {
      fontSize: '1.5rem', // 24px
      marginBottom: spacing[2]
    },
    text: {
      color: colors.text.secondary
    },
    error: {
      color: colors.semantic.error.main,
      marginTop: spacing[2],
      fontSize: typography.fontSize.xs
    }
  },

  dashboardLayout: {
    container: {
      minHeight: '100vh',
      backgroundColor: colors.background.secondary,
      padding: spacing[6]
    },
    header: {
      backgroundColor: colors.background.primary,
      borderRadius: borderRadius.lg,
      padding: spacing[6],
      marginBottom: spacing[6],
      boxShadow: shadows.card
    },
    title: {
      margin: `0 0 ${spacing[2]} 0`,
      fontSize: '1.75rem', // 28px
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary
    },
    subtitle: {
      margin: 0,
      color: colors.text.secondary,
      fontSize: typography.fontSize.lg
    },
    controls: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[3]
    },
    metricsGrid: {
      marginBottom: spacing[6]
    },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      gap: spacing[6]
    },
    twoColumnGrid: {
      display: 'flex',
      flexDirection: 'column',
      gap: spacing[6]
    }
  },

  statusBadge: {
    base: {
      padding: `${spacing[1]} ${spacing[2]}`,
      borderRadius: borderRadius.full,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      textTransform: 'uppercase' as const,
      display: 'inline-flex',
      alignItems: 'center'
    },
    variants: {
      active: {
        backgroundColor: colors.severity.critical.background,
        color: colors.severity.critical.text
      },
      acknowledged: {
        backgroundColor: colors.severity.high.background,
        color: colors.severity.high.text
      },
      resolved: {
        backgroundColor: colors.severity.low.background,
        color: colors.severity.low.text
      },
      suppressed: {
        backgroundColor: colors.gray[200],
        color: colors.gray[600]
      }
    }
  },

  mapComponents: {
    container: {
      base: {
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column' as const
      }
    },

    header: {
      base: {
        padding: spacing[4],
        backgroundColor: colors.gray[800],
        color: colors.text.inverse,
        display: 'flex',
        gap: spacing[4],
        alignItems: 'center',
        flexWrap: 'wrap' as const
      },
      title: {
        margin: 0,
        color: colors.primary[400],
        fontSize: typography.fontSize['2xl'],
        fontWeight: typography.fontWeight.semibold
      }
    },

    controlSection: {
      base: {
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2]
      },
      label: {
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2],
        fontSize: typography.fontSize.sm,
        color: colors.text.inverse
      },
      select: {
        padding: `${spacing[1]} ${spacing[2]}`,
        backgroundColor: colors.gray[700],
        color: colors.text.inverse,
        border: `1px solid ${colors.gray[600]}`,
        borderRadius: borderRadius.base,
        fontSize: typography.fontSize.sm
      },
      button: {
        base: {
          padding: `${spacing[1]} ${spacing[3]}`,
          borderRadius: borderRadius.base,
          border: 'none',
          cursor: 'pointer',
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.medium,
          transition: `all ${animations.duration.fast}`
        },
        primary: {
          backgroundColor: colors.primary[500],
          color: colors.text.inverse,
          '&:hover': {
            backgroundColor: colors.primary[600]
          }
        },
        secondary: {
          backgroundColor: colors.gray[600],
          color: colors.text.inverse,
          '&:hover': {
            backgroundColor: colors.gray[500]
          }
        },
        danger: {
          backgroundColor: colors.semantic.error.main,
          color: colors.text.inverse,
          '&:hover': {
            backgroundColor: colors.semantic.error.dark
          }
        }
      }
    },

    mapContainer: {
      base: {
        flex: 1,
        position: 'relative' as const
      }
    },

    sidebar: {
      base: {
        position: 'absolute' as const,
        top: spacing[4],
        right: spacing[4],
        width: '320px',
        maxHeight: 'calc(100% - 32px)',
        backgroundColor: colors.background.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.lg,
        zIndex: 10,
        overflow: 'hidden'
      },
      header: {
        backgroundColor: colors.gray[50],
        padding: spacing[4],
        borderBottom: `1px solid ${colors.border.primary}`
      },
      title: {
        margin: 0,
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        color: colors.text.primary
      },
      content: {
        padding: spacing[4],
        maxHeight: '400px',
        overflowY: 'auto' as const
      }
    },

    polygonList: {
      item: {
        padding: spacing[3],
        marginBottom: spacing[2],
        backgroundColor: colors.gray[50],
        border: `1px solid ${colors.border.secondary}`,
        borderRadius: borderRadius.base,
        cursor: 'pointer',
        transition: `all ${animations.duration.fast}`,
        '&:hover': {
          backgroundColor: colors.gray[100],
          borderColor: colors.primary[300]
        }
      },
      title: {
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary,
        marginBottom: spacing[1]
      },
      metadata: {
        fontSize: typography.fontSize.xs,
        color: colors.text.secondary,
        marginBottom: spacing[1]
      },
      timestamp: {
        fontSize: typography.fontSize.xs,
        color: colors.text.tertiary
      },
      actions: {
        display: 'flex',
        gap: spacing[2],
        marginTop: spacing[2]
      }
    },

    debugSection: {
      container: {
        position: 'absolute' as const,
        bottom: spacing[4],
        left: spacing[4],
        right: spacing[4],
        backgroundColor: colors.background.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.md
      },
      summary: {
        cursor: 'pointer',
        fontWeight: typography.fontWeight.semibold,
        padding: spacing[3],
        backgroundColor: colors.gray[50],
        borderRadius: `${borderRadius.lg} ${borderRadius.lg} 0 0`,
        borderBottom: `1px solid ${colors.border.primary}`
      },
      content: {
        padding: spacing[4],
        backgroundColor: colors.gray[900],
        color: colors.gray[100],
        fontFamily: typography.fontFamily.mono,
        fontSize: typography.fontSize.xs,
        lineHeight: typography.lineHeight.relaxed,
        overflowX: 'auto' as const,
        borderRadius: `0 0 ${borderRadius.lg} ${borderRadius.lg}`
      }
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

// ============================================================================
// CONFIGURATION INTERFACE COMPONENTS
// ============================================================================

export const configurationComponents = {
  layout: {
    container: {
      backgroundColor: colors.background.secondary,
      minHeight: '100vh',
      padding: spacing[6]
    },
    header: {
      marginBottom: spacing[6]
    },
    title: {
      margin: '0 0 8px 0',
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary
    },
    subtitle: {
      margin: 0,
      color: colors.text.secondary,
      fontSize: typography.fontSize.base
    },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      gap: spacing[6]
    },
    sidebar: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: spacing[4]
    }
  },

  configurationCard: {
    base: {
      backgroundColor: colors.background.primary,
      border: `2px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      cursor: 'pointer',
      transition: `all ${animations.duration.normal}`
    },
    selected: {
      backgroundColor: colors.primary[50],
      borderColor: colors.primary[500]
    },
    hover: {
      backgroundColor: colors.gray[50],
      borderColor: colors.gray[300]
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[3],
      marginBottom: spacing[2]
    },
    icon: {
      fontSize: '1.5rem' // 24px
    },
    titleContainer: {
      flex: 1
    },
    title: {
      margin: 0,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    statusContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2],
      marginTop: spacing[1]
    },
    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%'
    },
    statusText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      textTransform: 'capitalize' as const
    },
    description: {
      margin: 0,
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed
    }
  },

  ruleEditor: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[6],
      boxShadow: shadows.card
    },
    header: {
      margin: `0 0 ${spacing[6]} 0`,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    section: {
      marginBottom: spacing[6]
    },
    label: {
      display: 'block',
      marginBottom: spacing[2],
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary
    },
    input: {
      width: '100%',
      padding: `${spacing[2]} ${spacing[3]}`,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      backgroundColor: colors.background.primary,
      transition: `border-color ${animations.duration.fast}`,
      '&:focus': {
        outline: 'none',
        borderColor: colors.border.focus,
        boxShadow: shadows.focus
      }
    },
    textarea: {
      width: '100%',
      padding: `${spacing[2]} ${spacing[3]}`,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      backgroundColor: colors.background.primary,
      minHeight: '80px',
      resize: 'vertical' as const,
      transition: `border-color ${animations.duration.fast}`,
      '&:focus': {
        outline: 'none',
        borderColor: colors.border.focus,
        boxShadow: shadows.focus
      }
    },
    select: {
      width: '100%',
      padding: `${spacing[2]} ${spacing[3]}`,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.md,
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      backgroundColor: colors.background.primary,
      cursor: 'pointer',
      transition: `border-color ${animations.duration.fast}`,
      '&:focus': {
        outline: 'none',
        borderColor: colors.border.focus,
        boxShadow: shadows.focus
      }
    },
    gridTwoColumns: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: spacing[4],
      marginBottom: spacing[6]
    },
    checkboxContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2]
    },
    checkboxLabel: {
      fontSize: typography.fontSize.sm,
      color: colors.text.primary,
      cursor: 'pointer'
    },
    mockSection: {
      backgroundColor: colors.background.secondary,
      padding: spacing[4],
      borderRadius: borderRadius.md
    },
    mockText: {
      margin: 0,
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed
    },
    mockButtonContainer: {
      marginTop: spacing[3]
    },
    actionButtons: {
      display: 'flex',
      gap: spacing[3],
      justifyContent: 'flex-end'
    }
  },

  notificationSettings: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[6],
      boxShadow: shadows.card
    },
    header: {
      margin: `0 0 ${spacing[6]} 0`,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    sectionTitle: {
      margin: `0 0 ${spacing[4]} 0`,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    channelsGrid: {
      display: 'grid',
      gap: spacing[3]
    },
    channelItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing[3],
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background.primary
    },
    channelLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[3]
    },
    channelCheckbox: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2]
    },
    channelName: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      textTransform: 'capitalize' as const,
      color: colors.text.primary
    },
    channelRight: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2]
    },
    priorityLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    },
    priorityInput: {
      width: '60px',
      padding: `${spacing[1]} ${spacing[2]}`,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.sm,
      fontSize: typography.fontSize.xs,
      textAlign: 'center' as const
    },
    advancedGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: spacing[4]
    },
    saveButtonContainer: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  },

  rulesSection: {
    headerContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing[6]
    },
    title: {
      margin: 0,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    rulesGrid: {
      display: 'grid',
      gap: spacing[4]
    },
    ruleCard: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      boxShadow: shadows.card
    },
    ruleHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing[2]
    },
    ruleTitle: {
      margin: '0 0 4px 0',
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    ruleMetadata: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2]
    },
    statusBadge: {
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium
    },
    statusActive: {
      backgroundColor: colors.semantic.success.light,
      color: colors.semantic.success.text
    },
    statusInactive: {
      backgroundColor: colors.background.disabled,
      color: colors.text.disabled
    },
    priorityText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    },
    ruleDescription: {
      margin: 0,
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed
    }
  },

  loadingState: {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '400px',
      backgroundColor: colors.background.secondary
    },
    content: {
      textAlign: 'center' as const
    },
    spinner: {
      fontSize: '1.5rem', // 24px
      marginBottom: spacing[2],
      animation: `spin ${animations.duration.normal} linear infinite`
    },
    text: {
      color: colors.text.secondary,
      fontSize: typography.fontSize.sm
    }
  },

  placeholderSection: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.lg,
      padding: spacing[6],
      textAlign: 'center' as const
    },
    title: {
      margin: `0 0 ${spacing[4]} 0`,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    text: {
      margin: 0,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed
    }
  },

  buttons: {
    primary: {
      padding: `${spacing[2]} ${spacing[4]}`,
      border: 'none',
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary[500],
      color: colors.text.inverse,
      cursor: 'pointer',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      transition: `all ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.primary[600]
      },
      '&:focus': {
        outline: 'none',
        boxShadow: shadows.focus
      }
    },
    secondary: {
      padding: `${spacing[2]} ${spacing[4]}`,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background.primary,
      color: colors.text.primary,
      cursor: 'pointer',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      transition: `all ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.gray[50],
        borderColor: colors.border.primary
      },
      '&:focus': {
        outline: 'none',
        boxShadow: shadows.focus
      }
    },
    small: {
      padding: `${spacing[1]} ${spacing[3]}`,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.primary,
      color: colors.text.primary,
      cursor: 'pointer',
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      transition: `all ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.gray[50]
      }
    }
  }
} as const;

// ============================================================================
// POLYGON DRAWING EXAMPLES COMPONENTS
// ============================================================================

export const polygonDrawingComponents = {
  layout: {
    container: {
      padding: spacing[5],
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: typography.fontFamily.sans
    },
    title: {
      margin: `0 0 ${spacing[6]} 0`,
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    }
  },

  controls: {
    section: {
      marginBottom: spacing[5],
      display: 'flex',
      gap: spacing[3],
      flexWrap: 'wrap' as const,
      alignItems: 'flex-start'
    },
    group: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: spacing[2]
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary
    },
    select: {
      padding: `${spacing[2]} ${spacing[3]}`,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.base,
      fontSize: typography.fontSize.sm,
      backgroundColor: colors.background.primary,
      color: colors.text.primary,
      cursor: 'pointer',
      transition: `border-color ${animations.duration.fast}`,
      '&:focus': {
        outline: 'none',
        borderColor: colors.border.focus,
        boxShadow: shadows.focus
      },
      '&:disabled': {
        backgroundColor: colors.background.disabled,
        color: colors.text.disabled,
        cursor: 'not-allowed'
      }
    }
  },

  buttons: {
    base: {
      padding: `${spacing[2]} ${spacing[4]}`,
      border: 'none',
      borderRadius: borderRadius.base,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: `all ${animations.duration.fast}`,
      outline: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    },
    primary: {
      backgroundColor: colors.primary[600],
      color: colors.text.inverse,
      '&:hover': {
        backgroundColor: colors.primary[700]
      },
      '&:focus': {
        boxShadow: shadows.focus
      }
    },
    success: {
      backgroundColor: colors.semantic.success.main,
      color: colors.text.inverse,
      '&:hover': {
        backgroundColor: colors.semantic.success.dark
      },
      '&:focus': {
        boxShadow: shadows.focus
      }
    },
    danger: {
      backgroundColor: colors.semantic.error.main,
      color: colors.text.inverse,
      '&:hover': {
        backgroundColor: colors.semantic.error.dark
      },
      '&:focus': {
        boxShadow: shadows.focus
      }
    },
    secondary: {
      backgroundColor: colors.secondary[500],
      color: colors.text.inverse,
      '&:hover': {
        backgroundColor: colors.secondary[600]
      },
      '&:focus': {
        boxShadow: shadows.focus
      }
    },
    disabled: {
      backgroundColor: colors.background.disabled,
      color: colors.text.disabled,
      cursor: 'not-allowed',
      opacity: 0.5
    },
    marginRight: {
      marginRight: spacing[2]
    }
  },

  instructions: {
    container: {
      marginBottom: spacing[5],
      padding: spacing[3],
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.base,
      fontSize: typography.fontSize.sm,
      lineHeight: typography.lineHeight.relaxed
    },
    title: {
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing[1]
    },
    list: {
      margin: `${spacing[2]} 0`,
      paddingLeft: spacing[5],
      color: colors.text.secondary
    },
    listItem: {
      marginBottom: spacing[1]
    }
  },

  canvas: {
    container: {
      marginBottom: spacing[5]
    },
    element: {
      border: `2px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.lg,
      display: 'block',
      transition: `border-color ${animations.duration.fast}`
    },
    drawing: {
      cursor: 'crosshair'
    },
    default: {
      cursor: 'default'
    }
  },

  statistics: {
    container: {
      marginBottom: spacing[5]
    },
    title: {
      margin: `0 0 ${spacing[4]} 0`,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: spacing[3]
    },
    card: {
      padding: spacing[3],
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.base,
      border: `1px solid ${colors.border.primary}`,
      textAlign: 'center' as const
    },
    cardActive: {
      backgroundColor: colors.semantic.warning.light,
      borderColor: colors.semantic.warning.main
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      display: 'block',
      marginBottom: spacing[1]
    },
    value: {
      fontSize: typography.fontSize.base,
      color: colors.text.secondary
    }
  },

  polygonList: {
    container: {
      marginTop: spacing[5]
    },
    title: {
      margin: `0 0 ${spacing[4]} 0`,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    scrollArea: {
      maxHeight: '300px',
      overflowY: 'auto' as const,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.base,
      padding: spacing[2]
    },
    item: {
      padding: spacing[3],
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.base,
      marginBottom: spacing[2],
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.background.primary,
      transition: `all ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.background.secondary,
        borderColor: colors.border.primary
      },
      '&:last-child': {
        marginBottom: 0
      }
    },
    info: {
      flex: 1
    },
    primaryText: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing[1]
    },
    secondaryText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    },
    deleteButton: {
      padding: `${spacing[1]} ${spacing[2]}`,
      backgroundColor: colors.semantic.error.main,
      color: colors.text.inverse,
      border: 'none',
      borderRadius: borderRadius.sm,
      cursor: 'pointer',
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      transition: `background-color ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.semantic.error.dark
      }
    }
  },

  debug: {
    container: {
      marginTop: spacing[5]
    },
    summary: {
      cursor: 'pointer',
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.base,
      color: colors.text.primary,
      padding: spacing[2],
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.base,
      border: `1px solid ${colors.border.primary}`,
      outline: 'none',
      transition: `background-color ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.gray[100]
      }
    },
    content: {
      backgroundColor: colors.gray[900],
      color: colors.gray[100],
      padding: spacing[3],
      borderRadius: borderRadius.base,
      fontSize: typography.fontSize.xs,
      fontFamily: typography.fontFamily.mono,
      lineHeight: typography.lineHeight.relaxed,
      overflow: 'auto',
      marginTop: spacing[2],
      border: `1px solid ${colors.border.primary}`
    }
  }
} as const;

// ============================================================================
// DIALOG COMPONENTS
// ============================================================================

export const dialogComponents = {
  modal: {
    backdrop: {
      position: 'fixed' as const,
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: spacing[4]
    },
    container: {
      backgroundColor: colors.gray[800],
      borderRadius: borderRadius.xl,
      boxShadow: shadows.xl,
      maxHeight: '90vh',
      width: '100%',
      maxWidth: '600px',
      overflow: 'auto',
      border: `1px solid ${colors.gray[700]}`
    },
    header: {
      padding: spacing[6],
      borderBottom: `1px solid ${colors.gray[700]}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    title: {
      fontSize: typography.fontSize.xl,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.inverse,
      margin: 0
    },
    closeButton: {
      padding: spacing[2],
      backgroundColor: 'transparent',
      border: 'none',
      color: colors.gray[400],
      fontSize: typography.fontSize.xl,
      cursor: 'pointer',
      borderRadius: borderRadius.base,
      transition: `all ${animations.duration.fast}`,
      '&:hover': {
        backgroundColor: colors.gray[700],
        color: colors.text.inverse
      }
    },
    content: {
      padding: spacing[6]
    },
    footer: {
      padding: spacing[6],
      borderTop: `1px solid ${colors.gray[700]}`,
      display: 'flex',
      gap: spacing[3],
      justifyContent: 'flex-end'
    }
  },

  form: {
    fieldset: {
      border: 'none',
      padding: 0,
      margin: `0 0 ${spacing[6]} 0`
    },
    label: {
      display: 'block',
      color: colors.text.inverse,
      fontWeight: typography.fontWeight.medium,
      marginBottom: spacing[3],
      fontSize: typography.fontSize.sm
    },
    select: {
      width: '100%',
      padding: spacing[3],
      backgroundColor: colors.gray[700],
      border: `1px solid ${colors.gray[600]}`,
      borderRadius: borderRadius.lg,
      color: colors.text.inverse,
      fontSize: typography.fontSize.sm,
      transition: `border-color ${animations.duration.fast}`,
      '&:focus': {
        outline: 'none',
        borderColor: colors.primary[500],
        boxShadow: shadows.focus
      },
      '&:disabled': {
        backgroundColor: colors.gray[800],
        color: colors.gray[500],
        cursor: 'not-allowed'
      }
    },
    option: {
      backgroundColor: colors.gray[700],
      color: colors.text.inverse,
      padding: spacing[2]
    },
    errorState: {
      padding: spacing[3],
      backgroundColor: colors.semantic.error.light,
      border: `1px solid ${colors.semantic.error.main}`,
      borderRadius: borderRadius.base,
      marginTop: spacing[3]
    },
    errorText: {
      color: colors.semantic.error.text,
      fontSize: typography.fontSize.sm,
      margin: 0
    },
    loadingState: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2],
      color: colors.gray[300],
      fontSize: typography.fontSize.sm
    },
    emptyState: {
      marginTop: spacing[3],
      padding: spacing[3],
      backgroundColor: colors.gray[700],
      borderRadius: borderRadius.lg
    },
    emptyText: {
      color: colors.gray[300],
      fontSize: typography.fontSize.sm,
      margin: 0
    }
  },

  infoCard: {
    container: {
      marginBottom: spacing[4],
      padding: spacing[3],
      backgroundColor: 'rgba(59, 130, 246, 0.1)', // blue-900/20
      border: `1px solid ${colors.primary[600]}`,
      borderRadius: borderRadius.lg
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2]
    },
    icon: {
      fontSize: '1.125rem' // 18px
    },
    content: {
      flex: 1
    },
    title: {
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.inverse,
      margin: 0,
      fontSize: typography.fontSize.sm
    },
    subtitle: {
      color: colors.gray[300],
      fontSize: typography.fontSize.xs,
      margin: 0
    }
  },

  buttons: {
    base: {
      padding: `${spacing[3]} ${spacing[4]}`,
      borderRadius: borderRadius.lg,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      cursor: 'pointer',
      transition: `all ${animations.duration.fast}`,
      border: 'none',
      outline: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2]
    },
    primary: {
      backgroundColor: colors.primary[600],
      color: colors.text.inverse,
      '&:hover': {
        backgroundColor: colors.primary[700]
      },
      '&:focus': {
        boxShadow: shadows.focus
      },
      '&:disabled': {
        backgroundColor: colors.gray[600],
        color: colors.gray[400],
        cursor: 'not-allowed'
      }
    },
    secondary: {
      backgroundColor: colors.gray[600],
      color: colors.text.inverse,
      '&:hover': {
        backgroundColor: colors.gray[700]
      },
      '&:focus': {
        boxShadow: shadows.focus
      },
      '&:disabled': {
        backgroundColor: colors.gray[700],
        color: colors.gray[500],
        cursor: 'not-allowed'
      }
    },
    danger: {
      backgroundColor: colors.semantic.error.main,
      color: colors.text.inverse,
      '&:hover': {
        backgroundColor: colors.semantic.error.dark
      },
      '&:focus': {
        boxShadow: shadows.focus
      }
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.gray[300],
      border: `1px solid ${colors.gray[600]}`,
      '&:hover': {
        backgroundColor: colors.gray[700],
        color: colors.text.inverse
      }
    }
  },

  steps: {
    container: {
      marginBottom: spacing[6]
    },
    list: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[4]
    },
    step: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing[2],
      flex: 1
    },
    stepNumber: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    stepNumberActive: {
      backgroundColor: colors.primary[600],
      color: colors.text.inverse
    },
    stepNumberCompleted: {
      backgroundColor: colors.semantic.success.main,
      color: colors.text.inverse
    },
    stepNumberInactive: {
      backgroundColor: colors.gray[600],
      color: colors.gray[400]
    },
    stepLabel: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    stepLabelActive: {
      color: colors.text.inverse
    },
    stepLabelInactive: {
      color: colors.gray[400]
    },
    divider: {
      flex: 1,
      height: '1px',
      backgroundColor: colors.gray[600]
    }
  }
} as const;

// ============================================================================
// STATUS INDICATOR COMPONENTS - ENTERPRISE AUTOSAVE SYSTEM
// ============================================================================

/**
 * Status Indicator Components για AutoSave & Settings Status
 * Enterprise-class status visualization με semantic meaning
 *
 * @example
 * ```tsx
 * <div style={statusIndicatorComponents.dot.active} />
 * <div style={statusIndicatorComponents.separator} />
 * ```
 */
export const statusIndicatorComponents = {
  // Status Container
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[3]} ${spacing[4]}`,
    backgroundColor: `${colors.gray[800]}80`, // 50% opacity
    border: `1px solid ${colors.gray[600]}`,
    borderRadius: borderRadius.md,
    transition: `all ${animations.duration.fast}`,
    position: 'relative' as const,
    zIndex: 9999,

    '&:hover': {
      backgroundColor: `${colors.gray[700]}80`,
      borderColor: colors.gray[500]
    }
  },

  // Compact Container
  compactContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1rem',
    height: '1rem',
    cursor: 'pointer'
  },

  // Status Message
  statusMessage: {
    primary: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary
    },
    secondary: {
      fontSize: typography.fontSize.xs,
      color: colors.gray[500],
      marginTop: '0.25rem'
    }
  },

  // Status Icons
  statusIcon: {
    base: {
      width: '0.75rem',
      height: '0.75rem',
      flexShrink: 0
    },
    saving: {
      width: '0.75rem',
      height: '0.75rem',
      border: `2px solid ${colors.blue[500]}`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    success: {
      color: colors.green[500]
    },
    error: {
      color: colors.red[500]
    },
    idle: {
      color: colors.gray[400]
    }
  },

  // Status Color Variants
  statusColors: {
    saving: {
      text: colors.blue[400],
      border: `${colors.blue[500]}4D` // 30% opacity
    },
    success: {
      text: colors.green[400],
      border: `${colors.green[500]}4D` // 30% opacity
    },
    error: {
      text: colors.red[400],
      border: `${colors.red[500]}4D` // 30% opacity
    },
    idle: {
      text: colors.gray[400],
      border: `${colors.gray[500]}4D` // 30% opacity
    }
  },

  // Settings Indicator Dots
  settingsDots: {
    container: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem'
    },

    // General Settings (Blue)
    general: {
      container: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        title: 'Γενικές Ρυθμίσεις'
      },
      dot: {
        base: {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          transition: `background-color ${animations.duration.fast}`
        },
        active: {
          backgroundColor: colors.blue[400] // #60a5fa
        },
        inactive: {
          backgroundColor: colors.gray[600] // #4b5563
        }
      }
    },

    // Specific Settings (Green)
    specific: {
      container: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        title: 'Ειδικές Ρυθμίσεις'
      },
      dot: {
        base: {
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          transition: `background-color ${animations.duration.fast}`
        },
        active: {
          backgroundColor: colors.green[400] // #4ade80
        },
        inactive: {
          backgroundColor: colors.gray[600] // #4b5563
        }
      }
    }
  },

  // Separator
  separator: {
    width: '1px',
    height: '16px',
    backgroundColor: colors.gray[500], // #6b7280
    opacity: 0.7
  },

  // Compact Status Indicators
  compact: {
    saving: {
      width: '0.5rem',
      height: '0.5rem',
      border: `1px solid ${colors.blue[500]}`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    success: {
      width: '0.5rem',
      height: '0.5rem',
      borderRadius: '50%',
      backgroundColor: colors.green[500]
    },
    error: {
      width: '0.5rem',
      height: '0.5rem',
      borderRadius: '50%',
      backgroundColor: colors.red[500]
    }
  }
} as const;