'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from './config';
import {
  RulerSettings,
  GridSettings,
  RulersGridState,
  DEFAULT_RULER_SETTINGS,
  DEFAULT_GRID_SETTINGS,
  RULERS_GRID_CONFIG,
  UnitType,
  GridBounds,
  RulerTick,
  GridLine,
  RulersLayoutInfo,
  RulersGridOperationResult,
  RulersGridOperation
} from './config';
import { storageSet } from '../../utils/storage-utils';
import {
  loadPersistedData,
  createInitialRulerSettings,
  createInitialGridSettings,
  validateRulersGridSettings,
  executeRulersGridOperation,
  exportRulersGridSettings,
  parseImportedSettings,
} from './rulers-grid-state-init';

// ✅ ENTERPRISE: Window interface extension for debug globals
declare global {
  interface Window {
    __GRID_SETTINGS__?: Partial<GridSettings>;
    __RULER_SETTINGS__?: RulerSettings;
  }
}
import { RulersGridCalculations, PerformanceUtilities, UnitConversion } from './utils';
// 🏢 ADR-125: Types imported from types.ts to prevent circular dependencies
import type { RulersGridHookReturn, RulersGridContextType } from './types';
import { RulersGridSystemProps, DEFAULT_ORIGIN } from './types';
import { useRulerManagement } from './useRulerManagement';
import { useGridManagement } from './useGridManagement';
import { useUserSettingsRulersGridSync } from './useUserSettingsRulersGridSync';
import { useSnapManagement } from './useSnapManagement';
import { useRenderingCalculations } from './useRenderingCalculations';
import { globalGridStore, globalRulerStore } from '../../settings-provider';

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

  // Load persisted settings (ADR-065: initialization extracted to rulers-grid-state-init.ts)
  const persistedData = loadPersistedData(enablePersistence, persistenceKey);

  // State initialization with deep merge + property migration (ADR-065: logic in rulers-grid-state-init.ts)
  const [rulers, setRulersInternal] = useState<RulerSettings>(() =>
    createInitialRulerSettings(initialRulerSettings, persistedData?.rulers)
  );

  const [grid, setGridInternal] = useState<GridSettings>(() =>
    createInitialGridSettings(initialGridSettings, persistedData?.grid)
  );

  const [origin, setOriginState] = useState<Point2D>(() => {
    // ✅ FORCE ORIGIN TO BOTTOM-LEFT (0,0) - User requested rulers to show 0-0 at bottom-left

    return { x: 0, y: 0 };
  });

  const [isVisible, setIsVisible] = useState<boolean>(() => 
    persistedData?.isVisible ?? initialVisibility
  );

  const setGrid = useCallback((updater: React.SetStateAction<GridSettings>) => {
    setGridInternal(prev => {
      const newGrid = typeof updater === 'function' ? updater(prev) : updater;
      return newGrid;
    });
  }, []);

  const setRulers = useCallback((updater: React.SetStateAction<RulerSettings>) => {
    setRulersInternal(prev => {
      const newRulers = typeof updater === 'function' ? updater(prev) : updater;
      return newRulers;
    });
  }, []);

  const calculateGridBounds = useCallback((transform: ViewTransform, canvasRect: DOMRectReadOnly): GridBounds => {
    const step = RulersGridCalculations.calculateAdaptiveSpacing(transform.scale, grid.visual.step, grid);
    return RulersGridCalculations.calculateVisibleBounds(transform, canvasRect as DOMRect, step);
  }, [grid]);

  const calculateGridLines = useCallback(
    (bounds: GridBounds, settings: GridSettings, transform: ViewTransform): GridLine[] =>
      RulersGridCalculations.generateGridLines(bounds, settings, transform),
    []
  );

  const calculateRulerTicks = useCallback(
    (
      type: 'horizontal' | 'vertical',
      bounds: GridBounds,
      settings: RulerSettings,
      transform: ViewTransform,
      canvasRect: DOMRectReadOnly
    ): RulerTick[] =>
      RulersGridCalculations.calculateTicks(type, bounds, settings, transform, canvasRect as DOMRect),
    []
  );

  const getLayoutInfo = useCallback(
    (canvasRect: DOMRectReadOnly): RulersLayoutInfo =>
      RulersGridCalculations.calculateLayout(canvasRect as DOMRect, rulers),
    [rulers]
  );

  const getContentArea = useCallback(
    (canvasRect: DOMRectReadOnly): DOMRectReadOnly => {
      const layout = getLayoutInfo(canvasRect);
      const { x, y, width, height } = layout.contentRect;
      return new DOMRect(x, y, width, height);
    },
    [getLayoutInfo]
  );

  const convertUnits = useCallback(
    (value: number, fromUnit: UnitType, toUnit: UnitType): number =>
      UnitConversion.convert(value, fromUnit, toUnit),
    []
  );

  const formatValue = useCallback(
    (value: number, units: UnitType, precision?: number): string =>
      UnitConversion.format(value, units, precision),
    []
  );

  const isRulerVisible = useCallback(
    (type: 'horizontal' | 'vertical') => isVisible && rulers[type].enabled,
    [isVisible, rulers]
  );

  const isGridVisible = useCallback(() => isVisible && grid.visual.enabled, [isVisible, grid]);

  const getEffectiveOpacity = useCallback(
    (transform: ViewTransform): number =>
      RulersGridCalculations.getEffectiveOpacity(grid.visual.opacity, transform, grid),
    [grid]
  );

  const shouldRenderGrid = useCallback(
    (transform: ViewTransform): boolean => PerformanceUtilities.shouldRenderGrid(transform, grid),
    [grid]
  );

  const shouldRenderRulers = useCallback(
    (transform: ViewTransform): boolean => PerformanceUtilities.shouldRenderRulers(transform, rulers),
    [rulers]
  );

  const getMaxGridLines = useCallback(() => RULERS_GRID_CONFIG.MAX_GRID_LINES, []);
  const getMaxRulerTicks = useCallback(() => RULERS_GRID_CONFIG.MAX_RULER_TICKS, []);
  const isPerformanceOptimized = useCallback(
    () => grid.behavior.adaptiveGrid || grid.behavior.fadeAtDistance,
    [grid]
  );

  const resetRulerSettings = useCallback(() => {
    setRulers(DEFAULT_RULER_SETTINGS);
  }, [setRulers]);

  const resetGridSettings = useCallback(() => {
    setGrid(DEFAULT_GRID_SETTINGS);
  }, [setGrid]);

  const validateSettings = useCallback(
    (settings: unknown) => validateRulersGridSettings(settings),
    [],
  );

  const getOptimalGridStep = useCallback(
    (transform: ViewTransform): number =>
      RulersGridCalculations.calculateAdaptiveSpacing(transform.scale, grid.visual.step, grid),
    [grid]
  );

  const getOptimalTickSpacing = useCallback(
    (transform: ViewTransform, _type: 'horizontal' | 'vertical'): number => {
      const scaledSpacing = RULERS_GRID_CONFIG.DEFAULT_TICK_SPACING / Math.max(transform.scale, 0.001);
      return Math.min(
        Math.max(scaledSpacing, RULERS_GRID_CONFIG.MIN_TICK_SPACING),
        RULERS_GRID_CONFIG.MAX_TICK_SPACING
      );
    },
    []
  );

  // Expose grid settings to window for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const gridWithStyle = {
        ...grid,
        visual: {
          ...grid.visual,
          style: grid.visual.style || 'lines' // Always ensure style is set
        }
      };
      window.__GRID_SETTINGS__ = gridWithStyle;
      window.__RULER_SETTINGS__ = rulers;
    }
  }, [grid, rulers]);

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

  const { setGridStep } = gridMethods;

  const autoFitGrid = useCallback(
    (transform: ViewTransform, _canvasRect: DOMRectReadOnly) => {
      const optimalStep = getOptimalGridStep(transform);
      setGridStep(optimalStep);
    },
    [getOptimalGridStep, setGridStep]
  );
  const renderingMethods = useRenderingCalculations(rulers, grid, origin);

  // Global store sync (bidirectional, with circular-update protection)
  const isUpdatingFromGlobalRef = useRef(false);

  useEffect(() => {
    const unsubscribeGrid = globalGridStore.subscribe((newGridSettings) => {
      if (!isUpdatingFromGlobalRef.current) setGrid(newGridSettings);
    });
    const unsubscribeRuler = globalRulerStore.subscribe((newRulerSettings) => {
      if (!isUpdatingFromGlobalRef.current) setRulers(newRulerSettings);
    });
    return () => { unsubscribeGrid(); unsubscribeRuler(); };
  }, []);

  // Reverse sync: local → global stores
  useEffect(() => {
    isUpdatingFromGlobalRef.current = true;
    globalGridStore.update(grid);
    isUpdatingFromGlobalRef.current = false;
  }, [grid]);

  useEffect(() => {
    isUpdatingFromGlobalRef.current = true;
    globalRulerStore.update(rulers);
    isUpdatingFromGlobalRef.current = false;
  }, [rulers]);

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
      // 🏢 ADR-092: Using centralized storage-utils
      storageSet(persistenceKey, dataToStore);
    }
  }, [rulers, grid, origin, isVisible, enablePersistence, persistenceKey]);

  // 🏢 ADR-XXX UserSettings SSoT — Firestore-backed mirror of rulers/grid.
  // Cross-device sync + survives hard refresh even if localStorage is cleared.
  // Local IndexedDB/localStorage remains as instant boot cache.
  useUserSettingsRulersGridSync({
    enabled: enablePersistence,
    rulers,
    grid,
    origin,
    isVisible,
    setRulers: setRulersInternal,
    setGrid: setGridInternal,
    setOriginState,
    setIsVisible,
  });

  // Bounds calculation when view changes
  useEffect(() => {
    if (viewTransform && canvasBounds) {
      const bounds = RulersGridCalculations.calculateVisibleBounds(
        viewTransform,
        canvasBounds,
        grid.visual.step
      );
      setLastCalculatedBounds(bounds);
    }
  }, [viewTransform, canvasBounds, grid.visual.step]);

  // Ruler snap points (TODO: implement calculateRulerSnapPoints)
  useEffect(() => {
    setRulerSnapPoints(lastCalculatedBounds && rulers.snap.enabled ? [] : []);
  }, [rulers.snap.enabled, lastCalculatedBounds, rulers.horizontal, rulers.vertical]);

  // Grid snap points (TODO: implement calculateGridSnapPoints)
  useEffect(() => {
    setGridSnapPoints(lastCalculatedBounds && grid.snap.enabled ? [] : []);
  }, [grid.snap.enabled, lastCalculatedBounds, grid.visual, origin]);

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

  // Operations (ADR-065: logic extracted to rulers-grid-state-init.ts)
  const performOperation = useCallback(
    (operation: RulersGridOperation) =>
      executeRulersGridOperation(operation, {
        toggleRulers: rulerMethods.toggleRulers,
        toggleGrid: gridMethods.toggleGrid,
        toggleRulerSnap: snapMethods.toggleRulerSnap,
        toggleGridSnap: snapMethods.toggleGridSnap,
        resetOrigin,
      }),
    [rulerMethods, gridMethods, snapMethods, resetOrigin],
  );

  const exportSettings = useCallback(
    () => exportRulersGridSettings(rulers, grid, origin, isVisible),
    [rulers, grid, origin, isVisible],
  );

  const importSettings = useCallback(async (data: string): Promise<RulersGridOperationResult> => {
    const parsed = parseImportedSettings(data);
    if (!parsed) return { success: false, operation: 'import-settings', error: 'Import failed: invalid JSON' };
    if (parsed.rulers) setRulers({ ...DEFAULT_RULER_SETTINGS, ...parsed.rulers });
    if (parsed.grid) setGrid({ ...DEFAULT_GRID_SETTINGS, ...parsed.grid });
    if (parsed.origin) setOrigin(parsed.origin);
    if (parsed.isVisible !== undefined) setIsVisible(parsed.isVisible);
    return { success: true, operation: 'import-settings' };
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
    calculateGridBounds,
    calculateGridLines,
    calculateRulerTicks,
    getLayoutInfo,
    getContentArea,
    convertUnits,
    formatValue,
    isRulerVisible,
    isGridVisible,
    getEffectiveOpacity,
    shouldRenderGrid,
    shouldRenderRulers,
    getMaxGridLines,
    getMaxRulerTicks,
    isPerformanceOptimized,
    resetRulerSettings,
    resetGridSettings,
    validateSettings,
    autoFitGrid,
    getOptimalGridStep,
    getOptimalTickSpacing,
    
    // Operations
    performOperation,
    exportSettings,
    importSettings,
    
    // System Control
    setVisibility: setIsVisible,
    getVisibility: () => isVisible,
    resetAllSettings: () => {
      setRulers(DEFAULT_RULER_SETTINGS);
      setGrid(DEFAULT_GRID_SETTINGS);
      resetOrigin();
      setIsVisible(true);
    }
  };
}

