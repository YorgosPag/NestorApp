/**
 * 🎨 CANVAS POSITIONING TOKENS
 *
 * UI positioning patterns για canvas elements
 * Μόνο styling - όχι business logic (που είναι στο core system)
 *
 * @author Enterprise Canvas Team
 * @since 2025-12-18
 * @version 1.0.0 - Foundation Consolidation
 */

import React from 'react';

// Import base tokens
import { Z_INDEX } from '../constants/shared-constants';

/**
 * 🎯 CANVAS POSITIONING PATTERNS
 * Pure CSS styling patterns για canvas positioning
 */
export const canvasPositioning = {
  // ============================================================================
  // BASIC POSITIONING PATTERNS
  // ============================================================================

  /**
   * Absolute positioning variants
   */
  absolute: {
    topLeft: {
      position: 'absolute' as const,
      top: 0,
      left: 0
    },
    topRight: {
      position: 'absolute' as const,
      top: 0,
      right: 0
    },
    bottomLeft: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0
    },
    bottomRight: {
      position: 'absolute' as const,
      bottom: 0,
      right: 0
    },
    center: {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    },
    fullScreen: {
      position: 'fixed' as const,
      inset: 0,
      zIndex: Z_INDEX.overlay
    }
  },

  /**
   * Relative positioning patterns
   */
  relative: {
    container: {
      position: 'relative' as const,
      width: '100%',
      height: '100%'
    },
    wrapper: {
      position: 'relative' as const,
      overflow: 'hidden' as const
    }
  },

  /**
   * Fixed positioning patterns
   */
  fixed: {
    topBar: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: Z_INDEX.modal
    },
    bottomBar: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: Z_INDEX.modal
    },
    sidebar: {
      position: 'fixed' as const,
      top: 0,
      bottom: 0,
      zIndex: Z_INDEX.modal
    }
  },

  // ============================================================================
  // DYNAMIC POSITIONING FUNCTIONS
  // ============================================================================

  /**
   * Dynamic positioning με coordinates
   */
  withCoordinates: (x: number, y: number, width?: number, height?: number): React.CSSProperties => ({
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    ...(width && { width: `${width}px` }),
    ...(height && { height: `${height}px` })
  }),

  /**
   * Canvas container με custom dimensions
   */
  canvasContainer: (width: string = '100%', height: string = '100%'): React.CSSProperties => ({
    position: 'relative',
    width,
    height,
    overflow: 'hidden'
  }),

  /**
   * Overlay positioning με custom z-index
   */
  overlay: (zIndex: number = Z_INDEX.overlay): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    zIndex,
    pointerEvents: 'none'
  }),

  /**
   * Status bar overlay positioning για CAD interfaces
   */
  statusBarOverlays: {
    /**
     * Color manager container που ανοίγει σε συγκεκριμένες συντεταγμένες
     * Replaces: canvasUtilities.overlays.cadStatusBar.colorManager.container(x, y)
     */
    colorManagerContainer: (x: number, y: number): React.CSSProperties => ({
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      zIndex: Z_INDEX.modal,
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
      border: '1px solid #e2e8f0',
      minWidth: '200px',
      pointerEvents: 'auto'
    }),

    /**
     * Status bar container - Basic container styling
     */
    statusBarContainer: (): React.CSSProperties => ({
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderBottomLeftRadius: '8px',
      borderBottomRightRadius: '8px',
      backgroundColor: '#1F2937',
      borderTop: '1px solid #6B7280',
      padding: '16px'
    })
  },

  /**
   * CAD Status Bar interface styling patterns
   * Replaces: canvasUtilities.overlays.cadStatusBar.*
   */
  cadStatusBar: {
    /**
     * Main status bar container
     */
    container: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1F2937',
      borderTop: '2px solid #374151',
      display: 'flex',
      alignItems: 'center',
      padding: '8px 16px',
      zIndex: 1000,
      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
      fontFamily: 'monospace'
    },

    /**
     * Status button styling (inactive state)
     */
    button: {
      backgroundColor: '#374151',
      border: '1px solid #6B7280',
      borderRadius: '4px',
      padding: '6px 12px',
      margin: '0 4px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '60px',
      height: '48px',
      transition: 'all 0.15s ease',
      color: '#D1D5DB'
    },

    /**
     * Status button styling (active state)
     */
    buttonActive: {
      backgroundColor: '#3B82F6',
      borderColor: '#2563EB',
      color: 'white',
      boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)'
    },

    /**
     * Status button label styling
     */
    label: {
      fontSize: '11px',
      fontWeight: 'bold' as const,
      letterSpacing: '0.5px',
      lineHeight: '1'
    },

    /**
     * Function key display styling
     */
    functionKey: {
      fontSize: '9px',
      opacity: 0.7,
      marginTop: '2px',
      lineHeight: '1'
    },

    /**
     * Status info area styling
     */
    statusInfo: {
      marginLeft: 'auto',
      color: '#9CA3AF',
      fontSize: '12px',
      fontStyle: 'italic' as const,
      padding: '0 16px'
    }
  },

  /**
   * Floating Panel System για draggable UI components
   * Replaces: canvasUtilities.overlays.floatingPanel.*
   */
  floatingPanel: {
    /**
     * Overlay toolbar system for draggable toolbars
     */
    overlayToolbar: {
      /**
       * Main toolbar container με dragging support
       * @param position - { x: number, y: number }
       * @param isDragging - boolean state
       */
      container: (position: { x: number; y: number }, isDragging: boolean): React.CSSProperties => ({
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: isDragging ? 1100 : 1000,
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'default',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.15s ease',
        boxShadow: isDragging
          ? '0 8px 32px rgba(0, 0, 0, 0.3)'
          : '0 4px 16px rgba(0, 0, 0, 0.15)'
      }),

      /**
       * Drag handle area styling
       */
      dragHandle: {
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        msUserSelect: 'none',
        touchAction: 'none'
      }
    },

    /**
     * Test results modal system
     */
    testModal: {
      /**
       * Modal backdrop styling
       * Replaces: canvasUtilities.overlays.floatingPanel.testModal.backdrop
       */
      backdrop: {
        zIndex: 2000,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)'
      },

      /**
       * Modal content container styling
       * Replaces: canvasUtilities.overlays.floatingPanel.testModal.content
       */
      content: {
        maxWidth: '90vw',
        maxHeight: '90vh',
        width: '800px',
        height: '600px',
        zIndex: 2001
      }
    }
  },

  /**
   * Layer positioning με z-index management
   */
  layer: (zIndex: number, visible: boolean = true): React.CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex,
    display: visible ? 'block' : 'none',
    pointerEvents: visible ? 'auto' : 'none'
  }),

  // ============================================================================
  // OVERLAY & LAYER PATTERNS
  // ============================================================================

  /**
   * Canvas overlay layer management
   * Replaces: canvasUtilities.layers.*
   */
  layers: {
    /**
     * Base overlay layer pattern
     * Replaces: canvasUtilities.layers.overlayBase
     */
    overlayBase: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: Z_INDEX.overlay,
      pointerEvents: 'none' as const
    },

    /**
     * Custom z-index με pointer events control
     * Replaces: canvasUtilities.layers.withZIndex(zIndex, pointerEvents)
     */
    withZIndex: (zIndex: number, pointerEvents: 'none' | 'auto' = 'none'): React.CSSProperties => ({
      position: 'absolute' as const,
      inset: 0,
      zIndex,
      pointerEvents
    }),

    /**
     * Canvas overlay με tool-aware pointer control
     * Replaces: canvasUtilities.layers.canvasOverlayWithPointerControl(activeTool)
     */
    canvasOverlayWithPointerControl: (activeTool: string): React.CSSProperties => {
      const drawingTools = ['line', 'polyline', 'polygon', 'circle', 'rectangle'];
      const isDrawingTool = drawingTools.includes(activeTool);

      return {
        touchAction: 'none',
        pointerEvents: isDrawingTool ? 'none' : 'auto'
      };
    },

    /**
     * DXF Canvas με tool and crosshair awareness
     * Replaces: canvasUtilities.layers.dxfCanvasWithTools(activeTool, crosshairEnabled)
     */
    dxfCanvasWithTools: (activeTool: string, crosshairEnabled: boolean = false): React.CSSProperties => {
      const drawingTools = ['line', 'polyline', 'polygon', 'circle', 'rectangle'];
      const isDrawingTool = drawingTools.includes(activeTool);

      return {
        cursor: crosshairEnabled ? 'crosshair' : (isDrawingTool ? 'crosshair' : 'default'),
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto'
      };
    },

    /**
     * Layer Canvas με tool and crosshair awareness
     * Replaces: canvasUtilities.layers.layerCanvasWithTools(activeTool, crosshairEnabled)
     */
    layerCanvasWithTools: (activeTool: string, crosshairEnabled: boolean = false): React.CSSProperties => {
      const drawingTools = ['line', 'polyline', 'polygon', 'circle', 'rectangle'];
      const isDrawingTool = drawingTools.includes(activeTool);

      return {
        cursor: crosshairEnabled ? 'crosshair' : (isDrawingTool ? 'crosshair' : 'default'),
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto',
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      };
    }
  },

  // ============================================================================
  // CANVAS OVERLAY PATTERNS
  // ============================================================================

  /**
   * Zoom window overlay styling
   * Replaces: canvasUtilities.zoom.window.*
   */
  zoomWindow: {
    rectangle: (left: number, top: number, width: number, height: number): React.CSSProperties => ({
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: '2px solid #3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      pointerEvents: 'none',
      zIndex: Z_INDEX.overlay
    })
  },

  /**
   * Snap indicator overlay patterns
   * Replaces: canvasUtilities.overlays.snapIndicator.*
   */
  snapIndicator: {
    point: (x: number, y: number): React.CSSProperties => ({
      position: 'absolute',
      left: `${x - 4}px`,
      top: `${y - 4}px`,
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: '#10b981',
      border: '2px solid white',
      boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
      pointerEvents: 'none',
      zIndex: Z_INDEX.overlay
    })
  },

  /**
   * Selection marquee overlay patterns
   * Replaces: canvasUtilities.overlays.marquee.*
   */
  marquee: {
    rectangle: (x: number, y: number, width: number, height: number, kind?: 'window' | 'crossing'): React.CSSProperties => ({
      position: 'absolute',
      left: `${Math.min(x, x + width)}px`,
      top: `${Math.min(y, y + height)}px`,
      width: `${Math.abs(width)}px`,
      height: `${Math.abs(height)}px`,
      border: kind === 'crossing' ? '1px dashed #f59e0b' : '1px dashed #3b82f6',
      backgroundColor: kind === 'crossing' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)',
      pointerEvents: 'none',
      zIndex: Z_INDEX.overlay
    })
  },

  /**
   * Cursor tooltip overlay patterns
   * Replaces: canvasUtilities.overlays.tooltip.*
   */
  tooltip: {
    positioned: (x: number, y: number): React.CSSProperties => ({
      position: 'absolute',
      left: `${x + 15}px`,
      top: `${y - 30}px`,
      backgroundColor: '#1f2937',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      pointerEvents: 'none',
      zIndex: Z_INDEX.tooltip
    })
  },

  // ============================================================================
  // RESPONSIVE POSITIONING
  // ============================================================================

  /**
   * Responsive container patterns
   */
  responsive: {
    /**
     * Full viewport container
     */
    fullViewport: {
      position: 'relative' as const,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    },

    /**
     * Aspect ratio container
     */
    aspectRatio: (ratio: string = '16/9'): React.CSSProperties => ({
      position: 'relative',
      width: '100%',
      aspectRatio: ratio,
      overflow: 'hidden'
    }),

    /**
     * Flexible container
     */
    flexible: {
      position: 'relative' as const,
      display: 'flex',
      flex: '1 1 auto',
      overflow: 'hidden'
    },

    /**
     * Responsive grid system με dynamic columns
     */
    responsiveGrid: (columns: number, gap: number): React.CSSProperties => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: `${gap * 4}px`,
      width: '100%'
    }),

    /**
     * Grid item με responsive spanning
     */
    responsiveGridItem: (
      span: number,
      offset: number = 0,
      order?: number
    ): React.CSSProperties => ({
      gridColumn: offset > 0 ? `${offset + 1} / span ${span}` : `span ${span}`,
      order: order || 'initial'
    }),

    /**
     * Card grid με auto-fill και minmax
     */
    responsiveCardGrid: (
      minCardWidth: number,
      maxCardWidth: number,
      gap: number
    ): React.CSSProperties => ({
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, ${maxCardWidth}px))`,
      gap: `${gap * 4}px`,
      justifyContent: 'center',
      width: '100%'
    }),

    /**
     * Dashboard sidebar με collapsible behavior
     */
    dashboardSidebar: (
      isCollapsed: boolean,
      width: number,
      collapsedWidth: number
    ): React.CSSProperties => ({
      width: isCollapsed ? `${collapsedWidth}px` : `${width}px`,
      height: '100vh',
      backgroundColor: '#f8fafc',
      borderRight: '1px solid #e2e8f0',
      transition: 'width 0.2s ease-in-out',
      position: 'fixed' as const,
      left: 0,
      top: 0,
      zIndex: 1000,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const
    }),

    /**
     * Sidebar toggle button με positioning
     */
    sidebarToggleButton: (isCollapsed: boolean): React.CSSProperties => ({
      position: 'absolute' as const,
      top: '16px',
      right: isCollapsed ? '8px' : '16px',
      padding: '8px',
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      zIndex: 1001,
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px'
    }),

    /**
     * Sidebar content area με padding
     */
    sidebarContent: (isCollapsed: boolean): React.CSSProperties => ({
      flex: 1,
      overflow: 'auto' as const,
      padding: isCollapsed ? '48px 8px 16px' : '48px 16px 16px'
    }),

    /**
     * Dashboard header με sidebar-aware positioning
     */
    dashboardHeader: (
      height: number,
      sidebarWidth: number,
      sidebarCollapsed: boolean
    ): React.CSSProperties => ({
      height: `${height}px`,
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      position: 'fixed' as const,
      top: 0,
      left: sidebarCollapsed ? '64px' : `${sidebarWidth}px`,
      right: 0,
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      transition: 'left 0.2s ease-in-out'
    }),

    /**
     * Dashboard footer με responsive positioning
     */
    dashboardFooter: (
      height: number,
      sidebarWidth: number,
      sidebarCollapsed: boolean
    ): React.CSSProperties => ({
      height: `${height}px`,
      backgroundColor: '#f8fafc',
      borderTop: '1px solid #e2e8f0',
      position: 'fixed' as const,
      bottom: 0,
      left: sidebarCollapsed ? '64px' : `${sidebarWidth}px`,
      right: 0,
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      transition: 'left 0.2s ease-in-out'
    }),

    /**
     * Main content area με responsive margins
     */
    dashboardMainContent: (
      sidebarWidth: number,
      sidebarCollapsed: boolean,
      headerHeight: number,
      footerHeight: number
    ): React.CSSProperties => ({
      marginLeft: sidebarCollapsed ? '64px' : `${sidebarWidth}px`,
      marginTop: `${headerHeight}px`,
      marginBottom: footerHeight > 0 ? `${footerHeight}px` : 0,
      minHeight: `calc(100vh - ${headerHeight}px - ${footerHeight}px)`,
      backgroundColor: '#ffffff',
      transition: 'margin-left 0.2s ease-in-out',
      overflow: 'auto' as const
    }),

    /**
     * Content container με centering και max-width
     */
    dashboardContentContainer: (
      fluid: boolean,
      centered: boolean
    ): React.CSSProperties => ({
      maxWidth: fluid ? '100%' : '1280px',
      margin: centered ? '0 auto' : '0',
      padding: '24px',
      width: '100%'
    }),

    /**
     * Dashboard layout base styling
     */
    dashboardLayout: (): React.CSSProperties => ({
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1e293b',
      position: 'relative' as const,
      overflow: 'hidden'
    }),

    /**
     * Mobile overlay για sidebar
     */
    dashboardMobileOverlay: (
      showMobileOverlay: boolean,
      prefersReducedMotion: boolean
    ): React.CSSProperties => ({
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 999,
      opacity: showMobileOverlay ? 1 : 0,
      visibility: showMobileOverlay ? 'visible' : 'hidden',
      transition: prefersReducedMotion
        ? 'none'
        : 'opacity 0.2s ease-in-out, visibility 0.2s ease-in-out'
    }),

    /**
     * Container με responsive max-width
     */
    responsiveContainer: (size: 'sm' | 'md' | 'lg' | 'xl' | 'full'): React.CSSProperties => {
      const maxWidths = {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        full: '100%'
      };

      return {
        maxWidth: maxWidths[size],
        margin: '0 auto',
        padding: '0 16px',
        width: '100%'
      };
    },

    /**
     * Responsive spacer component
     */
    responsiveSpacer: (
      spacingValue: number,
      direction: 'horizontal' | 'vertical'
    ): React.CSSProperties => ({
      [direction === 'horizontal' ? 'width' : 'height']: `${spacingValue * 4}px`,
      [direction === 'horizontal' ? 'height' : 'width']: direction === 'horizontal' ? '1px' : '100%',
      flexShrink: 0
    }),

    /**
     * Mobile layout spacing
     */
    mobileLayoutSpacing: (gap: number): React.CSSProperties => ({
      marginBottom: `${gap * 4}px`
    })
  },

  // ============================================================================
  // CANVAS-SPECIFIC POSITIONING
  // ============================================================================

  /**
   * Canvas element positioning
   */
  canvas: {
    /**
     * Base canvas element styling
     */
    base: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%'
    },

    /**
     * Canvas με specific z-index
     */
    withZIndex: (zIndex: number): React.CSSProperties => ({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex
    }),

    /**
     * Interactive canvas
     */
    interactive: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      touchAction: 'none', // Prevent browser touch gestures
      userSelect: 'none'
    }
  }
} as const;

/**
 * 📱 MOBILE POSITIONING PATTERNS
 * Mobile-specific positioning utilities
 */
export const mobilePositioning = {
  /**
   * Mobile-safe positioning
   */
  mobileSafe: {
    /**
     * Full screen with safe area
     */
    fullScreenSafe: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)'
    },

    /**
     * Header with safe area
     */
    headerSafe: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      paddingTop: 'env(safe-area-inset-top)',
      zIndex: Z_INDEX.modal
    }
  },

  /**
   * Touch-friendly positioning
   */
  touchFriendly: {
    /**
     * Touch target sizing
     */
    touchTarget: {
      minWidth: '44px',
      minHeight: '44px',
      position: 'relative' as const
    },

    /**
     * Gesture area
     */
    gestureArea: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      touchAction: 'manipulation'
    }
  }
} as const;

/**
 * 🔧 POSITIONING UTILITIES
 * Helper functions για positioning calculations
 */
export const positioningUtils = {
  /**
   * Calculate center position
   */
  centerPosition: (containerWidth: number, containerHeight: number, elementWidth: number, elementHeight: number) => ({
    left: (containerWidth - elementWidth) / 2,
    top: (containerHeight - elementHeight) / 2
  }),

  /**
   * Calculate grid position
   */
  gridPosition: (row: number, col: number, cellWidth: number, cellHeight: number) => ({
    left: col * cellWidth,
    top: row * cellHeight
  }),

  /**
   * Clamp position to bounds
   */
  clampPosition: (
    x: number,
    y: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
  ) => ({
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y))
  })
} as const;

/**
 * ✅ TYPE EXPORTS
 */
export type CanvasPositioning = typeof canvasPositioning;
export type MobilePositioning = typeof mobilePositioning;
export type PositioningUtils = typeof positioningUtils;