/**
 * DXF Viewer — Cursor, Calibration & Canvas Style Utilities
 * Extracted from DxfViewerComponents.styles.ts (SRP split).
 *
 * Covers: cursor preview shapes, calibration overlay, DXF canvas core,
 * cursor settings panel, cursor line preview, button hover animation.
 *
 * @see DxfViewerComponents.styles.ts — barrel re-exports from here
 */

import { UI_COLORS } from '../config/color-config';
import { PANEL_COLORS } from '../config/panel-tokens';
import { zIndex as globalZIndex } from '../../../styles/design-tokens';
import { dxfZIndex } from '../styles/DxfZIndexSystem.styles';
import { CSS_VARS, TYPOGRAPHY_CSS, FONT_WEIGHT_CSS } from './dxf-style-tokens';

// ── Cursor preview ───────────────────────────────────────────────────────────

export const getCursorPreviewBorderStyles = (cursorColor: string) => ({
  borderColor: cursorColor,
  borderWidth: '2px',
  borderStyle: 'solid',
  transition: 'border-color 0.15s ease-in-out',
});

export const getCursorShapeButtonStyles = (isActive = false, cursorColor?: string) => ({  // eslint-disable-line @typescript-eslint/no-unused-vars
  padding: '0.5rem',
  borderRadius: 'var(--radius)',
  fontSize: TYPOGRAPHY_CSS.XS,
  border: '1px solid',
  transition: 'colors 0.15s ease-in-out',
  ...(isActive
    ? { backgroundColor: CSS_VARS.BG_INFO, borderColor: PANEL_COLORS.BORDER_HEX_ACCENT, color: 'white' }
    : { backgroundColor: CSS_VARS.BG_TERTIARY, borderColor: PANEL_COLORS.BORDER_HEX_SECONDARY, color: CSS_VARS.TEXT_SECONDARY }),
});

export const getCursorPreviewContainerStyles = () => ({
  width: '1rem',
  height: '1rem',
  margin: '0 auto',
  borderRadius: '50%',
  borderWidth: '2px',
  borderStyle: 'solid',
  transition: 'all 0.15s ease-in-out',
});

export const getCursorSquarePreviewStyles = () => ({
  width: '1rem',
  height: '1rem',
  margin: '0 auto',
  borderWidth: '2px',
  borderStyle: 'solid',
  borderRadius: '0',
  transition: 'all 0.15s ease-in-out',
});

export const getCursorCrosshairPreviewStyles = (cursorColor: string) => ({
  width: '1rem',
  height: '1rem',
  margin: '0 auto',
  position: 'relative' as const,
  '&::before': {
    content: '""',
    position: 'absolute' as const,
    top: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '1px',
    height: '100%',
    backgroundColor: cursorColor,
  },
  '&::after': {
    content: '""',
    position: 'absolute' as const,
    top: '50%',
    left: '0',
    transform: 'translateY(-50%)',
    width: '100%',
    height: '1px',
    backgroundColor: cursorColor,
  },
});

export const getCursorSizePreviewStyles = (
  cursorColor: string,
  shape: 'circle' | 'square',
  width: number,
  size?: number,
) => ({
  ...getCursorPreviewBorderStyles(cursorColor),
  borderWidth: `${width}px`,
  width: `${Math.min((size ?? width) * 4, 16)}px`,
  height: `${Math.min((size ?? width) * 4, 16)}px`,
  ...(shape === 'circle' ? { borderRadius: '50%' } : { borderRadius: '0' }),
});

export const getCursorDimensionPreviewStyles = (
  cursorColor: string,
  shape: 'circle' | 'square',
  size: number,
) => ({
  ...getCursorPreviewBorderStyles(cursorColor),
  width: `${Math.min(size, 16)}px`,
  height: `${Math.min(size, 16)}px`,
  ...(shape === 'circle' ? { borderRadius: '50%' } : { borderRadius: '0' }),
});

// ── Canvas core ──────────────────────────────────────────────────────────────

export const getCrosshairOverlayCanvasStyles = (displayStatus: string) => ({
  position: 'absolute' as const,
  top: 0,
  left: 0,
  pointerEvents: 'none' as const,
  display: displayStatus,
  width: '100%',
  height: '100%',
  zIndex: dxfZIndex.overlays.crosshair,
});

