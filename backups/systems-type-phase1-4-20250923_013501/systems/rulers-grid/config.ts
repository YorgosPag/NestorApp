/**
 * RULERS/GRID SYSTEM CONFIGURATION
 * Single Source of Truth για rulers και grid systems
 */

import type { Point2D } from '../../types/shared';

// ===== BASIC TYPES MOVED FROM COORDINATES =====
export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CanvasRect {
  width: number;
  height: number;
}

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
    enabled: true,
    height: 30,
    position: 'top',
    color: '#f0f0f0', // Ουδέτερο γκρι
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontFamily: 'Arial, sans-serif',
    unitsFontSize: 10,  // Same as fontSize by default
    precision: 1,
    showZero: true,
    showMinorTicks: true,
    showMajorTicks: true,  // Default: show major ticks
    minorTickLength: 5,
    majorTickLength: 10,
    tickColor: '#666666',
    majorTickColor: '#666666',  // Default: same color as tickColor
    minorTickColor: '#999999',  // Default: lighter color for minor ticks
    textColor: '#333333',
    unitsColor: '#333333',  // Default: same color as textColor
    showLabels: true,  // Default: show labels
    showUnits: true,   // Default: show units in labels
    showBackground: true  // Default: show background
  },
  vertical: {
    enabled: true,
    width: 30,
    position: 'left',
    color: '#f0f0f0', // Ουδέτερο γκρι
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontFamily: 'Arial, sans-serif',
    unitsFontSize: 10,  // Same as fontSize by default
    precision: 1,
    showZero: true,
    showMinorTicks: true,
    showMajorTicks: true,  // Default: show major ticks
    minorTickLength: 5,
    majorTickLength: 10,
    tickColor: '#666666',
    majorTickColor: '#666666',  // Default: same color as tickColor
    minorTickColor: '#999999',  // Default: lighter color for minor ticks
    textColor: '#333333',
    unitsColor: '#333333',  // Default: same color as textColor
    showLabels: true,  // Default: show labels
    showUnits: true,   // Default: show units in labels
    showBackground: true  // Default: show background
  },
  units: 'mm',
  snap: {
    enabled: false,
    tolerance: 5
  }
};

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  visual: {
    enabled: true,
    step: 10,
    opacity: 0.6,
    color: '#4444ff', // Μπλε για καλύτερη ορατότητα
    subDivisions: 5,
    showOrigin: true,
    showAxes: true,
    axesColor: '#666666', // Σκουρότερο γκρι για τους άξονες
    axesWeight: 2,
    majorGridColor: '#888888', // Γκρι για τις κύριες γραμμές
    minorGridColor: '#bbbbbb', // Ανοιχτότερο γκρι για τις δευτερεύουσες γραμμές
    majorGridWeight: 1,
    minorGridWeight: 0.5
  },
  snap: {
    enabled: false,
    step: 10,
    tolerance: 12,
    showIndicators: true,
    indicatorColor: '#0099ff', // Μπλε για τα indicators
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
  | 'auto-fit-grid'
  | 'export-settings'
  | 'import-settings';

export interface RulersGridOperationResult {
  success: boolean;
  operation: RulersGridOperation;
  error?: string;
  data?: any;
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

// ===== MOVED FROM COORDINATES SYSTEM =====
// Layout constants (moved from coordinates/config.ts)
export const COORDINATE_LAYOUT = {
  RULER_LEFT_WIDTH: 30,
  RULER_BOTTOM_HEIGHT: 30,
  ORIGIN: { x: 0, y: 0 } as Point2D,
  MARGINS: {
    left: 30,
    right: 0,
    top: 0,
    bottom: 30
  }
} as const;

// Coordinate transformation functions (moved from coordinates/config.ts)
export function worldToScreen(
  worldPoint: Point2D, 
  transform: ViewTransform, 
  canvasRect: CanvasRect
): Point2D {
  const { left, bottom } = COORDINATE_LAYOUT.MARGINS;
  if (!worldPoint) {
    console.warn("worldToScreen received undefined point. Returning (0,0)");
    return { x: left, y: canvasRect.height - bottom };
  }
  return {
    x: left + (worldPoint.x + transform.offsetX) * transform.scale,
    y: canvasRect.height - bottom - (worldPoint.y + transform.offsetY) * transform.scale
  };
}

export function screenToWorld(
  screenPoint: Point2D, 
  transform: ViewTransform, 
  canvasRect: CanvasRect
): Point2D {
  const { left, bottom } = COORDINATE_LAYOUT.MARGINS;
  if (!screenPoint) {
    console.warn("screenToWorld received undefined point. Returning (0,0)");
    return { x: -transform.offsetX, y: -transform.offsetY };
  }
  return {
    x: (screenPoint.x - left) / transform.scale - transform.offsetX,
    y: (canvasRect.height - bottom - screenPoint.y) / transform.scale - transform.offsetY
  };
}

// Coordinate transform object for compatibility
export const coordTransforms = {
  worldToScreen,
  screenToWorld
};

// Legacy exports for compatibility
export const RULER_SIZE = COORDINATE_LAYOUT.RULER_LEFT_WIDTH;
export const MARGINS = COORDINATE_LAYOUT.MARGINS;