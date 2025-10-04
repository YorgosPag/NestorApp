# Rulers System - Complete Code Documentation

## Περιγραφή
Αυτό το αρχείο περιέχει όλους τους κώδικες που σχετίζονται με το σύστημα χαράκων (rulers) στο DXF Viewer.

---

## 1. config.ts - Διαμόρφωση και Types

```typescript
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
    precision: number;
    showZero: boolean;
    showMinorTicks: boolean;
    minorTickLength: number;
    majorTickLength: number;
    tickColor: string;
    textColor: string;
  };
  vertical: {
    enabled: boolean;
    width: number;
    position: 'left' | 'right';
    color: string;
    backgroundColor: string;
    fontSize: number;
    fontFamily: string;
    precision: number;
    showZero: boolean;
    showMinorTicks: boolean;
    minorTickLength: number;
    majorTickLength: number;
    tickColor: string;
    textColor: string;
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
    precision: 1,
    showZero: true,
    showMinorTicks: true,
    minorTickLength: 5,
    majorTickLength: 10,
    tickColor: '#666666',
    textColor: '#333333'
  },
  vertical: {
    enabled: true,
    width: 30,
    position: 'left',
    color: '#f0f0f0', // Ουδέτερο γκρι
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontFamily: 'Arial, sans-serif',
    precision: 1,
    showZero: true,
    showMinorTicks: true,
    minorTickLength: 5,
    majorTickLength: 10,
    tickColor: '#666666',
    textColor: '#333333'
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
  MAX_RULER_TICKS: 500,
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
```

---

## 2. useRulerManagement.ts - Διαχείριση Χαράκων

```typescript
import { useCallback } from 'react';
import type { RulerSettings, RulerSettingsUpdate, UnitType } from './config';

export interface RulerManagementHook {
  toggleRulers: (type?: 'horizontal' | 'vertical' | 'both') => void;
  setRulerVisibility: (type: 'horizontal' | 'vertical', visible: boolean) => void;
  updateRulerSettings: (updates: RulerSettingsUpdate) => void;
  setRulerUnits: (units: UnitType) => void;
  setRulerPosition: (type: 'horizontal' | 'vertical', position: 'top' | 'bottom' | 'left' | 'right') => void;
}

export function useRulerManagement(
  rulers: RulerSettings,
  setRulers: React.Dispatch<React.SetStateAction<RulerSettings>>
): RulerManagementHook {
  const toggleRulers = useCallback((type: 'horizontal' | 'vertical' | 'both' = 'both') => {
    setRulers(prev => {
      const newSettings = { ...prev };
      if (type === 'horizontal' || type === 'both') {
        newSettings.horizontal.enabled = !prev.horizontal.enabled;
      }
      if (type === 'vertical' || type === 'both') {
        newSettings.vertical.enabled = !prev.vertical.enabled;
      }
      return newSettings;
    });
  }, [setRulers]);

  const setRulerVisibility = useCallback((type: 'horizontal' | 'vertical', visible: boolean) => {
    setRulers(prev => ({
      ...prev,
      [type]: { ...prev[type], enabled: visible }
    }));
  }, [setRulers]);

  const updateRulerSettings = useCallback((updates: RulerSettingsUpdate) => {
    setRulers(prev => {
      const newSettings = { ...prev };
      
      if (updates.horizontal) {
        newSettings.horizontal = { ...prev.horizontal, ...updates.horizontal };
      }
      if (updates.vertical) {
        newSettings.vertical = { ...prev.vertical, ...updates.vertical };
      }
      if (updates.units !== undefined) {
        newSettings.units = updates.units;
      }
      if (updates.snap) {
        newSettings.snap = { ...prev.snap, ...updates.snap };
      }
      
      return newSettings;
    });
  }, [setRulers]);

  const setRulerUnits = useCallback((units: UnitType) => {
    setRulers(prev => ({ ...prev, units }));
  }, [setRulers]);

  const setRulerPosition = useCallback((
    type: 'horizontal' | 'vertical', 
    position: 'top' | 'bottom' | 'left' | 'right'
  ) => {
    setRulers(prev => ({
      ...prev,
      [type]: { ...prev[type], position }
    }));
  }, [setRulers]);

  return {
    toggleRulers,
    setRulerVisibility,
    updateRulerSettings,
    setRulerUnits,
    setRulerPosition
  };
}
```

