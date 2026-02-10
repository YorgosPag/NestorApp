import type { CSSProperties } from 'react';
import { colors, typography } from '@/styles/design-tokens';
import { GEO_COLORS, withOpacity } from './color-config';

export const MAP_CORE_ZINDEX = {
  overlay: 1000,
  loading: 999
} as const;

export const MAP_CORE_STYLES = {
  container: (): CSSProperties => ({
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: colors.text.primary
  }),

  overlay: (): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withOpacity(GEO_COLORS.GRAY_900, 0.9),
    color: colors.background.secondary,
    zIndex: MAP_CORE_ZINDEX.overlay
  }),

  loadingIndicator: (): CSSProperties => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withOpacity(GEO_COLORS.GRAY_900, 0.75),
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    zIndex: MAP_CORE_ZINDEX.loading
  })
} as const;
