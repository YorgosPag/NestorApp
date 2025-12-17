/**
 * 🎨 CANVAS INTERACTION TOKENS
 *
 * UI interaction patterns για canvas elements
 * Cursor states, pointer events, touch gestures - pure styling
 *
 * @author Enterprise Canvas Team
 * @since 2025-12-18
 * @version 1.0.0 - Foundation Consolidation
 */

import React from 'react';

// Import base tokens
import { colors } from '../base/colors';
import { Z_INDEX } from '../constants/shared-constants';

/**
 * 🖱️ CURSOR MANAGEMENT TOKENS
 * Cursor states για different interaction modes
 */
export const cursorTokens = {
  // ============================================================================
  // BASIC CURSOR STATES
  // ============================================================================

  /**
   * Standard cursor types
   */
  standard: {
    default: { cursor: 'default' as const },
    pointer: { cursor: 'pointer' as const },
    text: { cursor: 'text' as const },
    wait: { cursor: 'wait' as const },
    help: { cursor: 'help' as const },
    notAllowed: { cursor: 'not-allowed' as const }
  },

  /**
   * Canvas-specific cursors
   */
  canvas: {
    crosshair: { cursor: 'crosshair' as const },
    move: { cursor: 'move' as const },
    grab: { cursor: 'grab' as const },
    grabbing: { cursor: 'grabbing' as const },
    copy: { cursor: 'copy' as const },
    alias: { cursor: 'alias' as const }
  },

  /**
   * Resize cursors
   */
  resize: {
    nResize: { cursor: 'n-resize' as const },
    sResize: { cursor: 's-resize' as const },
    eResize: { cursor: 'e-resize' as const },
    wResize: { cursor: 'w-resize' as const },
    neResize: { cursor: 'ne-resize' as const },
    nwResize: { cursor: 'nw-resize' as const },
    seResize: { cursor: 'se-resize' as const },
    swResize: { cursor: 'sw-resize' as const },
    ewResize: { cursor: 'ew-resize' as const },
    nsResize: { cursor: 'ns-resize' as const },
    neswResize: { cursor: 'nesw-resize' as const },
    nwseResize: { cursor: 'nwse-resize' as const }
  },

  /**
   * Zoom cursors
   */
  zoom: {
    zoomIn: { cursor: 'zoom-in' as const },
    zoomOut: { cursor: 'zoom-out' as const }
  },

  // ============================================================================
  // DYNAMIC CURSOR PATTERNS
  // ============================================================================

  /**
   * Conditional cursor based on tool state
   */
  toolCursor: (tool: string, isActive: boolean = true): React.CSSProperties => {
    if (!isActive) return { cursor: 'default' };

    const toolCursors = {
      pan: 'grab',
      panning: 'grabbing',
      draw: 'crosshair',
      select: 'default',
      move: 'move',
      resize: 'nwse-resize',
      rotate: 'grab',
      zoom: 'zoom-in',
      measure: 'crosshair',
      text: 'text'
    } as const;

    return { cursor: toolCursors[tool as keyof typeof toolCursors] || 'default' };
  },

  /**
   * Interactive state cursor
   */
  interactiveCursor: (isHover: boolean, isActive: boolean, isDisabled: boolean = false): React.CSSProperties => {
    if (isDisabled) return { cursor: 'not-allowed' };
    if (isActive) return { cursor: 'grabbing' };
    if (isHover) return { cursor: 'grab' };
    return { cursor: 'default' };
  },

  /**
   * Drawing mode cursor
   */
  drawingCursor: (isDrawing: boolean, isPicking: boolean): React.CSSProperties => ({
    cursor: isDrawing || isPicking ? 'crosshair' : 'default'
  })
} as const;

/**
 * 👆 POINTER EVENTS TOKENS
 * Pointer event control patterns
 */
