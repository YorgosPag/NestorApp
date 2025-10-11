/**
 * 🌉 UNIVERSAL POLYGON SYSTEM BRIDGE
 *
 * Integration bridge μεταξύ Universal Polygon System και Unified Database
 *
 * @module core/geo-alert-unified/integration/universal-polygon-bridge
 */

import type {
  UniversalPolygon,
  PolygonPoint,
  PolygonType,
  PolygonStyle
} from '../polygon-system/types';

import type {
  UniversalPolygonRecord,
  PolygonPointRecord,
  CreateUniversalPolygonRequest,
  CreatePolygonPointRequest,
  GeoPolygon,
  GeoPoint
} from '../database/types';

// ============================================================================
// CONVERSION FUNCTIONS: Universal System → Database
// ============================================================================

/**
 * Convert UniversalPolygon to database record format
 */
export function universalPolygonToRecord(
  polygon: UniversalPolygon,
  projectId?: string
): CreateUniversalPolygonRequest {
  // Convert points to GeoJSON polygon
  const coordinates = polygon.points.map(point => [point.x, point.y]);

  // Ensure polygon is closed for GeoJSON
  if (polygon.isClosed && coordinates.length >= 3) {
    const firstCoord = coordinates[0];
    const lastCoord = coordinates[coordinates.length - 1];

    if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
      coordinates.push([...firstCoord]);
    }
  }

  const geometry: GeoPolygon = {
    type: 'Polygon',
    coordinates: [coordinates]
  };

  return {
    projectId,
    polygonType: polygon.type,
    name: `Polygon ${polygon.id}`,
    description: polygon.metadata?.description,
    geometry,
    strokeColor: polygon.style.strokeColor,
    fillColor: polygon.style.fillColor,
    strokeWidth: polygon.style.strokeWidth,
    fillOpacity: polygon.style.fillOpacity,
    strokeOpacity: polygon.style.strokeOpacity,
    strokeDash: polygon.style.strokeDash
  };
}

/**
 * Convert PolygonPoint to database record format
 */
export function polygonPointToRecord(
  point: PolygonPoint,
  polygonId: string,
  order: number
): CreatePolygonPointRequest {
  const geoPoint: GeoPoint = {
    lng: point.x,
    lat: point.y
  };

  return {
    polygonId,
    pointOrder: order,
    geoPoint,
    pointId: point.id || `point_${order}`,
    label: point.label,
    isControlPoint: false, // Default, can be overridden
    createdBy: 'universal-polygon-system'
  };
}

/**
 * Convert polygon points array to database records
 */
export function polygonPointsToRecords(
  points: PolygonPoint[],
  polygonId: string
): CreatePolygonPointRequest[] {
  return points.map((point, index) =>
    polygonPointToRecord(point, polygonId, index)
  );
}

// ============================================================================
// CONVERSION FUNCTIONS: Database → Universal System
// ============================================================================

/**
 * Convert database record to UniversalPolygon
 */
export function recordToUniversalPolygon(
  record: UniversalPolygonRecord,
  points: PolygonPointRecord[]
): UniversalPolygon {
  // Convert database points to UniversalPolygon format
  const polygonPoints: PolygonPoint[] = points
    .sort((a, b) => a.pointOrder - b.pointOrder)
    .map(point => ({
      x: point.geoPoint.lng,
      y: point.geoPoint.lat,
      id: point.pointId,
      label: point.label
    }));

  const style: PolygonStyle = {
    strokeColor: record.strokeColor,
    fillColor: record.fillColor,
    strokeWidth: record.strokeWidth,
    fillOpacity: record.fillOpacity,
    strokeOpacity: record.strokeOpacity,
    strokeDash: record.strokeDash
  };

  return {
    id: record.id,
    type: record.polygonType,
    points: polygonPoints,
    isClosed: record.isClosed,
    style,
    metadata: {
      createdAt: record.createdAt,
      modifiedAt: record.updatedAt,
      description: record.description,
      area: record.areaSqm,
      perimeter: record.perimeterM,
      properties: {
        projectId: record.projectId,
        qualityScore: record.qualityScore,
        validationErrors: record.validationErrors
      }
    }
  };
}

/**
 * Convert multiple database records to UniversalPolygon array
 */
export function recordsToUniversalPolygons(
  records: UniversalPolygonRecord[],
  pointsMap: Map<string, PolygonPointRecord[]>
): UniversalPolygon[] {
  return records.map(record => {
    const points = pointsMap.get(record.id) || [];
    return recordToUniversalPolygon(record, points);
  });
}

// ============================================================================
// POLYGON TYPE CONVERSIONS
// ============================================================================

/**
 * Convert Universal Polygon Type to database enum
 */
export function universalTypeToDbType(type: PolygonType): UniversalPolygonRecord['polygonType'] {
  const typeMap: Record<PolygonType, UniversalPolygonRecord['polygonType']> = {
    'simple': 'simple',
    'georeferencing': 'georeferencing',
    'alert-zone': 'alert-zone',
    'measurement': 'measurement',
    'annotation': 'annotation'
  };

  return typeMap[type] || 'simple';
}

/**
 * Convert database type to Universal Polygon Type
 */
