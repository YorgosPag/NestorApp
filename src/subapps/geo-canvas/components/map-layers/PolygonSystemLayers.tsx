/**
 * 🔷 POLYGON SYSTEM LAYERS - ENTERPRISE COMPONENT
 *
 * Professional polygon system rendering για centralized polygon management.
 * Handles both standard polygons και point mode (πινέζα) polygons.
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - React memo optimization
 * - GeoJSON compliance
 * - Performance optimizations
 * - Multiple polygon types support
 *
 * @module PolygonSystemLayers
 */

import React, { memo, useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import type { UniversalPolygon } from '@geo-alert/core';
import { interactiveMapStyles } from '../InteractiveMap.styles';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface PolygonSystemLayersProps {
  /** Polygons από centralized system */
  polygons: UniversalPolygon[];
  /** Function to export polygons as GeoJSON */
  exportAsGeoJSON: () => any;
  /** Whether polygon drawing is enabled */
  enablePolygonDrawing?: boolean;
}

export interface CircleGeometry {
  center: { x: number; y: number };
  radius: number;
  coordinates: number[][];
}

// ============================================================================
// 🧮 GEOMETRY CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate circle coordinates για point mode polygons (πινέζα)
 */
const calculateCircleCoordinates = (
  center: { x: number; y: number },
  radiusMeters: number,
  resolution: number = 64
): number[][] => {
  // Calculate radius in degrees (approximation for visualization)
  // 1 degree ≈ 111km at equator, so radius in degrees = radius_meters / 111000
  const radiusInDegrees = radiusMeters / 111000;
  const coordinates: number[][] = [];

  for (let i = 0; i < resolution; i++) {
    const angle = (i / resolution) * 2 * Math.PI;
    const lat = center.y + radiusInDegrees * Math.cos(angle);
    const lng = center.x + radiusInDegrees * Math.sin(angle) / Math.cos(center.y * Math.PI / 180);
    coordinates.push([lng, lat]);
  }

  // Close the circle
  coordinates.push(coordinates[0]);

  return coordinates;
};

/**
 * Validate coordinate values για rendering safety
 */
const isValidCoordinate = (point: { x: number; y: number }): boolean => {
  return point.y >= -90 && point.y <= 90 && point.x >= -180 && point.x <= 180;
};

// ============================================================================
// 🔷 POLYGON SYSTEM LAYERS COMPONENT
// ============================================================================

/**
 * Enterprise polygon system layers με multiple polygon types support
 */
export const PolygonSystemLayers: React.FC<PolygonSystemLayersProps> = memo(({
  polygons = [],
  exportAsGeoJSON,
  enablePolygonDrawing = false
}) => {
  // Early return για performance
  if (!enablePolygonDrawing || !polygons || polygons.length === 0) {
    return null;
  }

  // ✅ PERFORMANCE: Memoized GeoJSON data from centralized system
  const geojsonData = useMemo(() => {
    try {
      return exportAsGeoJSON();
    } catch (error) {
      console.warn('Failed to export GeoJSON data:', error);
      return null;
    }
  }, [exportAsGeoJSON, polygons]);

  // Early return if no valid GeoJSON data
  if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
    return null;
  }

  // ✅ PERFORMANCE: Memoized polygon rendering data
  const polygonRenderData = useMemo(() => {
    return geojsonData.features.map((feature: any, index: number) => {
      const polygon = polygons.find(p => p.id === feature.properties?.id);
      if (!polygon) return null;

      const sourceId = `polygon-${polygon.id}`;
      const isPointMode = polygon.config?.pointMode === true;
      const pointRadius = polygon.config?.radius || 100;

      return {
        polygon,
        feature,
        sourceId,
        isPointMode,
        pointRadius,
        index
      };
    }).filter(Boolean);
  }, [geojsonData.features, polygons]);

  return (
    <>
      {polygonRenderData.map((data) => {
        if (!data) return null;

        const { polygon, feature, sourceId, isPointMode, pointRadius } = data;

        // ========================================================================
        // POINT MODE RENDERING (Πινέζα με Radius Circle)
        // ========================================================================

        if (isPointMode && polygon.points.length === 1) {
          const point = polygon.points[0];

          // Validate coordinates
          if (!isValidCoordinate(point)) {
            return null;
          }

          const circleCoordinates = calculateCircleCoordinates(point, pointRadius);
          const circleFeature = {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [circleCoordinates]
            },
            properties: {
              id: `${polygon.id}-radius-circle`,
              type: 'point-mode-circle',
              radius: pointRadius
            }
          };

          // Calculate radius in degrees για label positioning
          const radiusInDegrees = pointRadius / 111000;

          return (
            <React.Fragment key={polygon.id}>
              {/* Radius Circle */}
              <Source
                id={`${sourceId}-circle`}
                type="geojson"
                data={circleFeature}
              >
                <Layer
                  id={`${sourceId}-circle-fill`}
                  type="fill"
                  paint={{
                    'fill-color': polygon.style.fillColor,
                    'fill-opacity': 0.1
                  }}
                />
                <Layer
                  id={`${sourceId}-circle-stroke`}
                  type="line"
                  paint={{
                    'line-color': polygon.style.strokeColor,
                    'line-opacity': 0.6,
                    'line-width': 2,
                    'line-dasharray': [5, 5]
                  }}
                />
              </Source>

              {/* Pin Marker (πινέζα) */}
              <Marker
                longitude={point.x}
                latitude={point.y}
              >
                <div
                  style={interactiveMapStyles.markers.dynamicPin(
                    polygon.style.strokeColor,
                    polygon.style.fillColor
                  )}
                  title={`Πινέζα - Ακτίνα: ${pointRadius}m`}
                >
                  {/* Pin center dot */}
                  <div
                    style={interactiveMapStyles.markers.dynamicCenterDot()}
                  />
                </div>
              </Marker>

              {/* Radius Label */}
              <Marker
                longitude={point.x}
                latitude={point.y + radiusInDegrees * 0.7}
              >
                <div
                  style={interactiveMapStyles.labels.radiusLabel()}
                >
                  {pointRadius}m
                </div>
              </Marker>
            </React.Fragment>
          );
        }

        // ========================================================================
        // 🔷 STANDARD POLYGON RENDERING
        // ========================================================================

        return (
          <React.Fragment key={polygon.id}>
            {/* Polygon Fill & Stroke Layers */}
            <Source
              id={sourceId}
              type="geojson"
              data={feature}
            >
              <Layer
                id={`${sourceId}-fill`}
                type="fill"
                paint={{
                  'fill-color': polygon.style.fillColor,
                  'fill-opacity': polygon.style.fillOpacity || 0.3
                }}
              />
              <Layer
                id={`${sourceId}-stroke`}
                type="line"
                paint={{
                  'line-color': polygon.style.strokeColor,
                  'line-opacity': polygon.style.strokeOpacity || 1.0,
                  'line-width': polygon.style.strokeWidth || 2
                }}
              />
            </Source>

            {/* Polygon Vertices (Points) */}
            {polygon.points.map((point, index) => {
              // Validate coordinates
              if (!isValidCoordinate(point)) {
                return null;
              }

              return (
                <Marker
                  key={`${polygon.id}-point-${index}`}
                  longitude={point.x}
                  latitude={point.y}
                >
                  <div
                    style={interactiveMapStyles.layout.polygonVertex(
                      polygon.style.pointRadius || 4,
                      polygon.style.pointColor || polygon.style.strokeColor,
                      polygon.style.strokeColor
                    )}
                    title={point.label || `Point ${index + 1}`}
                  />
                </Marker>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
});

PolygonSystemLayers.displayName = 'PolygonSystemLayers';

/**
 * ✅ ENTERPRISE POLYGON SYSTEM LAYERS COMPLETE (2025-12-18)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με comprehensive interfaces
 * ✅ React memo optimization για performance
 * ✅ Point mode (πινέζα) support με radius circles
 * ✅ Standard polygon rendering με vertices
 * ✅ GeoJSON compliance με proper structure
 * ✅ Coordinate validation για safety
 * ✅ Memoized calculations για optimization
 * ✅ Professional error handling
 * ✅ Clean geometry utilities
 * ✅ Multiple layer types (fill, stroke, markers)
 *
 * Extracted από InteractiveMap.tsx:
 * 🔥 renderPolygonSystemLayers function (lines 584-760)
 * 🔥 Point mode circle calculation logic
 * 🔥 Standard polygon rendering
 * 🔥 Coordinate validation patterns
 * 🔥 GeoJSON data export integration
 * 🔥 Dynamic styling patterns
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο polygon system rendering
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα map contexts
 * 🧪 Testability - Isolated component με clear props
 * ⚡ Performance - Multiple optimization strategies
 * 🗺️ Standards Compliance - Proper GeoJSON & MapLibre patterns
 * 🏗️ Maintainability - Clean separation από parent logic
 */