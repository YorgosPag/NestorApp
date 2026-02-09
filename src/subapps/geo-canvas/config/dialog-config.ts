import type { CSSProperties } from 'react';
import { animation, borderRadius, colors, shadows, spacing, typography } from '@/styles/design-tokens';
import { GEO_COLORS, withOpacity } from './color-config';

export const GEO_DIALOG_LIMITS = {
  maxDialogs: 5,
  baseZIndex: 2000
} as const;

export const GEO_DIALOG_DIMENSIONS = {
  width: {
    small: 400,
    medium: 600,
    large: 900,
    fullscreen: '100vw'
  },
  height: {
    fullscreen: '100vh'
  },
  maxHeightVh: 90,
  contentOffsetPx: 140
} as const;

const headerPaddingTop = 'calc(' + spacing.md + ' + ' + spacing.xs + ')';
const headerPaddingX = spacing.lg;
const headerPaddingBottom = spacing.md;
const contentPaddingY = 'calc(' + spacing.md + ' + ' + spacing.xs + ')';
const contentPaddingX = spacing.lg;
const footerPaddingTop = spacing.md;
const footerPaddingX = spacing.lg;
const footerPaddingBottom = 'calc(' + spacing.md + ' + ' + spacing.xs + ')';

export const GEO_DIALOG_STYLES = {
  overlay: (hasOverlay: boolean): CSSProperties => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: hasOverlay ? withOpacity(GEO_COLORS.BLACK, 0.6) : GEO_COLORS.TRANSPARENT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: hasOverlay ? 'auto' : 'none'
  }),

  container: (config: {
    size: 'small' | 'medium' | 'large' | 'fullscreen';
    position?: 'center' | 'top' | 'bottom' | 'custom';
    customPosition?: { x: number; y: number };
  }): CSSProperties => ({
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.md,
    boxShadow: shadows.lg,
    maxHeight: GEO_DIALOG_DIMENSIONS.maxHeightVh + 'vh',
    overflow: 'hidden',
    pointerEvents: 'auto',
    width:
      config.size === 'small' ? GEO_DIALOG_DIMENSIONS.width.small :
      config.size === 'medium' ? GEO_DIALOG_DIMENSIONS.width.medium :
      config.size === 'large' ? GEO_DIALOG_DIMENSIONS.width.large :
      GEO_DIALOG_DIMENSIONS.width.fullscreen,
    height: config.size === 'fullscreen' ? GEO_DIALOG_DIMENSIONS.height.fullscreen : 'auto'
  }),

  header: (): CSSProperties => ({
    padding: headerPaddingTop + ' ' + headerPaddingX + ' ' + headerPaddingBottom,
    borderBottom: '1px solid ' + colors.border.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  }),

  content: (): CSSProperties => ({
    padding: contentPaddingY + ' ' + contentPaddingX,
    maxHeight: 'calc(' + GEO_DIALOG_DIMENSIONS.maxHeightVh + 'vh - ' + GEO_DIALOG_DIMENSIONS.contentOffsetPx + 'px)',
    overflow: 'auto'
  }),

  footer: (): CSSProperties => ({
    padding: footerPaddingTop + ' ' + footerPaddingX + ' ' + footerPaddingBottom,
    borderTop: '1px solid ' + colors.border.primary,
    display: 'flex',
    gap: spacing.component.gap.md,
    justifyContent: 'flex-end'
  }),

  closeButton: (): CSSProperties => ({
    background: GEO_COLORS.TRANSPARENT,
    border: 'none',
    fontSize: typography.fontSize.lg,
    cursor: 'pointer',
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    color: colors.text.secondary,
    transition: 'all ' + animation.duration.fast + ' ' + animation.easing.easeOut
  })
} as const;