export const pointerTokens = {
  // ============================================================================
  // BASIC POINTER STATES
  // ============================================================================

  /**
   * Standard pointer events
   */
  standard: {
    auto: { pointerEvents: 'auto' as const },
    none: { pointerEvents: 'none' as const },
    visiblePainted: { pointerEvents: 'visiblePainted' as const },
    visibleFill: { pointerEvents: 'visibleFill' as const },
    visibleStroke: { pointerEvents: 'visibleStroke' as const },
    visible: { pointerEvents: 'visible' as const },
    painted: { pointerEvents: 'painted' as const },
    fill: { pointerEvents: 'fill' as const },
    stroke: { pointerEvents: 'stroke' as const },
    all: { pointerEvents: 'all' as const }
  },

  /**
   * Canvas layer pointer events
   */
  layer: {
    interactive: { pointerEvents: 'auto' as const },
    passThrough: { pointerEvents: 'none' as const },
    childrenOnly: {
      pointerEvents: 'none' as const,
      '& > *': { pointerEvents: 'auto' }
    }
  },

  /**
   * Conditional pointer events
   */
  conditional: (isInteractive: boolean): React.CSSProperties => ({
    pointerEvents: isInteractive ? 'auto' : 'none'
  }),

  /**
   * Touch action control
   */
  touchAction: {
    auto: { touchAction: 'auto' as const },
    none: { touchAction: 'none' as const },
    pan: { touchAction: 'pan-x pan-y' as const },
    panX: { touchAction: 'pan-x' as const },
    panY: { touchAction: 'pan-y' as const },
    pinchZoom: { touchAction: 'pinch-zoom' as const },
    manipulation: { touchAction: 'manipulation' as const }
  }
} as const;

/**
 * 🎭 INTERACTION FEEDBACK TOKENS
 * Visual feedback για user interactions
 */
export const feedbackTokens = {
  // ============================================================================
  // HOVER STATES
  // ============================================================================

  /**
   * Hover effects
   */
  hover: {
    /**
     * Subtle highlight
     */
    subtle: {
      transition: 'background-color 0.15s ease',
      ':hover': {
        backgroundColor: `${colors.primary?.[100] || '#f3f4f6'}40`
      }
    },

    /**
     * Border highlight
     */
    border: {
      transition: 'border-color 0.15s ease',
      ':hover': {
        borderColor: colors.primary?.[500] || '#3b82f6'
      }
    },

    /**
     * Scale effect
     */
    scale: {
      transition: 'transform 0.15s ease',
      ':hover': {
        transform: 'scale(1.05)'
      }
    },

    /**
     * Shadow effect
     */
    shadow: {
      transition: 'box-shadow 0.15s ease',
      ':hover': {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }
    }
  },

  // ============================================================================
  // ACTIVE STATES
  // ============================================================================

  /**
   * Active/pressed states
   */
  active: {
    /**
     * Pressed down effect
     */
    pressed: {
      transform: 'scale(0.95)',
      transition: 'transform 0.1s ease'
    },

    /**
     * Active highlight
     */
    highlight: {
      backgroundColor: colors.primary?.[500] || '#3b82f6',
      color: 'white'
    },

    /**
     * Active border
     */
    border: {
      borderColor: colors.primary?.[600] || '#2563eb',
      borderWidth: '2px'
    }
  },

  // ============================================================================
  // DISABLED STATES
  // ============================================================================

  /**
   * Disabled states
   */
  disabled: {
    /**
     * Grayed out
     */
    grayed: {
      opacity: 0.5,
      cursor: 'not-allowed',
      pointerEvents: 'none'
    },

    /**
     * Faded
     */
    faded: {
      opacity: 0.3,
      filter: 'grayscale(100%)',
      cursor: 'not-allowed',
      pointerEvents: 'none'
    }
  },

  // ============================================================================
  // SELECTION FEEDBACK
  // ============================================================================

  /**
   * Selection states
   */
  selection: {
    /**
     * Selected item highlight
     */
    selected: {
      backgroundColor: `${colors.primary?.[500] || '#3b82f6'}20`,
      borderColor: colors.primary?.[500] || '#3b82f6',
      borderWidth: '2px',
      borderStyle: 'solid'
    },

    /**
     * Multi-select highlight
     */
    multiSelect: {
      backgroundColor: `${colors.secondary?.[500] || '#10b981'}20`,
      borderColor: colors.secondary?.[500] || '#10b981',
      borderWidth: '2px',
      borderStyle: 'dashed'
    },

    /**
     * Focus outline
     */
    focus: {
      outline: `2px solid ${colors.primary?.[500] || '#3b82f6'}`,
      outlineOffset: '2px'
    }
  }
} as const;

/**
 * 📱 TOUCH INTERACTION TOKENS
 * Mobile/touch-specific interaction patterns
 */
