/**
 * 🗺️ MAP COMPONENT TOKENS
 * Enterprise Design System - Map & Geographic Components Layer
 *
 * @description Centralized map interface tokens για polygon drawing,
 * geographic interfaces, markers κτλ.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-16
 * @version 2.0.0 - Enterprise Consolidation
 */

import { statusSemanticColors } from '../semantic/alert-tokens';

// ============================================================================
// MAP CONTAINER TOKENS
// ============================================================================

export const mapContainerTokens = {
  base: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#F9FAFB',           // bg-gray-50
    overflow: 'hidden'
  },

  fullscreen: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998
  },

  interactiveMap: {
    width: '100%',
    height: '100%'
  }
} as const;

// ============================================================================
// MAP HEADER TOKENS
// ============================================================================

export const mapHeaderTokens = {
  base: {
    padding: '1rem',                      // p-4
    backgroundColor: '#1F2937',           // bg-gray-800
    color: '#F9FAFB',                     // text-gray-50
    display: 'flex',
    gap: '1rem',                          // gap-4
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    borderBottom: '1px solid #374151'     // border-b border-gray-700
  },

  title: {
    margin: '0',
    color: '#60A5FA',                     // text-blue-400
    fontSize: '1.5rem',                   // text-2xl
    fontWeight: '600'                     // font-semibold
  },

  subtitle: {
    margin: '0',
    color: '#D1D5DB',                     // text-gray-300
    fontSize: '0.875rem'                  // text-sm
  }
} as const;

// ============================================================================
// MAP CONTROL SECTION TOKENS
// ============================================================================

export const mapControlSectionTokens = {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'                         // gap-2
  },

  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',                        // gap-2
    fontSize: '0.875rem',                 // text-sm
    color: '#F9FAFB',                     // text-gray-50
    fontWeight: '500'                     // font-medium
  },

  select: {
    padding: '0.25rem 0.5rem',            // py-1 px-2
    backgroundColor: '#374151',           // bg-gray-700
    color: '#F9FAFB',                     // text-gray-50
    border: '1px solid #4B5563',          // border-gray-600
    borderRadius: '0.25rem',              // rounded
    fontSize: '0.875rem',                 // text-sm
    transition: 'all 150ms ease',

    focus: {
      outline: 'none',
      borderColor: '#3B82F6',             // focus:border-blue-500
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)' // focus:ring-blue-500/10
    }
  }
} as const;

// ============================================================================
// MAP BUTTON TOKENS
// ============================================================================

export const mapButtonTokens = {
  base: {
    padding: '0.25rem 0.75rem',           // py-1 px-3
    borderRadius: '0.25rem',              // rounded
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',                 // text-sm
    fontWeight: '500',                    // font-medium
    transition: 'all 150ms ease',
    outline: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  variants: {
    primary: {
      backgroundColor: '#3B82F6',         // bg-blue-500
      color: '#F9FAFB',                   // text-gray-50

      hover: {
        backgroundColor: '#2563EB'        // hover:bg-blue-600
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)' // focus:ring-blue-500/30
      }
    },

    secondary: {
      backgroundColor: '#4B5563',         // bg-gray-600
      color: '#F9FAFB',                   // text-gray-50

      hover: {
        backgroundColor: '#6B7280'        // hover:bg-gray-500
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(107, 114, 128, 0.3)' // focus:ring-gray-500/30
      }
    },

    danger: {
      backgroundColor: '#EF4444',         // bg-red-500
      color: '#F9FAFB',                   // text-gray-50

      hover: {
        backgroundColor: '#DC2626'        // hover:bg-red-600
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)' // focus:ring-red-500/30
      }
    },

    dangerSmall: {
      backgroundColor: '#EF4444',         // bg-red-500
      color: '#F9FAFB',                   // text-gray-50
      fontSize: '0.75rem',                // text-xs
      padding: '0.125rem 0.5rem',         // py-0.5 px-2

      hover: {
        backgroundColor: '#DC2626'        // hover:bg-red-600
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.3)' // focus:ring-red-500/30
      }
    },

    dangerDisabled: {
      backgroundColor: '#EF4444',         // bg-red-500
      color: '#F9FAFB',                   // text-gray-50
      opacity: 0.5,
      cursor: 'not-allowed'
    },

    secondarySmall: {
      backgroundColor: '#4B5563',         // bg-gray-600
      color: '#F9FAFB',                   // text-gray-50
      fontSize: '0.75rem',                // text-xs
      padding: '0.125rem 0.5rem',         // py-0.5 px-2

      hover: {
        backgroundColor: '#6B7280'        // hover:bg-gray-500
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(107, 114, 128, 0.3)' // focus:ring-gray-500/30
      }
    },

    success: {
      backgroundColor: '#22C55E',         // bg-green-500
      color: '#F9FAFB',                   // text-gray-50

      hover: {
        backgroundColor: '#16A34A'        // hover:bg-green-600
      },

      focus: {
        boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.3)' // focus:ring-green-500/30
      }
    }
  }
} as const;

