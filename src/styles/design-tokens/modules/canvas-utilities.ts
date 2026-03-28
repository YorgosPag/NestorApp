/**
 * 🏢 ENTERPRISE: Canvas Utilities Module
 * Extracted from design-tokens.ts for modular architecture
 *
 * ROLE: LOW-LEVEL CANVAS ENGINE
 *
 * This module provides generic, reusable primitives for
 * canvas-based interactions (geo, DXF, generic shapes).
 *
 * ⚠️ DO NOT:
 * - Add domain-specific (map-only) logic here
 * - Rename APIs for UX clarity
 *
 * ✅ Allowed:
 * - Math
 * - Geometry
 * - Hit-testing
 *
 * Higher-level map logic MUST live in InteractiveMap.styles.ts
 *
 * Contains: canvasUtilities, autoSaveStatusTokens, statusIndicatorComponents
 */

import * as React from 'react';
import { colors, semanticColors, spacing, typography, shadows } from './foundations';
import { borderRadius } from './borders';
import { zIndex } from './layout';
import { layoutUtilities } from './layout-utilities-constants';

export const canvasUtilities = {
  geoInteractive: {
    viewport: {
      padding: spacing.md,
      margin: spacing.lg
    },
    positioning: {
      center: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } as const,
      topRight: { position: 'absolute', top: spacing.md, right: spacing.md } as const
    },
    mobileSlideHeader: (): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      padding: `${spacing.sm} ${spacing.md}`,
      borderBottom: `1px solid ${colors.border.primary}`,
      backgroundColor: colors.background.primary,
      minHeight: '48px',
      position: 'sticky',
      top: 0,
      zIndex: zIndex.docked // Enterprise: centralized z-index
    }),
    mobileSlideHeaderClass: 'flex items-center gap-2 px-2 py-2 border-b bg-card min-h-12 sticky top-0 z-10',
    mobileSlideContent: (): React.CSSProperties => ({
      flex: '1 1 auto',
      overflowY: 'auto',
      backgroundColor: colors.background.primary,
      padding: spacing.md,
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }),
    mobileSlideContentClass: 'flex-1 overflow-y-auto bg-card p-4 h-full flex flex-col',
    canvasFullDisplay: (): React.CSSProperties => ({
      width: '100%',
      height: '100%',
      display: 'block',
      backgroundColor: colors.background.secondary,
      border: 'none',
      outline: 'none'
    }),
    floorPlanCanvasLayer: {
      container: (
        disableInteractions: boolean,
        hasClick: boolean,
        layerZIndex?: number
      ): React.CSSProperties => ({
        position: 'absolute',
        top: 0,
        left: 0,
        width: layoutUtilities.dimensions.full,
        height: layoutUtilities.dimensions.full,
        pointerEvents: disableInteractions ? 'none' : (hasClick ? 'auto' : 'none'),
        zIndex: layerZIndex ?? zIndex.base
      }),
      canvas: {
        width: layoutUtilities.dimensions.full,
        height: layoutUtilities.dimensions.full,
        display: 'block',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none'
      } as React.CSSProperties
    },
    floorPlanControls: {
      container: {
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: spacing.sm,
        border: `1px solid ${colors.border.secondary}`,
        backgroundColor: colors.background.primary,
        boxShadow: shadows.sm
      } as React.CSSProperties
    },

    /**
     * 🎯 DRAGGABLE PANEL CONTAINER UTILITY
     * ENTERPRISE: Centralized draggable panel styling για geo interface
     * Replaces: inline styles in geo components
     */
    draggablePanelContainer: (
      position: { x: number; y: number },
      isDragging: boolean,
      width?: number
    ): React.CSSProperties => ({
      position: 'absolute',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: width ? `${width}px` : 'auto',
      minWidth: '200px',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #e5e5e5',
      borderRadius: '8px',
      boxShadow: isDragging
        ? '0 8px 25px -5px rgba(0, 0, 0, 0.3)'
        : '0 4px 15px -3px rgba(0, 0, 0, 0.2)',
      zIndex: zIndex.dropdown, // Enterprise: centralized z-index
      cursor: isDragging ? 'grabbing' : 'auto',
      userSelect: 'none' as const,
      backdropFilter: 'blur(4px)',
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      transition: isDragging ? 'none' : 'all 0.2s ease-in-out'
    }),

    /**
     * 🎯 PDF FALLBACK CONTAINER UTILITY
     * ENTERPRISE: PDF fallback container styling
     */
    pdfFallbackContainer: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: '8px',
      color: colors.text.muted,
      fontSize: '14px'
    }),

    /**
     * 🎯 PDF DISPLAY WRAPPER UTILITY
     * ENTERPRISE: PDF display wrapper styling
     */
    pdfDisplayWrapper: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: colors.background.primary
    }),

    /**
     * 🎯 DEBUG CROSSHAIR POSITION UTILITY
     * ENTERPRISE: Debug crosshair positioning
     */
    debugCrosshairPosition: (x: number, y: number): React.CSSProperties => ({
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none' as const,
      zIndex: zIndex.tooltip // Enterprise: centralized z-index
    }),

    /**
     * 🎯 RESPONSIVE UTILITIES
     * ENTERPRISE: Responsive layout helpers for geo-canvas
     */
    responsive: {
      mobileBreakpoint: 768,
      tabletBreakpoint: 1024,
      desktopBreakpoint: 1280,
      containerPadding: (isMobile: boolean): string => isMobile ? spacing.sm : spacing.md,
      gridGap: (isMobile: boolean): string => isMobile ? spacing.sm : spacing.md,
      flexWrap: (isMobile: boolean): React.CSSProperties['flexWrap'] => isMobile ? 'wrap' : 'nowrap'
    }

    /**
     * NOTE:
     * Map-specific interaction utilities previously exposed here
     * have been intentionally removed.
     *
     * All map-related styling and interaction logic now lives in:
     * src/subapps/geo-canvas/components/InteractiveMap.styles.ts
     *
     * This engine module MUST remain map-agnostic.
     */
  },
  drawing: {
    strokeWidth: '2px',
    fillOpacity: 0.2
  }
};

