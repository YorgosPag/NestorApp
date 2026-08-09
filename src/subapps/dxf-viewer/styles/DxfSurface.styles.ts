/**
 * 🏢 ENTERPRISE DXF SURFACE STYLES — τα ΣΤΥΛ των επιφανειών του DXF Viewer.
 *
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `DxfZIndexSystem.styles.ts` (ADR-780 Φάση Β, 2026-08-09):
 * εκείνο απαντά **«ποιο κάθεται πάνω από ποιο»** — μια ιεραρχία αριθμών παραγόμενη από
 * την κλίμακα του SSoT. Αυτό απαντά **«πώς μοιάζει η επιφάνεια»** — θέση, χρώμα,
 * δείκτης, προσβασιμότητα. Δύο ευθύνες, δύο αρχεία (N.7.1: το ενιαίο αρχείο είχε φτάσει
 * τις **600** γραμμές και το μπλοκάριζε ο έλεγχος μεγέθους).
 *
 * ⚠️ Η στρώση **δεν** ξαναγράφεται εδώ: κάθε `zIndex` διαβάζεται από το `dxfZIndex`,
 * που με τη σειρά του παράγεται από το `design-tokens.json ▸ zIndex`. Ένας αριθμός
 * γραμμένος εδώ θα ήταν τρίτο πρόσωπο της ίδιας αλήθειας (σχήμα ADR-749).
 *
 * @module subapps/dxf-viewer/styles/DxfSurface.styles
 */

import type { CSSProperties } from 'react';
import { UI_COLORS, withOpacity } from '../config/color-config';
import { dxfZIndex } from './DxfZIndexSystem.styles';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

interface DxfComponentStyles {
  readonly canvasContainer: CSSProperties;
  readonly dxfCanvas: CSSProperties;
  readonly layerCanvas: CSSProperties;
  readonly collaborationOverlay: CSSProperties;
  readonly importModal: CSSProperties;
  readonly baseModal: CSSProperties;
}

interface DxfOverlayStyles {
  readonly selectionMarquee: CSSProperties;
  readonly crosshair: CSSProperties;
  readonly snapIndicator: CSSProperties;
  readonly cursorTooltip: CSSProperties;
  readonly zoomWindow: CSSProperties;
}

// ============================================================================
// 🎯 MAIN DXF COMPONENT STYLES
// ============================================================================

/**
 * 🏢 ENTERPRISE DXF COMPONENT STYLES
 * Complete styling system που αντικαθιστά όλα τα hardcoded z-index values
 */
export const dxfComponentStyles: DxfComponentStyles = {
  /**
   * 🎯 CANVAS CONTAINER: Main DXF viewer container
   */
  canvasContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    zIndex: dxfZIndex.canvas.background
  } as const,

  /**
   * 🎯 DXF CANVAS: Main content rendering layer
   */
  dxfCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: dxfZIndex.canvas.dxfCanvas,
    pointerEvents: 'auto'
  } as const,

  /**
   * 🎯 LAYER CANVAS: Interactive drawing layer
   */
  layerCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: dxfZIndex.canvas.layerCanvas,
    pointerEvents: 'auto' // Dynamic: 'none' during drawing tools
  } as const,

  /**
   * 🎯 COLLABORATION OVERLAY: Multi-user interaction layer
   */
  collaborationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: dxfZIndex.ui.collaboration,
    pointerEvents: 'auto'
  } as const,

  /**
   * 🎯 IMPORT MODAL: DXF file import dialog
   * Replaces hardcoded zIndex: 999999 με professional hierarchy
   */
  importModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: UI_COLORS.MODAL_OVERLAY_MEDIUM,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: dxfZIndex.modals.import
  } as const,

  /**
   * 🎯 BASE MODAL: Standard modal styling
   */
  baseModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: UI_COLORS.MODAL_OVERLAY_LIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: dxfZIndex.modals.base
  } as const
} as const;

// ============================================================================
// 🎯 DXF OVERLAY STYLES
// ============================================================================

/**
 * 🎯 DXF OVERLAY SYSTEM: Professional overlay styling
 */
