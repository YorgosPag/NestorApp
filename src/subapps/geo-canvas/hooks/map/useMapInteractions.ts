/**
 * 🖱️ MAP INTERACTIONS HOOK - ENTERPRISE IMPLEMENTATION
 *
 * Professional map interaction handling για MapLibre GL JS.
 * Centralized event handling με polygon drawing, coordinate picking και error recovery.
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - React hooks patterns
 * - Event handling optimization
 * - Error boundary protection
 * - Performance optimization
 *
 * @module useMapInteractions
 */

import { useCallback } from 'react';
import { mapStyleManager, type MapStyleType } from '../../services/map/MapStyleManager';
import type { GeoCoordinate } from '../../types';
import type { FloorPlanControlPoint } from '../../floor-plan-system/types/control-points';
import type { AffineTransformMatrix } from '../../floor-plan-system/types';

// ============================================================================
// 🏢 ENTERPRISE: MapLibre Type Definitions
// ============================================================================

/**
 * MapLibre event with coordinates
 */
export interface MapEvent {
  lngLat?: { lng: number; lat: number };
  longitude?: number;
  latitude?: number;
  originalEvent?: MouseEvent;
  preventDefault?: () => void;
}

/**
 * MapLibre map instance interface
 */
export interface MapInstance {
  getMap?: () => MapInstance;
  getCenter?: () => { lng: number; lat: number };
  getZoom?: () => number;
  setZoom?: (zoom: number) => void;
  flyTo?: (options: { center: [number, number]; zoom?: number }) => void;
  _polygonSystem?: PolygonSystemRef;
}

/**
 * Polygon system reference attached to map
 */
export interface PolygonSystemRef {
  polygons: GeoPolygon[];
  stats: PolygonStats;
  startDrawing?: () => void;
  finishDrawing?: () => void;
  cancelDrawing?: () => void;
  isDrawing: boolean;
}

/**
 * GeoPolygon structure
 */
export interface GeoPolygon {
  id: string;
  points: Array<{ lng: number; lat: number }>;
  isClosed?: boolean;
}

/**
 * Polygon statistics
 */
export interface PolygonStats {
  totalPolygons?: number;
  activePolygons?: number;
}

/**
 * Drawing data structure
 */
export interface DrawingData {
  points: Array<{ lng: number; lat: number }>;
  config?: {
    pointMode?: boolean;
    freehandMode?: boolean;
  };
}

/**
 * Transform state from parent
 */
export interface TransformState {
  controlPoints: FloorPlanControlPoint[];
  isCalibrated: boolean;
  quality?: 'excellent' | 'good' | 'fair' | 'poor' | null;
  rmsError?: number | null;
  matrix?: AffineTransformMatrix | null;
}

/**
 * Map error event structure
 */
export interface MapErrorEvent {
  error?: {
    message?: string;
    url?: string;
    status?: number;
  };
  message?: string;
}

/**
 * Map ref type
 */
export interface MapRef {
  current: MapInstance | null;
}

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface MapInteractionConfig {
  enablePolygonDrawing?: boolean;
  isPickingCoordinates?: boolean;
  clickMode?: 'off' | 'add_dxf' | 'add_geo';
  transformState: TransformState;
  onCoordinateClick?: (coordinate: GeoCoordinate) => void;
  isPolygonComplete?: boolean;

  // Polygon system integration
  systemIsDrawing?: boolean;
  addPoint?: (lng: number, lat: number) => void;
  getCurrentDrawing?: () => DrawingData | null;
  finishDrawing?: () => void;
  isInFreehandMode?: () => boolean;

  // Freehand state
  isDraggingFreehand?: boolean;
  setIsDraggingFreehand?: (dragging: boolean) => void;
  lastDragPoint?: { lng: number, lat: number } | null;
  setLastDragPoint?: (point: { lng: number, lat: number } | null) => void;

  // Coordinate state
  setHoveredCoordinate?: (coord: GeoCoordinate) => void;
  setForceUpdate?: (fn: (prev: number) => number) => void;
  cancelDrawing?: () => void;
}

