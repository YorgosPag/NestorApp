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
import type { GeoControlPoint } from '../types';
import type { UniversalPolygon } from '@geo-alert/core';
import type { ViewState } from '../hooks/map/useMapState';
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

// Style imports
import { interactiveMapStyles } from './InteractiveMap.styles';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface InteractiveMapPresentationProps {
  // Map Configuration
  mapStyle: string;
  viewState: ViewState;
  onViewStateChange: (viewState: ViewState) => void;
  onLoad: () => void;

  // Event Handlers
  onClick: (event: any) => void;
  onMouseMove: (event: any) => void;

  // Layer Data
  controlPoints: GeoControlPoint[];
  currentDrawing: Array<{ x: number; y: number }>;
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
  transformState: {
    isCalibrated: boolean;
    controlPoints: Array<{
      id: string;
      dxf: { x: number; y: number };
      geo: { lng: number; lat: number };
      accuracy: number;
    }>;
    transformMatrix?: number[][];
    calibrationAccuracy?: number;
  };

  // Export Functions
  exportAsGeoJSON: () => any;

  // Cursor
  cursor?: string;

  // Hover Coordinate
  hoveredCoordinate: { lat: number; lng: number } | null;
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
  hoveredCoordinate
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
            currentDrawing={currentDrawing}
            isDrawing={isDrawing}
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
            isDrawing={isDrawing}
            isPolygonComplete={localIsPolygonComplete}
            hoveredCoordinate={hoveredCoordinate}
            mapLoaded={true}
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