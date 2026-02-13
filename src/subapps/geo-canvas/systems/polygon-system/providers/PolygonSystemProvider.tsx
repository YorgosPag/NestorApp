/**
 * 🏢 ENTERPRISE POLYGON SYSTEM PROVIDER
 * Centralized state management for polygon operations
 *
 * @module polygon-system/providers
 * @enterprise-pattern Context Provider + State Management
 */

'use client';

import React, { createContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { usePolygonSystem } from '@geo-alert/core';
import type { PolygonType, UniversalPolygon } from '@geo-alert/core';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type {
  UserRole,
  PolygonSystemState,
  PolygonSystemActions,
  PolygonSystemContext as PolygonSystemContextType,
  RoleBasedConfig,
  MapRef
} from '../types/polygon-system.types';
import { getRoleConfig } from '../utils/polygon-config';

// ============================================================================
// CONTEXT CREATION
// ============================================================================

export const PolygonSystemContext = createContext<PolygonSystemContextType | null>(null);

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Polygon system actions
 */
/** Drawing configuration options */
interface DrawingConfig {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  [key: string]: unknown;
}

/** Completed polygon point */
type CompletedPolygonPoint = [number, number];

type PolygonSystemAction =
  | { type: 'SET_ROLE'; payload: UserRole }
  | { type: 'SET_POLYGONS'; payload: UniversalPolygon[] }
  | { type: 'START_DRAWING'; payload: { type: PolygonType; config?: DrawingConfig } }
  | { type: 'FINISH_DRAWING'; payload?: UniversalPolygon }
  | { type: 'CANCEL_DRAWING' }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_POLYGON_COMPLETE'; payload: boolean }
  | { type: 'SET_COMPLETED_POLYGON'; payload: CompletedPolygonPoint[] | null }
  | { type: 'SET_MAP_REF'; payload: React.RefObject<MapRef> | null }
  | { type: 'SET_MAP_LOADED'; payload: boolean }
  | { type: 'SET_COORDINATE_PICKING'; payload: boolean }
  | { type: 'BLOCK_COORDINATE_PICKING'; payload: boolean };

/**
 * Initial state
 */
const initialState: PolygonSystemState = {
  currentRole: 'citizen',
  polygons: [],
  isDrawing: false,
  currentTool: null,
  currentDrawing: null,
  isPolygonComplete: false,
  completedPolygon: null,
  mapRef: null,
  mapLoaded: false,
  isPickingCoordinates: false,
  coordinatePickingBlocked: false
};

/**
 * State reducer
 */
function polygonSystemReducer(
  state: PolygonSystemState,
  action: PolygonSystemAction
): PolygonSystemState {
  switch (action.type) {
    case 'SET_ROLE':
      return { ...state, currentRole: action.payload };

    case 'SET_POLYGONS':
      return { ...state, polygons: action.payload };

    case 'START_DRAWING':
      return {
        ...state,
        isDrawing: true,
        currentTool: action.payload.type,
        coordinatePickingBlocked: false,
        currentDrawing: {
          type: action.payload.type,
          config: action.payload.config
        }
      };

    case 'FINISH_DRAWING':
      return {
        ...state,
        isDrawing: false,
        currentTool: null,
        currentDrawing: null,
        polygons: action.payload
          ? [...state.polygons, action.payload]
          : state.polygons
      };

    case 'CANCEL_DRAWING':
      return {
        ...state,
        isDrawing: false,
        currentTool: null,
        currentDrawing: null
      };

    case 'CLEAR_ALL':
      return {
        ...state,
        polygons: [],
        isDrawing: false,
        currentTool: null,
        isPolygonComplete: false,
        completedPolygon: null
      };

    case 'SET_POLYGON_COMPLETE':
      return {
        ...state,
        isPolygonComplete: action.payload,
        coordinatePickingBlocked: action.payload
      };

    case 'SET_COMPLETED_POLYGON':
      return { ...state, completedPolygon: action.payload };

    case 'SET_MAP_REF':
      return { ...state, mapRef: action.payload };

    case 'SET_MAP_LOADED':
      return { ...state, mapLoaded: action.payload };

    case 'SET_COORDINATE_PICKING':
      return { ...state, isPickingCoordinates: action.payload };

    case 'BLOCK_COORDINATE_PICKING':
      return { ...state, coordinatePickingBlocked: action.payload };

    default:
      return state;
  }
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface PolygonSystemProviderProps {
  children: React.ReactNode;
  initialRole?: UserRole;
  config?: Partial<RoleBasedConfig>;
}

export function PolygonSystemProvider({
  children,
  initialRole = 'citizen',
  config: configOverrides
}: PolygonSystemProviderProps) {
  const [state, dispatch] = useReducer(polygonSystemReducer, {
    ...initialState,
    currentRole: initialRole
  });

  // Get current configuration
  const config = React.useMemo(() => {
    const baseConfig = getRoleConfig(state.currentRole);
    return configOverrides
      ? { ...baseConfig, ...configOverrides }
      : baseConfig;
  }, [state.currentRole, configOverrides]);

  // Create a dummy canvas for polygon system initialization
  const dummyCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize dummy canvas once
  useEffect(() => {
    if (!dummyCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      canvas.style.display = 'none';
      dummyCanvasRef.current = canvas;
    }
  }, []);

  // Core polygon system from @geo-alert/core
  const corePolygonSystem = usePolygonSystem({
    autoInit: false, // We'll initialize manually
    debug: config.debug,
    enableSnapping: config.enableSnapping,
    snapTolerance: config.snapTolerance
  });

  // Manual initialization when we have both canvas and map
  useEffect(() => {
    if (dummyCanvasRef.current && state.mapRef?.current && !corePolygonSystem.manager) {
      const map = state.mapRef.current.getMap?.() as MaplibreMap | undefined;
      if (map && corePolygonSystem.initialize) {
        corePolygonSystem.initialize(dummyCanvasRef.current, map);
      }
    }
  }, [state.mapRef, corePolygonSystem.initialize, corePolygonSystem.manager]);

  // ============================================================================
  // ACTIONS IMPLEMENTATION
  // ============================================================================

  const setRole = useCallback((role: UserRole) => {
    dispatch({ type: 'SET_ROLE', payload: role });
  }, []);

  const startDrawing = useCallback((type: PolygonType, drawingConfig?: DrawingConfig) => {
    // Start drawing with core system
    corePolygonSystem.startDrawing(type, {
      fillColor: drawingConfig?.fillColor || config.visualFeedback.lines.drawing.color + '40',
      strokeColor: drawingConfig?.strokeColor || config.visualFeedback.lines.drawing.color,
      strokeWidth: drawingConfig?.strokeWidth || config.visualFeedback.lines.drawing.width,
      ...drawingConfig
    });

    dispatch({ type: 'START_DRAWING', payload: { type, config: drawingConfig } });
  }, [state.currentRole, config, corePolygonSystem]);

  const finishDrawing = useCallback(() => {
    const polygon = corePolygonSystem.finishDrawing();

    // ✅ ENTERPRISE: Apply stored configuration to finished polygon
    if (polygon && state.currentDrawing?.config) {
      polygon.config = { ...polygon.config, ...state.currentDrawing.config };
    }

    if (polygon) {
      dispatch({ type: 'FINISH_DRAWING', payload: polygon });
    } else {
      dispatch({ type: 'FINISH_DRAWING' });
    }

    return polygon;
  }, [state.currentRole, corePolygonSystem, state.currentDrawing]);

  const cancelDrawing = useCallback(() => {
    corePolygonSystem.cancelDrawing();
    dispatch({ type: 'CANCEL_DRAWING' });
  }, [state.currentRole, corePolygonSystem]);

  const clearAll = useCallback(() => {
    corePolygonSystem.clearAll();
    dispatch({ type: 'CLEAR_ALL' });
  }, [state.currentRole, corePolygonSystem]);

  const addPoint = useCallback((longitude: number, latitude: number) => {
    // Add point to core system using geo coordinates directly
    // For map-based polygons, x=longitude and y=latitude (geo coordinates)
    if (corePolygonSystem.addPoint) {
      corePolygonSystem.addPoint(longitude, latitude, { lng: longitude, lat: latitude });
    }
  }, [state.currentRole, corePolygonSystem]);

  // Legacy compatibility
  const handlePolygonClosure = useCallback(() => {
    dispatch({ type: 'SET_POLYGON_COMPLETE', payload: true });

    // Show notification
    showNotification('Πολύγωνο κλείστηκε επιτυχώς!', 'success');
  }, [state.currentRole]);

  const setMapRef = useCallback((ref: React.RefObject<MapRef> | null) => {
    dispatch({ type: 'SET_MAP_REF', payload: ref });
  }, []);

  const setMapLoaded = useCallback((loaded: boolean) => {
    dispatch({ type: 'SET_MAP_LOADED', payload: loaded });
  }, []);

  const setCoordinatePicking = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_COORDINATE_PICKING', payload: enabled });
  }, []);

  const blockCoordinatePicking = useCallback((blocked: boolean) => {
    dispatch({ type: 'BLOCK_COORDINATE_PICKING', payload: blocked });
  }, []);

  // ✅ ENTERPRISE: Update polygon configuration (για real-time radius changes)
  const updatePolygonConfig = useCallback((polygonId: string, configUpdates: Partial<{
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    pointMode: boolean;
    radius: number;
    [key: string]: unknown;
  }>) => {
    // Find polygon and update its config
    const polygonIndex = state.polygons.findIndex(p => p.id === polygonId);
    if (polygonIndex !== -1) {
      const updatedPolygons = [...state.polygons];
      updatedPolygons[polygonIndex] = {
        ...updatedPolygons[polygonIndex],
        config: {
          ...updatedPolygons[polygonIndex].config,
          ...configUpdates
        }
      };
      dispatch({ type: 'SET_POLYGONS', payload: updatedPolygons });
      console.debug('✅ Updated polygon config:', polygonId, configUpdates);
    }
  }, [state.polygons]);

  // Notification system
  // Export functionality
  const exportAsGeoJSON = useCallback(() => {
    if (corePolygonSystem.exportAsGeoJSON) {
      return corePolygonSystem.exportAsGeoJSON();
    } else {
      return { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
    }
  }, [state.currentRole, corePolygonSystem]);

  // Get current drawing state for live preview
  const getCurrentDrawing = useCallback(() => {
    return corePolygonSystem.manager?.getCurrentDrawing() || null;
  }, [corePolygonSystem.manager]);

  const showNotification = useCallback((
    message: string,
    type: 'success' | 'warning' | 'error'
  ) => {
    const notification = document.createElement('div');
    notification.className = `${config.notifications.position} ${config.notifications.styles[type]} z-[${config.visualFeedback.zIndex.notifications}]`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, config.notifications.autoRemoveDelay);
  }, [config]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const actions: PolygonSystemActions = {
    setRole,
    startDrawing,
    finishDrawing,
    cancelDrawing,
    clearAll,
    addPoint,
    exportAsGeoJSON,
    getCurrentDrawing,
    handlePolygonClosure,
    setMapRef,
    setMapLoaded,
    setCoordinatePicking,
    blockCoordinatePicking,
    updatePolygonConfig,
    showNotification
  };

  const contextValue: PolygonSystemContextType = {
    state,
    actions,
    config
  };

  // ============================================================================
  // SYNC WITH CORE SYSTEM
  // ============================================================================

  // Sync polygons from core system
  useEffect(() => {
    const currentPolygons = corePolygonSystem.polygons || [];
    if (currentPolygons.length !== state.polygons.length) {
      dispatch({ type: 'SET_POLYGONS', payload: currentPolygons });
    }
  }, [corePolygonSystem.polygons, state.polygons.length]);

  return (
    <PolygonSystemContext.Provider value={contextValue}>
      {children}
    </PolygonSystemContext.Provider>
  );
}
