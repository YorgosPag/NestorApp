/**
 * Chart Components Design Tokens
 * Extracted from layout-utilities.ts for file size compliance.
 * Config/data file (no line limit per CLAUDE.md N.7.1).
 */

import * as React from 'react';
import { colors, spacing, typography, shadows, animation } from './foundations';
import { borderRadius } from './borders';

export const chartComponents = {
  legend: {
    container: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.sm
    },
    positioning: {
      top: {
        marginTop: 0,
        marginBottom: spacing.sm
      },
      bottom: {
        marginTop: spacing.sm,
        marginBottom: 0
      }
    },
    item: {
      base: {
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary
      },
      icon: {
        width: spacing.sm,
        height: spacing.sm,
        borderRadius: borderRadius.full,
        flexShrink: 0
      }
    },
    indicator: {
      base: {
        width: spacing.sm,
        height: spacing.sm,
        borderRadius: borderRadius.full,
        flexShrink: 0
      },
      withColor: (color: string) => ({
        backgroundColor: color
      })
    }
  },
  tooltip: {
    container: {
      base: {
        backgroundColor: colors.background.primary,
        border: `1px solid ${colors.border.secondary}`,
        borderRadius: borderRadius.md,
        boxShadow: shadows.md,
        padding: spacing.sm
      },
      content: {
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary
      }
    },
    indicator: {
      dot: {
        width: spacing.sm,
        height: spacing.sm,
        borderRadius: borderRadius.full
      },
      line: {
        width: spacing.xs,
        height: spacing.lg,
        borderRadius: borderRadius.full
      },
      dashed: {
        width: spacing.xs,
        height: spacing.lg,
        borderRadius: borderRadius.full
      },
      withColor: (color: string) => ({
        backgroundColor: color,
        borderColor: color
      }),
      cssVariables: {
        '--chart-tooltip-indicator-color': colors.text.primary
      } as React.CSSProperties
    }
  },
  container: {
    base: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%'
    },
    responsive: {
      width: '100%',
      height: 'auto'
    },
    sizes: {
      sm: { height: spacing['3xl'] },
      md: { height: spacing['3xl'] },
      lg: { height: spacing['3xl'] },
      xl: { height: spacing['3xl'] }
    }
  },
  axis: {
    line: { stroke: colors.border.secondary },
    tick: {
      fill: colors.text.secondary,
      fontSize: typography.fontSize.xs
    },
    label: {
      fill: colors.text.primary,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    }
  },
  colors: {
    primary: [
      colors.blue['500'],
      colors.green['500'],
      colors.orange['500'],
      colors.red['500'],
      colors.yellow['500']
    ],
    secondary: [
      colors.blue['400'],
      colors.green['300'],
      colors.orange['300'],
      colors.red['300'],
      colors.yellow['400']
    ],
    status: {
      success: colors.green['500'],
      warning: colors.yellow['500'],
      error: colors.red['500'],
      info: colors.blue['500'],
      neutral: colors.gray['500']
    },
    grid: {
      major: colors.border.secondary,
      minor: colors.border.tertiary
    }
  },
  animations: {
    fadeIn: {
      animation: `fadeIn ${animation.duration.normal} ${animation.easing.easeOut}`
    },
    slideUp: {
      animation: `slideUp ${animation.duration.normal} ${animation.easing.easeOut}`
    },
    scale: {
      animation: `scaleIn ${animation.duration.normal} ${animation.easing.easeOut}`
    }
  }
} as const;
