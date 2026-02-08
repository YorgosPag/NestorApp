/**
 * 🎨 INTERACTIVE MAP PRESENTATION - ENTERPRISE COMPONENT
 *
 * Pure presentation layer για map rendering χωρίς business logic.
 * Professional separation of concerns με complete UI responsibility.
 *
 * ✅ Enterprise Standards:
 * - Zero business logic (pure presentation)
 * - TypeScript strict typing
 * - React memo optimization
 * - MapLibre GL JS integration
 * - Performance optimization
 * - Single Responsibility Principle
 *
 * @module InteractiveMapPresentation
 */

import React, { memo } from 'react';
import { Map } from 'react-map-gl/maplibre';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';
import type { FloorPlanControlPoint } from '../floor-plan-system/types/control-points';
import type { UniversalPolygon } from '@geo-alert/core/polygon-system/types';
import type { ViewState } from '../hooks/map/useMapState';
import type { TransformState, MapInstance } from '../hooks/map/useMapInteractions';
import type { MapStyleType } from '../services/map/MapStyleManager';

// Component imports
import {
  ControlPointLayer,
  PolygonLinesLayer,
  LiveDrawingPreview,
  AccuracyVisualizationLayer,
  TransformationPreviewLayer,
  PolygonSystemLayers
} from './map-layers';
import type { CurrentDrawing } from './map-layers/LiveDrawingPreview';
import type { GeoJSONFeatureCollection } from '../types';

// Style imports
import { interactiveMapStyles } from './InteractiveMap.styles';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

// 🏢 ENTERPRISE: GeoJSON types for export function

export interface InteractiveMapPresentationProps {
  // Map Configuration
  mapStyle: string | object;
  viewState: ViewState;
  onViewStateChange: (viewState: ViewState) => void;
  onLoad: (event: { target: MapInstance }) => void;

  // Event Handlers
  onClick: (event: MapLayerMouseEvent) => void;
  onMouseMove: (event: MapLayerMouseEvent) => void;

  // Layer Data
  controlPoints: FloorPlanControlPoint[];
  currentDrawing: CurrentDrawing | null;
  polygons: UniversalPolygon[];

  // Visibility Flags
  showControlPoints: boolean;
  showPolygonLines: boolean;
  showCurrentDrawing: boolean;
  showAccuracyCircles: boolean;
  showTransformationPreview: boolean;
  enablePolygonDrawing: boolean;

  // Drawing State
  isDrawing: boolean;
  localIsPolygonComplete: boolean;

  // Accuracy Visualization
  accuracyVisualizationMode: 'circles' | 'heatmap' | 'zones';

  // Transform State
  transformState: TransformState;

  // Export Functions
  // 🏢 ENTERPRISE: Proper return type instead of any
  exportAsGeoJSON: () => GeoJSONFeatureCollection | null;

  // Cursor
  cursor?: string;

  // Hover Coordinate
  hoveredCoordinate: { lat: number; lng: number } | null;

  /** 🗺️ ENTERPRISE: Children elements (markers, layers) to render inside the map */
  children?: React.ReactNode;
}

// ============================================================================
// 🎨 INTERACTIVE MAP PRESENTATION COMPONENT
// ============================================================================

/**
 * Pure presentation component για map rendering
 * Zero business logic - μόνο UI rendering responsibility
 */
