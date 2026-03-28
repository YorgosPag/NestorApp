/**
 * 🏢 ENTERPRISE: Portal & Overlay Module
 * Extracted from design-tokens.ts for modular architecture
 *
 * Contains: portalComponentsBase (private), portalComponentsExtended, portalComponents,
 *           svgUtilities, interactionUtilities, photoPreviewComponents, photoPreviewLayout
 */

import { colors } from './foundations';
import { borderRadius } from './borders';
import { zIndex } from './layout';

// Base portal components (kept for compatibility)
// 🏢 ENTERPRISE: Portal components with centralized z-index
const portalComponentsBase = {
  overlay: {
    fullscreen: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none' as const,
    },
    backdrop: (zIndexValue: number = zIndex.dropdown) => ({
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: zIndexValue,
      pointerEvents: 'auto' as const,
    }),
  },

  dropdown: {
    absolute: (top: number, left: number, width: number, height?: number | string) => ({
      position: 'absolute' as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: height ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
      pointerEvents: 'auto' as const,
    }),
    custom: (config: {
      top: number;
      left: number;
      width: number;
      height?: number | string;
      minHeight?: string;
      maxHeight?: string
    }) => ({
      position: 'absolute' as const,
      top: `${config.top}px`,
      left: `${config.left}px`,
      width: `${config.width}px`,
      height: config.height ? (typeof config.height === 'number' ? `${config.height}px` : config.height) : 'auto',
      minHeight: config.minHeight || undefined,
      maxHeight: config.maxHeight || undefined,
      pointerEvents: 'auto' as const,
    }),
  },

  // 🏢 ENTERPRISE: Modal z-index uses centralized values
  modal: {
    backdrop: {
      zIndex: (customZIndex?: number) => customZIndex || zIndex.modal,
    },
    content: {
      zIndex: (customZIndex?: number) => (customZIndex || zIndex.modal) + 1,
    },
  },

  // 🏢 ENTERPRISE: Reference to centralized zIndex (no duplicates!)
  // All values come from the main zIndex object defined at line ~382
  // Property name kept as 'zIndex' for backward compatibility
  zIndex
} as const;

// 🏢 ENTERPRISE: Extended portal components with centralized z-index hierarchy
// All values derived from centralized zIndex object (ADR-002)
export const portalComponentsExtended = {
  ...portalComponentsBase,
  // 🏢 ENTERPRISE: Extended dropdown variants for EnterprisePortalSystem
  dropdown: {
    ...portalComponentsBase.dropdown,
    // Base positioned dropdown style - used as default for all variants
    positioned: {
      position: 'fixed' as const,
      zIndex: zIndex.dropdown,
      backgroundColor: colors.background.primary,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      border: `1px solid ${colors.border.primary}`,
      overflow: 'hidden',
    },
    // Relationship dropdown variant (for relationship/entity selectors)
    relationship: {
      maxHeight: '300px',
      overflowY: 'auto' as const,
    },
    // Generic selector variant (for form selects, filters)
    selector: {
      minWidth: '200px',
      maxHeight: '400px',
      overflowY: 'auto' as const,
    },
  },
  overlay: {
    ...portalComponentsBase.overlay,
    // CAD Overlay Hierarchy: Uses zIndex.overlay (1300) as base, with +50 increments
    base: { zIndex: () => zIndex.overlay },                    // 1300
    fullscreen: { zIndex: () => zIndex.modal },                // 1400
    crosshair: { zIndex: () => zIndex.modal + 50 },            // 1450
    selection: { zIndex: () => zIndex.modal + 60 },            // 1460
    tooltip: { zIndex: () => zIndex.modal + 70 },              // 1470
    snap: { zIndex: () => zIndex.modal + 80 },                 // 1480
    search: { zIndex: () => zIndex.modal + 90 },               // 1490
    searchResults: { zIndex: () => zIndex.popover },           // 1500
    controls: { zIndex: () => zIndex.popover + 10 },           // 1510
    zoom: { zIndex: () => zIndex.popover + 20 },               // 1520
    calibration: { zIndex: () => zIndex.popover + 30 },        // 1530
    // ✅ ENTERPRISE FIX: Debug overlays above calibration
    debug: {
      zIndex: () => zIndex.popover + 40,                       // 1540
      info: { zIndex: () => zIndex.popover + 41 },             // 1541
      main: { zIndex: () => zIndex.popover + 42 },             // 1542
      controls: { zIndex: () => zIndex.popover + 43 }          // 1543
    },
    floatingPanel: { zIndex: () => zIndex.popover + 50 }       // 1550
  },
  canvas: {
    fullscreen: { zIndex: () => zIndex.modal },                // 1400
    layers: {
      dxf: { zIndex: () => zIndex.banner },                    // 1200
      layer: { zIndex: () => zIndex.banner + 10 }              // 1210
    }
  },
  // 🏢 ENTERPRISE: Positioning utilities for dropdown/portal placement
  positioning: {
    dropdownOffset: { top: 4, left: 0, bottom: 4 },
    tooltipOffset: { top: 8, left: 0, bottom: 8 },
    modalOffset: { top: 0, left: 0, bottom: 0 }
  }
};

