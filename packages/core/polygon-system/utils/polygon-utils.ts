/**
 * 🔧 POLYGON UTILITIES
 *
 * Utility functions για polygon operations
 *
 * @module core/polygon-system/utils/polygon-utils
 */

import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonValidationResult,
  RealEstatePolygon,
  PropertyLocation,
  PropertyMatchResult
} from '../types';
import { simplifyClosedRing, simplifyPolyline } from '@/lib/geometry/douglas-peucker';
import { pointInPolygon, polygonArea } from '@/lib/geometry/planar-polygon';

/**
 * Validate polygon structure and geometry
 */
export function validatePolygon(polygon: UniversalPolygon): PolygonValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Basic structure validation
  if (!polygon.id) {
    errors.push('Polygon must have an ID');
  }

  if (!polygon.points || !Array.isArray(polygon.points)) {
    errors.push('Polygon must have points array');
    return { isValid: false, errors, warnings, suggestions };
  }

  if (polygon.points.length < 2) {
    errors.push('Polygon must have at least 2 points');
  }

  // Point validation
  for (let i = 0; i < polygon.points.length; i++) {
    const point = polygon.points[i];

    if (typeof point.x !== 'number' || typeof point.y !== 'number') {
      errors.push(`Point ${i}: Invalid coordinates`);
    }

    if (isNaN(point.x) || isNaN(point.y)) {
      errors.push(`Point ${i}: NaN coordinates`);
    }

    if (!isFinite(point.x) || !isFinite(point.y)) {
      errors.push(`Point ${i}: Infinite coordinates`);
    }
  }

  // Geometric validation
  if (polygon.points.length >= 3) {
    // Check for duplicate consecutive points
    for (let i = 0; i < polygon.points.length - 1; i++) {
      const current = polygon.points[i];
      const next = polygon.points[i + 1];

      if (Math.abs(current.x - next.x) < 0.001 && Math.abs(current.y - next.y) < 0.001) {
        warnings.push(`Duplicate consecutive points at index ${i}-${i + 1}`);
        suggestions.push('Remove duplicate points');
      }
    }

    // Check for self-intersection (basic check)
    if (polygon.points.length >= 4 && polygon.isClosed) {
      const hasIntersection = checkSelfIntersection(polygon.points);
      if (hasIntersection) {
        warnings.push('Polygon may have self-intersections');
        suggestions.push('Check polygon geometry');
      }
    }

    // Check polygon area
    const area = calculatePolygonArea(polygon);
    if (Math.abs(area) < 0.001) {
      warnings.push('Polygon has very small or zero area');
    }
  }

  // Closure validation
  if (polygon.isClosed && polygon.points.length >= 3) {
    const firstPoint = polygon.points[0];
    const lastPoint = polygon.points[polygon.points.length - 1];

    if (Math.abs(firstPoint.x - lastPoint.x) > 0.001 ||
        Math.abs(firstPoint.y - lastPoint.y) > 0.001) {
      warnings.push('Polygon marked as closed but first/last points differ');
      suggestions.push('Update closure status or fix coordinates');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

/**
 * Calculate polygon area (unsigned — το παλιό σχόλιο έλεγε «signed», το σώμα έδινε πάντα απόλυτη τιμή).
 * SSoT: `@/lib/geometry/planar-polygon` (ADR-884 §4.14 Γ3).
 */
export function calculatePolygonArea(polygon: UniversalPolygon): number {
  return polygonArea(polygon.points);
}

/**
 * Calculate polygon perimeter
 */
export function calculatePolygonPerimeter(polygon: UniversalPolygon): number {
  const points = polygon.points;

  if (points.length < 2) {
    return 0;
  }

  let perimeter = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    perimeter += Math.sqrt(
      Math.pow(next.x - current.x, 2) + Math.pow(next.y - current.y, 2)
    );
  }

  // Add closing edge if polygon is closed
  if (polygon.isClosed && points.length >= 3) {
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    perimeter += Math.sqrt(
      Math.pow(firstPoint.x - lastPoint.x, 2) + Math.pow(firstPoint.y - lastPoint.y, 2)
    );
  }

  return perimeter;
}

/**
 * Check if polygon is closed
 */
export function isPolygonClosed(polygon: UniversalPolygon): boolean {
  if (polygon.points.length < 3) {
    return false;
  }

  const firstPoint = polygon.points[0];
  const lastPoint = polygon.points[polygon.points.length - 1];

  const isClosed = Math.abs(firstPoint.x - lastPoint.x) < 0.001 &&
                   Math.abs(firstPoint.y - lastPoint.y) < 0.001;

  return isClosed;
}

/**
 * Close polygon by adding first point as last point
 */
export function closePolygon(polygon: UniversalPolygon): UniversalPolygon {
  if (polygon.points.length < 3) {
    console.warn('⚠️ Cannot close polygon with less than 3 points');
    return polygon;
  }

  if (polygon.isClosed) {
    return polygon; // Already closed
  }

  const firstPoint = polygon.points[0];
  const lastPoint = polygon.points[polygon.points.length - 1];

  // Check if already geometrically closed
  const isGeometricallyClosedÖ = Math.abs(firstPoint.x - lastPoint.x) < 0.001 &&
                                 Math.abs(firstPoint.y - lastPoint.y) < 0.001;

  if (!isGeometricallyClosedÖ) {
    // Add closing point
    polygon.points.push({
      ...firstPoint,
      id: `closing_point_${Date.now()}`,
      label: 'Closing Point'
    });
  }

  // Mark as closed
  polygon.isClosed = true;
  polygon.metadata = {
    createdAt: polygon.metadata?.createdAt || new Date(),
    modifiedAt: new Date(),
    ...polygon.metadata
  };

  return polygon;
}

/**
 * Get polygon bounding box
 */
export function getPolygonBounds(polygon: UniversalPolygon): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (polygon.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = polygon.points[0].x;
  let minY = polygon.points[0].y;
  let maxX = polygon.points[0].x;
  let maxY = polygon.points[0].y;

  for (let i = 1; i < polygon.points.length; i++) {
    const point = polygon.points[i];
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Check if point is inside polygon (ray casting algorithm — SSoT `@/lib/geometry/planar-polygon`, ADR-884 §4.14 Γ3).
 * Ανοιχτό πολύγωνο δεν έχει «μέσα».
 */
export function isPointInPolygon(point: PolygonPoint, polygon: UniversalPolygon): boolean {
  if (!polygon.isClosed) {
    return false;
  }
  return pointInPolygon(point, polygon.points);
}

/**
 * Simple self-intersection check
 */
function checkSelfIntersection(points: PolygonPoint[]): boolean {
  if (points.length < 4) {
    return false;
  }

  // Check each edge against every other non-adjacent edge
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      // Skip adjacent edges
      if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 2)) {
        continue;
      }

      const edge1Start = points[i];
      const edge1End = points[i + 1];
      const edge2Start = points[j];
      const edge2End = points[j + 1];

      if (doLinesIntersect(edge1Start, edge1End, edge2Start, edge2End)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if two line segments intersect
 */
function doLinesIntersect(
  p1: PolygonPoint,
  p2: PolygonPoint,
  p3: PolygonPoint,
  p4: PolygonPoint
): boolean {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

  if (Math.abs(denom) < 0.001) {
    return false; // Lines are parallel
  }

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

/**
 * Simplify polygon using Douglas-Peucker algorithm — SSoT `@/lib/geometry/douglas-peucker` (ADR-884 §4.14 Γ3):
 * κλειστό πολύγωνο = δακτύλιος (δύο αλυσίδες), ανοιχτό = γραμμή με σταθερά άκρα.
 */
export function simplifyPolygon(polygon: UniversalPolygon, tolerance: number = 1.0): UniversalPolygon {
  if (polygon.points.length <= 2) {
    return polygon;
  }

  const simplifiedPoints = polygon.isClosed
    ? simplifyClosedRing(polygon.points, tolerance)
    : simplifyPolyline(polygon.points, tolerance);

  return {
    ...polygon,
    points: simplifiedPoints.length >= 3 || !polygon.isClosed ? simplifiedPoints : polygon.points,
    metadata: {
      createdAt: polygon.metadata?.createdAt || new Date(),
      modifiedAt: new Date(),
      ...polygon.metadata
    }
  };
}

// ============================================================================
// REAL ESTATE MONITORING FUNCTIONS (Phase 2.5.2)
// ============================================================================

/**
 * Check if property location matches real estate polygons
 */
export function checkPropertyInRealEstatePolygons(
  property: PropertyLocation,
  polygons: RealEstatePolygon[],
  toleranceMeters = 100
): PropertyMatchResult {
  const matchedPolygons: PropertyMatchResult['matchedPolygons'] = [];

  for (const polygon of polygons) {
    // Convert lat/lng to x/y for point-in-polygon test
    const point: PolygonPoint = {
      x: property.coordinates.lng,
      y: property.coordinates.lat
    };

    const isInside = isPointInPolygon(point, polygon);
    const distance = calculateDistanceToPolygonCenter(property.coordinates, polygon);

    if (isInside || distance <= toleranceMeters) {
      const confidence = calculateMatchConfidence(property.coordinates, polygon, distance, isInside);

      matchedPolygons.push({
        polygon,
        confidence,
        distance
      });
    }
  }

  const shouldAlert = determineShouldAlert(property, matchedPolygons);
  const alertReason = generateAlertReason(property, matchedPolygons);

  return {
    property,
    matchedPolygons,
    shouldAlert,
    alertReason
  };
}

/**
 * Calculate distance from property to polygon center in meters
 */
function calculateDistanceToPolygonCenter(
  coordinates: { lat: number; lng: number },
  polygon: UniversalPolygon
): number {
  const center = calculatePolygonCenterLatLng(polygon);
  return calculateHaversineDistance(coordinates, center);
}

/**
 * Calculate polygon center for lat/lng coordinates
 */
function calculatePolygonCenterLatLng(polygon: UniversalPolygon): { lat: number; lng: number } {
  let latSum = 0;
  let lngSum = 0;

  for (const point of polygon.points) {
    latSum += point.y; // y = lat
    lngSum += point.x; // x = lng
  }

  return {
    lat: latSum / polygon.points.length,
    lng: lngSum / polygon.points.length
  };
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 */
function calculateHaversineDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate match confidence based on distance and polygon settings
 */
function calculateMatchConfidence(
  coordinates: { lat: number; lng: number },
  polygon: RealEstatePolygon,
  distance: number,
  isInside: boolean
): number {
  let baseConfidence = polygon.alertSettings.includeExclude === 'include' ? 0.8 : 0.2;

  if (isInside) {
    baseConfidence += 0.2;
  }

  // Distance weighting: closer to center = higher confidence
  const maxDistance = 1000; // 1km max distance for confidence calculation
  const distanceWeight = Math.max(0, 1 - (distance / maxDistance));

  return Math.min(1, baseConfidence + (distanceWeight * 0.1));
}

/**
 * Determine if property should trigger alert based on polygon settings
 */
function determineShouldAlert(
  property: PropertyLocation,
  matches: PropertyMatchResult['matchedPolygons']
): boolean {
  if (matches.length === 0) return false;

  for (const match of matches) {
    const { polygon } = match;
    const { alertSettings } = polygon;

    if (!alertSettings.enabled) continue;

    // 'exclude' polygons prevent alerts
    if (alertSettings.includeExclude === 'exclude') {
      return false;
    }

    // Check price range
    if (alertSettings.priceRange && property.price) {
      const { min, max } = alertSettings.priceRange;
      if ((min && property.price < min) || (max && property.price > max)) {
        continue;
      }
    }

    // Check property type
    if (alertSettings.propertyTypes && property.type) {
      if (!alertSettings.propertyTypes.includes(property.type)) {
        continue;
      }
    }

    // Check size range
    if (property.size) {
      if (alertSettings.minSize && property.size < alertSettings.minSize) {
        continue;
      }
      if (alertSettings.maxSize && property.size > alertSettings.maxSize) {
        continue;
      }
    }

    // If we reach here, this polygon wants to alert
    return true;
  }

  return false;
}

/**
 * Generate human-readable alert reason
 */
function generateAlertReason(
  property: PropertyLocation,
  matches: PropertyMatchResult['matchedPolygons']
): string | undefined {
  if (matches.length === 0) return undefined;

  const includingPolygons = matches.filter(m => m.polygon.alertSettings.includeExclude === 'include');
  const excludingPolygons = matches.filter(m => m.polygon.alertSettings.includeExclude === 'exclude');

  if (excludingPolygons.length > 0) {
    const polygonNames = excludingPolygons.map(m => m.polygon.metadata?.description || m.polygon.id);
    return `Αποκλείεται από: ${polygonNames.join(', ')}`;
  }

  if (includingPolygons.length > 0) {
    const bestMatch = includingPolygons.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    const polygonName = bestMatch.polygon.metadata?.description || bestMatch.polygon.id;
    const details = [];
    if (property.price) details.push(`€${property.price.toLocaleString()}`);
    if (property.size) details.push(`${property.size}m²`);
    if (property.type) details.push(property.type);

    return `Βρέθηκε στην περιοχή "${polygonName}" (${Math.round(bestMatch.distance)}m από κέντρο)${details.length ? ` - ${details.join(', ')}` : ''}`;
  }

  return undefined;
}

/**
 * Batch process multiple properties against real estate polygons
 */
export async function checkMultiplePropertiesInRealEstatePolygons(
  properties: PropertyLocation[],
  polygons: RealEstatePolygon[],
  options: {
    toleranceMeters?: number;
    batchSize?: number;
  } = {}
): Promise<PropertyMatchResult[]> {
  const { toleranceMeters = 100, batchSize = 50 } = options;
  const results: PropertyMatchResult[] = [];

  // Process in batches για performance
  for (let i = 0; i < properties.length; i += batchSize) {
    const batch = properties.slice(i, i + batchSize);

    const batchResults = batch.map(property =>
      checkPropertyInRealEstatePolygons(property, polygons, toleranceMeters)
    );

    results.push(...batchResults);

    // Small delay μεταξύ batches (avoid blocking UI)
    if (i + batchSize < properties.length) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  return results;
}

/**
 * Get properties that should trigger alerts
 */
export function getAlertableProperties(results: PropertyMatchResult[]): PropertyMatchResult[] {
  return results.filter(result => result.shouldAlert);
}

/**
 * Group results by polygon for reporting
 */
export function groupPropertyResultsByPolygon(results: PropertyMatchResult[]): Map<string, PropertyMatchResult[]> {
  const groups = new Map<string, PropertyMatchResult[]>();

  for (const result of results) {
    for (const match of result.matchedPolygons) {
      const polygonId = match.polygon.id;
      if (!groups.has(polygonId)) {
        groups.set(polygonId, []);
      }
      groups.get(polygonId)!.push(result);
    }
  }

  return groups;
}