/**
 * 🎯 STATUS INDICATOR COMPONENTS - ENTERPRISE AUTO-SAVE SYSTEM
 */
export const autoSaveStatusTokens = {
  base: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs
  },
  variants: {
    saving: {
      backgroundColor: semanticColors.status.warning,
      color: colors.text.inverse
    },
    saved: {
      backgroundColor: semanticColors.status.success,
      color: colors.text.inverse
    },
    error: {
      backgroundColor: semanticColors.status.error,
      color: colors.text.inverse
    },
    idle: {
      backgroundColor: colors.background.secondary,
      color: colors.text.secondary
    }
  }
} as const;

export const statusIndicatorComponents = {
  // Main container styles
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium
  },

  // Text styles
  text: {
    primary: {
      color: colors.text.primary,
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    secondary: {
      color: colors.text.secondary,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.normal
    }
  },

  // Status colors
  statusColors: {
    saving: {
      backgroundColor: semanticColors.status.warning,
      color: colors.text.inverse
    },
    success: {
      backgroundColor: semanticColors.status.success,
      color: colors.text.inverse
    },
    error: {
      backgroundColor: semanticColors.status.error,
      color: colors.text.inverse
    },
    idle: {
      backgroundColor: colors.background.secondary,
      color: colors.text.secondary
    }
  },

  // Status dot styles
  statusDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: borderRadius.full,
    flexShrink: 0,
    transition: 'background-color 150ms ease'
  },

  // Separator styles
  separator: {
    width: '1px',
    height: '1rem',
    backgroundColor: colors.border.secondary,
    opacity: 0.7
  }
} as const;