export interface MapInteractionHandlers {
  handleMapClick: (event: MapEvent) => void;
  handleMapMouseMove: (event: MapEvent) => void;
  handleMapMouseDown: (event: MapEvent) => void;
  handleMapMouseUp: () => void;
  handleMapLoad: (
    onMapReady?: (map: MapInstance) => void,
    enablePolygonDrawing?: boolean,
    setMapRef?: (ref: MapRef) => void,
    polygons?: GeoPolygon[],
    stats?: PolygonStats,
    startDrawing?: () => void,
    finishDrawing?: () => void,
    cancelDrawing?: () => void,
    systemIsDrawing?: boolean
  ) => (event: { target: MapInstance }) => void;
  handleMapError: (
    error: MapErrorEvent,
    currentMapStyle: MapStyleType,
    setCurrentMapStyle: (style: MapStyleType) => void,
    setMapLoaded: (loaded: boolean) => void
  ) => void;
  handleMapStyleChange: (
    newStyle: MapStyleType,
    setCurrentMapStyle: (style: MapStyleType) => void,
    setMapLoaded: (loaded: boolean) => void
  ) => void;
}

// ============================================================================
// 🖱️ MAP INTERACTIONS HOOK
// ============================================================================

/**
 * Enterprise map interaction hook με centralized event handling
 */
