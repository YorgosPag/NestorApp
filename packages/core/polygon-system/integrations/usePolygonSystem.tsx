/**
 * 🪝 USE POLYGON SYSTEM HOOK
 *
 * React hook για Universal Polygon System integration
 *
 * @module core/polygon-system/integrations/usePolygonSystem
 */

import { useState, useEffect, useRef, useCallback, createContext, useContext, type ReactNode } from 'react';
import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonType,
  PolygonStyle
} from '../types';
import {
  GeoCanvasPolygonManager,
  type GeoCanvasIntegrationOptions
} from './geo-canvas-integration';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type * as GeoJSON from 'geojson';

/**
 * Polygon system hook options
 */
export interface UsePolygonSystemOptions extends Omit<GeoCanvasIntegrationOptions, 'callbacks'> {
  /** Auto-initialize on mount */
  autoInit?: boolean;

  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Polygon system hook return type
 */
export interface UsePolygonSystemReturn {
  // Manager instance
  manager: GeoCanvasPolygonManager | null;

  // State
  polygons: UniversalPolygon[];
  currentMode: PolygonType;
  isDrawing: boolean;
  stats: {
    totalPolygons: number;
    byType: Record<PolygonType, number>;
  };

  // Actions
  initialize: (canvas: HTMLCanvasElement, map?: MaplibreMap) => void;
  startDrawing: (type?: PolygonType, style?: Partial<PolygonStyle>) => void;
  addPoint: (x: number, y: number, geoCoords?: { lng: number; lat: number }) => PolygonPoint | null;
  finishDrawing: () => UniversalPolygon | null;
  cancelDrawing: () => void;
  setMode: (mode: PolygonType) => void;
  deletePolygon: (id: string) => boolean;
  clearAll: () => void;

  // Export/Import
  exportAsGeoJSON: () => GeoJSON.FeatureCollection;
  exportByType: (type: PolygonType) => GeoJSON.FeatureCollection;
  importFromGeoJSON: (geojson: GeoJSON.FeatureCollection) => { imported: number; errors: string[] };

  // Map integration
  addPolygonToMap: (polygon: UniversalPolygon) => void;
  removePolygonFromMap: (polygonId: string) => void;

  // Utilities
  getPolygon: (id: string) => UniversalPolygon | null;
  getPolygonsByType: (type: PolygonType) => UniversalPolygon[];
}

/**
 * Universal Polygon System hook
 */
export function usePolygonSystem(options: UsePolygonSystemOptions = {}): UsePolygonSystemReturn {
  const {
    autoInit = true,
    debug = false,
    defaultMode = 'simple',
    autoSave = true,
    storageKey = 'polygon-system-data',
    ...otherOptions
  } = options;

  // State
  const [manager, setManager] = useState<GeoCanvasPolygonManager | null>(null);
  const [polygons, setPolygons] = useState<UniversalPolygon[]>([]);
  const [currentMode, setCurrentMode] = useState<PolygonType>(defaultMode);
  const [isDrawing, setIsDrawing] = useState(false);
  const [stats, setStats] = useState<{
    totalPolygons: number;
    byType: Record<PolygonType, number>;
  }>({
    totalPolygons: 0,
    byType: {
      'simple': 0,
      'freehand': 0,
      'point': 0,
      'georeferencing': 0,
      'alert-zone': 0,
      'real-estate': 0,
      'measurement': 0,
      'annotation': 0
    }
  });

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);

  /**
   * Update state from manager
   */
  const updateState = useCallback(() => {
    if (!manager) return;

    const managerStats = manager.getStats();
    const allPolygons = manager.getPolygons();

    setPolygons(allPolygons);
    setCurrentMode(managerStats.currentMode);
    setIsDrawing(managerStats.isDrawing);
    setStats({
      totalPolygons: managerStats.totalPolygons,
      byType: managerStats.byType
    });

    if (debug) {
      console.log('🔄 Polygon system state updated:', managerStats);
    }
  }, [manager, debug]);

  /**
   * Initialize polygon manager
   */
  const initialize = useCallback((canvas: HTMLCanvasElement, map?: MaplibreMap) => {
    canvasRef.current = canvas;
    mapRef.current = map ?? null;

    const integrationOptions: GeoCanvasIntegrationOptions = {
      canvas,
      map,
      defaultMode,
      autoSave,
      storageKey,
      callbacks: {
        onPolygonCreated: (polygon) => {
          if (debug) console.log('✅ Polygon created:', polygon);
          updateState();
        },
        onPolygonModified: (polygon) => {
          if (debug) console.log('📝 Polygon modified:', polygon);
          updateState();
        },
        onPolygonDeleted: (polygonId) => {
          if (debug) console.log('🗑️ Polygon deleted:', polygonId);
          updateState();
        },
        onModeChanged: (mode) => {
          if (debug) console.log('🔄 Mode changed:', mode);
          setCurrentMode(mode);
        }
      },
      ...otherOptions
    };

    const newManager = new GeoCanvasPolygonManager(integrationOptions);
    setManager(newManager);

    if (debug) {
      console.log('🚀 Polygon system initialized');
    }
  }, [defaultMode, autoSave, storageKey, debug, updateState, otherOptions]);