export function dbTypeToUniversalType(type: UniversalPolygonRecord['polygonType']): PolygonType {
  const typeMap: Record<UniversalPolygonRecord['polygonType'], PolygonType> = {
    'simple': 'simple',
    'georeferencing': 'georeferencing',
    'alert-zone': 'alert-zone',
    'measurement': 'measurement',
    'annotation': 'annotation'
  };

  return typeMap[type] || 'simple';
}

// ============================================================================
// COORDINATE TRANSFORMATIONS
// ============================================================================

/**
 * Apply transformation matrix to convert DXF coordinates to geo coordinates
 */
export function transformDxfToGeo(
  dxfPoint: { x: number; y: number },
  transformMatrix: {
    a: number; b: number; c: number;
    d: number; e: number; f: number;
  }
): GeoPoint {
  const { x, y } = dxfPoint;
  const { a, b, c, d, e, f } = transformMatrix;

  // Apply 2D affine transformation
  const lng = a * x + b * y + c;
  const lat = d * x + e * y + f;

  return { lng, lat };
}

/**
 * Apply inverse transformation to convert geo coordinates to DXF coordinates
 */
export function transformGeoToDxf(
  geoPoint: GeoPoint,
  transformMatrix: {
    a: number; b: number; c: number;
    d: number; e: number; f: number;
  }
): { x: number; y: number } {
  const { lng, lat } = geoPoint;
  const { a, b, c, d, e, f } = transformMatrix;

  // Calculate inverse transformation matrix
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-10) {
    throw new Error('Transformation matrix is singular (not invertible)');
  }

  const invA = e / det;
  const invB = -b / det;
  const invC = (b * f - c * e) / det;
  const invD = -d / det;
  const invE = a / det;
  const invF = (c * d - a * f) / det;

  // Apply inverse transformation
  const x = invA * lng + invB * lat + invC;
  const y = invD * lng + invE * lat + invF;

  return { x, y };
}

/**
 * Convert UniversalPolygon με DXF coordinates to geo coordinates
 */
export function transformUniversalPolygonToGeo(
  polygon: UniversalPolygon,
  transformMatrix: {
    a: number; b: number; c: number;
    d: number; e: number; f: number;
  }
): UniversalPolygon {
  const transformedPoints = polygon.points.map(point => {
    const geoPoint = transformDxfToGeo(
      { x: point.x, y: point.y },
      transformMatrix
    );

    return {
      ...point,
      x: geoPoint.lng,
      y: geoPoint.lat
    };
  });

  return {
    ...polygon,
    points: transformedPoints,
    metadata: {
      createdAt: polygon.metadata?.createdAt || new Date(),
      modifiedAt: new Date(),
      createdBy: polygon.metadata?.createdBy,
      description: polygon.metadata?.description,
      area: polygon.metadata?.area,
      perimeter: polygon.metadata?.perimeter,
      properties: {
        ...polygon.metadata?.properties,
        transformed: true,
        transformMatrix
      }
    }
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate UniversalPolygon για database storage
 */
export function validatePolygonForStorage(polygon: UniversalPolygon): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!polygon.id) {
    errors.push('Polygon ID is required');
  }

  if (!polygon.type) {
    errors.push('Polygon type is required');
  }

  if (!polygon.points || polygon.points.length === 0) {
    errors.push('Polygon must have at least one point');
  }

  // Check geometric validity
  if (polygon.isClosed && polygon.points.length < 3) {
    errors.push('Closed polygon must have at least 3 points');
  }

  // Check for duplicate points
  const pointSet = new Set();
  for (const point of polygon.points) {
    const key = `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
    if (pointSet.has(key)) {
      warnings.push(`Duplicate point found at (${point.x}, ${point.y})`);
    }
    pointSet.add(key);
  }

  // Check coordinate validity (rough bounds check για Earth)
  for (const point of polygon.points) {
    if (point.x < -180 || point.x > 180) {
      warnings.push(`Longitude ${point.x} is outside valid range [-180, 180]`);
    }
    if (point.y < -90 || point.y > 90) {
      warnings.push(`Latitude ${point.y} is outside valid range [-90, 90]`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate polygon statistics για metadata
 */
export function calculatePolygonStatistics(polygon: UniversalPolygon): {
  areaSqm?: number;
  perimeterM?: number;
  centroid?: GeoPoint;
  bounds?: { north: number; south: number; east: number; west: number };
} {
  if (polygon.points.length < 3) {
    return {};
  }

  // Simple approximation - για accurate calculations θα χρησιμοποιήσουμε PostGIS
  const lats = polygon.points.map(p => p.y);
  const lngs = polygon.points.map(p => p.x);

  const bounds = {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs)
  };

  const centroid: GeoPoint = {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2
  };

  // Note: For accurate area/perimeter calculation, we should use PostGIS
  // These are rough approximations για initial storage
  const roughAreaDegrees = (bounds.east - bounds.west) * (bounds.north - bounds.south);
  const areaSqm = roughAreaDegrees * 111319.9 * 111319.9; // Very rough conversion

  return {
    areaSqm,
    centroid,
    bounds
  };
}

// ============================================================================
// NOTE: Functions are exported directly via their definitions above
// No need για additional export block
// ============================================================================