export const useMapInteractions = (config: MapInteractionConfig): MapInteractionHandlers => {

  // ========================================================================
  // 🖱️ MAP CLICK HANDLER
  // ========================================================================

  const handleMapClick = useCallback((event: MapEvent) => {
    const lngLat = event.lngLat || { lng: event.longitude, lat: event.latitude };
    const lng = lngLat.lng ?? 0;
    const lat = lngLat.lat ?? 0;
    if (lng === 0 && lat === 0) return; // Invalid coordinates
    const coordinate: GeoCoordinate = { lng, lat };

    // ✅ NEW: Universal Polygon System - Handle polygon drawing
    if (config.enablePolygonDrawing && config.systemIsDrawing) {
      // Skip click handling for freehand mode (handled by mouse drag)
      if (config.isInFreehandMode && config.isInFreehandMode()) return;

      // Add point to polygon system using centralized method
      if (config.addPoint) {
        config.addPoint(lng, lat);
      }

      // ✅ NEW: Check if this is point mode - automatically finish after first click
      const currentDrawing = config.getCurrentDrawing && config.getCurrentDrawing();
      if (currentDrawing?.config?.pointMode === true) {
        // For point mode, finish drawing immediately after first click
        setTimeout(() => {
          if (config.finishDrawing) {
            config.finishDrawing();
          }
        }, 100); // Small delay to ensure point is added first
      }

      return;
    }

    // 🔒 ENTERPRISE: Handle coordinate picking for control points
    if (!config.isPickingCoordinates || !config.onCoordinateClick || config.isPolygonComplete) {
      if (config.isPolygonComplete) {
        // Polygon is complete, no more coordinate picking
      }
      return;
    }

    config.onCoordinateClick(coordinate);
  }, [
    config.isPickingCoordinates,
    config.onCoordinateClick,
    config.isPolygonComplete,
    config.enablePolygonDrawing,
    config.systemIsDrawing,
    config.addPoint,
    config.getCurrentDrawing,
    config.finishDrawing,
    config.isInFreehandMode
  ]);

  // ========================================================================
  // 🖱️ MAP MOUSE MOVE HANDLER
  // ========================================================================

  const handleMapMouseMove = useCallback((event: MapEvent) => {
    const lngLat = event.lngLat || { lng: event.longitude, lat: event.latitude };
    const lng = lngLat.lng ?? 0;
    const lat = lngLat.lat ?? 0;
    if (lng === 0 && lat === 0) return; // Invalid coordinates

    if (config.setHoveredCoordinate) {
      config.setHoveredCoordinate({ lng, lat });
    }

    // ✅ ENTERPRISE: Freehand drawing during mouse move (when dragging)
    if (config.isDraggingFreehand && config.isInFreehandMode && config.isInFreehandMode() && config.enablePolygonDrawing) {
      // Throttling: Προσθέτουμε point μόνο αν έχουμε μετακινηθεί αρκετά
      if (config.lastDragPoint && config.addPoint) {
        const distance = Math.sqrt(
          Math.pow(lng - config.lastDragPoint.lng, 2) + Math.pow(lat - config.lastDragPoint.lat, 2)
        );

        // Minimum distance για smoother lines (0.0001 degrees ≈ 10 meters)
        if (distance > 0.0001) {
          config.addPoint(lng, lat);
          if (config.setLastDragPoint) {
            config.setLastDragPoint({ lng, lat });
          }
        }
      }
    }

    // ✅ ENTERPRISE: Update live preview for point mode
    if (config.enablePolygonDrawing && config.systemIsDrawing) {
      const currentDrawing = config.getCurrentDrawing && config.getCurrentDrawing();
      if (currentDrawing?.config?.pointMode === true && currentDrawing.points.length === 0) {
        // Force re-render για live preview
        if (config.setForceUpdate) {
          config.setForceUpdate(prev => prev + 1);
        }
      }
    }
  }, [
    config.enablePolygonDrawing,
    config.systemIsDrawing,
    config.getCurrentDrawing,
    config.isDraggingFreehand,
    config.isInFreehandMode,
    config.addPoint,
    config.lastDragPoint,
    config.setHoveredCoordinate,
    config.setLastDragPoint,
    config.setForceUpdate
  ]);

  // ========================================================================
  // 🖱️ MAP MOUSE DOWN HANDLER (Freehand Drawing)
  // ========================================================================

  const handleMapMouseDown = useCallback((event: MapEvent) => {
    // Μόνο για freehand mode
    if (!config.isInFreehandMode || !config.isInFreehandMode() || !config.enablePolygonDrawing) return;
    if (!event.lngLat) return;

    const { lng, lat } = event.lngLat;

    if (config.setIsDraggingFreehand) {
      config.setIsDraggingFreehand(true);
    }

    if (config.setLastDragPoint) {
      config.setLastDragPoint({ lng, lat });
    }

    // Ξεκινάει το freehand drawing με το πρώτο point
    if (config.addPoint) {
      config.addPoint(lng, lat);
    }
  }, [
    config.isInFreehandMode,
    config.enablePolygonDrawing,
    config.addPoint,
    config.setIsDraggingFreehand,
    config.setLastDragPoint
  ]);

  // ========================================================================
  // 🖱️ MAP MOUSE UP HANDLER (Freehand Drawing)
  // ========================================================================

  const handleMapMouseUp = useCallback(() => {
    if (!config.isDraggingFreehand || !config.isInFreehandMode || !config.isInFreehandMode()) return;

    if (config.setIsDraggingFreehand) {
      config.setIsDraggingFreehand(false);
    }

    if (config.setLastDragPoint) {
      config.setLastDragPoint(null);
    }

    // ✅ FIX: Validation - Τελειώνει το freehand drawing μόνο αν έχουμε αρκετά points
    const currentDrawing = config.getCurrentDrawing && config.getCurrentDrawing();
    if (currentDrawing && currentDrawing.points && currentDrawing.points.length >= 2) {
      if (config.finishDrawing) {
        config.finishDrawing();
      }
    } else {
      // Cancel drawing αν δεν έχουμε αρκετά points
      if (config.cancelDrawing) {
        config.cancelDrawing();
      }
      console.log('🚫 Freehand drawing cancelled: Not enough points');
    }
  }, [
    config.isDraggingFreehand,
    config.isInFreehandMode,
    config.finishDrawing,
    config.getCurrentDrawing,
    config.cancelDrawing,
    config.setIsDraggingFreehand,
    config.setLastDragPoint
  ]);

  // ========================================================================
  // 🗺️ MAP LOAD HANDLER
  // ========================================================================

  const handleMapLoad = useCallback((
    onMapReady?: (map: MapInstance) => void,
    enablePolygonDrawing?: boolean,
    setMapRef?: (ref: MapRef) => void,
    polygons?: GeoPolygon[],
    stats?: PolygonStats,
    startDrawing?: () => void,
    finishDrawing?: () => void,
    cancelDrawing?: () => void,
    systemIsDrawing?: boolean
  ) => {
    return (event: { target: MapInstance }) => {
      console.log('🗺️ Map onLoad event fired!', { event });

      const map = event?.target;
      if (!map) {
        console.warn('⚠️ Map instance not found in event.target');
        return;
      }

      // Initialize polygon system with map instance
      if (enablePolygonDrawing) {
        // Note: We don't have a canvas here, so we initialize with map only
        // The canvas would be used for overlay drawing if needed
        console.log('📦 Polygon drawing enabled');
      }

      // ✅ ENTERPRISE FIX: Pass map to centralized polygon system
      if (enablePolygonDrawing && setMapRef) {
        // Create MapRef object
        const mapRef: MapRef = { current: map };
        setMapRef(mapRef);

        map._polygonSystem = {
          polygons: polygons || [],
          stats: stats || {},
          startDrawing,
          finishDrawing,
          cancelDrawing,
          isDrawing: systemIsDrawing || false
        };
        console.log('✅ Polygon system initialized on map');
      }

      // Notify parent that map is ready
      if (onMapReady) {
        console.log('📣 Calling onMapReady callback');
        onMapReady(map);
      } else {
        console.warn('⚠️ No onMapReady callback provided');
      }
    };
  }, []);

  // ========================================================================
  // 🚨 MAP ERROR HANDLER με Fallback Cascade
  // ========================================================================

  const handleMapError = useCallback((
    error: MapErrorEvent,
    currentMapStyle: MapStyleType,
    setCurrentMapStyle: (style: MapStyleType) => void,
    setMapLoaded: (loaded: boolean) => void
  ) => {
    console.error('🗺️ MapLibre GL JS Error:', error);

    // Log structured error for debugging
    const errorInfo = {
      type: 'MapLibre Error',
      error: error?.error || error,
      message: error?.message || 'Unknown MapLibre error',
      timestamp: Date.now(),
      currentStyle: currentMapStyle,
      failureReason: error?.message?.includes('Failed to fetch') ? 'Network/CORS' : 'Unknown'
    };

    console.error('🔍 MapLibre Error Details:', errorInfo);

    // 🔧 FIX: Don't fallback for tile loading errors (404s at high zoom)
    // These are normal when zoom level exceeds maxzoom
    const isTileError = error?.message?.includes('tile') || error?.error?.message?.includes('404') || error?.error?.status === 404;
    const isHighZoomError = error?.message?.includes('Failed to fetch') && error?.error?.url?.includes('/tile/');

    if (isTileError || isHighZoomError) {
      // Just log the error but don't change map style
      return;
    }

    // Don't crash the app - graceful degradation
    setMapLoaded(false);

    // ✅ ENHANCED: Use MapStyleManager fallback cascade
    const fallbackStyle = mapStyleManager.getFallbackStyle(currentMapStyle);

    if (fallbackStyle) {
      setTimeout(() => {
        setCurrentMapStyle(fallbackStyle);
        setMapLoaded(true); // Try to load immediately
      }, 1500);
    } else {
      // Final fallback failed - show user notification
      console.error('❌ All map styles failed. Using emergency fallback.');
      setTimeout(() => {
        // Emergency: Try to load with minimal OSM style
        setCurrentMapStyle('osm');
        setMapLoaded(true);
      }, 3000);
    }
  }, []);

  // ========================================================================
  // 🎨 MAP STYLE CHANGE HANDLER
  // ========================================================================

  const handleMapStyleChange = useCallback((
    newStyle: MapStyleType,
    setCurrentMapStyle: (style: MapStyleType) => void,
    setMapLoaded: (loaded: boolean) => void
  ) => {
    setCurrentMapStyle(newStyle);
    setMapLoaded(false); // Show loading while style changes

    // ✅ ENHANCED: Use MapStyleManager timeout configuration
    const timeout = mapStyleManager.getLoadingTimeout(newStyle);

    // Set loading state with appropriate timeout
    setTimeout(() => {
      setMapLoaded(true);
    }, timeout);
  }, []);

  // ========================================================================
  // 🎯 RETURN HANDLERS OBJECT
  // ========================================================================

  return {
    handleMapClick,
    handleMapMouseMove,
    handleMapMouseDown,
    handleMapMouseUp,
    handleMapLoad,
    handleMapError,
    handleMapStyleChange
  };
};

