/**
 * 🏢 ENTERPRISE DXF Z-INDEX SYSTEM
 *
 * Professional DXF-specific z-index hierarchy που eliminates ALL hardcoded z-index chaos
 * και implements Fortune 500-grade layering architecture για το DXF Viewer system.
 *
 * ✅ Enterprise Standards:
 * - Professional DXF canvas layering hierarchy
 * - Modal and overlay z-index management
 * - Collaboration system positioning
 * - TypeScript strict typing με readonly properties
 * - Zero hardcoded values (999999 elimination!)
 * - Integration με global design-tokens.ts
 * - Semantic layer definitions
 * - Performance-optimized z-index calculations
 */

import { zIndex as globalZIndex } from '../../../styles/design-tokens';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

interface DxfZIndexHierarchy {
  readonly canvas: {
    readonly background: number;
    readonly dxfCanvas: number;
    readonly layerCanvas: number;
    readonly overlayBase: number;
  };
  readonly overlays: {
    readonly selection: number;
    readonly crosshair: number;
    readonly snap: number;
    readonly cursor: number;
    readonly zoom: number;
  };
  readonly ui: {
    readonly collaboration: number;
    readonly toolbar: number;
    readonly sidebar: number;
    readonly notifications: number;
  };
  readonly modals: {
    readonly base: number;
    readonly import: number;
    readonly settings: number;
    readonly help: number;
  };
}

// ============================================================================
// 🎨 ENTERPRISE DXF Z-INDEX HIERARCHY
// ============================================================================

/**
 * 🎯 PROFESSIONAL DXF Z-INDEX HIERARCHY
 * Eliminates 999999 chaos με semantic layer management
 * Based on CAD software standards (AutoCAD, SolidWorks, etc.)
 */
export const dxfZIndex: DxfZIndexHierarchy = {
  /**
   * 🎯 CANVAS LAYERS: Core rendering hierarchy
   * Background (0) → DXF Content (5) → Interactive Layer (10) → Overlays (15+)
   */
  canvas: {
    background: 0,           // Canvas background
    dxfCanvas: 5,           // Main DXF content rendering
    layerCanvas: 10,        // Interactive drawing layer
    overlayBase: 15         // Base for all overlays
  },

  /**
   * 🎯 OVERLAY LAYERS: Interactive elements που float above canvas
   * Selection (20) → Drawing Tools (30) → User Feedback (40+)
   */
  overlays: {
    selection: 20,          // Selection marquee, grips
    crosshair: 30,         // Drawing crosshair
    snap: 35,              // Snap indicators
    cursor: 40,            // Cursor tooltip, coordinates
    zoom: 45               // Zoom window, magnifier
  },

  /**
   * 🎯 UI LAYERS: Application interface elements
   * Uses global design tokens as base + DXF-specific offsets
   */
  ui: {
    collaboration: globalZIndex.docked + 5,    // 15 - Collaboration overlay
    toolbar: globalZIndex.sticky,              // 1100 - Toolbars, panels
    sidebar: globalZIndex.sticky + 10,         // 1110 - Side panels
    notifications: globalZIndex.toast          // 1700 - Status notifications
  },

  /**
   * 🎯 MODAL LAYERS: Dialog and modal management
   * Standard → Import → Settings → Help
   *
   * 🔴 ΤΟ `critical` ΑΦΑΙΡΕΘΗΚΕ (ADR-780 Φάση Β, 2026-08-09) — ήταν **δεύτερος** ρόλος
   * με το ίδιο όνομα: `critical` σήμαινε **1500** εδώ και **2147483647** στην κλίμακα
   * (`design-tokens.json ▸ zIndex`). Ακριβώς το σχήμα που γέννησε το ADR-780 (§2.1:
   * δύο λεξιλόγια, ίδιο όνομα ρόλου, διαφορετικός αριθμός) — και το 1500 ήταν επιπλέον
   * ταυτόσημο με τον ρόλο `popover`, δηλαδή δύο ονόματα για ένα σκαλί.
   * Μετρημένο πριν τη διαγραφή: `criticalModal`, `CRITICAL_MODAL` και
   * `createModalZIndex('critical')` είχαν **ΜΗΔΕΝ** καταναλωτές σε όλο το `src/`.
   */
  modals: {
    base: globalZIndex.modal,              // 1400 - Standard modals
    import: globalZIndex.modal + 10,       // 1410 - DXF import modal
    settings: globalZIndex.modal + 20,     // 1420 - Settings modal
    help: globalZIndex.modal + 30          // 1430 - Help modal
  }
} as const;

// ============================================================================
// 🎯 DYNAMIC Z-INDEX UTILITIES
// ============================================================================

/**
 * 🎯 MODAL Z-INDEX CALCULATOR: Professional modal stacking
 * Eliminates hardcoded 999999 με intelligent modal management
 */
export const createModalZIndex = (
  modalType: 'base' | 'import' | 'settings' | 'help' = 'base',
  stackOffset: number = 0
): number => {
  const baseZIndex = dxfZIndex.modals[modalType];
  return baseZIndex + stackOffset;
};

/**
 * 🎯 OVERLAY Z-INDEX CALCULATOR: Dynamic overlay positioning
 */
export const createOverlayZIndex = (
  overlayType: 'selection' | 'crosshair' | 'snap' | 'cursor' | 'zoom',
  priority: number = 0
): number => {
  const baseZIndex = dxfZIndex.overlays[overlayType];
  return baseZIndex + priority;
};

/**
 * 🎯 CANVAS Z-INDEX CALCULATOR: Canvas layer management
 */