---

## 3. useRenderingCalculations.ts - Υπολογισμοί και Rendering

```typescript
import { useCallback } from 'react';
import type { Point2D } from '../coordinates/config';
import type {
  RulerSettings,
  GridSettings,
  GridBounds,
  GridLine,
  RulerTick,
  RulersLayoutInfo,
  CanvasRect,
  ViewTransform
} from './config';
import { RulersGridCalculations, RulersGridRendering } from './utils';

export interface RenderingCalculationsHook {
  calculateGridLines: (bounds: GridBounds) => GridLine[];
  calculateRulerTicks: (type: 'horizontal' | 'vertical', bounds: GridBounds) => RulerTick[];
  calculateLayout: (canvasRect: CanvasRect) => RulersLayoutInfo;
  renderGrid: (ctx: CanvasRenderingContext2D, bounds: GridBounds, transform: ViewTransform) => void;
  renderRulers: (
    horizontalCtx: CanvasRenderingContext2D | null,
    verticalCtx: CanvasRenderingContext2D | null,
    layout: RulersLayoutInfo,
    bounds: GridBounds,
    transform: ViewTransform
  ) => void;
}

export function useRenderingCalculations(
  rulers: RulerSettings,
  grid: GridSettings,
  origin: Point2D
): RenderingCalculationsHook {
  // Calculation functions
  const calculateGridLines = useCallback((bounds: GridBounds): GridLine[] => {
    return RulersGridCalculations.calculateGridLines(grid, origin, bounds);
  }, [grid, origin]);

  const calculateRulerTicks = useCallback((
    type: 'horizontal' | 'vertical',
    bounds: GridBounds
  ): RulerTick[] => {
    return RulersGridCalculations.calculateRulerTicks(rulers, type, bounds);
  }, [rulers]);

  const calculateLayout = useCallback((canvasRect: CanvasRect): RulersLayoutInfo => {
    return RulersGridCalculations.calculateRulersLayout(rulers, canvasRect);
  }, [rulers]);

  // Rendering functions
  const renderGrid = useCallback((
    ctx: CanvasRenderingContext2D,
    bounds: GridBounds,
    transform: ViewTransform
  ) => {
    if (!grid.visual.enabled) return;
    const lines = calculateGridLines(bounds);
    RulersGridRendering.renderGridLines(ctx, lines, transform);
  }, [grid, calculateGridLines]);

  const renderRulers = useCallback((
    horizontalCtx: CanvasRenderingContext2D | null,
    verticalCtx: CanvasRenderingContext2D | null,
    layout: RulersLayoutInfo,
    bounds: GridBounds,
    transform: ViewTransform
  ) => {
    if (horizontalCtx && rulers.horizontal.enabled) {
      const ticks = calculateRulerTicks('horizontal', bounds);
      RulersGridRendering.renderRuler(horizontalCtx, ticks, rulers.horizontal, 'horizontal', transform);
    }
    
    if (verticalCtx && rulers.vertical.enabled) {
      const ticks = calculateRulerTicks('vertical', bounds);
      RulersGridRendering.renderRuler(verticalCtx, ticks, rulers.vertical, 'vertical', transform);
    }
  }, [rulers, calculateRulerTicks]);

  return {
    calculateGridLines,
    calculateRulerTicks,
    calculateLayout,
    renderGrid,
    renderRulers
  };
}
```

---

## 4. RulersGridSystem.tsx - Κύριο Component