export const getDxfCanvasCoreStyles = (backgroundColor: string) => ({
  width: '100%',
  height: '100%',
  position: 'absolute' as const,
  top: 0,
  left: 0,
  cursor: 'crosshair',
  backgroundColor,
  userSelect: 'none' as const,
  touchAction: 'none',
  outline: 'none',
});

// ── Calibration ──────────────────────────────────────────────────────────────

export const getCalibrationOverlayContainerStyles = (zIndex: number) => ({
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none' as const,
  zIndex,
});

export const getCalibrationDebugPanelStyles = () => ({
  position: 'absolute' as const,
  top: '1rem',
  left: '1rem',
  backgroundColor: CSS_VARS.BG_PRIMARY,
  color: 'white',
  padding: '1rem',
  borderRadius: 'calc(var(--radius) + 2px)',
  boxShadow: `0 10px 15px -3px ${UI_COLORS.SHADOW_MEDIUM}, 0 4px 6px -2px ${UI_COLORS.SHADOW_LIGHT}`,
  pointerEvents: 'auto' as const,
  minWidth: '320px',
  maxWidth: '500px',
});

export const getCalibrationTestMarkerStyles = (x: number, y: number, isSuccess: boolean) => ({
  position: 'absolute' as const,
  left: `${x}px`,
  top: `${y}px`,
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  backgroundColor: isSuccess ? UI_COLORS.SUCCESS_GREEN : UI_COLORS.ERROR,
  border: '2px solid white',
  transform: 'translate(-50%, -50%)',
  zIndex: globalZIndex.dropdown,
  pointerEvents: 'none' as const,
  animation: 'pulse 2s infinite',
});

export const getCalibrationTooltipStyles = () => ({
  position: 'absolute' as const,
  top: '-30px',
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: UI_COLORS.MODAL_OVERLAY_HEAVY,
  color: 'white',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: TYPOGRAPHY_CSS.XS,
  fontWeight: FONT_WEIGHT_CSS.BOLD,
  whiteSpace: 'nowrap' as const,
  pointerEvents: 'none' as const,
});

// ── Cursor settings ──────────────────────────────────────────────────────────

export const getCursorSettingsPanelStyles = () => ({
  padding: '0.5rem',
  backgroundColor: CSS_VARS.BG_TERTIARY,
  borderRadius: 'var(--radius)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.5rem',
});

export const getCursorColorPreviewStyles = (cursorColor: string) => ({
  width: '1.5rem',
  height: '1.5rem',
  borderRadius: 'var(--radius)',
  backgroundColor: cursorColor,
  border: `2px solid ${PANEL_COLORS.BORDER_HEX_PRIMARY}`,
  transition: 'all 0.15s ease-in-out',
  cursor: 'pointer' as const,
  '&:hover': {
    borderColor: cursorColor,
    boxShadow: `0 0 0 2px ${cursorColor}20`,
  },
});

export const getCursorLinePreviewStyles = (
  cursorColor: string,
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot',
) => {
  const base = { height: '2px', width: '100%' };
  switch (lineStyle) {
    case 'solid':
      return { ...base, backgroundColor: cursorColor };
    case 'dashed':
      return { ...base, background: `repeating-linear-gradient(to right, ${cursorColor} 0, ${cursorColor} 4px, transparent 4px, transparent 8px)` };
    case 'dotted':
      return { ...base, background: `repeating-linear-gradient(to right, ${cursorColor} 0, ${cursorColor} 1px, transparent 1px, transparent 8px)` };
    case 'dash-dot':
      return { ...base, background: `repeating-linear-gradient(to right, ${cursorColor} 0, ${cursorColor} 8px, transparent 8px, transparent 12px, ${cursorColor} 12px, ${cursorColor} 14px, transparent 14px, transparent 22px)` };
    default:
      return { ...base, backgroundColor: cursorColor };
  }
};

// ── Animation ────────────────────────────────────────────────────────────────

export const getButtonHoverAnimationStyles = () => ({
  transition: 'all 0.15s ease-in-out',
  ':hover': {
    transform: 'translateY(-1px)',
    boxShadow: `0 4px 8px ${UI_COLORS.SHADOW_HEAVY}`,
  },
  ':active': {
    transform: 'translateY(0)',
    boxShadow: `0 2px 4px ${UI_COLORS.SHADOW_HEAVY}`,
  },
});
