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
// Imports from config are no longer needed here - types moved to types.ts

// 🏢 ADR-125: Context type imported from types.ts to prevent circular dependencies
import type { RulersGridContextType, RulersGridHookReturn } from './types';
import { RulersGridContext } from './RulersGridSystem';

export function useRulersGrid(): RulersGridContextType | null {
  // 🏢 ENTERPRISE: Use lazy-loaded context reference (ADR-125)
  // Context is defined in RulersGridSystem.tsx to prevent "Provider is null" errors.
  const context = useContext(RulersGridContext);

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

// ============================================================================
// 🏢 ENTERPRISE: CONTEXT RE-EXPORT FOR BACKWARD COMPATIBILITY (ADR-125)
// ============================================================================
// Context is now defined in RulersGridSystem.tsx (canonical location).
// This re-export ensures existing imports continue to work.
// Pattern: Autodesk/Microsoft/Google enterprise standard
// ============================================================================

// Re-export context from canonical location
export { RulersGridContext };

// DEPRECATED: No longer needed with static context colocation
export function setRulersGridContext(_context: React.Context<RulersGridContextType | null>) {
  console.warn('[DEPRECATED] setRulersGridContext is no longer needed - context is colocated with Provider');
}

export function getRulersGridContext(): React.Context<RulersGridContextType | null> {
  return RulersGridContext;
}

// Re-export types for consumers (ADR-125)
export type { RulersGridContextType, RulersGridHookReturn } from './types';