```typescript
'use client';
import React, { createContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { Point2D, ViewTransform, CanvasRect } from '../coordinates/config';
import {
  RulerSettings,
  GridSettings,
  RulersGridState,
  DEFAULT_RULER_SETTINGS,
  DEFAULT_GRID_SETTINGS,
  RULERS_GRID_CONFIG,
  UnitType,
  GridBounds,
  SnapResult,
  RulerTick,
  GridLine,
  RulersLayoutInfo,
  RulersGridOperationResult,
  RulersGridOperation,
  RulerSettingsUpdate,
  GridSettingsUpdate
} from './config';
import { RulersGridCalculations, RulersGridRendering, RulersGridSnapping } from './utils';
import { setRulersGridContext, type RulersGridHookReturn } from './useRulersGrid';
import { RulersGridSystemProps, DEFAULT_ORIGIN } from './types';
import { useRulerManagement } from './useRulerManagement';
import { useGridManagement } from './useGridManagement';
import { useSnapManagement } from './useSnapManagement';
import { useRenderingCalculations } from './useRenderingCalculations';

function useRulersGridSystemIntegration({
  initialRulerSettings = {},
  initialGridSettings = {},
  initialOrigin = DEFAULT_ORIGIN,
  initialVisibility = true,
  enablePersistence = false,
  persistenceKey = 'dxf-viewer-rulers-grid',
  onSettingsChange,
  onOriginChange,
  onVisibilityChange,
  onSnapResult,
  viewTransform,
  canvasBounds
}: Omit<RulersGridSystemProps, 'children'>): RulersGridHookReturn {
  
  console.log('🔍 [useRulersGridSystemIntegration] Hook called');
  console.log('🔍 [useRulersGridSystemIntegration] enablePersistence:', enablePersistence);
  console.log('🔍 [useRulersGridSystemIntegration] persistenceKey:', persistenceKey);

  // Load persisted settings if enabled
  const loadPersistedSettings = useCallback(() => {
    if (!enablePersistence) return null;
    try {
      const stored = localStorage.getItem(persistenceKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [enablePersistence, persistenceKey]);

  const persistedData = loadPersistedSettings();

  // Deep merge helper for nested objects
  const deepMerge = (target: any, source: any): any => {
    if (!source) return target;
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  };

  // State initialization with deep merge
  const [rulers, setRulers] = useState<RulerSettings>(() => {
    let result = { ...DEFAULT_RULER_SETTINGS };
    if (persistedData?.rulers) {
      result = deepMerge(result, persistedData.rulers);
    }
    if (initialRulerSettings) {
      result = deepMerge(result, initialRulerSettings);
    }
    
    // ✅ FORCE ENABLE RULERS - User requested to show rulers
    result.horizontal.enabled = true;
    result.vertical.enabled = true;
    
    console.log('🔍 [RulersGridSystem] Initial rulers settings (RULERS FORCED ENABLED):', result);
    console.log('🔍 [RulersGridSystem] Rulers H enabled:', result?.horizontal?.enabled);
    console.log('🔍 [RulersGridSystem] Rulers V enabled:', result?.vertical?.enabled);
    return result;
  });

  const [grid, setGrid] = useState<GridSettings>(() => {
    let result = { ...DEFAULT_GRID_SETTINGS };
    if (persistedData?.grid) {
      result = deepMerge(result, persistedData.grid);
    }
    if (initialGridSettings) {
      result = deepMerge(result, initialGridSettings);
    }
    console.log('🔍 [RulersGridSystem] Initial grid settings (no forced enabling):', result);
    console.log('🔍 [RulersGridSystem] Grid.visual.enabled:', result?.visual?.enabled);
    console.log('🔍 [RulersGridSystem] Grid.visual.subDivisions:', result?.visual?.subDivisions);
    return result;
  });

  const [origin, setOriginState] = useState<Point2D>(() => {
    // ✅ FORCE ORIGIN TO BOTTOM-LEFT (0,0) - User requested rulers to show 0-0 at bottom-left
    console.log('🎯 [RulersGridSystem] FORCING ORIGIN TO (0,0) for bottom-left positioning');
    return { x: 0, y: 0 };
  });

  const [isVisible, setIsVisible] = useState<boolean>(() => 
    persistedData?.isVisible ?? initialVisibility
  );

  const [rulerSnapPoints, setRulerSnapPoints] = useState<Point2D[]>([]);
  const [gridSnapPoints, setGridSnapPoints] = useState<Point2D[]>([]);
  const [lastCalculatedBounds, setLastCalculatedBounds] = useState<RulersGridState['lastCalculatedBounds']>(null);

  // State object
  const state = useMemo<RulersGridState>(() => ({
    rulers,
    grid,
    origin,
    isVisible,
    rulerSnapPoints,
    gridSnapPoints,
    lastCalculatedBounds
  }), [rulers, grid, origin, isVisible, rulerSnapPoints, gridSnapPoints, lastCalculatedBounds]);

  // Initialize individual management hooks
  const rulerMethods = useRulerManagement(rulers, setRulers);
  const gridMethods = useGridManagement(grid, setGrid);
  const snapMethods = useSnapManagement(rulers, setRulers, grid, setGrid, state, viewTransform, onSnapResult);
  const renderingMethods = useRenderingCalculations(rulers, grid, origin);

  // Persistence effect
  useEffect(() => {
    if (enablePersistence) {
      const dataToStore = {
        rulers,
        grid,
        origin,
        isVisible,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(persistenceKey, JSON.stringify(dataToStore));
      } catch (error) {
        console.warn('Failed to persist rulers/grid settings:', error);
      }
    }
  }, [rulers, grid, origin, isVisible, enablePersistence, persistenceKey]);

  // Calculations and updates when view changes
  useEffect(() => {
    if (viewTransform && canvasBounds) {
      const bounds = RulersGridCalculations.calculateGridBounds(viewTransform, canvasBounds);
      setLastCalculatedBounds(bounds);

      // Update snap points
      if (rulers.snap.enabled) {
        const rulerSnaps = RulersGridCalculations.calculateRulerSnapPoints(rulers, bounds);
        setRulerSnapPoints(rulerSnaps);
      }

      if (grid.snap.enabled) {
        const gridSnaps = RulersGridCalculations.calculateGridSnapPoints(grid, origin, bounds);
        setGridSnapPoints(gridSnaps);
      }
    }
  }, [rulers, grid, origin, viewTransform, canvasBounds]);

  // Settings change effects
  useEffect(() => {
    onSettingsChange?.(rulers, grid);
  }, [rulers, grid, onSettingsChange]);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  // Origin and coordinate system functions
  const setOrigin = useCallback((point: Point2D) => {
    setOriginState(point);
    onOriginChange?.(point);
  }, [onOriginChange]);

  const resetOrigin = useCallback(() => {
    setOrigin(DEFAULT_ORIGIN);
  }, [setOrigin]);

  const getOrigin = useCallback(() => origin, [origin]);

  // Utility operations
  const performOperation = useCallback(async (operation: RulersGridOperation): Promise<RulersGridOperationResult> => {
    try {
      switch (operation) {
        case 'toggle-rulers':
          rulerMethods.toggleRulers();
          break;
        case 'toggle-grid':
          gridMethods.toggleGrid();
          break;
        case 'toggle-ruler-snap':
          snapMethods.toggleRulerSnap();
          break;
        case 'toggle-grid-snap':
          snapMethods.toggleGridSnap();
          break;
        case 'reset-origin':
          resetOrigin();
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
      
      return { success: true, operation };
    } catch (error) {
      return {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Operation failed'
      };
    }
  }, [rulerMethods, gridMethods, snapMethods, resetOrigin]);

  const exportSettings = useCallback(() => {
    return {
      rulers,
      grid,
      origin,
      isVisible,
      version: '1.0',
      timestamp: Date.now()
    };
  }, [rulers, grid, origin, isVisible]);

  const importSettings = useCallback((data: any): RulersGridOperationResult => {
    try {
      if (data.rulers) setRulers({ ...DEFAULT_RULER_SETTINGS, ...data.rulers });
      if (data.grid) setGrid({ ...DEFAULT_GRID_SETTINGS, ...data.grid });
      if (data.origin) setOrigin(data.origin);
      if (data.isVisible !== undefined) setIsVisible(data.isVisible);
      
      return { success: true, operation: 'import' };
    } catch (error) {
      return {
        success: false,
        operation: 'import',
        error: error instanceof Error ? error.message : 'Import failed'
      };
    }
  }, [setOrigin]);

  return {
    // State
    state,
    
    // Ruler Management
    ...rulerMethods,
    
    // Grid Management
    ...gridMethods,
    
    // Origin and Coordinate System
    setOrigin,
    resetOrigin,
    getOrigin,
    
    // Snap Functionality
    ...snapMethods,
    
    // Calculations and Rendering
    ...renderingMethods,
    
    // Operations
    performOperation,
    exportSettings,
    importSettings,
    
    // System Control
    setVisibility: setIsVisible,
    getVisibility: () => isVisible,
    resetSettings: () => {
      setRulers(DEFAULT_RULER_SETTINGS);
      setGrid(DEFAULT_GRID_SETTINGS);
      resetOrigin();
      setIsVisible(true);
    }
  };
}

const RulersGridContext = createContext<RulersGridHookReturn | null>(null);

export function useRulersGridContext(): RulersGridHookReturn {
  const context = React.useContext(RulersGridContext);
  if (!context) {
    throw new Error('useRulersGridContext must be used within RulersGridSystem');
  }
  return context;
}

export function RulersGridSystem({ children, ...props }: RulersGridSystemProps) {
  console.log('🚀 [RulersGridSystem] *** COMPONENT INITIALIZED ***', props);
  console.log('🔍 [RulersGridSystem] Component initialized');
  console.log('🔍 [RulersGridSystem] Props:', props);
  
  const value = useRulersGridSystemIntegration(props);
  console.log('🔍 [RulersGridSystem] Integration result:', value?.state);

  React.useEffect(() => {
    console.log('🔍 [RulersGridSystem] Setting context');
    setRulersGridContext(RulersGridContext);
  }, []);

  console.log('🔍 [RulersGridSystem] Rendering provider with value:', !!value);

  return (
    <RulersGridContext.Provider value={value}>
      {children}
    </RulersGridContext.Provider>
  );
}
```