export const touchTokens = {
  // ============================================================================
  // TOUCH TARGET SIZING
  // ============================================================================

  /**
   * Touch target sizes
   */
  targetSize: {
    small: { minWidth: '32px', minHeight: '32px' },
    medium: { minWidth: '44px', minHeight: '44px' },
    large: { minWidth: '56px', minHeight: '56px' }
  },

  /**
   * Touch-friendly spacing
   */
  spacing: {
    tight: { padding: '8px' },
    comfortable: { padding: '12px' },
    spacious: { padding: '16px' }
  },

  // ============================================================================
  // GESTURE PATTERNS
  // ============================================================================

  /**
   * Gesture handling
   */
  gestures: {
    /**
     * Pan gesture
     */
    pan: {
      touchAction: 'pan-x pan-y',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      msUserSelect: 'none'
    },

    /**
     * Pinch zoom
     */
    pinchZoom: {
      touchAction: 'pinch-zoom',
      userSelect: 'none'
    },

    /**
     * No gestures
     */
    none: {
      touchAction: 'none',
      userSelect: 'none'
    }
  },

  /**
   * Touch feedback
   */
  feedback: {
    /**
     * Touch ripple effect
     */
    ripple: {
      position: 'relative' as const,
      overflow: 'hidden',
      ':active::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: `${colors.primary?.[500] || '#3b82f6'}20`,
        animation: 'ripple 0.3s ease-out'
      }
    },

    /**
     * Touch highlight
     */
    highlight: {
      WebkitTapHighlightColor: `${colors.primary?.[500] || '#3b82f6'}40`
    }
  }
} as const;

/**
 * 🔧 INTERACTION UTILITIES
 * Helper functions για interaction states
 */
export const interactionUtils = {
  /**
   * Combine cursor and pointer events
   */
  combineInteraction: (cursor: string, pointerEvents: string = 'auto'): React.CSSProperties => ({
    cursor: cursor as any,
    pointerEvents: pointerEvents as any
  }),

  /**
   * Create state-based styles
   */
  statefulStyles: (
    isHover: boolean,
    isActive: boolean,
    isDisabled: boolean,
    isSelected: boolean
  ): React.CSSProperties => {
    let styles: React.CSSProperties = {};

    if (isDisabled) {
      styles = { ...styles, ...feedbackTokens.disabled.grayed };
    } else if (isSelected) {
      styles = { ...styles, ...feedbackTokens.selection.selected };
    } else if (isActive) {
      styles = { ...styles, ...feedbackTokens.active.pressed };
    } else if (isHover) {
      styles = { ...styles, ...feedbackTokens.hover.subtle };
    }

    return styles;
  }
} as const;

/**
 * 📊 CHART ANIMATION TOKENS
 * Animation and interaction patterns για chart elements
 */
export const chartTokens = {
  // ============================================================================
  // CHART ANIMATIONS
  // ============================================================================

  /**
   * Chart element transition animation για SVG elements
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
   */
  chartElementStyle: (
    animated: boolean,
    interactive: boolean,
    duration: 'fast' | 'normal' | 'slow' = 'normal'
  ): React.CSSProperties => ({
    ...chartTokens.chartElementTransition(animated, duration),
    cursor: interactive ? 'pointer' : 'default'
  })
} as const;

/**
 * 🎨 COLOR PICKER INTERACTION TOKENS
 * UI patterns για interactive color pickers and selectors
 */
export const colorPickerTokens = {
  // ============================================================================
  // COLOR AREA PATTERNS
  // ============================================================================

  /**
   * Color picker area container styling
   * Replaces: canvasUtilities.geoInteractive.colorPickerArea(size)
   */
  colorPickerArea: (size: number): React.CSSProperties => ({
    width: `${size}px`,
    height: `${size}px`,
    position: 'relative' as const,
    userSelect: 'none',
    touchAction: 'none'
  }),

  /**
   * Color picker thumb positioning and styling
   * Replaces: canvasUtilities.geoInteractive.colorPickerThumb(thumbPosition, color)
   */
  colorPickerThumb: (
    thumbPosition: { x: number; y: number },
    backgroundColor: string
  ): React.CSSProperties => ({
    left: `${thumbPosition.x}px`,
    top: `${thumbPosition.y}px`,
    backgroundColor,
    border: '2px solid white',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    position: 'absolute' as const,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none' as const
  }),

  /**
   * Color picker area interaction patterns
   */
  colorAreaInteraction: {
    /**
     * Active dragging state
     */
    dragging: {
      cursor: 'grabbing',
      userSelect: 'none'
    },

    /**
     * Hover state
     */
    hover: {
      cursor: 'crosshair'
    },

    /**
     * Focus state
     */
    focus: {
      outline: '2px solid #3b82f6',
      outlineOffset: '2px'
    }
  }
} as const;

/**
 * ✅ TYPE EXPORTS
 */
export type CursorTokens = typeof cursorTokens;
export type PointerTokens = typeof pointerTokens;
export type FeedbackTokens = typeof feedbackTokens;
export type TouchTokens = typeof touchTokens;
export type InteractionUtils = typeof interactionUtils;