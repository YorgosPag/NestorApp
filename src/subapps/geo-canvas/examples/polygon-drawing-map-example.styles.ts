import type { CSSProperties } from 'react';
import { animation, borderRadius, colors, spacing, typography } from '@/styles/design-tokens';
import { GEO_COLORS, withOpacity } from '../config/color-config';

const headerPaddingY = spacing.md;
const headerPaddingX = spacing.lg;
const controlLabelGap = 'calc(' + spacing.xs + ' + ' + spacing.component.padding.xs + ')';
const controlSelectPaddingY = 'calc(' + spacing.xs + ' + ' + spacing.component.padding.xs + ')';
const controlSelectPaddingX = 'calc(' + spacing.component.padding.lg + ' + ' + spacing.component.padding.xs + ')';
const sidebarContentPadding = spacing.component.padding.lg;
const sidebarEmptyPadding = spacing.lg;
const listItemPadding = spacing.component.padding.lg;
const debugContentPadding = spacing.component.padding.lg;
const buttonPaddingY = 'calc(' + spacing.xs + ' + ' + spacing.component.padding.xs + ')';
const buttonPaddingX = spacing.component.padding.lg;
const buttonSmallPaddingY = spacing.xs;
const buttonSmallPaddingX = spacing.sm;

export const mapComponents = {
  container: {
    base: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: GEO_COLORS.GRAY_900
    } as CSSProperties,
  },
  header: {
    base: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      padding: headerPaddingY + ' ' + headerPaddingX,
      backgroundColor: withOpacity(colors.text.primary, 0.95),
      borderBottom: '1px solid ' + withOpacity(colors.text.secondary, 0.3)
    } as CSSProperties,
    title: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.background.secondary,
      margin: 0
    } as CSSProperties,
  },
  controlSection: {
    base: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
    } as CSSProperties,
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: controlLabelGap,
      color: colors.border.primary,
      fontSize: typography.fontSize.sm,
      cursor: 'pointer',
    } as CSSProperties,
    select: {
      padding: controlSelectPaddingY + ' ' + controlSelectPaddingX,
      backgroundColor: colors.text.primary,
      border: '1px solid ' + withOpacity(colors.text.secondary, 0.4),
      borderRadius: borderRadius.default,
      color: colors.background.secondary,
      fontSize: typography.fontSize.sm,
    } as CSSProperties,
  },
  mapContainer: {
    base: {
      flex: 1,
      display: 'flex',
      position: 'relative',
      overflow: 'hidden',
    } as CSSProperties,
    interactiveMap: {
      flex: 1,
    } as CSSProperties,
  },
  sidebar: {
    base: {
      width: '320px',
      backgroundColor: withOpacity(colors.text.primary, 0.95),
      borderLeft: '1px solid ' + withOpacity(colors.text.secondary, 0.3),
      display: 'flex',
      flexDirection: 'column',
    } as CSSProperties,
    header: {
      padding: spacing.md,
      borderBottom: '1px solid ' + withOpacity(colors.text.secondary, 0.3),
    } as CSSProperties,
    title: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.background.secondary,
      margin: 0,
    } as CSSProperties,
    content: {
      flex: 1,
      overflowY: 'auto',
      padding: sidebarContentPadding,
    } as CSSProperties,
    emptyState: {
      color: colors.text.tertiary,
      fontSize: typography.fontSize.sm,
      textAlign: 'center',
      padding: sidebarEmptyPadding,
    } as CSSProperties,
  },
  polygonList: {
    item: {
      padding: listItemPadding,
      backgroundColor: withOpacity(GEO_COLORS.GRAY_700, 0.5),
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
    } as CSSProperties,
    title: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.background.secondary,
      marginBottom: spacing.xs,
    } as CSSProperties,
    metadata: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      marginBottom: spacing.xs,
    } as CSSProperties,
    timestamp: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      display: 'block',
      marginBottom: spacing.sm,
    } as CSSProperties,
    actions: {
      display: 'flex',
      gap: spacing.sm,
    } as CSSProperties,
  },
  debugSection: {
    container: {
      padding: headerPaddingY + ' ' + headerPaddingX,
      backgroundColor: withOpacity(colors.text.primary, 0.8),
      borderTop: '1px solid ' + withOpacity(colors.text.secondary, 0.3),
    } as CSSProperties,
    summary: {
      color: colors.text.tertiary,
      fontSize: typography.fontSize.sm,
      cursor: 'pointer',
    } as CSSProperties,
    content: {
      marginTop: spacing.component.padding.lg,
      padding: debugContentPadding,
      backgroundColor: GEO_COLORS.GRAY_900,
      borderRadius: borderRadius.default,
      color: colors.text.tertiary,
      fontSize: typography.fontSize.xs,
      fontFamily: 'monospace',
      overflow: 'auto',
      maxHeight: '200px',
    } as CSSProperties,
  },
} as const;

type ButtonVariant = 'danger' | 'dangerDisabled' | 'secondarySmall' | 'dangerSmall';

export const getMapButtonStyle = (variant: ButtonVariant): CSSProperties => {
  const baseStyle: CSSProperties = {
    padding: buttonPaddingY + ' ' + buttonPaddingX,
    borderRadius: borderRadius.default,
    border: 'none',
    fontSize: typography.fontSize.xs,
    cursor: 'pointer',
    transition: 'all ' + animation.duration.fast + ' ' + animation.easing.easeOut,
  };

  switch (variant) {
    case 'danger':
      return { ...baseStyle, backgroundColor: GEO_COLORS.POLYGON.ERROR, color: colors.text.inverse };
    case 'dangerDisabled':
      return { ...baseStyle, backgroundColor: colors.text.secondary, color: colors.text.tertiary, cursor: 'not-allowed' };
    case 'secondarySmall':
      return { ...baseStyle, backgroundColor: GEO_COLORS.GRAY_700, color: colors.border.primary, padding: buttonSmallPaddingY + ' ' + buttonSmallPaddingX };
    case 'dangerSmall':
      return { ...baseStyle, backgroundColor: GEO_COLORS.POLYGON.ERROR, color: colors.text.inverse, padding: buttonSmallPaddingY + ' ' + buttonSmallPaddingX };
    default:
      return baseStyle;
  }
};
