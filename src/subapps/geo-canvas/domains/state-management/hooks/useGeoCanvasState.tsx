/**
 * 🔄 GEO CANVAS STATE MANAGEMENT - ENTERPRISE DOMAIN MODULE
 *
 * Centralized state management για όλο το geo-canvas system.
 * Domain-driven design με Redux-style patterns.
 *
 * @module useGeoCanvasState
 * @domain state-management
 * @version 2.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @extracted από GeoCanvasContent.tsx (state logic)
 * @created 2025-12-28 - Domain decomposition
 */

import React from 'react';
import { PanelPosition } from '../../enterprise-types/GeoCanvasTypes';

// ============================================================================
// 🎯 ENTERPRISE TYPES - STATE MANAGEMENT DOMAIN
// ============================================================================

export interface GeoCanvasMode {
  current: 'view' | 'edit' | 'measure' | 'annotate';
  previous: 'view' | 'edit' | 'measure' | 'annotate';
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds?: [[number, number], [number, number]];
}

export interface PanelState {
  id: string;
  position: PanelPosition;
  isVisible: boolean;
  isMinimized: boolean;
  width?: number;
  height?: number;
}

export interface ToolState {
  activeTool: string | null;
  toolSettings: Record<string, unknown>;
  measurementData: Array<{
    type: 'distance' | 'area';
    coordinates: number[][];
    result: number;
  }>;
}

export interface GeoCanvasState {
  // Core state
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;

  // Mode management
  mode: GeoCanvasMode;

  // Map state
  mapView: MapViewState;

  // Panel system
  panels: Map<string, PanelState>;
  panelZOrder: string[];

  // Tool system
  tools: ToolState;

  // UI state
  ui: {
    sidebarWidth: number;
    toolbarPosition: 'top' | 'bottom' | 'left' | 'right';
    theme: 'light' | 'dark' | 'auto';
  };
}

// ============================================================================
// 🎯 STATE ACTIONS - ENTERPRISE REDUX PATTERN
// ============================================================================

// 🏢 ENTERPRISE: Type-safe mode values
export type GeoCanvasModeValue = 'view' | 'edit' | 'measure' | 'annotate';

export type GeoCanvasAction =
  | { type: 'INITIALIZE'; payload?: Partial<GeoCanvasState> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'CHANGE_MODE'; payload: { mode: GeoCanvasModeValue; saveHistory?: boolean } }
  | { type: 'UPDATE_MAP_VIEW'; payload: Partial<MapViewState> }
  | { type: 'UPDATE_PANEL'; payload: { panelId: string; updates: Partial<PanelState> } }
  | { type: 'ADD_PANEL'; payload: PanelState }
  | { type: 'REMOVE_PANEL'; payload: string }
  | { type: 'REORDER_PANELS'; payload: string[] }
  | { type: 'SET_ACTIVE_TOOL'; payload: string | null }
  | { type: 'UPDATE_TOOL_SETTINGS'; payload: { tool: string; settings: Record<string, unknown> } }
  | { type: 'ADD_MEASUREMENT'; payload: { type: 'distance' | 'area'; coordinates: number[][]; result: number } }
  | { type: 'UPDATE_UI'; payload: Partial<GeoCanvasState['ui']> };

// ============================================================================
// 🔄 STATE REDUCER - ENTERPRISE IMMUTABLE PATTERNS
// ============================================================================

const initialState: GeoCanvasState = {
  isInitialized: false,
  isLoading: false,
  error: null,
  mode: {
    current: 'view',
    previous: 'view'
  },
  mapView: {
    center: [23.7275, 37.9838], // Athens, Greece - Default
    zoom: 10,
    bearing: 0,
    pitch: 0
  },
  panels: new Map(),
  panelZOrder: [],
  tools: {
    activeTool: null,
    toolSettings: {},
    measurementData: []
  },
  ui: {
    sidebarWidth: 300,
    toolbarPosition: 'top',
    theme: 'light'
  }
};

function geoCanvasReducer(state: GeoCanvasState, action: GeoCanvasAction): GeoCanvasState {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        ...action.payload,
        isInitialized: true,
        isLoading: false,
        error: null
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };

    case 'CHANGE_MODE':
      return {
        ...state,
        mode: {
          current: action.payload.mode,
          previous: action.payload.saveHistory !== false ? state.mode.current : state.mode.previous
        }
      };

    case 'UPDATE_MAP_VIEW':
      return {
        ...state,
        mapView: {
          ...state.mapView,
          ...action.payload
        }
      };

    case 'UPDATE_PANEL': {
      const newPanels = new Map(state.panels);
      const existingPanel = newPanels.get(action.payload.panelId);
      if (existingPanel) {
        newPanels.set(action.payload.panelId, {
          ...existingPanel,
          ...action.payload.updates
        });
      }
      return {
        ...state,
        panels: newPanels
      };
    }

    case 'ADD_PANEL': {
      const newPanels = new Map(state.panels);
      newPanels.set(action.payload.id, action.payload);
      return {
        ...state,
        panels: newPanels,
        panelZOrder: [...state.panelZOrder, action.payload.id]
      };
    }

    case 'REMOVE_PANEL': {
      const newPanels = new Map(state.panels);
      newPanels.delete(action.payload);
      return {
        ...state,
        panels: newPanels,
        panelZOrder: state.panelZOrder.filter(id => id !== action.payload)
      };
    }

    case 'REORDER_PANELS':
      return {
        ...state,
        panelZOrder: action.payload
      };

    case 'SET_ACTIVE_TOOL':
      return {
        ...state,
        tools: {
          ...state.tools,
          activeTool: action.payload
        }
      };

    case 'UPDATE_TOOL_SETTINGS':
      return {
        ...state,
        tools: {
          ...state.tools,
          toolSettings: {
            ...state.tools.toolSettings,
            [action.payload.tool]: action.payload.settings
          }
        }
      };

    case 'ADD_MEASUREMENT':
      return {
        ...state,
        tools: {
          ...state.tools,
          measurementData: [...state.tools.measurementData, action.payload]
        }
      };

    case 'UPDATE_UI':
      return {
        ...state,
        ui: {
          ...state.ui,
          ...action.payload
        }
      };

    default:
      return state;
  }
}

