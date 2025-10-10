'use client';
// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_RULERS_GRID = false;
import React, { createContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform, DOMRect } from './config';
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

// ✅ ENTERPRISE: Window interface extension for debug globals
declare global {
  interface Window {
    __GRID_SETTINGS__?: GridSettings;
    __RULER_SETTINGS__?: RulerSettings;
  }
}
import { RulersGridCalculations, RulersGridRendering, RulersGridSnapping } from './utils';
import { setRulersGridContext, type RulersGridHookReturn } from './useRulersGrid';
import { RulersGridSystemProps, DEFAULT_ORIGIN } from './types';
import { useRulerManagement } from './useRulerManagement';
import { useGridManagement } from './useGridManagement';
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
  const deepMerge = <T extends Record<string, unknown>>(target: T, source: T): T => {
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
  const [rulers, setRulersInternal] = useState<RulerSettings>(() => {
    let result = { ...DEFAULT_RULER_SETTINGS };
    if (persistedData?.rulers) {
      result = deepMerge(result, persistedData.rulers);
    }
    if (initialRulerSettings) {
      result = deepMerge(result, initialRulerSettings);
    }

    // ✅ RESPECT DEFAULT SETTINGS - Let button control visibility properly
    // result.horizontal.enabled = true;  // REMOVED: Causing button synchronization issue
    // result.vertical.enabled = true;    // REMOVED: Causing button synchronization issue
    
    // ✅ ENSURE NEW PROPERTIES EXIST - Migration for showLabels, showUnits and showBackground
    if (result.horizontal.showLabels === undefined) {
      result.horizontal.showLabels = true;
    }
    if (result.horizontal.showUnits === undefined) {
      result.horizontal.showUnits = true;
    }
    if (result.horizontal.showBackground === undefined) {
      result.horizontal.showBackground = true;
    }
    if (result.horizontal.unitsFontSize === undefined) {
      result.horizontal.unitsFontSize = result.horizontal.fontSize || 10;
    }
    if (result.horizontal.showMajorTicks === undefined) {
      result.horizontal.showMajorTicks = true;
    }
    if (result.horizontal.majorTickColor === undefined) {
      result.horizontal.majorTickColor = result.horizontal.tickColor || '#ffffff';
    }
    if (result.horizontal.minorTickColor === undefined) {
      result.horizontal.minorTickColor = '#ffffff';
    }
    if (result.vertical.showLabels === undefined) {
      result.vertical.showLabels = true;
    }
    if (result.vertical.showUnits === undefined) {
      result.vertical.showUnits = true;
    }
    if (result.vertical.showBackground === undefined) {
      result.vertical.showBackground = true;
    }
    if (result.vertical.unitsFontSize === undefined) {
      result.vertical.unitsFontSize = result.vertical.fontSize || 10;
    }
    if (result.vertical.showMajorTicks === undefined) {
      result.vertical.showMajorTicks = true;
    }
    if (result.vertical.majorTickColor === undefined) {
      result.vertical.majorTickColor = result.vertical.tickColor || '#ffffff';
    }
    if (result.vertical.minorTickColor === undefined) {
      result.vertical.minorTickColor = '#ffffff';
    }
    if (result.horizontal.unitsColor === undefined) {
      result.horizontal.unitsColor = result.horizontal.textColor || '#ffffff';
    }
    if (result.vertical.unitsColor === undefined) {
      result.vertical.unitsColor = result.vertical.textColor || '#ffffff';
    }

    return result;
  });

  const [grid, setGridInternal] = useState<GridSettings>(() => {
    let result = { ...DEFAULT_GRID_SETTINGS };
    if (persistedData?.grid) {
      result = deepMerge(result, persistedData.grid);
    }
    if (initialGridSettings) {
      result = deepMerge(result, initialGridSettings);
    }

    // ✅ ENSURE STYLE PROPERTY EXISTS - Migration for grid style
    if (result.visual.style === undefined) {
      result.visual.style = 'lines'; // Default to lines if not set
    }

    return result;
  });

  const [origin, setOriginState] = useState<Point2D>(() => {
    // ✅ FORCE ORIGIN TO BOTTOM-LEFT (0,0) - User requested rulers to show 0-0 at bottom-left

    return { x: 0, y: 0 };
  });

  const [isVisible, setIsVisible] = useState<boolean>(() => 
    persistedData?.isVisible ?? initialVisibility
  );

  // 🆕 UNIFIED AUTOSAVE: Wrapped setters για integration με DxfSettingsProvider
  const setGrid = useCallback((updater: React.SetStateAction<GridSettings>) => {
    setGridInternal(prev => {
      const newGrid = typeof updater === 'function' ? updater(prev) : updater;

      // Delegate to unified autosave system
      setTimeout(() => {
        const gridSettingsEvent = new CustomEvent('dxf-grid-settings-update', {
          detail: {
            gridSettings: newGrid,
            source: 'RulersGridSystem',
            timestamp: Date.now()
          }
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(gridSettingsEvent);
        }
      }, 0);

      return newGrid;
    });
  }, []);

  const setRulers = useCallback((updater: React.SetStateAction<RulerSettings>) => {
    setRulersInternal(prev => {
      const newRulers = typeof updater === 'function' ? updater(prev) : updater;

      // Delegate to unified autosave system
      setTimeout(() => {
        const rulerSettingsEvent = new CustomEvent('dxf-ruler-settings-update', {
          detail: {
            rulerSettings: newRulers,
            source: 'RulersGridSystem',
            timestamp: Date.now()
          }
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(rulerSettingsEvent);
        }
      }, 0);

      return newRulers;
    });
  }, []);

  // 🔄 BIDIRECTIONAL SYNC: Event listeners για sync από DxfSettingsProvider
  // ✅ STABILIZATION: Added ref to prevent excessive add/remove cycles
  const listenersRegisteredRef = useRef(false);

  useEffect(() => {
    // ✅ GUARD: Prevent duplicate listener registration
    if (listenersRegisteredRef.current) {
      return;
    }

    const handleProviderGridSync = (event: CustomEvent) => {
      const { gridSettings, source, timestamp } = event.detail;
      // ✅ REMOVED CONSOLE.LOG to prevent logging during sync cycles
      setGridInternal(gridSettings);
    };

    const handleProviderRulerSync = (event: CustomEvent) => {
      const { rulerSettings, source, timestamp } = event.detail;
      // ✅ REMOVED CONSOLE.LOG to prevent logging during sync cycles
      setRulersInternal(rulerSettings);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('dxf-provider-grid-sync', handleProviderGridSync as EventListener);
      window.addEventListener('dxf-provider-ruler-sync', handleProviderRulerSync as EventListener);
      listenersRegisteredRef.current = true;
      // ✅ REMOVED CONSOLE.LOG to prevent mount/unmount logging spam
    }

    return () => {
      if (typeof window !== 'undefined' && listenersRegisteredRef.current) {
        window.removeEventListener('dxf-provider-grid-sync', handleProviderGridSync as EventListener);
        window.removeEventListener('dxf-provider-ruler-sync', handleProviderRulerSync as EventListener);
        listenersRegisteredRef.current = false;
        // ✅ REMOVED CONSOLE.LOG to prevent mount/unmount logging spam
      }
    };
  }, []);

  // 🎯 DEBUG: Expose grid settings to window για enterprise testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // ✅ ENSURE STYLE PROPERTY EXISTS before exposing to window
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
  const renderingMethods = useRenderingCalculations(rulers, grid, origin);

  // ===== ΣΥΓΧΡΟΝΙΣΜΟΣ ΜΕ DXFSETTINGSPROVIDER =====
  // Ακούει αλλαγές από τα global stores και ενημερώνει το τοπικό state
  // 🛡️ ΠΡΟΣΤΑΣΙΑ ΑΠΟ CIRCULAR UPDATES με useRef
  const isUpdatingFromGlobalRef = useRef(false);

  useEffect(() => {
    const unsubscribeGrid = globalGridStore.subscribe((newGridSettings) => {
      // ✅ REMOVED DEBUG LOG to prevent excessive logging during store sync

      // 🛡️ ΠΡΟΣΤΑΣΙΑ: Μόνο αν δεν ενημερώνουμε εμείς τα global stores
      if (!isUpdatingFromGlobalRef.current) {
        setGrid(newGridSettings);
      }
    });

    const unsubscribeRuler = globalRulerStore.subscribe((newRulerSettings) => {
      // ✅ REMOVED DEBUG LOG to prevent excessive logging during store sync

      // 🛡️ ΠΡΟΣΤΑΣΙΑ: Μόνο αν δεν ενημερώνουμε εμείς τα global stores
      if (!isUpdatingFromGlobalRef.current) {
        setRulers(newRulerSettings);
      }
    });

    return () => {
      unsubscribeGrid();
      unsubscribeRuler();
    };
  }, []); // ✅ STABILIZATION: Remove setGrid/setRulers deps to prevent infinite recreations

  // ===== REVERSE ΣΥΓΧΡΟΝΙΣΜΟΣ =====
  // Όταν αλλάζουν τοπικά οι ρυθμίσεις, ενημερώνει τα global stores
  // 🛡️ ΠΡΟΣΤΑΣΙΑ: Χρήση ref για αποφυγή circular updates
  useEffect(() => {
    isUpdatingFromGlobalRef.current = true;
    globalGridStore.update(grid);
    // ✅ REMOVED DEBUG LOG to prevent excessive logging during reverse sync
    isUpdatingFromGlobalRef.current = false;
  }, [grid]);

  useEffect(() => {
    isUpdatingFromGlobalRef.current = true;
    globalRulerStore.update(rulers);
    // ✅ REMOVED DEBUG LOG to prevent excessive logging during reverse sync
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
      try {
        localStorage.setItem(persistenceKey, JSON.stringify(dataToStore));
      } catch (error) {
        console.warn('Failed to persist rulers/grid settings:', error);
      }
    }
  }, [rulers, grid, origin, isVisible, enablePersistence, persistenceKey]);

  // Calculations and updates when view changes
  // 🛡️ ΣΤΑΘΕΡΟΠΟΙΗΣΗ: Χωρίζουμε το bounds calculation από τα snap points
  useEffect(() => {
    if (viewTransform && canvasBounds) {
      const bounds = RulersGridCalculations.calculateGridBounds(viewTransform, canvasBounds);
      setLastCalculatedBounds(bounds);
    }
  }, [viewTransform, canvasBounds]);

  // 🛡️ ΣΤΑΘΕΡΟΠΟΙΗΣΗ: Ruler snap points μόνο όταν χρειάζεται
  useEffect(() => {
    if (lastCalculatedBounds && rulers.snap.enabled) {
      const rulerSnaps = RulersGridCalculations.calculateRulerSnapPoints(rulers, lastCalculatedBounds);
      setRulerSnapPoints(rulerSnaps);
    } else {
      setRulerSnapPoints([]);
    }
  }, [rulers.snap.enabled, lastCalculatedBounds, rulers.horizontal, rulers.vertical]);

  // 🛡️ ΣΤΑΘΕΡΟΠΟΙΗΣΗ: Grid snap points μόνο όταν χρειάζεται
  useEffect(() => {
    if (lastCalculatedBounds && grid.snap.enabled) {
      const gridSnaps = RulersGridCalculations.calculateGridSnapPoints(grid, origin, lastCalculatedBounds);
      setGridSnapPoints(gridSnaps);
    } else {
      setGridSnapPoints([]);
    }
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

  const importSettings = useCallback((data: unknown): RulersGridOperationResult => {
    try {
      const settings = data as { rulers?: RulerSettings; grid?: GridSettings; origin?: Point2D; isVisible?: boolean };
      if (settings.rulers) setRulers({ ...DEFAULT_RULER_SETTINGS, ...settings.rulers });
      if (settings.grid) setGrid({ ...DEFAULT_GRID_SETTINGS, ...settings.grid });
      if (settings.origin) setOrigin(settings.origin);
      if (settings.isVisible !== undefined) setIsVisible(settings.isVisible);
      
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
  // Debug logging removed for performance
  
  const value = useRulersGridSystemIntegration(props);
  // Debug logging removed for performance

  React.useEffect(() => {
    // Debug logging removed for performance
    setRulersGridContext(RulersGridContext);
  }, []);

  // Debug logging removed for performance

  return (
    <RulersGridContext.Provider value={value}>
      {children}
    </RulersGridContext.Provider>
  );
}