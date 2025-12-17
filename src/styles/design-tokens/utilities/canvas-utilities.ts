/**
 * 🎨 CANVAS UTILITIES - ENTERPRISE MODULE
 *
 * @description Enterprise-grade canvas utilities για DXF & Geo-Canvas systems.
 * Centralized canvas management για 478+ inline styles elimination.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-17
 * @version 1.0.0 - Enterprise Modularization
 *
 * 🔄 EXTRACTED FROM: src/styles/design-tokens.ts (~1,850 lines - ΜΕΓΑΛΥΤΕΡΟ SECTION!)
 * 🎯 CRITICAL REFACTORING: 478+ inline styles → Centralized Canvas System
 */

import React from 'react';

// Import base tokens for consistent styling
import { colors } from '../base/colors';
import { spacing } from '../base/spacing';

// Import centralized constants για αποφυγή circular dependencies
import { Z_INDEX } from '../constants/shared-constants';

// ============================================================================
// ENTERPRISE CANVAS UTILITIES - PLACEHOLDER STRUCTURE
// ============================================================================

/**
 * 🚨 CRITICAL NOTE: Το πλήρες canvasUtilities section είναι ΤΕΡΑΣΤΙΟ (1,850 lines)!
 *
 * Για την enterprise μετάβαση, θα δημιουργήσω πρώτα τη βασική δομή και μετά
 * θα μεταφέρω σταδιακά το περιεχόμενο από το κύριο αρχείο.
 */