/**
 * SVG Utilities για Canvas & Graphics Rendering
 * Enterprise-class SVG styling με text effects και shape patterns
 */
export const svgUtilities = {
  text: {
    withStroke: (strokeColor: string = 'white', strokeWidth: number = 4) => ({
      paintOrder: 'stroke' as const,
      stroke: strokeColor,
      strokeWidth: `${strokeWidth}px`,
      strokeLinejoin: 'round' as const,
    }),
    outlined: (strokeColor: string = 'white', strokeWidth: number = 2) => ({
      paintOrder: 'stroke' as const,
      stroke: strokeColor,
      strokeWidth: `${strokeWidth}px`,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    }),
  },

  shapes: {
    backgroundRect: (color: string, opacity: number = 1) => ({
      fill: color,
      opacity,
      pointerEvents: 'none' as const,
    }),
  },
} as const;

/**
 * Interaction Utilities για User Input & Selection Control
 * Enterprise-class interaction management με cross-browser compatibility
 */
export const interactionUtilities = {
  pointerEvents: {
    none: { pointerEvents: 'none' as const },
    auto: { pointerEvents: 'auto' as const },
    all: { pointerEvents: 'all' as const },
  },

  userSelect: {
    none: {
      userSelect: 'none' as const,
      WebkitUserSelect: 'none' as const,
      MozUserSelect: 'none' as const,
      msUserSelect: 'none' as const,
    },
    text: { userSelect: 'text' as const },
    all: { userSelect: 'all' as const },
  },

  // Combined interaction patterns για common use cases
  nonInteractive: {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    MozUserSelect: 'none' as const,
    msUserSelect: 'none' as const,
  },

  overlay: {
    position: 'absolute' as const,
    pointerEvents: 'auto' as const,
    userSelect: 'text' as const,
  },
} as const;

/**
 * 🏢 ENTERPRISE PHOTO PREVIEW COMPONENTS
 * Centralized styling for photo preview states
 */
export const photoPreviewComponents = {
  container: {
    base: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.lg,
      overflow: 'hidden' as const,
      transition: 'all 0.2s ease-in-out'
    },
    uploading: {
      opacity: 0.7,
      cursor: 'wait'
    },
    error: {
      borderColor: colors.error['500'],
      backgroundColor: colors.error['50']
    },
    withPhoto: {
      border: `2px solid ${colors.primary['500']}`,
      backgroundColor: colors.background.primary
    },
    empty: {
      border: `2px dashed ${colors.border.primary}`,
      backgroundColor: colors.background.secondary
    }
  },
  colors: {
    emptyStateBackground: colors.background.secondary,
    emptyStateBorder: colors.border.primary,
    withPhotoBorder: colors.primary['500'],
    // 🏢 ENTERPRISE: Additional colors for migration-utilities (2026-01-19)
    uploadingBackground: '#f8fafc', // Slate-50 - uploading state
    errorBackground: colors.error['50'] // Error state background
  }
} as const;

export const photoPreviewLayout = {
  dialog: {
    // 🔧 FIX: Override DialogContent's default translate-x-[-50%] translate-y-[-50%] centering
    // and its slide-in/out animations — fullscreen dialogs position via inset-0 instead.
    mobile: 'fixed inset-x-0 top-[env(safe-area-inset-top)] bottom-[env(safe-area-inset-bottom)] max-w-none w-screen rounded-none border-0 h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] pb-[max(env(safe-area-inset-bottom),5rem)] !translate-x-0 !translate-y-0 !left-0 !top-auto !slide-in-from-left-0 !slide-in-from-top-0',
    desktop: 'fixed inset-0 max-w-none w-screen h-screen rounded-none border-0 !translate-x-0 !translate-y-0 !left-0 !top-0'
  },
  image: {
    base: 'max-w-full max-h-full object-contain'
  }
} as const;

/**
 * 🏢 ENTERPRISE PORTAL COMPONENTS - MAIN EXPORT
 * Export extended portal components as main portalComponents για backward compatibility
 * This ensures that CoordinateCalibrationOverlay can access calibration.zIndex()
 */
export const portalComponents = portalComponentsExtended;