// ============================================================================
// MAP SIDEBAR TOKENS
// ============================================================================

export const mapSidebarTokens = {
  base: {
    position: 'absolute' as const,
    top: '1rem',                          // top-4
    right: '1rem',                        // right-4
    width: '320px',
    maxHeight: 'calc(100% - 32px)',
    backgroundColor: '#FFFFFF',           // bg-white
    border: '1px solid #E5E7EB',          // border-gray-200
    borderRadius: '0.5rem',               // rounded-lg
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // shadow-lg
    zIndex: 10,
    overflow: 'hidden'
  },

  header: {
    backgroundColor: '#F9FAFB',           // bg-gray-50
    padding: '1rem',                      // p-4
    borderBottom: '1px solid #E5E7EB'     // border-b border-gray-200
  },

  title: {
    margin: '0',
    fontSize: '1.125rem',                 // text-lg
    fontWeight: '600',                    // font-semibold
    color: '#111827'                      // text-gray-900
  },

  content: {
    padding: '1rem',                      // p-4
    maxHeight: '400px',
    overflowY: 'auto' as const
  },

  emptyState: {
    color: '#6B7280',                     // text-gray-500
    fontSize: '0.875rem',                 // text-sm
    textAlign: 'center' as const,
    margin: 0,
    padding: '2rem 1rem',                 // py-8 px-4
    fontStyle: 'italic' as const
  }
} as const;

// ============================================================================
// POLYGON LIST TOKENS
// ============================================================================

export const polygonListTokens = {
  item: {
    padding: '0.75rem',                   // p-3
    marginBottom: '0.5rem',               // mb-2
    backgroundColor: '#F9FAFB',           // bg-gray-50
    border: '1px solid #D1D5DB',          // border-gray-300
    borderRadius: '0.25rem',              // rounded
    cursor: 'pointer',
    transition: 'all 150ms ease',

    hover: {
      backgroundColor: '#F3F4F6',         // hover:bg-gray-100
      borderColor: '#93C5FD'              // hover:border-blue-300
    },

    selected: {
      backgroundColor: '#EFF6FF',         // bg-blue-50
      borderColor: '#3B82F6'              // border-blue-500
    }
  },

  title: {
    fontWeight: '500',                    // font-medium
    fontSize: '0.875rem',                 // text-sm
    color: '#111827',                     // text-gray-900
    marginBottom: '0.25rem'               // mb-1
  },

  metadata: {
    fontSize: '0.75rem',                  // text-xs
    color: '#6B7280',                     // text-gray-500
    marginBottom: '0.25rem'               // mb-1
  },

  timestamp: {
    fontSize: '0.75rem',                  // text-xs
    color: '#9CA3AF'                      // text-gray-400
  },

  actions: {
    display: 'flex',
    gap: '0.5rem',                        // gap-2
    marginTop: '0.5rem'                   // mt-2
  }
} as const;

// ============================================================================
// MAP DRAWING TOOLS TOKENS
// ============================================================================

export const mapDrawingToolsTokens = {
  toolbar: {
    position: 'absolute' as const,
    top: '1rem',                          // top-4
    left: '1rem',                         // left-4
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',                        // gap-2
    backgroundColor: '#FFFFFF',           // bg-white
    padding: '0.75rem',                   // p-3
    borderRadius: '0.5rem',               // rounded-lg
    border: '1px solid #E5E7EB',          // border-gray-200
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // shadow-md
    zIndex: 10
  },

  toolButton: {
    width: '2.5rem',                      // w-10
    height: '2.5rem',                     // h-10
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',           // bg-gray-50
    border: '1px solid #D1D5DB',          // border-gray-300
    borderRadius: '0.375rem',             // rounded-md
    cursor: 'pointer',
    transition: 'all 150ms ease',
    fontSize: '1rem',                     // text-base

    hover: {
      backgroundColor: '#F3F4F6'          // hover:bg-gray-100
    },

    active: {
      backgroundColor: '#3B82F6',         // bg-blue-500
      color: '#FFFFFF',                   // text-white
      borderColor: '#2563EB'              // border-blue-600
    },

    disabled: {
      backgroundColor: '#F9FAFB',         // bg-gray-50
      color: '#D1D5DB',                   // text-gray-300
      cursor: 'not-allowed',
      opacity: 0.5
    }
  }
} as const;

// ============================================================================
// MAP COORDINATE DISPLAY TOKENS
// ============================================================================

