/**
 * 🔗 POLYGON LINES LAYER - ENTERPRISE COMPONENT
 *
 * Professional polygon line rendering για interactive map polygon visualization.
 * Handles visual states για complete vs incomplete polygons.
 *
 * ✅ Enterprise Standards:
 * - TypeScript strict typing
 * - React memo optimization
 * - GeoJSON standard compliance
 * - Professional visual differentiation
 * - Performance optimization
 *
 * @module PolygonLinesLayer
 */

import React, { memo, useMemo } from 'react';
import { Source, Layer } from '@/lib/maps/maplibre';
import type { FloorPlanControlPoint } from '../../floor-plan-system/types/control-points';
import { GEO_COLORS } from '../../config/color-config';

// ============================================================================
// 🎯 ENTERPRISE TYPE DEFINITIONS
// ============================================================================

export interface PolygonLinesLayerProps {
  /** Control points to connect */
  controlPoints: FloorPlanControlPoint[];
  /** Whether to show polygon lines */
  showControlPoints?: boolean;
  /** Whether map is loaded */
  mapLoaded?: boolean;
  /** Whether polygon is complete */
  isPolygonComplete?: boolean;
}

// ============================================================================
// 🔗 POLYGON LINES LAYER COMPONENT
// ============================================================================

/**
 * Enterprise polygon lines layer με GeoJSON compliance
 */
export const PolygonLinesLayer: React.FC<PolygonLinesLayerProps> = memo(({
  controlPoints = [],
  showControlPoints = true,
  mapLoaded = false,
  isPolygonComplete = false
}) => {
  // Early return για performance optimization
  if (!showControlPoints || !mapLoaded || controlPoints.length < 2) {
    return null;
  }

  // ✅ PERFORMANCE: Memoized GeoJSON generation
  const lineGeoJSON = useMemo(() => {
    // 🔥 ENTERPRISE: Create coordinates - if polygon is complete, close it!
    const coordinates = controlPoints.map(cp => [cp.geo.lng, cp.geo.lat]);

    // ✅ POLYGON CLOSURE: Add first point to end if polygon is complete
    if (isPolygonComplete && coordinates.length >= 3) {
      coordinates.push(coordinates[0]); // Close the polygon
    }

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: coordinates
      },
      properties: {
        id: 'polygon-lines',
        isComplete: isPolygonComplete,
        pointCount: controlPoints.length,
        timestamp: Date.now()
      }
    };
  }, [controlPoints, isPolygonComplete]);

  // ✅ PERFORMANCE: Memoized paint configuration
  const linePaint = useMemo(() => ({
    // ✅ ENTERPRISE: Different styles για complete vs incomplete polygon
    'line-color': isPolygonComplete ? GEO_COLORS.MAP_LAYER.POLYGON_COMPLETE : GEO_COLORS.MAP_LAYER.POLYGON_INCOMPLETE, // Centralized: Green when complete, blue when drawing
    'line-width': isPolygonComplete ? 3 : 2,
    'line-dasharray': isPolygonComplete ? [1, 0] : [2, 2], // Solid when complete, dashed when drawing
    'line-opacity': 0.8
  }), [isPolygonComplete]);

  return (
    <Source id="polygon-lines" type="geojson" data={lineGeoJSON}>
      <Layer
        id="polygon-lines-layer"
        type="line"
        paint={linePaint}
      />
    </Source>
  );
});

PolygonLinesLayer.displayName = 'PolygonLinesLayer';

/**
 * ✅ ENTERPRISE POLYGON LINES LAYER COMPLETE (2025-12-17)
 *
 * Features Implemented:
 * ✅ TypeScript strict typing με enterprise interfaces
 * ✅ React memo optimization για performance
 * ✅ GeoJSON standard compliance με proper properties
 * ✅ Professional visual differentiation (complete vs incomplete)
 * ✅ Memoized GeoJSON generation για optimization
 * ✅ Memoized paint configuration για performance
 * ✅ Automatic polygon closure για complete polygons
 * ✅ Clean props interface με clear responsibilities
 * ✅ Early return optimization
 *
 * Extracted από InteractiveMap.tsx:
 * 🔥 renderPolygonLines function (lines 854-890)
 * 🔥 GeoJSON generation logic
 * 🔥 Visual state management για lines
 * 🔥 Polygon closure logic
 *
 * Enterprise Benefits:
 * 🎯 Single Responsibility - Μόνο polygon line rendering
 * 🔄 Reusability - Μπορεί να χρησιμοποιηθεί σε άλλα contexts
 * 🧪 Testability - Isolated component με clear props
 * ⚡ Performance - Multiple memoization optimizations
 * 🗺️ Standards Compliance - Proper GeoJSON structure
 * 🎨 Visual Excellence - Professional differentiation patterns
 */