// ============================================================================
// 🏢 ENTERPRISE: STATIC CONTEXT CREATION (ADR-125)
// ============================================================================
// CRITICAL: Context MUST be created in the SAME file as the Provider component.
// This prevents "Provider is null" errors in production builds due to bundler
// optimizations that can reorder module evaluation.
// Pattern: Autodesk/Microsoft/Google enterprise standard
// ============================================================================

/**
 * Static context instance (created once at module load)
 * This is the CANONICAL location for RulersGridContext.
 * RulersGridContextType is imported at the top of the file.
 */
export const RulersGridContext = React.createContext<RulersGridContextType | null>(null);

export function useRulersGridContext(): RulersGridHookReturn {
  const context = React.useContext(RulersGridContext);
  if (!context) {
    throw new Error('useRulersGridContext must be used within RulersGridSystem');
  }
  return context;
}

export function RulersGridSystem({ children, ...props }: RulersGridSystemProps) {
  // Debug logging removed for performance

  const value = useRulersGridSystemIntegration(props);
  // Debug logging removed for performance

  // 🏢 ENTERPRISE: No need to call setRulersGridContext - we use the shared static context

  // Debug logging removed for performance

  return (
    <RulersGridContext.Provider value={value}>
      {children}
    </RulersGridContext.Provider>
  );
}
