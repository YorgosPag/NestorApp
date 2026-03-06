/**
 * 🗺️ MAP STATE HOOK - ENTERPRISE IMPLEMENTATION
 *
 * Centralized map state management με enterprise patterns.
 * Consolidates ALL map-related state management που διάσπαρτο στο InteractiveMap.
 *
 * ✅ Enterprise Standards:
 * - Single Responsibility Principle
 * - TypeScript strict typing
 * - Performance optimization
 * - Clean state management
 * - Separation of concerns
 *
 * @module useMapState
 */

import { useState, useCallback } from 'react';
import type { MapStyleType } from '../../services/map/MapStyleManager';
import type { GeoCoordinate } from '../../types';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface MapStateConfig {
  initialStyle?: MapStyleType;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
  };
  enableAccuracyVisualization?: boolean;
  defaultAccuracyMode?: 'circles' | 'heatmap' | 'zones';
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface MapStateReturn {
  // Core Map State
  mapLoaded: boolean;
  setMapLoaded: (loaded: boolean) => void;

  // View State Management
  viewState: ViewState;
  setViewState: (state: ViewState) => void;

  // Style Management
  currentMapStyle: MapStyleType;
  setCurrentMapStyle: (style: MapStyleType) => void;

  // Click Mode Management
  clickMode: 'off' | 'add_dxf' | 'add_geo';
  setClickMode: (mode: 'off' | 'add_dxf' | 'add_geo') => void;
  startCoordinatePicking: (mode: 'add_dxf' | 'add_geo') => void;
  stopCoordinatePicking: () => void;

  // Coordinate Management
  hoveredCoordinate: GeoCoordinate | null;
  setHoveredCoordinate: (coord: GeoCoordinate | null) => void;

  // Accuracy Visualization
  showAccuracyCircles: boolean;
  setShowAccuracyCircles: (show: boolean) => void;
  accuracyVisualizationMode: 'circles' | 'heatmap' | 'zones';
  setAccuracyVisualizationMode: (mode: 'circles' | 'heatmap' | 'zones') => void;
  toggleAccuracyVisualization: () => void;

  // Polygon State Management
  localIsPolygonComplete: boolean;
  setLocalIsPolygonComplete: (complete: boolean) => void;

  // Force Update για Live Preview
  forceUpdate: number;
  setForceUpdate: (fn: (prev: number) => number) => void;
}

// ============================================================================
// 🗺️ MAP STATE HOOK
// ============================================================================

/**
 * Enterprise map state management hook
 * Consolidates ALL map state management from InteractiveMap.tsx
 */
export const useMapState = (config: MapStateConfig = {}): MapStateReturn => {
  const {
    initialStyle = 'greece',
    initialViewState = {
      longitude: 23.7275,
      latitude: 37.9755,
      zoom: 8,
      bearing: 0,
      pitch: 0
    },
    enableAccuracyVisualization = true,
    defaultAccuracyMode = 'circles'
  } = config;

  // ========================================================================
  // 🎯 CORE MAP STATE
  // ========================================================================

  const normalizedInitialViewState: ViewState = {
    ...initialViewState,
    bearing: initialViewState.bearing ?? 0,
    pitch: initialViewState.pitch ?? 0
  };
  const [mapLoaded, setMapLoaded] = useState(false);
  const [viewState, setViewState] = useState<ViewState>(normalizedInitialViewState);
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyleType>(initialStyle);

  // ========================================================================
  // 🖱️ INTERACTION STATE
  // ========================================================================

  const [clickMode, setClickMode] = useState<'off' | 'add_dxf' | 'add_geo'>('off');
  const [hoveredCoordinate, setHoveredCoordinate] = useState<GeoCoordinate | null>(null);

  // ========================================================================
  // 📊 ACCURACY VISUALIZATION STATE
  // ========================================================================

  const [showAccuracyCircles, setShowAccuracyCircles] = useState(enableAccuracyVisualization);
  const [accuracyVisualizationMode, setAccuracyVisualizationMode] = useState<'circles' | 'heatmap' | 'zones'>(defaultAccuracyMode);

  // ========================================================================
  // 🔵 POLYGON STATE
  // ========================================================================

  const [localIsPolygonComplete, setLocalIsPolygonComplete] = useState(false);

  // Force re-render state για live preview
  const [forceUpdate, setForceUpdate] = useState(0);

  // ========================================================================
  // 🎮 ACTION CREATORS
  // ========================================================================

  const startCoordinatePicking = useCallback((mode: 'add_dxf' | 'add_geo') => {
    setClickMode(mode);
  }, []);

  const stopCoordinatePicking = useCallback(() => {
    setClickMode('off');
  }, []);

  const toggleAccuracyVisualization = useCallback(() => {
    setShowAccuracyCircles(prev => !prev);
  }, []);

  // ========================================================================
  // 🎯 RETURN STATE & ACTIONS
  // ========================================================================

  return {
    // Core Map State
    mapLoaded,
    setMapLoaded,

    // View State Management
    viewState,
    setViewState,

    // Style Management
    currentMapStyle,
    setCurrentMapStyle,

    // Click Mode Management
    clickMode,
    setClickMode,
    startCoordinatePicking,
    stopCoordinatePicking,

    // Coordinate Management
    hoveredCoordinate,
    setHoveredCoordinate,

    // Accuracy Visualization
    showAccuracyCircles,
    setShowAccuracyCircles,
    accuracyVisualizationMode,
    setAccuracyVisualizationMode,
    toggleAccuracyVisualization,

    // Polygon State Management
    localIsPolygonComplete,
    setLocalIsPolygonComplete,

    // Force Update
    forceUpdate,
    setForceUpdate
  };
};

/**
 * ✅ ENTERPRISE MAP STATE HOOK COMPLETE (2025-12-18)
 *
 * Features Implemented:
 * ✅ Centralized state management για ALL map state
 * ✅ TypeScript strict typing με comprehensive interfaces
 * ✅ Performance optimization με useCallback
 * ✅ Clean action creators pattern
 * ✅ Configurable initialization
 * ✅ Complete separation of concerns
 * ✅ Professional state management patterns
 * ✅ Enterprise-grade hook design
 *
 * Extracted από InteractiveMap.tsx:
 * 🔥 mapLoaded state & management
 * 🔥 viewState management
 * 🔥 currentMapStyle state
 * 🔥 clickMode state & actions
 * 🔥 hoveredCoordinate management
 * 🔥 showAccuracyCircles state
 * 🔥 accuracyVisualizationMode state
 * 🔥 localIsPolygonComplete state
 * 🔥 forceUpdate state για live preview
 * 🔥 startCoordinatePicking/stopCoordinatePicking actions
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο map state management
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα map components
 * 🧪 Testability - Isolated hook με clear interface
 * ⚡ Performance - Optimized με proper React patterns
 * 🏗️ Maintainability - Clean separation από UI logic
 * 📚 Documentation - Comprehensive typing & comments
 */