export const mapCoordinateTokens = {
  container: {
    position: 'absolute' as const,
    bottom: '1rem',                       // bottom-4
    left: '1rem',                         // left-4
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // bg-black/80
    color: '#FFFFFF',                     // text-white
    padding: '0.5rem 0.75rem',            // py-2 px-3
    borderRadius: '0.25rem',              // rounded
    fontSize: '0.75rem',                  // text-xs
    fontFamily: 'monospace',
    zIndex: 10
  },

  label: {
    opacity: 0.8,
    marginRight: '0.5rem'                 // mr-2
  },

  value: {
    fontWeight: '600'                     // font-semibold
  }
} as const;

// ============================================================================
// MAP ZOOM CONTROLS TOKENS
// ============================================================================

export const mapZoomControlsTokens = {
  container: {
    position: 'absolute' as const,
    bottom: '1rem',                       // bottom-4
    right: '1rem',                        // right-4
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',                       // gap-1
    zIndex: 10
  },

  button: {
    width: '2.5rem',                      // w-10
    height: '2.5rem',                     // h-10
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',           // bg-white
    border: '1px solid #D1D5DB',          // border-gray-300
    borderRadius: '0.375rem',             // rounded-md
    cursor: 'pointer',
    transition: 'all 150ms ease',
    fontSize: '1.125rem',                 // text-lg
    fontWeight: '600',                    // font-semibold
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', // shadow-sm

    hover: {
      backgroundColor: '#F9FAFB',         // hover:bg-gray-50
      borderColor: '#9CA3AF'              // hover:border-gray-400
    },

    active: {
      transform: 'scale(0.95)'
    }
  }
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// ============================================================================
// CONTROL POINT TOKENS
// ============================================================================

export const mapControlPointTokens = {
  // Base control point states
  states: {
    default: {
      classes: 'w-4 h-4 bg-red-500 border-red-300 cursor-pointer',
      zIndex: 1000,
      pointerEvents: 'auto' as const,
      cursor: 'pointer' as const
    },

    active: {
      classes: 'w-5 h-5 bg-blue-500 border-blue-300 scale-125 cursor-pointer',
      zIndex: 1100,
      pointerEvents: 'auto' as const,
      cursor: 'pointer' as const
    },

    highlight: {
      classes: 'w-8 h-8 bg-green-400 border-green-200 scale-125 animate-bounce shadow-lg shadow-green-500/50 cursor-pointer',
      zIndex: 1200,
      pointerEvents: 'auto' as const,
      cursor: 'pointer' as const
    },

    completed: {
      classes: 'w-4 h-4 bg-gray-400 border-gray-300 cursor-default',
      zIndex: 1000,
      pointerEvents: 'none' as const,
      cursor: 'default' as const
    }
  },

  // Dynamic style function
  getControlPointStyle: (
    isActive: boolean,
    shouldHighlight: boolean,
    isCompleted: boolean
  ) => {
    if (isCompleted) return mapControlPointTokens.states.completed;
    if (isActive) return mapControlPointTokens.states.active;
    if (shouldHighlight) return mapControlPointTokens.states.highlight;
    return mapControlPointTokens.states.default;
  }
} as const;

// ============================================================================
// MAP INTERACTION TOKENS
// ============================================================================

export const mapInteractionTokens = {
  // Map cursor states
  cursors: {
    default: 'default',
    picking: 'crosshair',
    drawing: 'crosshair',
    dragging: 'grabbing',
    disabled: 'wait'
  },

  // Map container dimensions
  containers: {
    fullscreen: {
      width: '100%',
      height: '100%',
      display: 'block' as const,
      position: 'relative' as const
    }
  },

  // Dynamic cursor function
  getMapCursor: (
    isPickingCoordinates: boolean,
    systemIsDrawing: boolean
  ): string => {
    if (isPickingCoordinates || systemIsDrawing) return 'crosshair';
    return 'default';
  }
} as const;

// ============================================================================
// OVERLAY TOKENS
// ============================================================================

export const mapOverlayTokens = {
  polygonDrawing: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 500,
    pointerEvents: 'none' as const,
    backgroundColor: 'transparent'
  },

  selectionOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 600,
    pointerEvents: 'auto' as const,
    backgroundColor: 'rgba(0, 0, 0, 0.05)'
  }
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates complete button style by combining base + variant
 */
export const getMapButtonStyle = (variant: keyof typeof mapButtonTokens.variants) => ({
  ...mapButtonTokens.base,
  ...mapButtonTokens.variants[variant]
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MapButtonVariant = keyof typeof mapButtonTokens.variants;
export type ControlPointState = keyof typeof mapControlPointTokens.states;
export type MapCursorState = keyof typeof mapInteractionTokens.cursors;