export const dxfOverlayStyles: DxfOverlayStyles = {
  /**
   * 🎯 SELECTION MARQUEE: Selection rectangle overlay
   */
  selectionMarquee: {
    position: 'absolute',
    border: `1px dashed ${UI_COLORS.INDICATOR_BLUE}`,
    backgroundColor: UI_COLORS.SELECTION_MARQUEE_BG,
    pointerEvents: 'none',
    zIndex: dxfZIndex.overlays.selection
  } as const,

  /**
   * 🎯 CROSSHAIR: Drawing crosshair overlay
   */
  crosshair: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: dxfZIndex.overlays.crosshair
  } as const,

  /**
   * 🎯 SNAP INDICATOR: Object snap visual feedback
   */
  snapIndicator: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: dxfZIndex.overlays.snap,
    color: UI_COLORS.BRIGHT_GREEN,
    fontSize: '12px',
    fontFamily: 'monospace'
  } as const,

  /**
   * 🎯 CURSOR TOOLTIP: Coordinate display and command feedback
   */
  cursorTooltip: {
    position: 'absolute',
    backgroundColor: UI_COLORS.MODAL_OVERLAY_HEAVY,
    color: UI_COLORS.WHITE,
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    pointerEvents: 'none',
    zIndex: dxfZIndex.overlays.cursor,
    whiteSpace: 'nowrap'
  } as const,

  /**
   * 🎯 ZOOM WINDOW: Magnification window overlay
   */
  zoomWindow: {
    position: 'absolute',
    border: `2px solid ${UI_COLORS.INDICATOR_BLUE}`,
    backgroundColor: 'hsl(var(--background) / 0.9)', // ✅ ENTERPRISE: CSS variable (adapts to dark mode)
    borderRadius: '4px',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: dxfZIndex.overlays.zoom
  } as const
} as const;

// ============================================================================
// 🎯 DYNAMIC STYLING UTILITIES
// ============================================================================

/**
 * 🎯 LAYER CANVAS POINTER EVENTS: Dynamic interaction control
 * Professional approach για drawing tool interaction management
 */
export const createLayerCanvasStyle = (
  isDrawingTool: boolean = false,
  customZIndex?: number
): CSSProperties => {
  return {
    ...dxfComponentStyles.layerCanvas,
    pointerEvents: isDrawingTool ? 'none' : 'auto',
    zIndex: customZIndex || dxfZIndex.canvas.layerCanvas
  } as const;
};

/**
 * 🎯 MODAL BACKDROP STYLE: Dynamic modal backdrop creation
 */
export const createModalBackdropStyle = (
  modalType: 'base' | 'import' | 'settings' | 'help' = 'base',
  opacity: number = 0.5
): CSSProperties => {
  const baseStyle = dxfComponentStyles.baseModal;

  return {
    ...baseStyle,
    backgroundColor: withOpacity(UI_COLORS.BLACK, opacity),
    zIndex: dxfZIndex.modals[modalType]
  } as const;
};

/**
 * 🎯 OVERLAY POSITIONING: Dynamic overlay positioning με bounds checking
 */
export const createOverlayPositionStyle = (
  x: number,
  y: number,
  overlayType: 'selection' | 'crosshair' | 'snap' | 'cursor' | 'zoom'
): CSSProperties => {
  // Map overlay type to actual dxfOverlayStyles keys
  const overlayTypeMap: Record<string, keyof DxfOverlayStyles> = {
    selection: 'selectionMarquee',
    crosshair: 'crosshair',
    snap: 'snapIndicator',
    cursor: 'cursorTooltip',
    zoom: 'zoomWindow'
  };

  const styleKey = overlayTypeMap[overlayType] || 'crosshair';
  const baseStyle = dxfOverlayStyles[styleKey];

  return {
    ...baseStyle,
    left: `${Math.max(0, x)}px`,
    top: `${Math.max(0, y)}px`
  } as const;
};

// ============================================================================
// 🎯 ACCESSIBILITY UTILITIES
// ============================================================================

/**
 * 🎯 DXF ACCESSIBILITY: Enterprise accessibility support για DXF components
 */
export const dxfAccessibility = {
  /**
   * Canvas accessibility
   */
  getCanvasProps: (canvasType: 'dxf' | 'layer', isInteractive: boolean = true) => ({
    role: 'img',
    'aria-label': `${canvasType} canvas for DXF drawing`,
    'aria-hidden': !isInteractive,
    tabIndex: isInteractive ? 0 : -1
  } as const),

  /**
   * Modal accessibility
   */
  getModalProps: (modalTitle: string) => ({
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': `${modalTitle.toLowerCase().replace(/\s+/g, '-')}-title`,
    'aria-describedby': `${modalTitle.toLowerCase().replace(/\s+/g, '-')}-description`
  } as const),

  /**
   * Overlay accessibility
   */
  getOverlayProps: (overlayType: string, isVisible: boolean = true) => ({
    role: 'complementary',
    'aria-label': `${overlayType} overlay`,
    'aria-hidden': !isVisible,
    'aria-live': 'polite' as const
  } as const)
} as const;

// ============================================================================
// 🔒 TYPE EXPORTS
// ============================================================================

export type {
  DxfComponentStyles,
  DxfOverlayStyles
};