export const createCanvasZIndex = (
  canvasType: 'background' | 'dxfCanvas' | 'layerCanvas',
  layerOffset: number = 0
): number => {
  const baseZIndex = dxfZIndex.canvas[canvasType];
  return baseZIndex + layerOffset;
};

// ============================================================================
// 🎯 PERFORMANCE OPTIMIZATION
// ============================================================================

/**
 * 🎯 Z-INDEX MEMOIZATION: Performance-optimized z-index caching
 */
const zIndexCache = new Map<string, number>();

export const getMemoizedZIndex = (
  componentType: string,
  subType: string = 'default',
  offset: number = 0
): number => {
  const key = `${componentType}-${subType}-${offset}`;

  if (!zIndexCache.has(key)) {
    let baseZIndex: number;

    // Calculate base z-index based on component type
    switch (componentType) {
      case 'modal':
        baseZIndex = dxfZIndex.modals[subType as keyof typeof dxfZIndex.modals] || dxfZIndex.modals.base;
        break;
      case 'overlay':
        baseZIndex = dxfZIndex.overlays[subType as keyof typeof dxfZIndex.overlays] || dxfZIndex.overlays.selection;
        break;
      case 'canvas':
        baseZIndex = dxfZIndex.canvas[subType as keyof typeof dxfZIndex.canvas] || dxfZIndex.canvas.background;
        break;
      case 'ui':
        baseZIndex = dxfZIndex.ui[subType as keyof typeof dxfZIndex.ui] || dxfZIndex.ui.collaboration;
        break;
      default:
        baseZIndex = 0;
    }

    zIndexCache.set(key, baseZIndex + offset);
  }

  return zIndexCache.get(key)!;
};

/**
 * 🎯 CACHE MANAGEMENT: Memory optimization utilities
 */
export const clearDxfZIndexCache = (): void => {
  zIndexCache.clear();
};

export const getDxfZIndexCacheStats = () => ({
  size: zIndexCache.size,
  keys: Array.from(zIndexCache.keys()),
  values: Array.from(zIndexCache.values())
});

// ============================================================================
// 🎯 VALIDATION UTILITIES
// ============================================================================

/**
 * 🎯 Z-INDEX VALIDATION: Development-time validation για z-index consistency
 */
export const validateDxfZIndexHierarchy = (): boolean => {
  const allZIndices = [
    ...Object.values(dxfZIndex.canvas),
    ...Object.values(dxfZIndex.overlays),
    ...Object.values(dxfZIndex.ui),
    ...Object.values(dxfZIndex.modals)
  ].sort((a, b) => a - b);

  // Check for duplicates
  for (let i = 1; i < allZIndices.length; i++) {
    if (allZIndices[i] === allZIndices[i - 1]) {
      console.warn(`Duplicate z-index found: ${allZIndices[i]}`);
      return false;
    }
  }

  // Check for proper hierarchy
  const canvasMax = Math.max(...Object.values(dxfZIndex.canvas));
  const overlayMin = Math.min(...Object.values(dxfZIndex.overlays));

  if (canvasMax >= overlayMin) {
    console.warn('Canvas z-index overlaps with overlay z-index');
    return false;
  }

  return true;
};

/**
 * 🎯 DEBUG INFO: Development utilities για z-index debugging
 */
export const getDxfZIndexInfo = () => ({
  hierarchy: dxfZIndex,
  validation: validateDxfZIndexHierarchy(),
  cacheStats: getDxfZIndexCacheStats(),
  maxZIndex: Math.max(...Object.values(dxfZIndex.modals)),
  layerCount: Object.keys(dxfZIndex).length,
  totalLayers: Object.values(dxfZIndex).reduce((total, group) => total + Object.keys(group).length, 0)
});

// ============================================================================
// 🔒 TYPE EXPORTS - ENTERPRISE TYPE SAFETY
// ============================================================================

export type { DxfZIndexHierarchy };

// ============================================================================
// 🎯 CONSTANTS EXPORT - QUICK ACCESS
// ============================================================================

/**
 * 🎯 QUICK ACCESS CONSTANTS: Common z-index values για immediate use
 */
export const DXF_ZINDEX = {
  // Canvas layers
  DXF_CANVAS: dxfZIndex.canvas.dxfCanvas,
  LAYER_CANVAS: dxfZIndex.canvas.layerCanvas,

  // Common overlays
  COLLABORATION: dxfZIndex.ui.collaboration,
  CROSSHAIR: dxfZIndex.overlays.crosshair,

  // Modals
  IMPORT_MODAL: dxfZIndex.modals.import,
  SETTINGS_MODAL: dxfZIndex.modals.settings
} as const;

/**
 * ✅ Η ΙΕΡΑΡΧΙΑ. Τα **στυλ** των επιφανειών (`dxfComponentStyles`, `dxfOverlayStyles`,
 * `dxfAccessibility`, δυναμικά utilities) ζουν στο αδελφό `DxfSurface.styles.ts` —
 * χωρίστηκαν στο ADR-780 Φάση Β όταν το ενιαίο αρχείο έφτασε τις 600 γραμμές (N.7.1).
 *
 * ΤΙ ΑΠΑΝΤΑ ΕΔΩ: «ποιο κάθεται πάνω από ποιο», παραγόμενο από το SSoT
 * (`design-tokens.json ▸ zIndex` → `zIndexScale` → `globalZIndex`).
 * ⚠️ Κάτω από το 1000 οι αριθμοί είναι **τοπική** στοίβαξη μέσα στο δοχείο του canvas —
 * δεν είναι καθολικό στρώμα και γι' αυτό δεν ζητούν ρόλο (CHECK 3.50, `local-stacking`).
 */