  /**
   * Start drawing
   */
  const startDrawing = useCallback((type?: PolygonType, style?: Partial<PolygonStyle>) => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return;
    }

    manager.startDrawing(type, style);
    setIsDrawing(true);
  }, [manager]);

  /**
   * Add point
   */
  const addPoint = useCallback((
    x: number,
    y: number,
    geoCoords?: { lng: number; lat: number }
  ): PolygonPoint | null => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return null;
    }

    const point = manager.addPoint(x, y, geoCoords);
    updateState();
    return point;
  }, [manager, updateState]);

  /**
   * Finish drawing
   */
  const finishDrawing = useCallback((): UniversalPolygon | null => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return null;
    }

    const polygon = manager.finishDrawing();
    setIsDrawing(false);
    updateState();
    return polygon;
  }, [manager, updateState]);

  /**
   * Cancel drawing
   */
  const cancelDrawing = useCallback(() => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return;
    }

    manager.cancelDrawing();
    setIsDrawing(false);
    updateState();
  }, [manager, updateState]);

  /**
   * Set mode
   */
  const setMode = useCallback((mode: PolygonType) => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return;
    }

    manager.setMode(mode);
    setCurrentMode(mode);
  }, [manager]);

  /**
   * Delete polygon
   */
  const deletePolygon = useCallback((id: string): boolean => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return false;
    }

    const deleted = manager.deletePolygon(id);
    if (deleted) {
      updateState();
    }
    return deleted;
  }, [manager, updateState]);

  /**
   * Clear all polygons
   */
  const clearAll = useCallback(() => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return;
    }

    manager.clearAll();
    updateState();
  }, [manager, updateState]);

  /**
   * Export as GeoJSON
   */
  const exportAsGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return { type: 'FeatureCollection', features: [] };
    }

    return manager.exportAsGeoJSON();
  }, [manager]);

  /**
   * Export by type
   */
  const exportByType = useCallback((type: PolygonType): GeoJSON.FeatureCollection => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return { type: 'FeatureCollection', features: [] };
    }

    return manager.exportByType(type);
  }, [manager]);

  /**
   * Import from GeoJSON
   */
  const importFromGeoJSON = useCallback((
    geojson: GeoJSON.FeatureCollection
  ): { imported: number; errors: string[] } => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return { imported: 0, errors: ['Manager not initialized'] };
    }

    const result = manager.importFromGeoJSON(geojson);
    updateState();
    return result;
  }, [manager, updateState]);

  /**
   * Add polygon to map
   */
  const addPolygonToMap = useCallback((polygon: UniversalPolygon) => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return;
    }

    manager.addPolygonToMap(polygon);
  }, [manager]);

  /**
   * Remove polygon from map
   */
  const removePolygonFromMap = useCallback((polygonId: string) => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return;
    }

    manager.removePolygonFromMap(polygonId);
  }, [manager]);

  /**
   * Get polygon by ID
   */
  const getPolygon = useCallback((id: string): UniversalPolygon | null => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return null;
    }

    return manager.getPolygon(id);
  }, [manager]);

  /**
   * Get polygons by type
   */
  const getPolygonsByType = useCallback((type: PolygonType): UniversalPolygon[] => {
    if (!manager) {
      console.warn('⚠️ Manager not initialized');
      return [];
    }

    return manager.getPolygonsByType(type);
  }, [manager]);

  // Auto-initialize on mount if canvas is available
  useEffect(() => {
    if (autoInit && canvasRef.current && !manager) {
      initialize(canvasRef.current, mapRef.current ?? undefined);
    }
  }, [autoInit, manager, initialize]);

  // Update state when manager changes
  useEffect(() => {
    if (manager) {
      updateState();
    }
  }, [manager, updateState]);

  return {
    manager,
    polygons,
    currentMode,
    isDrawing,
    stats,
    initialize,
    startDrawing,
    addPoint,
    finishDrawing,
    cancelDrawing,
    setMode,
    deletePolygon,
    clearAll,
    exportAsGeoJSON,
    exportByType,
    importFromGeoJSON,
    addPolygonToMap,
    removePolygonFromMap,
    getPolygon,
    getPolygonsByType
  };
}

/**
 * Polygon system context provider (optional για complex apps)
 */
const PolygonSystemContext = createContext<UsePolygonSystemReturn | null>(null);

export interface PolygonSystemProviderProps {
  children: ReactNode;
  options?: UsePolygonSystemOptions;
}

export function PolygonSystemProvider({ children, options }: PolygonSystemProviderProps) {
  const polygonSystem = usePolygonSystem(options);

  return (
    <PolygonSystemContext.Provider value={polygonSystem}>
      {children}
    </PolygonSystemContext.Provider>
  );
}

export function usePolygonSystemContext(): UsePolygonSystemReturn {
  const context = useContext(PolygonSystemContext);

  if (!context) {
    throw new Error('usePolygonSystemContext must be used within PolygonSystemProvider');
  }

  return context;
}
