/**
 * 🏢 ENTERPRISE POLYGON SYSTEM PROVIDER
 * Centralized state management for polygon operations
 *
 * @module polygon-system/providers
 * @enterprise-pattern Context Provider + State Management
 */

'use client';

import React, { createContext, useReducer, useRef, useCallback, useEffect, useState } from 'react';
import { usePolygonSystem } from '@geo-alert/core';
import type { PolygonType, UniversalPolygon, PolygonPoint } from '@geo-alert/core';
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
import {
  type DrawingConfig,
  type PolygonSystemAction,
  initialState,
  polygonSystemReducer
} from './polygon-system-reducer';

export const PolygonSystemContext = createContext<PolygonSystemContextType | null>(null);

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

  // State = reactivity; Ref = sync read (avoids stale closure in setTimeout)
  const [liveDrawingPoints, setLiveDrawingPoints] = useState<PolygonPoint[]>([]);
  const liveDrawingPointsRef = useRef<PolygonPoint[]>([]);
  const [liveDrawingConfig, setLiveDrawingConfig] = useState<DrawingConfig | null>(null);
  const liveDrawingConfigRef = useRef<DrawingConfig | null>(null);
  const [liveDrawingType, setLiveDrawingType] = useState<PolygonType>('simple');
  const liveDrawingTypeRef = useRef<PolygonType>('simple');

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

  // Manual initialization with canvas (map optional — rendering handled by PolygonSystemLayers)
  useEffect(() => {
    if (dummyCanvasRef.current && !corePolygonSystem.manager && corePolygonSystem.initialize) {
      // state.mapRef.current IS the MapLibre map directly (no getMap() wrapper needed)
      const mapInstance = state.mapRef?.current as unknown as MaplibreMap | undefined;
      corePolygonSystem.initialize(dummyCanvasRef.current, mapInstance);
    }
  }, [state.mapRef, corePolygonSystem.initialize, corePolygonSystem.manager]);

  // ============================================================================
  // ACTIONS IMPLEMENTATION
  // ============================================================================

  const setRole = useCallback((role: UserRole) => {
    dispatch({ type: 'SET_ROLE', payload: role });
  }, []);

  const startDrawing = useCallback((type: PolygonType, drawingConfig?: DrawingConfig) => {
    // Reset live drawing state (both state and refs)
    liveDrawingPointsRef.current = [];
    liveDrawingConfigRef.current = drawingConfig ?? null;
    liveDrawingTypeRef.current = type;
    setLiveDrawingPoints([]);
    setLiveDrawingConfig(drawingConfig ?? null);
    setLiveDrawingType(type);

    // Cancel any existing manager drawing first — startDrawing() calls finishDrawing()
    // internally which validates (and errors) when manager has 0 points (React is SSoT).
    corePolygonSystem.cancelDrawing();

    // Also start in core system (manager may or may not be initialized)
    corePolygonSystem.startDrawing(type, {
      fillColor: drawingConfig?.fillColor || config.visualFeedback.lines.drawing.color + '40',
      strokeColor: drawingConfig?.strokeColor || config.visualFeedback.lines.drawing.color,
      strokeWidth: drawingConfig?.strokeWidth || config.visualFeedback.lines.drawing.width,
      ...drawingConfig
    });

    dispatch({ type: 'START_DRAWING', payload: { type, config: drawingConfig } });
  }, [state.currentRole, config, corePolygonSystem]);

  const finishDrawing = useCallback(() => {
    const refPoints = liveDrawingPointsRef.current;
    const refConfig = liveDrawingConfigRef.current;
    const refType = liveDrawingTypeRef.current;

    // React state is SSoT for points — never call manager.finishDrawing() with 0 points.
    // If ref has no points, cancel the manager session and return null.
    if (refPoints.length === 0) {
      corePolygonSystem.cancelDrawing();
      liveDrawingPointsRef.current = [];
      liveDrawingConfigRef.current = null;
      setLiveDrawingPoints([]);
      setLiveDrawingConfig(null);
      dispatch({ type: 'FINISH_DRAWING' });
      return null;
    }

    let polygon: UniversalPolygon | null = null;

    // ✅ ENTERPRISE: Apply stored configuration to finished polygon
    if (polygon && state.currentDrawing?.config) {
      polygon.config = { ...polygon.config, ...state.currentDrawing.config };
    }

    if (!polygon && refPoints.length > 0) {
      const mergedConfig = refConfig as unknown as Record<string, unknown>;
      polygon = {
        id: `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: refType,
        points: [...refPoints],
        isClosed: refPoints.length >= 3,
        style: {
          strokeColor: (refConfig?.strokeColor as string) || config.visualFeedback.lines.drawing.color,
          fillColor: (refConfig?.fillColor as string) || config.visualFeedback.lines.drawing.color + '40',
          strokeWidth: (refConfig?.strokeWidth as number) || config.visualFeedback.lines.drawing.width,
          fillOpacity: 0.2,
          strokeOpacity: 1,
        },
        config: mergedConfig,
        metadata: { createdAt: new Date(), modifiedAt: new Date() }
      };
    }

    liveDrawingPointsRef.current = [];
    liveDrawingConfigRef.current = null;
    setLiveDrawingPoints([]);
    setLiveDrawingConfig(null);

    if (polygon) {
      dispatch({ type: 'FINISH_DRAWING', payload: polygon });
    } else {
      dispatch({ type: 'FINISH_DRAWING' });
    }

    return polygon;
  }, [state.currentRole, corePolygonSystem, state.currentDrawing, config]);

  const cancelDrawing = useCallback(() => {
    corePolygonSystem.cancelDrawing();
    liveDrawingPointsRef.current = [];
    liveDrawingConfigRef.current = null;
    setLiveDrawingPoints([]);
    setLiveDrawingConfig(null);
    dispatch({ type: 'CANCEL_DRAWING' });
  }, [state.currentRole, corePolygonSystem]);

  const clearAll = useCallback(() => {
    corePolygonSystem.clearAll();
    liveDrawingPointsRef.current = [];
    liveDrawingConfigRef.current = null;
    setLiveDrawingPoints([]);
    setLiveDrawingConfig(null);
    dispatch({ type: 'CLEAR_ALL' });
  }, [state.currentRole, corePolygonSystem]);

  const addPoint = useCallback((longitude: number, latitude: number) => {
    const newPoint: PolygonPoint = {
      x: longitude,
      y: latitude,
      id: `point_${liveDrawingPointsRef.current.length}`,
      label: `Point ${liveDrawingPointsRef.current.length + 1}`
    };
    liveDrawingPointsRef.current = [...liveDrawingPointsRef.current, newPoint];
    setLiveDrawingPoints([...liveDrawingPointsRef.current]);

    // Also try manager (silently no-ops if null)
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

  const deletePolygon = useCallback((polygonId: string) => {
    dispatch({ type: 'DELETE_POLYGON', payload: polygonId });
  }, []);

  const movePolygonPoint = useCallback((
    polygonId: string,
    pointIndex: number,
    longitude: number,
    latitude: number
  ) => {
    dispatch({ type: 'MOVE_POLYGON_POINT', payload: { polygonId, pointIndex, longitude, latitude } });
  }, []);

  // ✅ ENTERPRISE: Update polygon configuration (για real-time radius changes)
  // Stable reference — logic lives in reducer, no state.polygons dep → no loop
  const updatePolygonConfig = useCallback((polygonId: string, configUpdates: Partial<{
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    pointMode: boolean;
    radius: number;
    [key: string]: unknown;
  }>) => {
    dispatch({ type: 'UPDATE_POLYGON_CONFIG', payload: { polygonId, configUpdates } });
  }, []);

  // Export — includes fallback polygons from state (manager may be empty)
  const exportAsGeoJSON = useCallback(() => {
    const managerGeoJSON = corePolygonSystem.exportAsGeoJSON
      ? corePolygonSystem.exportAsGeoJSON()
      : { type: 'FeatureCollection' as const, features: [] as GeoJSON.Feature[] };

    // If manager has all polygons, return as-is
    if (managerGeoJSON.features.length >= state.polygons.length) {
      return managerGeoJSON as GeoJSON.FeatureCollection;
    }

    // Fallback: build features from state.polygons for any not in manager
    const managerIds = new Set(
      managerGeoJSON.features.map(f => (f.properties as Record<string, unknown> | null)?.id as string)
    );
    const missingFeatures: GeoJSON.Feature[] = state.polygons
      .filter(p => !managerIds.has(p.id))
      .map(p => {
        const isPoint = p.config?.pointMode === true || p.points.length === 1;
        const coords = p.points.map(pt => [pt.x, pt.y]);
        // GeoJSON Polygon spec: ring must be closed (first === last point)
        if (!isPoint && p.points.length >= 3) {
          coords.push([p.points[0].x, p.points[0].y]);
        }
        const geometry: GeoJSON.Geometry = isPoint || p.points.length < 3
          ? p.points.length <= 1
            ? { type: 'Point' as const, coordinates: [p.points[0]?.x ?? 0, p.points[0]?.y ?? 0] }
            : { type: 'LineString' as const, coordinates: coords }
          : { type: 'Polygon' as const, coordinates: [coords] };
        return {
          type: 'Feature' as const,
          geometry,
          properties: { id: p.id, type: p.type, ...(p.config ?? {}) }
        };
      });

    return {
      type: 'FeatureCollection',
      features: [...managerGeoJSON.features, ...missingFeatures]
    } as GeoJSON.FeatureCollection;
  }, [state.currentRole, corePolygonSystem, state.polygons]);

  // Live preview: React state primary, manager fallback
  const getCurrentDrawing = useCallback(() => {
    if (liveDrawingPoints.length > 0 || liveDrawingConfig !== null) {
      return {
        id: 'live-drawing',
        type: liveDrawingType,
        points: liveDrawingPoints,
        isClosed: false,
        style: {
          strokeColor: (liveDrawingConfig?.strokeColor as string) || '#3b82f6',
          fillColor: (liveDrawingConfig?.fillColor as string) || '#3b82f640',
          strokeWidth: (liveDrawingConfig?.strokeWidth as number) || 2,
          fillOpacity: 0.2,
          strokeOpacity: 1,
        },
        config: liveDrawingConfig as unknown as Record<string, unknown>,
        metadata: { createdAt: new Date(), modifiedAt: new Date() }
      } as UniversalPolygon;
    }
    // Fallback to manager
    return corePolygonSystem.manager?.getCurrentDrawing() || null;
  }, [liveDrawingPoints, liveDrawingConfig, liveDrawingType, corePolygonSystem.manager]);

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
    deletePolygon,
    movePolygonPoint,
    showNotification
  };

  const contextValue: PolygonSystemContextType = {
    state,
    actions,
    config,
    liveDrawingPointCount: liveDrawingPoints.length
  };

  // ============================================================================
  // SYNC WITH CORE SYSTEM
  // ============================================================================

  // Sync polygons from core system only when manager has more (additive sync)
  useEffect(() => {
    const currentPolygons = corePolygonSystem.polygons || [];
    if (currentPolygons.length > state.polygons.length) {
      dispatch({ type: 'SET_POLYGONS', payload: currentPolygons });
    }
  }, [corePolygonSystem.polygons, state.polygons.length]);

  return (
    <PolygonSystemContext.Provider value={contextValue}>
      {children}
    </PolygonSystemContext.Provider>
  );
}
