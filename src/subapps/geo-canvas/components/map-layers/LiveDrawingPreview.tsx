/**
 * 🎥 LIVE DRAWING PREVIEW - ENTERPRISE COMPONENT
 *
 * Professional live drawing preview για polygon system με real-time visual feedback.
 * Handles point mode previews και standard drawing visualization.
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - React memo optimization
 * - GeoJSON compliance
 * - Real-time coordinate validation
 * - Professional visual feedback
 *
 * @module LiveDrawingPreview
 */

import React, { memo, useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { GeoCoordinate } from '../../types';
import { interactiveMapStyles } from '../InteractiveMap.styles';
import { GEO_COLORS } from '../../config/color-config';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface DrawingPoint {
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface CurrentDrawing {
  points: DrawingPoint[];
  config?: {
    pointMode?: boolean;
    radius?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface LiveDrawingPreviewProps {
  /** Whether polygon drawing is enabled */
  enablePolygonDrawing?: boolean;
  /** Whether system is currently drawing */
  systemIsDrawing?: boolean;
  /** Current drawing state */
  currentDrawing?: CurrentDrawing | null;
  /** Hovered coordinate για preview */
  hoveredCoordinate?: GeoCoordinate | null;
  /** Function to get current drawing state */
  getCurrentDrawing?: () => CurrentDrawing | null;
}

// ============================================================================
// 🎥 LIVE DRAWING PREVIEW COMPONENT
// ============================================================================

/**
 * Enterprise live drawing preview με real-time feedback
 */
export const LiveDrawingPreview: React.FC<LiveDrawingPreviewProps> = memo(({
  enablePolygonDrawing = false,
  systemIsDrawing = false,
  currentDrawing,
  hoveredCoordinate,
  getCurrentDrawing
}) => {
  // Early return για performance
  if (!enablePolygonDrawing || !systemIsDrawing) {
    return null;
  }

  // Get current drawing state
  const drawing = currentDrawing || (getCurrentDrawing ? getCurrentDrawing() : null);

  // ✅ ENTERPRISE: Point mode preview calculation
  const pointModePreview = useMemo(() => {
    if (!drawing?.config?.pointMode || !hoveredCoordinate || drawing.points.length > 0) {
      return null;
    }

    const pointRadius = drawing.config?.radius || 100; // Default 100m radius

    // Validate hovered coordinates
    if (hoveredCoordinate.lat < -90 || hoveredCoordinate.lat > 90 ||
        hoveredCoordinate.lng < -180 || hoveredCoordinate.lng > 180) {
      return null;
    }

    // Calculate radius circle in degrees (approximation για visualization)
    const radiusInDegrees = pointRadius / 111000;
    const circleCoordinates = [];
    const numPoints = 32; // Optimized resolution για smooth preview

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      const lat = hoveredCoordinate.lat + radiusInDegrees * Math.cos(angle);
      const lng = hoveredCoordinate.lng + radiusInDegrees * Math.sin(angle) / Math.cos(hoveredCoordinate.lat * Math.PI / 180);
      circleCoordinates.push([lng, lat]);
    }
    // Close the circle
    circleCoordinates.push(circleCoordinates[0]);

    return {
      coordinate: hoveredCoordinate,
      radius: pointRadius,
      radiusInDegrees,
      circleFeature: {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [circleCoordinates]
        },
        properties: {
          id: 'point-mode-preview-circle',
          radius: pointRadius,
          center: [hoveredCoordinate.lng, hoveredCoordinate.lat]
        }
      }
    };
  }, [drawing, hoveredCoordinate]);

  // ✅ PERFORMANCE: Memoized drawing points visualization
  const drawingVisualization = useMemo(() => {
    if (!drawing || !drawing.points || drawing.points.length === 0) {
      return null;
    }

    // Validate και filter valid coordinates
    const validPoints = drawing.points.filter(point =>
      point.y >= -90 && point.y <= 90 &&
      point.x >= -180 && point.x <= 180
    );

    if (validPoints.length === 0) {
      return null;
    }

    const lineGeoJSON = validPoints.length > 1 ? {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: validPoints.map(p => [p.x, p.y])
      },
      properties: {
        id: 'drawing-preview-line',
        pointCount: validPoints.length,
        timestamp: Date.now()
      }
    } : null;

    return {
      points: validPoints,
      lineGeoJSON
    };
  }, [drawing]);

  // ✅ RENDER: Point mode preview
  if (pointModePreview) {
    return (
      <React.Fragment>
        {/* Preview Radius Circle */}
        <Source
          id="point-preview-circle"
          type="geojson"
          data={pointModePreview.circleFeature}
        >
          <Layer
            id="point-preview-circle-fill"
            type="fill"
            paint={{
              'fill-color': GEO_COLORS.MAP_LAYER.LIVE_DRAWING_FILL,
              'fill-opacity': 0.05
            }}
          />
          <Layer
            id="point-preview-circle-stroke"
            type="line"
            paint={{
              'line-color': GEO_COLORS.MAP_LAYER.LIVE_DRAWING_STROKE,
              'line-opacity': 0.4,
              'line-width': 1,
              'line-dasharray': [8, 8]
            }}
          />
        </Source>

        {/* Preview Pin Marker (ghost πινέζα) */}
        <Marker
          longitude={pointModePreview.coordinate.lng}
          latitude={pointModePreview.coordinate.lat}
        >
          <div
            style={interactiveMapStyles.markers.pin(pointModePreview.radius, 0.7)}
            title={`Πινέζα Preview - Ακτίνα: ${pointModePreview.radius}m`}
          >
            {/* Pin center dot */}
            <div
              style={interactiveMapStyles.markers.centerDot()}
            />
          </div>
        </Marker>

        {/* Preview Radius Label */}
        <Marker
          longitude={pointModePreview.coordinate.lng}
          latitude={pointModePreview.coordinate.lat + pointModePreview.radiusInDegrees * 0.7}
        >
          <div
            style={interactiveMapStyles.labels.previewLabel(0.8)}
          >
            {pointModePreview.radius}m
          </div>
        </Marker>
      </React.Fragment>
    );
  }

  // ✅ RENDER: Standard drawing preview
  if (drawingVisualization) {
    return (
      <React.Fragment>
        {/* Render current drawing points */}
        {drawingVisualization.points.map((point, index) => (
          <Marker
            key={`preview-point-${index}`}
            longitude={point.x}
            latitude={point.y}
          >
            <div
              style={interactiveMapStyles.markers.drawingPoint(index)}
              title={`Point ${index + 1} (Drawing)`}
            />
          </Marker>
        ))}

        {/* Render lines between points */}
        {drawingVisualization.lineGeoJSON && (
          <Source
            id="preview-line"
            type="geojson"
            data={drawingVisualization.lineGeoJSON}
          >
            <Layer
              id="preview-line-layer"
              type="line"
              paint={{
                'line-color': GEO_COLORS.MAP_LAYER.LIVE_DRAWING_STROKE,
                'line-width': 2,
                'line-dasharray': [4, 4],
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}
      </React.Fragment>
    );
  }

  return null;
});

LiveDrawingPreview.displayName = 'LiveDrawingPreview';

/**
 * ✅ ENTERPRISE LIVE DRAWING PREVIEW COMPLETE (2025-12-17)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με enterprise interfaces
 * ✅ React memo optimization για performance
 * ✅ Real-time coordinate validation και sanitization
 * ✅ Point mode preview με radius visualization
 * ✅ Standard drawing mode με line preview
 * ✅ GeoJSON compliance με proper properties
 * ✅ Memoized calculations για optimization
 * ✅ Professional visual feedback patterns
 * ✅ Ghost marker previews για user guidance
 * ✅ Clean separation of concerns
 *
 * Extracted από InteractiveMap.tsx:
 * 🔥 renderLiveDrawingPreview function (lines 994-1151)
 * 🔥 Point mode preview calculation
 * 🔥 Circle geometry generation
 * 🔥 Drawing points visualization
 * 🔥 Preview line rendering
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο live drawing preview
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα drawing contexts
 * 🧪 Testability - Isolated component με clear props
 * ⚡ Performance - Multiple memoization optimizations
 * 🎮 User Experience - Real-time visual feedback
 * 🗺️ Standards Compliance - Proper GeoJSON structure
 */