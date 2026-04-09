/**
 * 🗺️ SPATIAL UTILITIES - Pure geometric functions
 *
 * Extracted from SpatialQueryService for SRP compliance (<500 lines).
 * Contains: point-in-polygon, bounding box operations, distance, buffer.
 *
 * @module services/spatial/spatial-utils
 */

import type { BoundingBox } from '../../types/administrative-types';

// ============================================================================
// TYPES
// ============================================================================

export type SpatialCoordinates =
  | GeoJSON.Position
  | GeoJSON.Position[]
  | GeoJSON.Position[][]
  | GeoJSON.Position[][][];

export type SpatialGeometry = GeoJSON.Geometry;

// ============================================================================
// POINT-IN-POLYGON
// ============================================================================

/**
 * Point-in-polygon test using ray casting algorithm
 */
export function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

// ============================================================================
// BOUNDING BOX OPERATIONS
// ============================================================================

/**
 * Calculate bounding box for geometry
 */
export function getBoundingBox(geometry: SpatialGeometry): BoundingBox {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  function processCoordinate(coord: number[]) {
    const [lng, lat] = coord;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  type GeoJSONCoordinates = SpatialCoordinates | number[][][][];
  function processCoordinates(coords: GeoJSONCoordinates) {
    if (Array.isArray(coords[0])) {
      (coords as GeoJSONCoordinates[]).forEach(processCoordinates);
    } else {
      processCoordinate(coords as number[]);
    }
  }

  if ('coordinates' in geometry && geometry.coordinates) {
    processCoordinates(geometry.coordinates as GeoJSONCoordinates);
  } else if (geometry.type === 'GeometryCollection' && geometry.geometries) {
    geometry.geometries.forEach((childGeometry) => {
      if ('coordinates' in childGeometry && childGeometry.coordinates) {
        processCoordinates(childGeometry.coordinates as GeoJSONCoordinates);
      }
    });
  }

  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng
  };
}

/**
 * Check if two bounding boxes intersect
 */
export function bboxIntersects(bbox1: BoundingBox, bbox2: BoundingBox): boolean {
  return !(
    bbox1.east < bbox2.west ||
    bbox1.west > bbox2.east ||
    bbox1.north < bbox2.south ||
    bbox1.south > bbox2.north
  );
}

/**
 * Check if first bbox contains second bbox
 */
export function bboxContains(outer: BoundingBox, inner: BoundingBox): boolean {
  return (
    outer.west <= inner.west &&
    outer.east >= inner.east &&
    outer.south <= inner.south &&
    outer.north >= inner.north
  );
}

/**
 * Check if point is within bounding box
 */
export function pointInBbox(point: [number, number], bbox: BoundingBox): boolean {
  const [lng, lat] = point;
  return lng >= bbox.west && lng <= bbox.east &&
         lat >= bbox.south && lat <= bbox.north;
}

// ============================================================================
// DISTANCE & BUFFER
// ============================================================================

/**
 * Calculate distance between two points (Haversine formula)
 * @returns Distance in meters
 */
export function calculateDistance(
  point1: [number, number],
  point2: [number, number]
): number {
  const [lng1, lat1] = point1;
  const [lng2, lat2] = point2;

  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Create circular buffer around point
 */
export function createCircularBuffer(
  center: [number, number],
  radiusMeters: number,
  points = 32
): GeoJSON.Polygon {
  const [centerLng, centerLat] = center;
  const coordinates: number[][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i * 360) / points;
    const dx = radiusMeters * Math.cos(angle * Math.PI / 180);
    const dy = radiusMeters * Math.sin(angle * Math.PI / 180);

    // Convert meters to degrees (approximate)
    const dLat = dy / 111320;
    const dLng = dx / (111320 * Math.cos(centerLat * Math.PI / 180));

    coordinates.push([centerLng + dLng, centerLat + dLat]);
  }

  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
}