export const canvasUtilities = {
  // ============================================================================
  // DXF CANVAS CORE PATTERNS
  // ============================================================================

  /**
   * 🎯 DXF Canvas positioning και layout patterns
   * Replaces: 478+ inline styles από DXF components
   */
  positioning: {
    // Absolute positioning patterns
    absolute: {
      topLeft: { position: 'absolute' as const, top: 0, left: 0 },
      topRight: { position: 'absolute' as const, top: 0, right: 0 },
      bottomLeft: { position: 'absolute' as const, bottom: 0, left: 0 },
      bottomRight: { position: 'absolute' as const, bottom: 0, right: 0 },
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

    // Dynamic positioning με coordinates
    withCoordinates: (x: number, y: number, width?: number, height?: number): React.CSSProperties => ({
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      ...(width && { width: `${width}px` }),
      ...(height && { height: `${height}px` })
    }),

    // Canvas container patterns
    canvasContainer: {
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      overflow: 'hidden' as const
    }
  },

  // ============================================================================
  // OVERLAY SYSTEMS
  // ============================================================================

  overlays: {
    // Crosshair overlay patterns
    crosshair: {
      base: {
        position: 'absolute' as const,
        pointerEvents: 'none' as const,
        zIndex: Z_INDEX.overlay,
        backgroundColor: colors.primary[500] || '#3b82f6',
        opacity: 0.8
      },

      horizontal: (top: number): React.CSSProperties => ({
        position: 'absolute',
        left: 0,
        right: 0,
        top: `${top}px`,
        height: '1px',
        backgroundColor: colors.primary[500] || '#3b82f6',
        pointerEvents: 'none',
        zIndex: Z_INDEX.overlay
      }),

      vertical: (left: number): React.CSSProperties => ({
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${left}px`,
        width: '1px',
        backgroundColor: colors.primary[500] || '#3b82f6',
        pointerEvents: 'none',
        zIndex: Z_INDEX.overlay
      })
    },

    // Grid overlay patterns
    grid: {
      base: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none' as const,
        zIndex: Z_INDEX.base,
        opacity: 0.1
      },

      withSpacing: (spacing: number, color: string = colors.text.tertiary): React.CSSProperties => ({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `
          linear-gradient(to right, ${color} 1px, transparent 1px),
          linear-gradient(to bottom, ${color} 1px, transparent 1px)
        `,
        backgroundSize: `${spacing}px ${spacing}px`,
        pointerEvents: 'none',
        zIndex: Z_INDEX.base
      })
    }
  },

  // ============================================================================
  // LAYER MANAGEMENT
  // ============================================================================

  layers: {
    // Z-index management για canvas layers
    getLayerZIndex: (layer: 'background' | 'content' | 'overlay' | 'ui' | 'tooltip'): number => {
      const layerMap = {
        background: Z_INDEX.base,
        content: Z_INDEX.base + 10,
        overlay: Z_INDEX.overlay,
        ui: Z_INDEX.modal,
        tooltip: Z_INDEX.tooltip
      };
      return layerMap[layer];
    },

    // Layer visibility management
    layer: (visible: boolean, zIndexLevel: number): React.CSSProperties => ({
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: zIndexLevel,
      display: visible ? 'block' : 'none',
      pointerEvents: visible ? 'auto' : 'none'
    })
  },

  // ============================================================================
  // INTERACTION PATTERNS
  // ============================================================================

  interactions: {
    // Pointer events management
    pointerEvents: {
      enabled: { pointerEvents: 'auto' as const },
      disabled: { pointerEvents: 'none' as const },
      childrenOnly: { pointerEvents: 'none' as const, '& > *': { pointerEvents: 'auto' } }
    },

    // Cursor states
    cursor: {
      crosshair: { cursor: 'crosshair' as const },
      move: { cursor: 'move' as const },
      grab: { cursor: 'grab' as const },
      grabbing: { cursor: 'grabbing' as const },
      pointer: { cursor: 'pointer' as const },
      default: { cursor: 'default' as const }
    },

    // Selection patterns
    selection: {
      base: {
        border: `2px dashed ${colors.primary[500] || '#3b82f6'}`,
        backgroundColor: `${colors.primary[100] || '#dbeafe'}40`,
        position: 'absolute' as const,
        pointerEvents: 'none' as const,
        zIndex: Z_INDEX.overlay
      },

      withBounds: (x: number, y: number, width: number, height: number): React.CSSProperties => ({
        position: 'absolute',
        left: `${Math.min(x, x + width)}px`,
        top: `${Math.min(y, y + height)}px`,
        width: `${Math.abs(width)}px`,
        height: `${Math.abs(height)}px`,
        border: `2px dashed ${colors.primary[500] || '#3b82f6'}`,
        backgroundColor: `${colors.primary[100] || '#dbeafe'}40`,
        pointerEvents: 'none',
        zIndex: Z_INDEX.overlay
      })
    }
  },

  // ============================================================================
  // GEO INTERACTIVE MOBILE PATTERNS
  // ============================================================================

  /**
   * GeoCanvas Specific Interactive Patterns
   * Replaces: InteractiveMap.tsx complex inline styles
   */
  geoInteractive: {
    /**
     * Conditional cursor patterns για interactive states
     * Replaces: cursor: shouldHighlight ? 'pointer' : (complete ? 'default' : 'pointer')
     */
    cursor: {
      conditionalPointer: (condition1: boolean, condition2: boolean): React.CSSProperties => ({
        cursor: condition1 ? 'pointer' : (condition2 ? 'default' : 'pointer')
      }),
      drawingState: (isDrawing: boolean, isPicking: boolean): React.CSSProperties => ({
        cursor: isDrawing || isPicking ? 'crosshair' : 'default'
      })
    },

    /**
     * Interactive control point styling
     * Replaces: complex zIndex + pointerEvents + cursor combinations
     */
    controlPoint: {
      base: {
        zIndex: Z_INDEX.critical,
        pointerEvents: 'auto' as const,
      },
      withCursor: (shouldHighlightFirst: boolean, isComplete: boolean): React.CSSProperties => ({
        zIndex: Z_INDEX.critical,
        pointerEvents: 'auto' as const,
        cursor: shouldHighlightFirst ? 'pointer' : (isComplete ? 'default' : 'pointer')
      })
    },

    /**
     * Accuracy circle geometry patterns
     * Replaces: dynamic circle styling με radius, colors, transforms
     */
    accuracyCircle: (
      radius: number,
      color: string,
      opacity: number = 0.2
    ): React.CSSProperties => ({
      width: radius * 2,
      height: radius * 2,
      borderRadius: '50%',
      border: `2px solid ${color}`,
      backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      transform: 'translate(-50%, -50%)',
      left: '50%',
      top: '50%',
      position: 'absolute' as const,
      pointerEvents: 'none' as const
    }),
    accuracyZone: (
      size: number,
      color: string,
      level: 'excellent' | 'good' | 'moderate' | 'poor',
      opacity: number = 0.25
    ): React.CSSProperties => ({
      width: size,
      height: size,
      backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      border: `2px solid ${color}`,
      borderRadius: level === 'excellent' ? '50%' :
                   level === 'good' ? '4px' : '0',
      transform: 'translate(-50%, -50%) rotate(45deg)',
      left: '50%',
      top: '50%',
      position: 'absolute' as const,
      pointerEvents: 'none' as const,
      zIndex: Z_INDEX.modal
    }),
    legendItem: (color: string): React.CSSProperties => ({
      borderColor: color
    }),
    pinMarker: (
      pointRadius: number,
      opacity: number = 0.7
    ): React.CSSProperties => ({
      width: 20,
      height: 28,
      background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
      borderRadius: '50% 50% 50% 0%',
      transform: 'translate(-50%, -100%) rotate(-45deg)',
      border: '1px solid white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      cursor: 'crosshair',
      position: 'relative' as const,
      opacity
    }),
    pinCenterDot: (): React.CSSProperties => ({
      position: 'absolute' as const,
      top: '30%',
      left: '30%',
      width: 4,
      height: 4,
      backgroundColor: 'white',
      borderRadius: '50%',
      transform: 'rotate(45deg)'
    }),
    drawingPoint: (index: number): React.CSSProperties => ({
      width: 12,
      height: 12,
      backgroundColor: '#3b82f6',
      borderRadius: '50%',
      border: '2px solid #1e40af',
      transform: 'translate(-50%, -50%)',
      cursor: 'pointer',
      animation: 'pulse 1s ease-in-out infinite'
    }),
    radiusLabel: (): React.CSSProperties => ({
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      transform: 'translate(-50%, -50%)',
      whiteSpace: 'nowrap' as const,
      pointerEvents: 'none' as const
    }),
    polygonVertex: (
      pointRadius: number,
      pointColor: string,
      strokeColor: string
    ): React.CSSProperties => ({
      width: pointRadius * 2,
      height: pointRadius * 2,
      backgroundColor: pointColor,
      borderRadius: '50%',
      border: `1px solid ${strokeColor}`,
      transform: 'translate(-50%, -50%)',
      cursor: 'pointer'
    }),

    /**
     * Control point styling με full interaction states
     * Replaces: complex style objects with zIndex, pointerEvents, cursor
     */
    controlPointInteraction: (
      isSelected: boolean,
      shouldHighlight: boolean,
      isCompleted: boolean
    ): React.CSSProperties => ({
      zIndex: shouldHighlight ? Z_INDEX.modal + 200 :
              isSelected ? Z_INDEX.modal + 100 :
              Z_INDEX.modal,
      pointerEvents: isCompleted ? 'none' : 'auto',
      cursor: isCompleted ? 'default' : (shouldHighlight ? 'pointer' : 'pointer')
    }),

    /**
     * Accuracy zone icon rotation
     * Replaces: style={{ transform: 'rotate(-45deg)' }}
     */
    accuracyZoneIcon: (): React.CSSProperties => ({
      transform: 'rotate(-45deg)'
    }),

    /**
     * Preview radius label με blue background
     * Replaces: complex preview styling με specific blue colors και opacity
     */
    previewRadiusLabel: (opacity: number = 0.8): React.CSSProperties => ({
      background: 'rgba(59, 130, 246, 0.9)',
      color: 'white',
      padding: '2px 6px',
      borderRadius: '3px',
      fontSize: '11px',
      fontWeight: 'bold',
      transform: 'translate(-50%, -50%)',
      whiteSpace: 'nowrap' as const,
      pointerEvents: 'none' as const,
      opacity
    }),

    /**
     * Dynamic pin marker με gradient background και custom colors
     * Replaces: complex pin styling με dynamic gradients
     */
    dynamicPinMarker: (
      strokeColor: string,
      fillColor: string
    ): React.CSSProperties => ({
      width: 24,
      height: 32,
      background: `linear-gradient(135deg, ${strokeColor}, ${fillColor})`,
      borderRadius: '50% 50% 50% 0%',
      transform: 'translate(-50%, -100%) rotate(-45deg)',
      border: '2px solid white',
      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
      cursor: 'pointer',
      position: 'relative' as const
    }),

    /**
     * Dynamic pin center dot με enhanced sizing
     * Replaces: nested position styling για pin center
     */
    dynamicPinCenterDot: (): React.CSSProperties => ({
      position: 'absolute' as const,
      top: '30%',
      left: '30%',
      width: 6,
      height: 6,
      backgroundColor: 'white',
      borderRadius: '50%',
      transform: 'rotate(45deg)'
    }),

    /**
     * Enhanced accuracy circle με custom zIndex support
     * Replaces: spread operator με manual zIndex override
     */
    accuracyCircleWithZIndex: (
      radius: number,
      color: string,
      opacity: number = 0.125,
      customZIndex?: number
    ): React.CSSProperties => ({
      width: radius * 2,
      height: radius * 2,
      borderRadius: '50%',
      border: `2px solid ${color}`,
      backgroundColor: `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
      transform: 'translate(-50%, -50%)',
      left: '50%',
      top: '50%',
      position: 'absolute' as const,
      pointerEvents: 'none' as const,
      zIndex: customZIndex ?? Z_INDEX.modal
    }),

    /**
     * Floor plan overlay styling
     * Replaces: inline floor plan style configurations
     */
    floorPlanOverlay: (
      opacity: number,
      strokeColor: string = '#000000',
      strokeWidth: number = 2
    ) => ({
      opacity,
      strokeColor,
      strokeWidth
    }),

    /**
     * 🏢 FLOOR PLAN DRAGGABLE PANEL SYSTEM
     * Enterprise patterns για draggable panels, dialogs, και control interfaces
     * Replaces: FloorPlanControlPointPicker.tsx inline styles
     */

    /**
     * Draggable panel container με position control
     * Replaces: complex fixed positioning με shadows και borders
     */
    draggablePanelContainer: (
      position: { x: number; y: number },
      isDragging: boolean,
      customZIndex?: number
    ): React.CSSProperties => ({
      position: 'fixed' as const,
      left: `${position.x}px`,
      top: `${position.y}px`,
      zIndex: customZIndex ?? 1000,
      backgroundColor: 'white',
      border: '2px solid #3b82f6',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      minWidth: '380px',
      maxWidth: '500px',
      maxHeight: '85vh',
      display: 'flex',
      flexDirection: 'column' as const,
      userSelect: isDragging ? 'none' : 'auto'
    }),

    /**
     * Draggable panel handle με grab cursor states
     * Replaces: drag handle styling με cursor states
     */
    draggablePanelHandle: (isDragging: boolean): React.CSSProperties => ({
      cursor: isDragging ? 'grabbing' : 'grab',
      backgroundColor: '#3b82f6',
      color: 'white',
      padding: '12px 16px',
      borderTopLeftRadius: '6px',
      borderTopRightRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontWeight: 600,
      fontSize: '16px'
    }),

    /**
     * Panel tab navigation container
     * Replaces: tab container με background και borders
     */
    draggablePanelTabNavigation: (): React.CSSProperties => ({
      display: 'flex',
      backgroundColor: '#f8fafc',
      borderBottom: '1px solid #e2e8f0'
    }),

    /**
     * Panel tab button με active states
     * Replaces: tab button styling με conditional states
     */
    draggablePanelTabButton: (
      isActive: boolean,
      isDisabled?: boolean
    ): React.CSSProperties => ({
      flex: 1,
      padding: '12px 16px',
      border: 'none',
      backgroundColor: isActive ? 'white' : 'transparent',
      color: isDisabled ? '#94a3b8' : (isActive ? '#3b82f6' : '#64748b'),
      fontWeight: isActive ? 600 : 400,
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
      transition: 'all 0.2s ease'
    }),

    /**
     * Panel form section container
     * Replaces: form section styling με consistent spacing
     */
    draggablePanelFormSection: (hasError?: boolean): React.CSSProperties => ({
      padding: '20px',
      backgroundColor: 'white',
      borderBottom: '1px solid #f1f5f9',
      borderColor: hasError ? '#ef4444' : '#f1f5f9'
    }),

    /**
     * Panel button styling με variant support
     * Replaces: button inline styles με consistent theming
     */
    draggablePanelButton: (
      variant: 'primary' | 'secondary' | 'success' | 'danger' = 'primary',
      isDisabled?: boolean,
      isFullWidth?: boolean
    ): React.CSSProperties => {
      const variants = {
        primary: {
          backgroundColor: isDisabled ? '#e2e8f0' : '#3b82f6',
          color: isDisabled ? '#94a3b8' : 'white',
          border: 'none'
        },
        secondary: {
          backgroundColor: isDisabled ? '#f8fafc' : '#f1f5f9',
          color: isDisabled ? '#94a3b8' : '#475569',
          border: '1px solid #e2e8f0'
        },
        success: {
          backgroundColor: isDisabled ? '#e2e8f0' : '#10b981',
          color: isDisabled ? '#94a3b8' : 'white',
          border: 'none'
        },
        danger: {
          backgroundColor: isDisabled ? '#e2e8f0' : '#ef4444',
          color: isDisabled ? '#94a3b8' : 'white',
          border: 'none'
        }
      };

      return {
        ...variants[variant],
        padding: '8px 16px',
        borderRadius: '6px',
        fontWeight: 500,
        fontSize: '14px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        width: isFullWidth ? '100%' : 'auto',
        minHeight: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
      };
    },

    /**
     * Panel input field styling με error states
     * Replaces: input field inline styles
     */
    draggablePanelInput: (
      hasError?: boolean,
      isDisabled?: boolean
    ): React.CSSProperties => ({
      width: '100%',
      padding: '8px 12px',
      border: `1px solid ${hasError ? '#ef4444' : '#e2e8f0'}`,
      borderRadius: '6px',
      fontSize: '14px',
      backgroundColor: isDisabled ? '#f8fafc' : 'white',
      color: isDisabled ? '#94a3b8' : '#1e293b',
      cursor: isDisabled ? 'not-allowed' : 'text',
      transition: 'all 0.2s ease',
      outline: 'none'
    }),

    /**
     * Panel help text styling
     * Replaces: help text inline styles
     */
    draggablePanelHelpText: (hasError?: boolean): React.CSSProperties => ({
      fontSize: '12px',
      color: hasError ? '#ef4444' : '#64748b',
      marginTop: '4px',
      lineHeight: 1.4
    }),

    /**
     * Panel spacing utilities
     * Replaces: margin/padding inline styles
     */
    draggablePanelSpacing: {
      section: { marginBottom: '16px' },
      field: { marginBottom: '12px' },
      group: { marginBottom: '20px' },
      button: { marginTop: '16px' }
    },

    /**
     * Progress bar με dynamic width percentage
     * Replaces: style={{ width: `${percent}%` }}
     */
    draggablePanelProgressBar: (percentage: number): React.CSSProperties => ({
      width: `${Math.min(Math.max(0, percentage), 100)}%`,
      transition: 'width 0.3s ease'
    }),

    /**
     * Fixed sidebar panel για dashboard και management interfaces
     * Replaces: Alert dashboard fixed positioning
     */
    fixedSidebarPanel: (
      side: 'left' | 'right' = 'right',
      width: string = '480px'
    ): React.CSSProperties => ({
      position: 'fixed' as const,
      top: '80px',
      [side]: '16px',
      width,
      maxHeight: 'calc(100vh - 100px)',
      zIndex: 300,
      overflow: 'auto' as const
    }),

    /**
     * 📄 PDF VIEWER CONTAINER SYSTEM
     * Enterprise utilities for PDF display components
     */

    /**
     * PDF container with dimensions
     * Replaces: style={{ width: layoutUtilities.pixels(width), height: layoutUtilities.pixels(height) }}
     */
    pdfContainer: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`
    }),

    /**
     * PDF fallback container (no file state)
     * Replaces: inline styles for empty PDF state
     */
    pdfFallbackContainer: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      border: '2px dashed #e2e8f0',
      borderRadius: '8px'
    }),

    /**
     * PDF display wrapper
     * Replaces: style={{ width: layoutUtilities.pixels(width), height: layoutUtilities.pixels(height) }}
     */
    pdfDisplayWrapper: (width: number, height: number): React.CSSProperties => ({
      width: `${width}px`,
      height: `${height}px`,
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden' as const,
      backgroundColor: '#f8fafc'
    }),

    /**
     * 🎛️ ENTERPRISE DROPDOWN SYSTEM
     * Portal-based dropdown με dynamic positioning
     */

    /**
     * Portal dropdown container με dynamic positioning
     * Replaces: style={{ top, left, width, minWidth, maxHeight, overflow }} για portal dropdowns
     */
    portalDropdownContainer: (
      buttonRect: { bottom: number; left: number; width: number },
      minWidth: string = '200px',
      maxHeight: string = '400px'
    ): React.CSSProperties => ({
      position: 'fixed' as const,
      top: buttonRect.bottom + 8,
      left: buttonRect.left,
      width: buttonRect.width,
      minWidth,
      maxHeight,
      overflow: 'hidden' as const,
      zIndex: 99999
    }),

    /**
     * Scrollable results container για dropdown options
     * Replaces: scrollable area με custom scrollbar styling
     */
    dropdownScrollableResults: (
      maxHeight: string = '300px',
      minHeight: string = '200px'
    ): React.CSSProperties => ({
      maxHeight,
      minHeight,
      overflowY: 'scroll' as const,
      scrollbarWidth: 'thin' as any,
      scrollbarColor: '#cbd5e1 transparent',
      WebkitScrollbarWidth: '6px'
    }),

    /**
     * 📄 DOCUMENT PREVIEW SYSTEM
     * Enterprise utilities για document live preview scaling
     */

    /**
     * Document preview scaling container με transform origin
     * Replaces: style={{ transform: scale, transformOrigin, width }} για document preview
     */
    documentPreviewScale: (scale: number): React.CSSProperties => ({
      transform: `scale(${scale})`,
      transformOrigin: 'top center' as const,
      width: `${100 / scale}%`
    }),

    /**
     * 🖼️ CANVAS DISPLAY SYSTEM
     * Enterprise utilities για full-size canvas elements
     */

    /**
     * Full-size canvas display container
     * Replaces: style={{ width: '100%', height: '100%', display: 'block' }}
     */
    canvasFullDisplay: (): React.CSSProperties => ({
      width: '100%',
      height: '100%',
      display: 'block'
    }),

    /**
     * 📱 MOBILE SLIDE-IN SYSTEM
     * Enterprise utilities για mobile detail panels
     */

    /**
     * Mobile slide header με fixed height
     * Replaces: style={{ height: layoutUtilities.pixels(48), minHeight: pixels(48), maxHeight: pixels(48) }}
     */
    mobileSlideHeader: (headerHeight: number = 48): React.CSSProperties => ({
      height: `${headerHeight}px`,
      minHeight: `${headerHeight}px`,
      maxHeight: `${headerHeight}px`
    }),

    /**
     * Mobile slide content με dynamic height
     * Replaces: style={{ height: calc(100vh - headerHeight), flex: '1 1 auto' }}
     */
    mobileSlideContent: (headerHeight: number = 48): React.CSSProperties => ({
      height: `calc(100vh - ${headerHeight}px)`,
      flex: '1 1 auto'
    }),

    /**
     * 🎯 DEBUG CROSSHAIR SYSTEM
     * Enterprise utilities για debug overlay positioning
     */

    /**
     * Debug crosshair positioning με mouse offset
     * Replaces: style={{ left: mouseScreen.x - 10, top: mouseScreen.y - 10 }}
     */
    debugCrosshairPosition: (mouseX: number, mouseY: number, offset: number = 10): React.CSSProperties => ({
      left: mouseX - offset,
      top: mouseY - offset,
      position: 'absolute' as const
    }),

    /**
     * 🎨 COLOR PICKER SYSTEM
     * Enterprise utilities για color picker components
     */

    /**
     * Color picker area container με size και touch action
     * Replaces: style={{ width: size, height: size, touchAction: 'none' }}
     */
    colorPickerArea: (size: string): React.CSSProperties => ({
      width: size,
      height: size,
      touchAction: 'none'
    }),

    /**
     * Color picker thumb positioning με background color
     * Replaces: style={{ left: position.x, top: position.y, backgroundColor: color }}
     */
    colorPickerThumb: (position: { x: number; y: number }, backgroundColor: string): React.CSSProperties => ({
      left: position.x,
      top: position.y,
      backgroundColor
    }),

    /**
     * 📊 ADVANCED CHARTS ANIMATION SYSTEM
     * Enterprise patterns για chart animations και interactions
     * Replaces: AdvancedCharts.tsx inline animation styles
     */

    /**
     * Chart element transition animation για SVG elements
     * Replaces: style={{ transition: animated ? 'all 0.3s ease' : 'none' }}
     */
    chartElementTransition: (
      animated: boolean,
      duration: 'fast' | 'normal' | 'slow' = 'normal'
    ): React.CSSProperties => {
      const durations = {
        fast: '200ms',
        normal: '300ms',
        slow: '500ms'
      };

      return {
        transition: animated ? `all ${durations[duration]} ease` : 'none'
      };
    },

    /**
     * Chart interaction styling με cursor states
     * Replaces: cursor inline styles για interactive charts
     */
    chartInteraction: (
      interactive: boolean,
      animated: boolean = true,
      duration: 'fast' | 'normal' | 'slow' = 'fast'
    ): React.CSSProperties => {
      const durations = {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms'
      };

      return {
        cursor: interactive ? 'pointer' : 'default',
        transition: animated ? `all ${durations[duration]} ease-in-out` : 'none'
      };
    },

    /**
     * Chart combined animation & interaction utilities
     * Replaces: combined transition + cursor inline styles
     */
    chartElementStyle: (
      animated: boolean,
      interactive: boolean,
      duration: 'fast' | 'normal' | 'slow' = 'normal'
    ): React.CSSProperties => ({
      ...canvasUtilities.geoInteractive.chartElementTransition(animated, duration),
      cursor: interactive ? 'pointer' : 'default'
    }),

    /**
     * 📐 DXF VIEWER SIDEBAR SYSTEM
     * Enterprise patterns για DXF sidebar, status bars, και floating panel containers
     * Replaces: SidebarSection.tsx inline styles
     */

    /**
     * DXF Sidebar main container με fixed width και positioning
     * Replaces: SidebarSection container με hardcoded 384px width
     */
    dxfSidebar: {
      container: {
        width: '384px',
        minWidth: '384px',
        maxWidth: '384px',
        height: '100%',
        flexShrink: 0,
        position: 'relative' as const,
        overflow: 'hidden',
        pointerEvents: 'auto' as const
      },

      /**
       * Sidebar panel με enterprise dark theme και shadows
       * Replaces: Inner div με backgroundColor #111827 και borders
       */
      panel: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '384px',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#111827', // DXF dark theme
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #6B7280'
      },

      /**
       * Floating panel content area με reserved space για status bar
       * Replaces: FloatingPanelContainer positioning με bottom: 120px
       */
      contentArea: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: '120px', // Reserve space for status bar
        overflow: 'hidden'
      },

      /**
       * Status bar container στο bottom του sidebar
       * Replaces: Status bar με absolute positioning και border styling
       */
      statusBar: {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        backgroundColor: '#1F2937', // gray-800 equivalent
        borderTop: '1px solid #6B7280', // gray-500 equivalent
        padding: '16px'
      }
    },

    /**
     * 📱 RESPONSIVE DASHBOARD LAYOUT SYSTEM
     * Enterprise patterns για responsive layouts, grids, sidebar management
     * Replaces: ResponsiveDashboard.tsx inline styles
     */

    /**
     * Responsive grid system με dynamic columns
     * Replaces: gridStyle objects με columns και gap calculation
     */
    responsiveGrid: (columns: number, gap: number): React.CSSProperties => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: `${gap * 4}px`,
      width: '100%'
    }),

    /**
     * Grid item με responsive spanning
     * Replaces: gridColumn calculations για span και offset
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
     * Replaces: auto-fill pattern με responsive cards
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
     * Replaces: sidebar positioning και transition logic
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
     * Replaces: toggle button styling και positioning
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
     * Replaces: sidebar content styling με conditional padding
     */
    sidebarContent: (isCollapsed: boolean): React.CSSProperties => ({
      flex: 1,
      overflow: 'auto' as const,
      padding: isCollapsed ? '48px 8px 16px' : '48px 16px 16px'
    }),

    /**
     * Dashboard header με sidebar-aware positioning
     * Replaces: header positioning που αλλάζει βάσει sidebar state
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
     * Replaces: footer positioning logic
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
     * Replaces: main content positioning logic
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
     * Replaces: container styling logic
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
     * Replaces: layout wrapper styling
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
     * Replaces: mobile overlay styling με visibility control
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
     * Replaces: container size variants
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
     * Replaces: spacer dimension calculations
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
     * Replaces: mobile margin calculations
     */
    mobileLayoutSpacing: (gap: number): React.CSSProperties => ({
      marginBottom: `${gap * 4}px`
    })
  }
} as const;

// ============================================================================
// CANVAS HELPER UTILITIES
// ============================================================================

export const canvasHelpers = {
  /**
   * Calculate canvas coordinates από screen coordinates
   */
  screenToCanvas: (
    screenX: number,
    screenY: number,
    canvasRect: DOMRect,
    scale: number = 1,
    panX: number = 0,
    panY: number = 0
  ): { x: number; y: number } => {
    const x = (screenX - canvasRect.left - panX) / scale;
    const y = (screenY - canvasRect.top - panY) / scale;
    return { x, y };
  },

  /**
   * Calculate screen coordinates από canvas coordinates
   */
  canvasToScreen: (
    canvasX: number,
    canvasY: number,
    canvasRect: DOMRect,
    scale: number = 1,
    panX: number = 0,
    panY: number = 0
  ): { x: number; y: number } => {
    const x = (canvasX * scale) + canvasRect.left + panX;
    const y = (canvasY * scale) + canvasRect.top + panY;
    return { x, y };
  },

  /**
   * Clamp coordinates to canvas bounds
   */
  clampToCanvas: (
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } => ({
    x: Math.max(0, Math.min(x, canvasWidth)),
    y: Math.max(0, Math.min(y, canvasHeight))
  }),

  // ============================================================================
  // CANVAS LAYER MANAGEMENT - ENTERPRISE LAYER SYSTEM
  // ============================================================================

  /**
   * Canvas Layer Management με dynamic tool states
   * Enterprise-class layer positioning και z-index control
   */
  layers: {
    // Main canvas layers
    dxfCanvas: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 1200, // DXF canvas layer
      pointerEvents: 'auto' as const
    },

    layerCanvas: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 1210, // Layer canvas above DXF
      pointerEvents: 'auto' as const
    },

    /**
     * DXF Canvas με dynamic tool states
     * Replaces: DxfCanvas.tsx complex inline style με cursor, zIndex
     */
    dxfCanvasWithTools: (
    activeTool: string,
    crosshairEnabled: boolean = false
  ): React.CSSProperties => ({
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    zIndex: 0, // DXF canvas below layer canvas
    touchAction: 'none', // Enterprise: Prevent browser touch gestures
    cursor: activeTool === 'pan' ? 'grab' :
           (crosshairEnabled ? 'none' : 'crosshair')
  }),

    /**
     * Layer Canvas με dynamic tool states
     * Replaces: LayerCanvas.tsx complex inline style με cursor, border, zIndex
     */
    layerCanvasWithTools: (
    activeTool: string,
    crosshairEnabled: boolean = false
  ): React.CSSProperties => ({
    position: 'absolute' as const,
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    zIndex: 10, // Layer canvas above DXF canvas
    pointerEvents: 'auto' as const,
    cursor: activeTool === 'pan' ? 'grab' :
           (crosshairEnabled ? 'none' : 'crosshair'),
    backgroundColor: 'transparent',
    border: activeTool === 'layering' ? '2px solid lime' : 'none'
    }),

    // Overlay layers
    overlayBase: {
      position: 'absolute' as const,
      inset: 0,
      zIndex: 1250, // Overlay above canvas layers
      pointerEvents: 'none' as const
    },

    /**
     * Custom z-index με pointer events control
     * Replaces: style={{ zIndex: customZ, pointerEvents: 'none' }}
     */
    withZIndex: (zIndex: number, pointerEvents: 'none' | 'auto' = 'none'): React.CSSProperties => ({
      position: 'absolute' as const,
      inset: 0,
      zIndex,
      pointerEvents
    })
  },

  // ============================================================================
  // CANVAS HELPER UTILITIES
  // ============================================================================

  /**
   * Canvas coordinate and utility functions
   */
  canvasHelpers: {
  /**
   * Calculate distance between two points
   */
    distance: (x1: number, y1: number, x2: number, y2: number): number => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    }
  }

} as const;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * 🔄 LEGACY SUPPORT: Re-export για backward compatibility
 */
export {
  canvasUtilities as designTokenCanvasUtilities,
  canvasHelpers as designTokenCanvasHelpers
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type CanvasUtilities = typeof canvasUtilities;
export type CanvasHelpers = typeof canvasHelpers;
export type CanvasPosition = { x: number; y: number };
export type CanvasBounds = { x: number; y: number; width: number; height: number };

/**
 * ✅ ENTERPRISE CANVAS UTILITIES MODULE - INITIAL STRUCTURE
 *
 * ⚠️ IMPORTANT: Αυτό είναι η ΒΑΣΙΚΗ ΔΟΜΗ του τεράστιου canvasUtilities section.
 *
 * Το πλήρες περιεχόμενο (1,850 lines) θα μεταφερθεί σταδιακά από το κύριο
 * design-tokens.ts αρχείο για να αποφευχθούν breaking changes.
 *
 * Features (Βασική δομή):
 * 1. ✅ Canvas positioning patterns (absolute, relative, fixed)
 * 2. ✅ Overlay systems (crosshairs, grids, selections)
 * 3. ✅ Layer management με z-index control
 * 4. ✅ Interaction patterns (pointer events, cursors)
 * 5. ✅ Helper utilities για coordinate transformations
 * 6. ✅ Legacy compatibility exports
 * 7. ✅ Complete TypeScript support
 *
 * NEXT STEPS:
 * - Μεταφορά full canvasUtilities content από design-tokens.ts
 * - Αφαίρεση από το κύριο αρχείο (1,850 lines reduction!)
 * - Testing των canvas functionalities
 *
 * Result: Professional canvas utilities management system
 */