/**
 * Canvas UI Design Tokens
 * Extracted from design-tokens.ts — canvasUI object
 * Config/data file (no line limit)
 */

import * as React from 'react';
import { colors, spacing, typography, shadows, animation, transitions } from './foundations';
import { borderRadius } from './borders';
import { zIndex, breakpoints } from './layout';
import { layoutUtilities } from './layout-utilities-constants';

export const canvasUI = {
  container: {
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.primary}`,
    borderRadius: borderRadius.md
  },
  overlay: {
    backgroundColor: colors.background.overlay,
    zIndex: zIndex.overlay,
    // 🏢 ENTERPRISE: Centralized overlay indicator colors (CAD-standard)
    colors: {
      /** Snap indicator - bright green for high visibility (AutoCAD standard) */
      snap: {
        border: colors.green["400"],
        background: colors.green["500"],
        glow: `0 0 4px ${colors.green["500"]}`
      },
      /** Zoom window - yellow for clear distinction (industry standard) */
      zoom: {
        border: 'rgba(250, 204, 21, 0.9)', // Yellow with high opacity
        background: 'rgba(250, 204, 21, 0.1)', // Yellow with low fill
        borderSolid: colors.yellow["400"]
      },
      /** Selection marquee - blue for selection operations */
      selection: {
        window: {
          border: 'rgba(59, 130, 246, 0.8)',   // Blue - left-to-right selection
          background: 'rgba(59, 130, 246, 0.1)'
        },
        crossing: {
          border: 'rgba(34, 197, 94, 0.8)',    // Green - right-to-left selection
          background: 'rgba(34, 197, 94, 0.1)'
        }
      }
    }
  },
  controls: {
    padding: spacing.md,
    gap: spacing.sm
  },
  // ✅ ENTERPRISE FIX: Added colorPicker property για EnterpriseColorArea.tsx
  colorPicker: {
    colorPickerArea: (size: string) => ({
      width: size,
      height: size,
      borderRadius: borderRadius.md
    } as React.CSSProperties),
    colorPickerThumb: (position: { x: number; y: number }, color: string) => ({
      left: `${position.x * 100}%`,
      top: `${position.y * 100}%`,
      backgroundColor: color
    } as React.CSSProperties)
  },
  positioning: {
    layers: {
      canvasOverlayWithPointerControl: (activeTool?: string): React.CSSProperties => ({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex.overlay,
        pointerEvents: activeTool === 'select' || activeTool === 'layering' ? 'auto' : 'none',
        // 🏢 FIX (2026-01-04): Select tool uses 'none' cursor - crosshair overlay is the only cursor
        cursor: activeTool === 'pan' ? 'grab' : 'none'
      }),
      layerCanvasWithTools: (activeTool?: string, crosshairEnabled?: boolean): React.CSSProperties => ({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex.base,
        pointerEvents: 'auto', // Layer canvas always captures events
        // 🏢 FIX (2026-01-04): Select tool uses 'none' cursor - crosshair overlay is the only cursor
        // Το σταυρόνημα εμφανίζεται μόνο από το CrosshairOverlay component
        cursor: activeTool === 'pan' ? 'grab' :
                activeTool === 'zoom' ? 'zoom-in' :
                'none', // ✅ CAD-GRADE: Always hide CSS cursor, crosshair is the only cursor
        touchAction: 'none', // Prevent browser touch gestures
        userSelect: 'none' as const
      }),
      dxfCanvasWithTools: (activeTool?: string, crosshairEnabled?: boolean): React.CSSProperties => ({
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex.docked, // Higher than layer canvas for DXF content
        pointerEvents: 'auto', // DXF canvas captures events for drawing
        // 🏢 FIX (2026-01-04): Select tool uses 'none' cursor - crosshair overlay is the only cursor
        // Το σταυρόνημα εμφανίζεται μόνο από το CrosshairOverlay component
        cursor: activeTool === 'pan' ? 'grab' :
                activeTool === 'zoom' ? 'zoom-in' :
                'none', // ✅ CAD-GRADE: Always hide CSS cursor, crosshair is the only cursor
        touchAction: 'none', // Prevent browser touch gestures
        userSelect: 'none' as const
        // ❌ REMOVED: backgroundColor - ADR-004 requires CANVAS_THEME from color-config.ts
        // 📍 Background is now set separately using CANVAS_THEME.DXF_CANVAS
      })
    },

    // ✅ ENTERPRISE: Canvas overlay positioning utilities
    tooltip: {
      positioned: (x: number, y: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${x + 10}px`,
        top: `${y - 10}px`,
        zIndex: zIndex.tooltip,
        pointerEvents: 'none',
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        padding: spacing.xs,
        borderRadius: borderRadius.sm,
        fontSize: typography.fontSize.sm,
        border: `1px solid ${colors.border.primary}`,
        boxShadow: shadows.sm
      })
    },

    marquee: {
      positioned: (startX: number, startY: number, endX: number, endY: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${Math.min(startX, endX)}px`,
        top: `${Math.min(startY, endY)}px`,
        width: `${Math.abs(endX - startX)}px`,
        height: `${Math.abs(endY - startY)}px`,
        border: `2px dashed ${colors.primary[500]}`,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointerEvents: 'none',
        zIndex: zIndex.overlay
      })
    },

    snapIndicator: {
      positioned: (x: number, y: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${x - 5}px`,
        top: `${y - 5}px`,
        width: '10px',
        height: '10px',
        border: `2px solid ${colors.green["500"]}`,
        borderRadius: '50%',
        backgroundColor: colors.background.primary,
        pointerEvents: 'none',
        zIndex: zIndex.overlay,
        boxShadow: `0 0 4px ${colors.green["500"]}`
      })
    },

    zoomWindow: {
      positioned: (startX: number, startY: number, endX: number, endY: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${Math.min(startX, endX)}px`,
        top: `${Math.min(startY, endY)}px`,
        width: `${Math.abs(endX - startX)}px`,
        height: `${Math.abs(endY - startY)}px`,
        border: `2px solid ${colors.blue["600"]}`,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        pointerEvents: 'none',
        zIndex: zIndex.overlay
      })
    },

    // ✅ ENTERPRISE FIX: Missing floating panel positioning for TestResultsModal
    floatingPanel: {
      testModal: {
        backdrop: {
          position: 'fixed' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: zIndex.modal
        },
        content: {
          position: 'relative' as const,
          maxWidth: '90vw',
          maxHeight: '90vh',
          minWidth: '600px',
          minHeight: '400px',
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          zIndex: zIndex.modal + 1
        }
      }
    },

    // ✅ ENTERPRISE FIX: Missing CAD status bar positioning for CadStatusBar
    cadStatusBar: {
      container: {
        position: 'fixed' as const,
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        backgroundColor: colors.background.primary,
        borderTop: `1px solid ${colors.border.primary}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        zIndex: zIndex.docked
      },
      statusInfo: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md
      },
      button: {
        padding: spacing.xs,
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: borderRadius.sm,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        transition: 'all 150ms ease'
      },
      buttonActive: {
        backgroundColor: colors.background.accent,
        color: colors.text.primary
      },
      label: {
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        fontWeight: typography.fontWeight.medium
      },
      functionKey: {
        fontSize: typography.fontSize.xs,
        color: colors.text.muted,
        backgroundColor: colors.background.muted,
        padding: `${spacing.xs} ${spacing.sm}`,
        borderRadius: borderRadius.sm,
        border: `1px solid ${colors.border.secondary}`
      }
    },

    // ✅ ENTERPRISE FIX: Status bar overlays για ColorManager.tsx
    statusBarOverlays: {
      colorManagerContainer: (x: number, y: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: zIndex.modal,
        pointerEvents: 'auto'
      })
    },

    // ✅ ENTERPRISE FIX: Responsive grid utilities for ResponsiveDashboard
    responsive: {
      responsiveGrid: (columns: number, gap: number): React.CSSProperties => ({
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap * 4}px`,
        width: '100%',
      }),
      responsiveGridItem: (span: number, offset: number, order?: number): React.CSSProperties => ({
        gridColumn: offset > 0 ? `${offset + 1} / span ${span}` : `span ${span}`,
        ...(order !== undefined && { order }),
      }),
      responsiveCardGrid: (minWidth: number, maxWidth: number, gap: number): React.CSSProperties => ({
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, ${maxWidth}px))`,
        gap: `${gap * 4}px`,
        width: '100%',
        justifyContent: 'start',
      }),
      responsiveSidebar: (isCollapsed: boolean, width: number): React.CSSProperties => ({
        width: isCollapsed ? '64px' : `${width}px`,
        transition: 'width 200ms ease-in-out',
        flexShrink: 0,
      }),
      responsiveMainContent: (hasSidebar: boolean, sidebarWidth: number): React.CSSProperties => ({
        flex: 1,
        marginLeft: hasSidebar ? `${sidebarWidth}px` : 0,
        transition: 'margin-left 200ms ease-in-out',
      }),
      dashboardSidebar: (isCollapsed: boolean, width: number, collapsedWidth: number): React.CSSProperties => ({
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: isCollapsed ? layoutUtilities.pixels(collapsedWidth) : layoutUtilities.pixels(width),
        backgroundColor: colors.background.secondary,
        borderRight: `1px solid ${colors.border.primary}`,
        transition: `width ${animation.duration.normal} ${animation.easing.ease}`,
        overflow: 'hidden',
        zIndex: zIndex.docked,
        display: 'flex',
        flexDirection: 'column',
      }),
      sidebarToggleButton: (isCollapsed: boolean): React.CSSProperties => ({
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: spacing.lg,
        height: spacing.lg,
        borderRadius: borderRadius.full,
        border: `1px solid ${colors.border.secondary}`,
        backgroundColor: colors.background.primary,
        color: colors.text.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: transitions.all,
        opacity: isCollapsed ? 1 : 0.9,
      }),
      sidebarContent: (isCollapsed: boolean): React.CSSProperties => ({
        flex: 1,
        padding: spacing.md,
        overflowY: 'auto',
        opacity: isCollapsed ? 0 : 1,
        pointerEvents: isCollapsed ? 'none' : 'auto',
        transition: `opacity ${animation.duration.fast} ${animation.easing.ease}`,
      }),
      dashboardHeader: (height: number, sidebarWidth: number, sidebarCollapsed: boolean): React.CSSProperties => ({
        position: 'fixed',
        top: 0,
        left: sidebarCollapsed ? spacing['3xl'] : layoutUtilities.pixels(sidebarWidth),
        right: 0,
        height: layoutUtilities.pixels(height),
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${spacing.lg}`,
        backgroundColor: colors.background.primary,
        borderBottom: `1px solid ${colors.border.primary}`,
        zIndex: zIndex.sticky,
      }),
      dashboardFooter: (height: number, sidebarWidth: number, sidebarCollapsed: boolean): React.CSSProperties => ({
        position: 'fixed',
        bottom: 0,
        left: sidebarCollapsed ? spacing['3xl'] : layoutUtilities.pixels(sidebarWidth),
        right: 0,
        height: layoutUtilities.pixels(height),
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${spacing.lg}`,
        backgroundColor: colors.background.primary,
        borderTop: `1px solid ${colors.border.primary}`,
        zIndex: zIndex.sticky,
      }),
      dashboardMainContent: (
        sidebarWidth: number,
        sidebarCollapsed: boolean,
        headerHeight: number,
        footerHeight: number
      ): React.CSSProperties => ({
        marginLeft: sidebarCollapsed ? spacing['3xl'] : layoutUtilities.pixels(sidebarWidth),
        paddingTop: layoutUtilities.pixels(headerHeight),
        paddingBottom: layoutUtilities.pixels(footerHeight),
        minHeight: layoutUtilities.dimensions.screenHeight,
        transition: `margin-left ${animation.duration.normal} ${animation.easing.ease}`,
      }),
      dashboardContentContainer: (fluid: boolean, centered: boolean): React.CSSProperties => ({
        width: layoutUtilities.dimensions.full,
        maxWidth: fluid ? layoutUtilities.dimensions.full : breakpoints.xl,
        marginLeft: centered ? 'auto' : undefined,
        marginRight: centered ? 'auto' : undefined,
        padding: spacing.lg,
      }),
      dashboardLayout: (): React.CSSProperties => ({
        position: 'relative',
        minHeight: layoutUtilities.dimensions.screenHeight,
        width: layoutUtilities.dimensions.full,
        backgroundColor: colors.background.primary,
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
      }),
      dashboardMobileOverlay: (show: boolean, prefersReducedMotion: boolean): React.CSSProperties => ({
        position: 'fixed',
        inset: 0,
        backgroundColor: colors.background.overlay,
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'auto' : 'none',
        transition: prefersReducedMotion
          ? 'none'
          : `opacity ${animation.duration.normal} ${animation.easing.ease}`,
        zIndex: zIndex.overlay,
      }),
      mobileLayoutSpacing: (gap: number): React.CSSProperties => ({
        marginBottom: `${gap * 4}px`,
      }),
      responsiveContainer: (size: 'sm' | 'md' | 'lg' | 'xl' | 'full'): React.CSSProperties => ({
        width: layoutUtilities.dimensions.full,
        maxWidth: size === 'full' ? layoutUtilities.dimensions.full : breakpoints[size],
        marginLeft: 'auto',
        marginRight: 'auto',
        padding: spacing.lg,
      }),
      responsiveSpacer: (spacingValue: number, direction: 'horizontal' | 'vertical'): React.CSSProperties => ({
        width: direction === 'horizontal' ? `${spacingValue * 4}px` : layoutUtilities.dimensions.full,
        height: direction === 'vertical' ? `${spacingValue * 4}px` : layoutUtilities.dimensions.full,
        flexShrink: 0,
      }),
    }
  }
};
