/**
 * 📍 ENDPOINT DETECTOR
 *
 * Extract endpoints from DXF entities για snap functionality
 *
 * @module floor-plan-system/snapping/engine/endpoint-detector
 *
 * Supported entities:
 * - LINE: Start point + End point
 * - POLYLINE: All vertices
 * - LWPOLYLINE: All vertices
 * - ARC: Start point + End point
 * - CIRCLE: (future) Quadrant points
 */

import type { ParserResult } from '../../types';
import { SnapMode, SnapPoint } from '../types';

/**
 * Extract Endpoints from DXF ParserResult
 *
 * @param parserResult - DXF parser result
 * @returns Array of snap points
 */
export function extractEndpoints(parserResult: ParserResult | null): SnapPoint[] {
  // ✅ FIX: Extract from GeoJSON features instead of entities
  const features = parserResult?.geoJSON?.features ?? [];

  if (features.length === 0) {
    console.warn('⚠️ extractEndpoints: No GeoJSON features found');
    return [];
  }

  console.log(`🔍 extractEndpoints: Processing ${features.length} GeoJSON features`);

  const snapPoints: SnapPoint[] = [];

  // Iterate through GeoJSON features
  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    try {
      switch (geometry.type) {
        case 'LineString':
          snapPoints.push(...extractLineStringEndpoints(geometry as GeoJSON.LineString, feature.properties));
          break;

        case 'Polygon':
          // Extract polygon corner points
          snapPoints.push(...extractPolygonEndpoints(geometry as GeoJSON.Polygon, feature.properties));
          break;

        case 'MultiLineString':
          // Extract endpoints from each line segment
          if (Array.isArray(geometry.coordinates)) {
            for (const coords of geometry.coordinates) {
              snapPoints.push(...extractCoordsEndpoints(coords as number[][], feature.properties));
            }
          }
          break;

        // Add more geometry types as needed
        default:
          // Unsupported geometry type - skip
          break;
      }
    } catch (error) {
      console.warn(`Failed to extract endpoints from ${geometry.type}:`, error);
    }
  }

  console.log(`📍 extractEndpoints: Extracted ${snapPoints.length} snap points`);
  return deduplicateSnapPoints(snapPoints);
}

/**
 * Extract LineString endpoints from GeoJSON geometry
 */
function extractLineStringEndpoints(
  geometry: GeoJSON.LineString,
  properties?: Record<string, unknown> | null
): SnapPoint[] {
  const snapPoints: SnapPoint[] = [];

  const coords = geometry.coordinates as number[][];
  if (coords.length < 2) return snapPoints;

  // Start point
  const [x1, y1] = coords[0];
  snapPoints.push({
    x: x1,
    y: y1,
    mode: SnapMode.ENDPOINT,
    entityType: 'LineString',
    label: `LINE Start (${x1.toFixed(2)}, ${y1.toFixed(2)})`
  });

  // End point
  const [x2, y2] = coords[coords.length - 1];
  snapPoints.push({
    x: x2,
    y: y2,
    mode: SnapMode.ENDPOINT,
    entityType: 'LineString',
    label: `LINE End (${x2.toFixed(2)}, ${y2.toFixed(2)})`
  });

  return snapPoints;
}

/**
 * Extract Polygon endpoints from GeoJSON geometry
 */
function extractPolygonEndpoints(
  geometry: GeoJSON.Polygon,
  properties?: Record<string, unknown> | null
): SnapPoint[] {
  const snapPoints: SnapPoint[] = [];

  // Polygon coordinates are [exterior ring, ...holes]
  const exteriorRing = geometry.coordinates[0] as number[][];
  if (!exteriorRing || exteriorRing.length === 0) return snapPoints;

  // Add all vertices of exterior ring
  for (let i = 0; i < exteriorRing.length; i++) {
    const [x, y] = exteriorRing[i];
    snapPoints.push({
      x,
      y,
      mode: SnapMode.ENDPOINT,
      entityType: 'Polygon',
      label: `Polygon Vertex ${i + 1} (${x.toFixed(2)}, ${y.toFixed(2)})`
    });
  }

  return snapPoints;
}

/**
 * Extract endpoints from coordinate array
 */
function extractCoordsEndpoints(
  coords: number[][],
  properties?: Record<string, unknown> | null
): SnapPoint[] {
  const snapPoints: SnapPoint[] = [];

  if (!coords || coords.length < 2) return snapPoints;

  // Start point
  const [x1, y1] = coords[0];
  snapPoints.push({
    x: x1,
    y: y1,
    mode: SnapMode.ENDPOINT,
    entityType: 'MultiLineString',
    label: `Start (${x1.toFixed(2)}, ${y1.toFixed(2)})`
  });

  // End point
  const [x2, y2] = coords[coords.length - 1];
  snapPoints.push({
    x: x2,
    y: y2,
    mode: SnapMode.ENDPOINT,
    entityType: 'MultiLineString',
    label: `End (${x2.toFixed(2)}, ${y2.toFixed(2)})`
  });

  return snapPoints;
}


/**
 * Remove duplicate snap points
 *
 * @param snapPoints - Array of snap points
 * @param tolerance - Distance tolerance for considering points equal (default: 0.01)
 * @returns Deduplicated array
 */
export function deduplicateSnapPoints(
  snapPoints: SnapPoint[],
  tolerance: number = 0.01
): SnapPoint[] {
  const unique: SnapPoint[] = [];

  for (const point of snapPoints) {
    const isDuplicate = unique.some(
      existing =>
        Math.abs(existing.x - point.x) < tolerance &&
        Math.abs(existing.y - point.y) < tolerance
    );

    if (!isDuplicate) {
      unique.push(point);
    }
  }

  return unique;
}
