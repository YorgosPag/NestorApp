/**
 * RULERS/GRID SYSTEM HOOK
 * Standalone hook for accessing rulers and grid context and utilities
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_RULERS_GRID = false;

import React, { useContext } from 'react';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-095: Centralized Snap Tolerance
import { SNAP_TOLERANCE } from '../../config/tolerance-config';
import type {
  RulerSettings,
  GridSettings,
  RulersGridState,
  RulersGridOperation,
  RulersGridOperationResult,
  UnitType,
  GridBounds,
  SnapResult,
  RulerTick,
  GridLine,
  RulersLayoutInfo
} from './config';
import type { Point2D, ViewTransform, DOMRect } from './config';

// Context type (will be properly typed when connected to RulersGridSystem)
interface RulersGridContextType {
  // State
  state: RulersGridState;
  
  // Ruler Management
  toggleRulers: (type?: 'horizontal' | 'vertical' | 'both') => void;
  setRulerVisibility: (type: 'horizontal' | 'vertical', visible: boolean) => void;
  updateRulerSettings: (updates: Partial<RulerSettings>) => void;
  setRulerUnits: (units: UnitType) => void;
  setRulerPosition: (type: 'horizontal' | 'vertical', position: 'top' | 'bottom' | 'left' | 'right') => void;
  
  // Grid Management
  toggleGrid: () => void;
  setGridVisibility: (visible: boolean) => void;
  updateGridSettings: (updates: Partial<GridSettings>) => void;
  setGridStep: (step: number) => void;
  setGridOpacity: (opacity: number) => void;
  setGridColor: (color: string) => void;
  
  // Origin and Coordinate System
  setOrigin: (point: Point2D) => void;
  resetOrigin: () => void;
  getOrigin: () => Point2D;
  
  // Snap Functionality
  toggleRulerSnap: () => void;
  toggleGridSnap: () => void;
  setSnapTolerance: (tolerance: number) => void;
  findSnapPoint: (point: Point2D, transform: ViewTransform, canvasRect: DOMRect) => SnapResult | null;
  
  // Calculation Functions
  calculateGridBounds: (transform: ViewTransform, canvasRect: DOMRect) => GridBounds;
  calculateGridLines: (bounds: GridBounds, settings: GridSettings, transform: ViewTransform) => GridLine[];
  calculateRulerTicks: (
    type: 'horizontal' | 'vertical',
    bounds: GridBounds,
    settings: RulerSettings,
    transform: ViewTransform,
    canvasRect: DOMRect
  ) => RulerTick[];
  
  // Layout Information
  getLayoutInfo: (canvasRect: DOMRect) => RulersLayoutInfo;
  getContentArea: (canvasRect: DOMRect) => DOMRect;
  
  // Unit Conversion
  convertUnits: (value: number, fromUnit: UnitType, toUnit: UnitType) => number;
  formatValue: (value: number, units: UnitType, precision?: number) => string;
  
  // Visibility and Display
  isRulerVisible: (type: 'horizontal' | 'vertical') => boolean;
  isGridVisible: () => boolean;
  getEffectiveOpacity: (transform: ViewTransform) => number;
  shouldRenderGrid: (transform: ViewTransform) => boolean;
  shouldRenderRulers: (transform: ViewTransform) => boolean;
  
  // Performance and Optimization
  getMaxGridLines: () => number;
  getMaxRulerTicks: () => number;
  isPerformanceOptimized: () => boolean;
  
  // Settings Management
  resetRulerSettings: () => void;
  resetGridSettings: () => void;
  resetAllSettings: () => void;
  exportSettings: () => string;
  importSettings: (data: string) => Promise<RulersGridOperationResult>;
  validateSettings: (settings: unknown) => { valid: boolean; errors: string[] };
  
  // Auto-fit and Smart Behavior
  autoFitGrid: (transform: ViewTransform, canvasRect: DOMRect) => void;
  getOptimalGridStep: (transform: ViewTransform) => number;
  getOptimalTickSpacing: (transform: ViewTransform, type: 'horizontal' | 'vertical') => number;
}

// Type alias for hook return
export type RulersGridHookReturn = RulersGridContextType;

export function useRulersGrid(): RulersGridContextType | null {
  // ✅ FIXED: Always call useContext with a valid context or create a dummy one
  const contextToUse = _rulersGridContext || React.createContext<RulersGridContextType | null>(null);
  const context = useContext(contextToUse);

  if (!_rulersGridContext) {
    if (DEBUG_RULERS_GRID) console.warn('🚨 [useRulersGrid] Context not initialized yet, returning null');
    return null;
  }

  if (!context) {
    if (DEBUG_RULERS_GRID) console.warn('🚨 [useRulersGrid] No context found, component may be outside RulersGridSystem provider');
    return null;
  }
  return context;
}

// Additional convenience hooks
export function useRulerState() {
  const rulersGrid = useRulersGrid();
  if (!rulersGrid) {
    return {
      horizontal: { enabled: false, visible: true, position: 'top' as const },
      vertical: { enabled: false, visible: true, position: 'left' as const },
      units: 'mm' as const,
      isHorizontalVisible: false,
      isVerticalVisible: false,
      toggleRulers: () => {},
      setRulerVisibility: () => {},
      updateRulerSettings: () => {}
    };
  }
  return {
    horizontal: rulersGrid.state.rulers.horizontal,
    vertical: rulersGrid.state.rulers.vertical,
    units: rulersGrid.state.rulers.units,
    isHorizontalVisible: rulersGrid.isRulerVisible('horizontal'),
    isVerticalVisible: rulersGrid.isRulerVisible('vertical'),
    toggleRulers: rulersGrid.toggleRulers,
    setRulerVisibility: rulersGrid.setRulerVisibility,
    updateRulerSettings: rulersGrid.updateRulerSettings
  };
}

export function useGridState() {
  const rulersGrid = useRulersGrid();
  if (!rulersGrid) {
    return {
      settings: { visual: { enabled: false, color: UI_COLORS.WHITE, opacity: 0.3, step: 25 } },
      isVisible: false,
      toggleGrid: () => {},
      setGridVisibility: () => {},
      updateGridSettings: () => {},
      setGridStep: () => {},
      setGridOpacity: () => {},
      setGridColor: () => {}
    };
  }
  return {
    settings: rulersGrid.state.grid,
    isVisible: rulersGrid.isGridVisible(),
    toggleGrid: rulersGrid.toggleGrid,
    setGridVisibility: rulersGrid.setGridVisibility,
    updateGridSettings: rulersGrid.updateGridSettings,
    setGridStep: rulersGrid.setGridStep,
    setGridOpacity: rulersGrid.setGridOpacity,
    setGridColor: rulersGrid.setGridColor
  };
}

export function useSnapState() {
  const rulersGrid = useRulersGrid();
  if (!rulersGrid) {
    return {
      rulerSnap: { enabled: false, tolerance: SNAP_TOLERANCE },
      gridSnap: { enabled: false, tolerance: SNAP_TOLERANCE },
      toggleRulerSnap: () => {},
      toggleGridSnap: () => {},
      setSnapTolerance: () => {},
      findSnapPoint: () => null
    };
  }
  return {
    rulerSnap: rulersGrid.state.rulers.snap,
    gridSnap: rulersGrid.state.grid.snap,
    toggleRulerSnap: rulersGrid.toggleRulerSnap,
    toggleGridSnap: rulersGrid.toggleGridSnap,
    setSnapTolerance: rulersGrid.setSnapTolerance,
    findSnapPoint: rulersGrid.findSnapPoint
  };
}

export function useOriginState() {
  const rulersGrid = useRulersGrid();
  if (!rulersGrid) {
    return {
      origin: { x: 0, y: 0 },
      setOrigin: () => {},
      resetOrigin: () => {},
      getOrigin: () => ({ x: 0, y: 0 })
    };
  }
  return {
    origin: rulersGrid.state.origin,
    setOrigin: rulersGrid.setOrigin,
    resetOrigin: rulersGrid.resetOrigin,
    getOrigin: rulersGrid.getOrigin
  };
}

export function useRulersGridCalculations() {
  const rulersGrid = useRulersGrid();
  if (!rulersGrid) {
    return {
      calculateGridBounds: () => ({ min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }),
      calculateGridLines: () => [],
      calculateRulerTicks: () => [],
      getLayoutInfo: () => ({ rulerThickness: 25, contentOffset: { x: 25, y: 25 } }),
      getContentArea: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      convertUnits: (value: number) => value,
      formatValue: (value: number) => value.toString()
    };
  }
  return {
    calculateGridBounds: rulersGrid.calculateGridBounds,
    calculateGridLines: rulersGrid.calculateGridLines,
    calculateRulerTicks: rulersGrid.calculateRulerTicks,
    getLayoutInfo: rulersGrid.getLayoutInfo,
    getContentArea: rulersGrid.getContentArea,
    convertUnits: rulersGrid.convertUnits,
    formatValue: rulersGrid.formatValue
  };
}

export function useRulersGridDisplay() {
  const rulersGrid = useRulersGrid();
  if (!rulersGrid) {
    return {
      shouldRenderGrid: () => false,
      shouldRenderRulers: () => false,
      getEffectiveOpacity: () => 0.3,
      isPerformanceOptimized: () => false,
      getMaxGridLines: () => 1000,
      getMaxRulerTicks: () => 200
    };
  }
  return {
    shouldRenderGrid: rulersGrid.shouldRenderGrid,
    shouldRenderRulers: rulersGrid.shouldRenderRulers,
    getEffectiveOpacity: rulersGrid.getEffectiveOpacity,
    isPerformanceOptimized: rulersGrid.isPerformanceOptimized,
    getMaxGridLines: rulersGrid.getMaxGridLines,
    getMaxRulerTicks: rulersGrid.getMaxRulerTicks
  };
}

export function useRulersGridSettings() {
  const rulersGrid = useRulersGrid();
  if (!rulersGrid) {
    return {
      resetRulerSettings: () => {},
      resetGridSettings: () => {},
      resetAllSettings: () => {},
      exportSettings: () => '',
      importSettings: () => Promise.resolve({ success: false, operation: 'import' as const }),
      validateSettings: () => ({ valid: false, errors: [] }),
      autoFitGrid: () => {},
      getOptimalGridStep: () => 25,
      getOptimalTickSpacing: () => 100
    };
  }
  return {
    resetRulerSettings: rulersGrid.resetRulerSettings,
    resetGridSettings: rulersGrid.resetGridSettings,
    resetAllSettings: rulersGrid.resetAllSettings,
    exportSettings: rulersGrid.exportSettings,
    importSettings: rulersGrid.importSettings,
    validateSettings: rulersGrid.validateSettings,
    autoFitGrid: rulersGrid.autoFitGrid,
    getOptimalGridStep: rulersGrid.getOptimalGridStep,
    getOptimalTickSpacing: rulersGrid.getOptimalTickSpacing
  };
}

// Legacy hook names removed - use useRulersGrid directly

// Context management
let _rulersGridContext: React.Context<RulersGridContextType | null> | null = null;

export function setRulersGridContext(context: React.Context<RulersGridContextType | null>) {
  _rulersGridContext = context;
}

export function getRulersGridContext() {
  return _rulersGridContext;
}