/**
 * DXF Viewer — Toolbar & Palette Style Utilities
 * Extracted from DxfViewerComponents.styles.ts (SRP split).
 *
 * Covers: toolbar buttons, mode/kind buttons, overlay toolbar,
 * status palette, responsive layout, type definitions.
 *
 * @see DxfViewerComponents.styles.ts — barrel re-exports from here
 */

import type React from 'react';
import type { PropertyStatus } from '../../../constants/property-statuses-enterprise';
import { BUTTON_STATUS_COLORS } from '../config/color-mapping';
import { PANEL_COLORS } from '../config/panel-tokens';
import { CSS_VARS, TYPOGRAPHY_CSS, FONT_WEIGHT_CSS } from './dxf-style-tokens';

// ── Toolbar button ───────────────────────────────────────────────────────────

export const getToolbarButtonBaseStyles = () => ({
  height: '2rem',
  padding: '0',
  borderRadius: 'var(--radius)',
  border: `1px solid ${PANEL_COLORS.BORDER_HEX_SECONDARY}`,
  transition: 'colors 0.15s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const getToolbarButtonStyles = (
  variant: 'default' | 'primary' | 'danger' = 'default',
  isDisabled: boolean = false,
) => {
  const variantStyles = {
    default: {
      backgroundColor: CSS_VARS.BG_TERTIARY,
      color: CSS_VARS.TEXT_SECONDARY,
      borderColor: PANEL_COLORS.BORDER_HEX_SECONDARY,
    },
    primary: {
      backgroundColor: CSS_VARS.BG_INFO,
      color: 'white',
      borderColor: PANEL_COLORS.BORDER_HEX_ACCENT,
    },
    danger: {
      backgroundColor: CSS_VARS.BG_TERTIARY,
      color: CSS_VARS.TEXT_ERROR,
      borderColor: PANEL_COLORS.BORDER_HEX_SECONDARY,
    },
  };
  return {
    ...getToolbarButtonBaseStyles(),
    ...variantStyles[variant],
    ...(isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
  };
};

// ── Mode / Kind buttons ──────────────────────────────────────────────────────

export const getModeButtonStyles = (isActive = false) => ({
  height: '2rem',
  paddingLeft: '0.5rem',
  paddingRight: '0.5rem',
  borderRadius: 'var(--radius)',
  border: '1px solid',
  transition: 'colors 0.15s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
  ...(isActive
    ? { backgroundColor: CSS_VARS.BG_INFO, color: 'white', borderColor: PANEL_COLORS.BORDER_HEX_ACCENT }
    : { backgroundColor: CSS_VARS.BG_TERTIARY, color: CSS_VARS.TEXT_SECONDARY, borderColor: PANEL_COLORS.BORDER_HEX_SECONDARY }),
});

export const getKindButtonStyles = (isActive = false) => ({
  height: '2rem',
  width: '2rem',
  padding: '0',
  borderRadius: 'var(--radius)',
  border: '1px solid',
  transition: 'colors 0.15s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...(isActive
    ? { backgroundColor: CSS_VARS.BG_INFO, color: 'white', borderColor: PANEL_COLORS.BORDER_HEX_ACCENT }
    : { backgroundColor: CSS_VARS.BG_TERTIARY, color: CSS_VARS.TEXT_SECONDARY, borderColor: PANEL_COLORS.BORDER_HEX_SECONDARY }),
});

// ── Overlay toolbar container ────────────────────────────────────────────────

export const getOverlayToolbarStyles = () => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem',
  backgroundColor: CSS_VARS.BG_SECONDARY,
  border: `1px solid ${PANEL_COLORS.BORDER_HEX_SECONDARY}`,
  borderRadius: 'calc(var(--radius) + 2px)',
  flexWrap: 'wrap' as const,
});

export const getToolbarSeparatorStyles = () => ({
  height: '1.5rem',
  backgroundColor: CSS_VARS.TEXT_MUTED,
});

export const getToolbarSectionStyles = () => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
});

export const getToolbarSectionWithLabelStyles = () => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

export const getToolbarLabelStyles = () => ({
  fontSize: TYPOGRAPHY_CSS.XS,
  fontWeight: FONT_WEIGHT_CSS.MEDIUM,
  color: CSS_VARS.TEXT_MUTED,
});

// ── Status palette ───────────────────────────────────────────────────────────

export const getStatusPaletteStyles = () => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
});

export const getStatusColorButtonStyles = (
  status: PropertyStatus,
  isActive = false,
) => ({
  width: '1.5rem',
  height: '1.5rem',
  borderRadius: 'var(--radius)',
  border: '2px solid',
  transition: 'all 0.15s ease-in-out',
  cursor: 'pointer',
  backgroundColor: BUTTON_STATUS_COLORS[status],
  ...(isActive
    ? {
        borderColor: 'white',
        boxShadow: `0 0 0 2px ${CSS_VARS.SHADOW_RING_OFFSET}, 0 0 0 4px ${CSS_VARS.SHADOW_RING_FOCUS}`,
      }
    : { borderColor: 'transparent' }),
});

// ── Responsive ───────────────────────────────────────────────────────────────

export const getResponsiveToolbarStyles = () => ({
  gap: '0.25rem',
  padding: '0.375rem',
  '@media (min-width: 640px)': { gap: '0.5rem', padding: '0.5rem' },
});

export const getResponsiveButtonTextStyles = () => ({
  display: 'none',
  '@media (min-width: 640px)': { display: 'inline', fontSize: TYPOGRAPHY_CSS.XS },
});

// ── Type definitions ─────────────────────────────────────────────────────────

export type ToolbarButtonVariant = 'default' | 'primary' | 'danger';
export type DrawingModeType = 'draw' | 'edit' | 'select';

export interface ToolbarSectionConfig {
  label: string;
  items: Array<{
    key: string;
    icon?: React.ComponentType;
    label: string;
    shortcut?: string;
  }>;
}
