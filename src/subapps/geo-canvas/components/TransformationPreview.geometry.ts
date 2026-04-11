/**
 * TransformationPreview — Pure geometry builders
 *
 * Extracted from TransformationPreview.tsx for Google SRP compliance
 * (file-size ratchet). These helpers convert calibrated control points
 * into GeoJSON overlays (grid + accuracy circles) without touching React state.
 */

import { dxfGeoTransformService } from '../services/geo-transform/DxfGeoTransform';
import type { GeoControlPoint } from '../types';

// ============================================================================
// PREVIEW GRID
// ============================================================================

/**
 * Build a transformation grid as GeoJSON LineStrings, sampled at
 * `gridSpacing` meters across the DXF-space bounding box of the control points.
 * Returns null when there are no control points to derive bounds from.
 */
export function buildPreviewGrid(
  controlPoints: GeoControlPoint[],
  gridSpacing: number
): GeoJSON.FeatureCollection | null {
  if (controlPoints.length === 0) return null;

  const features: GeoJSON.Feature[] = [];

  // Calculate grid bounds από control points
  const dxfPoints = controlPoints.map(cp => cp.dxfPoint);
  const minX = Math.min(...dxfPoints.map(p => p.x));
  const maxX = Math.max(...dxfPoints.map(p => p.x));
  const minY = Math.min(...dxfPoints.map(p => p.y));
  const maxY = Math.max(...dxfPoints.map(p => p.y));

  // Extend bounds slightly
  const padding = gridSpacing;
  const gridMinX = Math.floor((minX - padding) / gridSpacing) * gridSpacing;
  const gridMaxX = Math.ceil((maxX + padding) / gridSpacing) * gridSpacing;
  const gridMinY = Math.floor((minY - padding) / gridSpacing) * gridSpacing;
  const gridMaxY = Math.ceil((maxY + padding) / gridSpacing) * gridSpacing;

  // Generate grid lines
  for (let x = gridMinX; x <= gridMaxX; x += gridSpacing) {
    try {
      const startGeo = dxfGeoTransformService.transformDxfToGeo({ x, y: gridMinY });
      const endGeo = dxfGeoTransformService.transformDxfToGeo({ x, y: gridMaxY });

      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [startGeo.lng, startGeo.lat],
            [endGeo.lng, endGeo.lat]
          ]
        },
        properties: {
          type: 'grid_line',
          direction: 'vertical',
          dxfX: x
        }
      });
    } catch (error) {
      // Skip invalid transformations
    }
  }

  for (let y = gridMinY; y <= gridMaxY; y += gridSpacing) {
    try {
      const startGeo = dxfGeoTransformService.transformDxfToGeo({ x: gridMinX, y });
      const endGeo = dxfGeoTransformService.transformDxfToGeo({ x: gridMaxX, y });

      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [startGeo.lng, startGeo.lat],
            [endGeo.lng, endGeo.lat]
          ]
        },
        properties: {
          type: 'grid_line',
          direction: 'horizontal',
          dxfY: y
        }
      });
    } catch (error) {
      // Skip invalid transformations
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

// ============================================================================
// ACCURACY INDICATORS
// ============================================================================

/**
 * Build accuracy-circle polygons around each control point.
 * Radius is derived from `cp.accuracy` (meters) using the approximate
 * 1° latitude ≈ 111,320 m conversion (good enough for small-scale previews).
 */
export function buildAccuracyIndicators(
  controlPoints: GeoControlPoint[]
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  // Add accuracy circles around control points
  controlPoints.forEach(cp => {
    // Create circle approximation
    const numVertices = 32;
    const radiusInDegrees = cp.accuracy / 111320; // Convert meters to degrees (approximate)
    const coordinates: number[][] = [];

    for (let i = 0; i <= numVertices; i++) {
      const angle = (i / numVertices) * 2 * Math.PI;
      const lng = cp.geoPoint.lng + radiusInDegrees * Math.cos(angle);
      const lat = cp.geoPoint.lat + radiusInDegrees * Math.sin(angle);
      coordinates.push([lng, lat]);
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: {
        type: 'accuracy_circle',
        controlPointId: cp.id,
        accuracy: cp.accuracy,
        description: cp.description
      }
    });
  });

  return {
    type: 'FeatureCollection',
    features
  };
}
