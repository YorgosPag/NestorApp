import type { CSSProperties } from 'react';
import { animation, borderRadius, colors, shadows, spacing, typography, zIndex } from '@/styles/design-tokens';
import { GEO_COLORS, withOpacity } from './color-config';

export const INFO_PANEL_DIMENSIONS = {
  defaultWidth: 350,
  minWidth: 200,
  maxHeight: 400,
  minVisibleHeaderHeight: 100,
  zIndexBase: zIndex.dropdown,
  backdropBlur: '4px',
  activeScale: '1.02',
  inactiveScale: '1'
} as const;

export const INFO_PANEL_POSITIONS = {
  offset: 16,
  verticalSpacing: 200
} as const;

const headerPaddingY = 'calc(' + spacing.sm + ' + ' + spacing.component.padding.xs + ')';
const headerPaddingX = 'calc(' + spacing.component.padding.lg + ' + ' + spacing.component.padding.xs + ')';
const contentPadding = 'calc(' + spacing.component.padding.lg + ' + ' + spacing.component.padding.xs + ')';

export const INFO_PANEL_STYLES = {
  container: (
    position: { x: number; y: number },
    isDragging: boolean,
    width?: number
  ): CSSProperties => ({
    position: 'absolute',
    left: position.x,
    top: position.y,
    width: width ?? INFO_PANEL_DIMENSIONS.defaultWidth,
    minWidth: INFO_PANEL_DIMENSIONS.minWidth,
    backgroundColor: withOpacity(colors.text.primary, 0.95),
    borderRadius: borderRadius.md,
    boxShadow: isDragging ? shadows.xl : shadows.lg,
    transition: isDragging ? 'none' : 'box-shadow ' + animation.duration.normal + ' ' + animation.easing.ease,
    cursor: isDragging ? 'grabbing' : 'default',
    overflow: 'hidden',
    backdropFilter: 'blur(' + INFO_PANEL_DIMENSIONS.backdropBlur + ')',
    transform: isDragging ? 'scale(' + INFO_PANEL_DIMENSIONS.activeScale + ')' : 'scale(' + INFO_PANEL_DIMENSIONS.inactiveScale + ')'
  }),

  header: (isActive: boolean): CSSProperties => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: headerPaddingY + ' ' + headerPaddingX,
    backgroundColor: isActive
      ? withOpacity(colors.primary[500], 0.2)
      : withOpacity(GEO_COLORS.GRAY_700, 0.8),
    cursor: 'grab',
    userSelect: 'none',
    borderBottom: '1px solid ' + withOpacity(colors.text.secondary, 0.3),
    color: colors.background.secondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium
  }),

  content: (): CSSProperties => ({
    padding: contentPadding,
    color: colors.border.primary,
    fontSize: typography.fontSize.sm,
    maxHeight: INFO_PANEL_DIMENSIONS.maxHeight,
    overflowY: 'auto'
  }),

  closeButton: (): CSSProperties => ({
    background: GEO_COLORS.TRANSPARENT,
    border: 'none',
    color: colors.text.tertiary,
    cursor: 'pointer',
    padding: spacing.xs + ' ' + spacing.sm,
    fontSize: typography.fontSize.sm,
    lineHeight: 1,
    borderRadius: borderRadius.sm,
    transition: 'all ' + animation.duration.fast + ' ' + animation.easing.easeOut
  })
} as const;