export const InteractiveMapPresentation: React.FC<InteractiveMapPresentationProps> = memo(({
  // Map Configuration
  mapStyle,
  viewState,
  onViewStateChange,
  onLoad,

  // Event Handlers
  onClick,
  onMouseMove,

  // Layer Data
  controlPoints,
  currentDrawing,
  polygons,

  // Visibility Flags
  showControlPoints,
  showPolygonLines,
  showCurrentDrawing,
  showAccuracyCircles,
  showTransformationPreview,
  enablePolygonDrawing,

  // Drawing State
  isDrawing,
  localIsPolygonComplete,

  // Accuracy Visualization
  accuracyVisualizationMode,

  // Transform State
  transformState,

  // Export Functions
  exportAsGeoJSON,

  // Cursor
  cursor = 'default',

  // Hover Coordinate
  hoveredCoordinate,

  // Children markers/layers
  children
}) => {
  return (
    <div className="h-full w-full relative">
      <Map
        {...viewState}
        onMove={(evt) => onViewStateChange(evt.viewState as ViewState)}
        onLoad={onLoad}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        onClick={onClick}
        onMouseMove={onMouseMove}
        cursor={cursor}
        dragPan={true}
        dragRotate={false}
        doubleClickZoom={true}
        keyboard={true}
        touchZoomRotate={true}
      >
        {/* ================================================================ */}
        {/* CONTROL POINTS LAYER */}
        {/* ================================================================ */}
        {showControlPoints && (
          <ControlPointLayer
            controlPoints={controlPoints}
            mapLoaded={true}
          />
        )}

        {/* ================================================================ */}
        {/* 🔷 POLYGON LINES LAYER */}
        {/* ================================================================ */}
        {showPolygonLines && (
          <PolygonLinesLayer
            controlPoints={controlPoints}
            showControlPoints={showPolygonLines}
            isPolygonComplete={localIsPolygonComplete}
            mapLoaded={true}
          />
        )}

        {/* ================================================================ */}
        {/* 🎨 LIVE DRAWING PREVIEW LAYER */}
        {/* ================================================================ */}
        {showCurrentDrawing && (
          <LiveDrawingPreview
            currentDrawing={currentDrawing}
            enablePolygonDrawing={enablePolygonDrawing}
            systemIsDrawing={isDrawing}
            hoveredCoordinate={hoveredCoordinate}
          />
        )}

        {/* ================================================================ */}
        {/* 📊 ACCURACY VISUALIZATION LAYER */}
        {/* ================================================================ */}
        <AccuracyVisualizationLayer
          controlPoints={controlPoints}
          showAccuracyCircles={showAccuracyCircles}
          accuracyVisualizationMode={accuracyVisualizationMode}
          mapLoaded={true}
          zoomLevel={viewState.zoom}
        />

        {/* ================================================================ */}
        {/* 🔄 TRANSFORMATION PREVIEW LAYER */}
        {/* ================================================================ */}
        <TransformationPreviewLayer
          showTransformationPreview={showTransformationPreview}
          transformState={transformState}
          mapLoaded={true}
        />

        {/* ================================================================ */}
        {/* 🔷 POLYGON SYSTEM LAYERS */}
        {/* ================================================================ */}
        <PolygonSystemLayers
          polygons={polygons}
          exportAsGeoJSON={exportAsGeoJSON}
          enablePolygonDrawing={enablePolygonDrawing}
        />

        {/* ================================================================ */}
        {/* 📍 CUSTOM CHILDREN (Markers, Custom Layers) */}
        {/* ================================================================ */}
        {children}
      </Map>
    </div>
  );
});

InteractiveMapPresentation.displayName = 'InteractiveMapPresentation';

/**
 * ✅ ENTERPRISE INTERACTIVE MAP PRESENTATION COMPLETE (2025-12-18)
 *
 * Features Implemented:
 * ✅ Pure presentation layer χωρίς business logic
 * ✅ TypeScript strict typing με comprehensive interfaces
 * ✅ React memo optimization για performance
 * ✅ Complete MapLibre GL JS integration
 * ✅ All layer components properly integrated
 * ✅ Event handler delegation to parent
 * ✅ Proper prop interface design
 * ✅ Zero state management (stateless)
 * ✅ Single Responsibility - μόνο UI rendering
 *
 * Layer Integration:
 * ✅ ControlPointLayer - Control points rendering
 * ✅ PolygonLinesLayer - Polygon lines rendering
 * ✅ LiveDrawingPreview - Real-time drawing preview
 * ✅ AccuracyVisualizationLayer - Accuracy circles/zones
 * ✅ TransformationPreviewLayer - DXF transformation preview
 * ✅ PolygonSystemLayers - Centralized polygon system
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο presentation logic
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί με διαφορετικά containers
 * 🧪 Testability - Isolated component με clear props
 * ⚡ Performance - Zero business logic overhead
 * 🎨 Pure Function - Predictable rendering από props
 * 🏗️ Maintainability - Clean separation από business logic
 *
 * Props Pattern:
 * 🎯 Configuration Props - Map settings, styles, viewState
 * 🎮 Handler Props - Event callbacks για parent delegation
 * 📊 Data Props - Layers data από parent business logic
 * 🎛️ Control Props - Visibility flags, modes, states
 * 🔗 Function Props - Export functions από centralized systems
 *
 * This component is the **pure presentation layer** στο enterprise pattern.
 * Receives ALL data and handlers από το InteractiveMapContainer.
 * Zero business logic - μόνο UI rendering responsibility.
 */