// ============================================================================
// 🔄 ENTERPRISE STATE HOOK
// ============================================================================

export function useGeoCanvasState(initialData?: Partial<GeoCanvasState>) {
  const [state, dispatch] = React.useReducer(geoCanvasReducer, {
    ...initialState,
    ...initialData
  });

  // ========================================================================
  // 🎯 ACTION CREATORS - ENTERPRISE API
  // ========================================================================

  const actions = React.useMemo(() => ({
    // Initialization
    initialize: (data?: Partial<GeoCanvasState>) =>
      dispatch({ type: 'INITIALIZE', payload: data }),

    setLoading: (isLoading: boolean) =>
      dispatch({ type: 'SET_LOADING', payload: isLoading }),

    setError: (error: Error | null) =>
      dispatch({ type: 'SET_ERROR', payload: error }),

    // Mode management
    changeMode: (mode: GeoCanvasModeValue, saveHistory = true) =>
      dispatch({ type: 'CHANGE_MODE', payload: { mode, saveHistory } }),

    // Map controls
    updateMapView: (updates: Partial<MapViewState>) =>
      dispatch({ type: 'UPDATE_MAP_VIEW', payload: updates }),

    // Panel management
    updatePanel: (panelId: string, updates: Partial<PanelState>) =>
      dispatch({ type: 'UPDATE_PANEL', payload: { panelId, updates } }),

    addPanel: (panel: PanelState) =>
      dispatch({ type: 'ADD_PANEL', payload: panel }),

    removePanel: (panelId: string) =>
      dispatch({ type: 'REMOVE_PANEL', payload: panelId }),

    reorderPanels: (newOrder: string[]) =>
      dispatch({ type: 'REORDER_PANELS', payload: newOrder }),

    // Tool management
    setActiveTool: (toolId: string | null) =>
      dispatch({ type: 'SET_ACTIVE_TOOL', payload: toolId }),

    updateToolSettings: (tool: string, settings: Record<string, unknown>) =>
      dispatch({ type: 'UPDATE_TOOL_SETTINGS', payload: { tool, settings } }),

    addMeasurement: (measurement: { type: 'distance' | 'area'; coordinates: number[][]; result: number }) =>
      dispatch({ type: 'ADD_MEASUREMENT', payload: measurement }),

    // UI controls
    updateUI: (updates: Partial<GeoCanvasState['ui']>) =>
      dispatch({ type: 'UPDATE_UI', payload: updates })
  }), []);

  // ========================================================================
  // 🎯 COMPUTED VALUES - ENTERPRISE SELECTORS
  // ========================================================================

  const selectors = React.useMemo(() => ({
    // State queries
    isReady: state.isInitialized && !state.isLoading && !state.error,
    hasError: Boolean(state.error),
    currentMode: state.mode.current,
    previousMode: state.mode.previous,

    // Panel queries
    visiblePanels: Array.from(state.panels.values()).filter(panel => panel.isVisible),
    panelCount: state.panels.size,
    topPanel: state.panelZOrder[state.panelZOrder.length - 1] || null,

    // Tool queries
    hasActiveTool: Boolean(state.tools.activeTool),
    activeTool: state.tools.activeTool,
    measurementCount: state.tools.measurementData.length,

    // Map queries
    mapCenter: state.mapView.center,
    mapZoom: state.mapView.zoom,
    mapBounds: state.mapView.bounds
  }), [state]);

  // ========================================================================
  // 🏢 ENTERPRISE RETURN INTERFACE
  // ========================================================================

  return {
    state,
    actions,
    selectors,
    dispatch // Direct access for advanced usage
  };
}

// ============================================================================
// 🔗 DOMAIN EXPORTS - STATE MANAGEMENT
// ============================================================================

export { initialState, geoCanvasReducer };
export default useGeoCanvasState;

/**
 * 🏢 ENTERPRISE METADATA - STATE MANAGEMENT DOMAIN
 *
 * ✅ Domain: state-management
 * ✅ Pattern: Redux-style reducer με TypeScript
 * ✅ Immutability: Πλήρως immutable state updates
 * ✅ Type Safety: 100% typed actions και state
 * ✅ Selectors: Memoized computed values
 * ✅ Performance: useReducer με optimized action creators
 * ✅ Scalability: Modular actions, extensible state structure
 */
