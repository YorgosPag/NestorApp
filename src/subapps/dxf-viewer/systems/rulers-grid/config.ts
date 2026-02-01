/**
 * RULERS/GRID SYSTEM CONFIGURATION
 * Single Source of Truth για rulers και grid systems
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';

// Re-export για συμβατότητα με existing imports
export type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

export interface BoundingBox {
  min: Point2D;
  max: Point2D;
}

// ===== BASIC TYPES =====
export interface RulerSettings {
  horizontal: {
    enabled: boolean;
    height: number;
    position: 'top' | 'bottom';
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontFamily: string;
    unitsFontSize: number;  // New property for units font size
    precision: number;
    showZero: boolean;
    showMinorTicks: boolean;
    showMajorTicks: boolean;  // New property for major ticks visibility
    minorTickLength: number;
    majorTickLength: number;
    tickColor: string;
    majorTickColor: string;   // New property for major ticks color  
    minorTickColor: string;   // New property for minor ticks color
    textColor: string;
    unitsColor: string;  // New property for units text color
    showLabels: boolean; // New property to control text visibility
    showUnits: boolean;  // New property to control units in labels
    showBackground: boolean;  // New property to control background visibility
  };
  vertical: {
    enabled: boolean;
    width: number;
    position: 'left' | 'right';
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontFamily: string;
    unitsFontSize: number;  // New property for units font size
    precision: number;
    showZero: boolean;
    showMinorTicks: boolean;
    showMajorTicks: boolean;  // New property for major ticks visibility
    minorTickLength: number;
    majorTickLength: number;
    tickColor: string;
    majorTickColor: string;   // New property for major ticks color  
    minorTickColor: string;   // New property for minor ticks color
    textColor: string;
    unitsColor: string;  // New property for units text color
    showLabels: boolean; // New property to control text visibility
    showUnits: boolean;  // New property to control units in labels
    showBackground: boolean;  // New property to control background visibility
  };
  units: 'mm' | 'cm' | 'm' | 'inches' | 'feet';
  snap: {
    enabled: boolean;
    tolerance: number;
  };
}

export interface GridSettings {
  visual: {
    enabled: boolean;
    step: number;
    opacity: number;
    color: string;
    style?: 'lines' | 'dots' | 'crosses'; // ✅ NEW: Grid rendering style
    subDivisions: number;
    showOrigin: boolean;
    showAxes: boolean;
    axesColor: string;
    axesWeight: number;
    majorGridColor: string;
    minorGridColor: string;
    majorGridWeight: number;
    minorGridWeight: number;
  };
  snap: {
    enabled: boolean;
    step: number;
    tolerance: number;
    showIndicators: boolean;
    indicatorColor: string;
    indicatorSize: number;
  };
  behavior: {
    autoZoomGrid: boolean;
    minGridSpacing: number;
    maxGridSpacing: number;
    adaptiveGrid: boolean;
    fadeAtDistance: boolean;
    fadeThreshold: number;
  };
}

export interface RulersGridState {
  rulers: RulerSettings;
  grid: GridSettings;
  origin: Point2D;
  isVisible: boolean;
  rulerSnapPoints: Point2D[];
  gridSnapPoints: Point2D[];
  lastCalculatedBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null;
}

// ===== DEFAULT SETTINGS =====
export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  horizontal: {
    enabled: false,  // 🔧 FIX: Start disabled to prevent race condition with localStorage
    height: 30,
    position: 'top',
    color: UI_COLORS.RULER_NEUTRAL_GRAY, // Ουδέτερο γκρι
    backgroundColor: 'hsl(var(--background) / 0.8)', // ✅ ENTERPRISE: CSS variable (adapts to dark mode)
    fontSize: 10,
    fontFamily: 'Arial, sans-serif',
    unitsFontSize: 10,  // Same as fontSize by default
    precision: 1,
    showZero: true,
    showMinorTicks: true,
    showMajorTicks: true,  // Default: show major ticks
    minorTickLength: 5,
    majorTickLength: 10,
    tickColor: UI_COLORS.RULER_DARK_GRAY,
    majorTickColor: UI_COLORS.RULER_DARK_GRAY,  // Default: same color as tickColor
    minorTickColor: UI_COLORS.RULER_LIGHT_GRAY,  // Default: lighter color for minor ticks
    textColor: UI_COLORS.RULER_TEXT_GRAY,
    unitsColor: UI_COLORS.RULER_TEXT_GRAY,  // Default: same color as textColor
    showLabels: true,  // Default: show labels
    showUnits: true,   // Default: show units in labels
    showBackground: true  // Default: show background
  },
  vertical: {
    enabled: false,  // 🔧 FIX: Start disabled to prevent race condition with localStorage
    width: 30,
    position: 'left',
    color: UI_COLORS.RULER_NEUTRAL_GRAY, // Ουδέτερο γκρι
    backgroundColor: 'hsl(var(--background) / 0.8)', // ✅ ENTERPRISE: CSS variable (adapts to dark mode)
    fontSize: 10,
    fontFamily: 'Arial, sans-serif',
    unitsFontSize: 10,  // Same as fontSize by default
    precision: 1,
    showZero: true,
    showMinorTicks: true,
    showMajorTicks: true,  // Default: show major ticks
    minorTickLength: 5,
    majorTickLength: 10,
    tickColor: UI_COLORS.RULER_DARK_GRAY,
    majorTickColor: UI_COLORS.RULER_DARK_GRAY,  // Default: same color as tickColor
    minorTickColor: UI_COLORS.RULER_LIGHT_GRAY,  // Default: lighter color for minor ticks
    textColor: UI_COLORS.RULER_TEXT_GRAY,
    unitsColor: UI_COLORS.RULER_TEXT_GRAY,  // Default: same color as textColor
    showLabels: true,  // Default: show labels
    showUnits: true,   // Default: show units in labels
    showBackground: true  // Default: show background
  },
  units: 'mm',
  // 🏢 ADR-105: Use centralized fallback tolerance
  snap: {
    enabled: false,
    tolerance: TOLERANCE_CONFIG.HIT_TEST_FALLBACK
  }
};

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  visual: {
    enabled: true,
    step: 10,
    opacity: 0.6,
    color: UI_COLORS.GRID_BLUE, // Μπλε για καλύτερη ορατότητα
    style: 'lines', // ✅ NEW: Default grid style (lines/dots/crosses)
    subDivisions: 5, // 🏢 ADR-110: Canonical value defined in RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS
    showOrigin: true,
    showAxes: true,
    axesColor: UI_COLORS.RULER_DARK_GRAY, // Σκουρότερο γκρι για τους άξονες
    axesWeight: 2,
    majorGridColor: UI_COLORS.GRID_MAJOR, // Γκρι για τις κύριες γραμμές
    minorGridColor: UI_COLORS.GRID_MINOR, // Ανοιχτότερο γκρι για τις δευτερεύουσες γραμμές
    majorGridWeight: 1,
    minorGridWeight: 0.5
  },
  snap: {
    enabled: false,
    step: 10,
    tolerance: 12,
    showIndicators: true,
    indicatorColor: UI_COLORS.INDICATOR_BLUE, // Μπλε για τα indicators
    indicatorSize: 4
  },
  behavior: {
    autoZoomGrid: true,
    minGridSpacing: 5,
    maxGridSpacing: 100,
    adaptiveGrid: true,
    fadeAtDistance: true,
    fadeThreshold: 0.1
  }
};

// ===== CONSTANTS =====
export const RULERS_GRID_CONFIG = {
  // Ruler constants
  MIN_RULER_HEIGHT: 20,
  MAX_RULER_HEIGHT: 60,
  MIN_RULER_WIDTH: 20,
  MAX_RULER_WIDTH: 60,
  DEFAULT_TICK_SPACING: 10,
  MIN_TICK_SPACING: 5,
  MAX_TICK_SPACING: 100,
  RULER_PADDING: 5,
  
  // Grid constants
  MIN_GRID_STEP: 0.1,
  MAX_GRID_STEP: 1000,
  DEFAULT_GRID_STEP: 10,
  DEFAULT_SUBDIVISIONS: 5, // 🏢 ADR-110: Centralized grid subdivisions fallback
  MIN_OPACITY: 0.05,
  MAX_OPACITY: 1.0,
  DEFAULT_OPACITY: 0.3,
  
  // Snap constants
  DEFAULT_SNAP_TOLERANCE: 10,
  MIN_SNAP_TOLERANCE: 1,
  MAX_SNAP_TOLERANCE: 50,
  
  // Unit conversion factors (to mm)
  UNIT_CONVERSIONS: {
    mm: 1,
    cm: 10,
    m: 1000,
    inches: 25.4,
    feet: 304.8
  } as const,
  
  // Performance thresholds
  MAX_GRID_LINES: 1000,
  MAX_RULER_TICKS: 1000, // Αύξηση από 500 σε 1000 για περισσότερα ticks
  RENDER_THROTTLE_MS: 16
} as const;

// ===== TYPE EXPORTS =====
export type UnitType = keyof typeof RULERS_GRID_CONFIG.UNIT_CONVERSIONS;
export type RulerPosition = 'top' | 'bottom' | 'left' | 'right';

// ===== GRID CALCULATION INTERFACES =====
export interface GridLine {
  type: 'major' | 'minor' | 'axis';
  position: number;
  orientation: 'horizontal' | 'vertical';
  opacity: number;
  weight: number;
  color: string;
}

export interface RulerTick {
  position: number;
  type: 'major' | 'minor';
  length: number;
  label?: string;
  value: number;
}

export interface GridBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  gridStep: number;
  subStep: number;
}

export interface SnapResult {
  point: Point2D;
  type: 'grid' | 'ruler' | 'axis' | 'origin';
  distance: number;
  direction?: 'horizontal' | 'vertical';
}

// ===== RULERS GRID OPERATIONS =====
export type RulersGridOperation =
  | 'toggle-rulers'
  | 'toggle-grid'
  | 'set-grid-step'
  | 'set-ruler-units'
  | 'reset-origin'
  | 'toggle-snap'
  | 'toggle-ruler-snap'
  | 'toggle-grid-snap'
  | 'auto-fit-grid'
  | 'export-settings'
  | 'import-settings';

export interface RulersGridOperationResult {
  success: boolean;
  operation: RulersGridOperation;
  error?: string;
  data?: Record<string, unknown>;
}

// ===== LAYOUT INFORMATION =====
export interface RulersLayoutInfo {
  horizontalRulerRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  verticalRulerRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cornerRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  contentRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ===== PERFORMANCE TRACKING =====
export interface RenderPerformance {
  lastRenderTime: number;
  averageRenderTime: number;
  gridLinesRendered: number;
  rulerTicksRendered: number;
  frameSkipped: boolean;
}

// ===== SETTINGS VALIDATION =====
export interface SettingsValidation {
  rulers: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  grid: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ===== UTILITY TYPE FOR SETTINGS UPDATES =====
export type RulerSettingsUpdate = {
  [K in keyof RulerSettings]?: K extends 'horizontal' | 'vertical' 
    ? Partial<RulerSettings[K]>
    : RulerSettings[K];
};

export type GridSettingsUpdate = {
  [K in keyof GridSettings]?: K extends 'visual' | 'snap' | 'behavior'
    ? Partial<GridSettings[K]>
    : GridSettings[K];
};

// ===== REMOVED DUPLICATE: COORDINATE_LAYOUT =====
// ✅ ΔΙΟΡΘΩΣΗ ΔΙΠΛΟΤΥΠΟΥ: Use COORDINATE_LAYOUT from rendering/core/CoordinateTransforms.ts
// This is the Single Source of Truth for coordinate layout constants

// Import from the correct location
import { COORDINATE_LAYOUT as CORE_COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';

// Re-export for compatibility (deprecated - please import directly from CoordinateTransforms)
/** @deprecated Import COORDINATE_LAYOUT from rendering/core/CoordinateTransforms.ts instead */
export const COORDINATE_LAYOUT = CORE_COORDINATE_LAYOUT;

/** @deprecated Import RULER_SIZE from rendering/core/CoordinateTransforms.ts instead */
export const RULER_SIZE = CORE_COORDINATE_LAYOUT.RULER_LEFT_WIDTH;

/** @deprecated Import MARGINS from rendering/core/CoordinateTransforms.ts instead */
export const MARGINS = CORE_COORDINATE_LAYOUT.MARGINS;