/**
 * ✅ ENTERPRISE MAP INTERACTIONS HOOK COMPLETE (2025-12-17)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με enterprise interfaces
 * ✅ React hooks patterns με useCallback optimization
 * ✅ Centralized event handling για all map interactions
 * ✅ Polygon drawing integration (freehand, point mode, regular)
 * ✅ Coordinate picking με validation
 * ✅ Error handling και fallback cascade
 * ✅ MapStyleManager integration για professional style management
 * ✅ Performance optimization με proper dependencies
 * ✅ Event throttling για smooth freehand drawing
 * ✅ Professional error logging και debugging
 *
 * Extracted από InteractiveMap.tsx:
 * 🔥 handleMapClick (lines 422-464)
 * 🔥 handleMapMouseMove (lines 466-494)
 * 🔥 handleMapMouseDown (lines 497-507)
 * 🔥 handleMapMouseUp (lines 510-525)
 * 🔥 handleMapLoad (lines 527-559)
 * 🔥 handleMapError (lines 565-623)
 * 🔥 handleMapStyleChange (lines 625-650)
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο map interaction logic
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα map components
 * 🧪 Testability - Isolated hook με clear interface
 * ⚡ Performance - Optimized με proper React patterns
 * 🎮 User Experience - Smooth interaction handling
 * 🔧 Maintainability - Clear separation of concerns
 */