---

## Σημαντικές Αλλαγές που Έγιναν

### 1. Transform Parameter Fix
**Πρόβλημα**: Οι κλήσεις `renderRuler` δεν περνούσαν το `transform` παράμετρο  
**Λύση**: Προστέθηκε το `transform` στις κλήσεις στο `useRenderingCalculations.ts`

### 2. OffsetY Fix  
**Πρόβλημα**: `offsetY: canvas.height` προκαλούσε διπλό μετασχηματισμό συντεταγμένων  
**Λύση**: Αλλάχθηκε σε `offsetY: 0` στο `DxfCanvasCore.tsx`

### 3. Dependencies Enhancement
**Πρόβλημα**: Λάθαν dependencies στο effect για real-time updates  
**Λύση**: Προστέθηκαν όλα τα visual fields του grid στο DxfCanvasCore effect

### 4. Coordinate System
**Βελτίωση**: Οι μετασχηματισμοί συντεταγμένων τώρα λειτουργούν σωστά με το 0-0 στο κάτω αριστερά

---

## Χρήση

```typescript
// Βασική χρήση στο component
import { RulersGridSystem } from './systems/rulers-grid';

function MyComponent() {
  return (
    <RulersGridSystem
      initialRulerSettings={{
        horizontal: { enabled: true, height: 30 },
        vertical: { enabled: true, width: 30 }
      }}
      enablePersistence={true}
    >
      {/* Το περιεχόμενό σας */}
    </RulersGridSystem>
  );
}

// Χρήση του hook σε child components
import { useRulersGridContext } from './systems/rulers-grid';

function ChildComponent() {
  const rulersGrid = useRulersGridContext();
  
  // Αλλαγή ρυθμίσεων χαράκων
  const handleToggleRulers = () => {
    rulersGrid.toggleRulers('both');
  };
  
  // Αλλαγή μονάδων
  const handleChangeUnits = (units: UnitType) => {
    rulersGrid.setRulerUnits(units);
  };
  
  return (
    <div>
      <button onClick={handleToggleRulers}>Toggle Rulers</button>
      <button onClick={() => handleChangeUnits('cm')}>Set to CM</button>
    </div>
  );
}
```