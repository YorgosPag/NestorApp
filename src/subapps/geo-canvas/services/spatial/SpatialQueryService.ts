/**
 * 🗺️ SPATIAL QUERY SERVICE - Phase 6.2
 *
 * Enterprise service για spatial relationship queries
 * Geometric analysis, spatial indexing, και boundary relationships
 *
 * @module services/spatial/SpatialQueryService
 */

import { GreekAdminLevel } from '../../types/administrative-types';
import type {
  SpatialQuery,
  AdminSearchResult,
  BoundingBox
} from '../../types/administrative-types';
import { administrativeBoundaryService } from '../administrative-boundaries/AdministrativeBoundaryService';

// ============================================================================
// SPATIAL UTILITIES
// ============================================================================

type SpatialCoordinates =
  | GeoJSON.Position
  | GeoJSON.Position[]
  | GeoJSON.Position[][]
  | GeoJSON.Position[][][];

type SpatialGeometry = GeoJSON.Geometry;


type FeatureCollectionLike = {
  type: 'FeatureCollection';
  features: Array<{
    geometry: GeoJSON.Geometry | null;
    properties: Record<string, unknown> | null;
  }>;
};

/**
 * Point-in-polygon test using ray casting algorithm
 */
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
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

/**
 * Calculate bounding box for geometry
 */
function getBoundingBox(geometry: SpatialGeometry): BoundingBox {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  function processCoordinate(coord: number[]) {
    const [lng, lat] = coord;
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  // 🏢 ENTERPRISE: Type-safe recursive coordinate processing
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
function bboxIntersects(bbox1: BoundingBox, bbox2: BoundingBox): boolean {
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
function bboxContains(outer: BoundingBox, inner: BoundingBox): boolean {
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
function pointInBbox(point: [number, number], bbox: BoundingBox): boolean {
  const [lng, lat] = point;
  return lng >= bbox.west && lng <= bbox.east &&
         lat >= bbox.south && lat <= bbox.north;
}

// ============================================================================
// MAIN SPATIAL QUERY SERVICE
// ============================================================================

/**
 * Enterprise Spatial Query Service
 * Handles complex spatial relationships και geometric analysis
 */
export class SpatialQueryService {

  private spatialCache = new Map<string, {
    results: AdminSearchResult[];
    timestamp: number;
  }>();

  private readonly cacheExpiryMs = 10 * 60 * 1000; // 10 minutes

  // ============================================================================
  // CORE SPATIAL QUERY METHODS
  // ============================================================================

  /**
   * Execute spatial query against administrative boundaries
   */
  async executeSpatialQuery(query: SpatialQuery): Promise<AdminSearchResult[]> {
    const cacheKey = this.generateCacheKey(query);

    // Check cache
    const cached = this.spatialCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      console.debug('📦 Using cached spatial query results');
      return cached.results;
    }

    console.debug(`🗺️ Executing spatial query: ${query.type}`);

    try {
      let results: AdminSearchResult[] = [];

      // Get query bounding box for optimization
      const queryBbox = getBoundingBox(query.geometry);

      // Get potentially relevant boundaries based on admin levels
      const adminLevels = query.targetAdminLevels || [
        GreekAdminLevel.REGION,
        GreekAdminLevel.MUNICIPALITY,
        GreekAdminLevel.MUNICIPAL_UNIT,
        GreekAdminLevel.POSTAL_CODE
      ];

      // Execute spatial relationship test for each admin level
      for (const adminLevel of adminLevels) {
        const levelResults = await this.queryAdminLevel(
          query,
          adminLevel,
          queryBbox
        );
        results.push(...levelResults);
      }

      // Sort by confidence/relevance
      results.sort((a, b) => b.confidence - a.confidence);

      // Apply result limit
      if (query.maxResults) {
        results = results.slice(0, query.maxResults);
      }

      // Cache results
      this.spatialCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });

      console.debug(`✅ Spatial query found ${results.length} results`);

      return results;

    } catch (error) {
      console.error('Spatial query error:', error);
      return [];
    }
  }

  /**
   * Find administrative boundaries that intersect with geometry
   */
  async findIntersecting(
    geometry: SpatialGeometry,
    adminLevels?: GreekAdminLevel[],
    maxResults = 20
  ): Promise<AdminSearchResult[]> {
    return this.executeSpatialQuery({
      type: 'intersects',
      geometry,
      targetAdminLevels: adminLevels,
      maxResults
    });
  }

  /**
   * Find administrative boundaries that contain the geometry
   */
  async findContaining(
    geometry: SpatialGeometry,
    adminLevels?: GreekAdminLevel[],
    maxResults = 10
  ): Promise<AdminSearchResult[]> {
    return this.executeSpatialQuery({
      type: 'contains',
      geometry,
      targetAdminLevels: adminLevels,
      maxResults
    });
  }

  /**
   * Find administrative boundaries that are within the geometry
   */
  async findWithin(
    geometry: SpatialGeometry,
    adminLevels?: GreekAdminLevel[],
    maxResults = 50
  ): Promise<AdminSearchResult[]> {
    return this.executeSpatialQuery({
      type: 'within',
      geometry,
      targetAdminLevels: adminLevels,
      maxResults
    });
  }

  /**
   * Find what administrative boundaries a point belongs to
   */
  async findBoundariesAtPoint(
    lat: number,
    lng: number,
    adminLevels?: GreekAdminLevel[]
  ): Promise<AdminSearchResult[]> {
    const pointGeometry: GeoJSON.Point = {
      type: 'Point',
      coordinates: [lng, lat]
    };

    return this.findContaining(pointGeometry, adminLevels, 10);
  }

  /**
   * Find administrative boundaries in a bounding box
   */
  async findInBoundingBox(
    bounds: BoundingBox,
    adminLevels?: GreekAdminLevel[],
    maxResults = 100
  ): Promise<AdminSearchResult[]> {
    const bboxGeometry: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [[
        [bounds.west, bounds.north],
        [bounds.east, bounds.north],
        [bounds.east, bounds.south],
        [bounds.west, bounds.south],
        [bounds.west, bounds.north]
      ]]
    };

    return this.findIntersecting(bboxGeometry, adminLevels, maxResults);
  }

  // ============================================================================
  // PRIVATE SPATIAL ANALYSIS METHODS
  // ============================================================================

  /**
   * Query specific admin level for spatial relationships
   */
  private async queryAdminLevel(
    query: SpatialQuery,
    adminLevel: GreekAdminLevel,
    queryBbox: BoundingBox
  ): Promise<AdminSearchResult[]> {
    try {
      // For now, we use a simple approach - get boundaries in the query bbox
      // and then test spatial relationships

      // This could be optimized with proper spatial indexing in the future
      const candidateResults = await this.getCandidateBoundaries(adminLevel, queryBbox);

      const matchingResults: AdminSearchResult[] = [];

      for (const candidate of candidateResults) {
        if (!candidate.geometry) continue;

        const relationship = this.testSpatialRelationship(
          query.geometry,
          candidate.geometry,
          query.type
        );

        if (relationship) {
          // Adjust confidence based on spatial relationship quality
          const adjustedCandidate = {
            ...candidate,
            confidence: Math.min(candidate.confidence * 1.1, 1.0)
          };
          matchingResults.push(adjustedCandidate);
        }
      }

      return matchingResults;

    } catch (error) {
      console.warn(`Error querying admin level ${adminLevel}:`, error);
      return [];
    }
  }

  /**
   * Get candidate boundaries for spatial testing
   */
  private async getCandidateBoundaries(
    adminLevel: GreekAdminLevel,
    bbox: BoundingBox
  ): Promise<AdminSearchResult[]> {
    // For postal codes, use the postal code service
    if (adminLevel === GreekAdminLevel.POSTAL_CODE) {
      try {
        const postalCollection = await administrativeBoundaryService.getPostalCodesInBounds(bbox);
        if (postalCollection) {
          return this.convertGeoJSONToSearchResults(postalCollection, adminLevel);
        }
      } catch (error) {
        console.warn('Error getting postal codes:', error);
      }
    }

    // For other admin levels, we would need more sophisticated spatial indexing
    // For now, return empty array - this could be enhanced with proper spatial database
    console.warn(`Spatial query for admin level ${adminLevel} not fully implemented`);
    return [];
  }

  /**
   * Convert GeoJSON FeatureCollection to AdminSearchResult[]
   */
  private convertGeoJSONToSearchResults(
    collection: FeatureCollectionLike,
    adminLevel: GreekAdminLevel
  ): AdminSearchResult[] {
    const getStringProp = (props: Record<string, unknown>, key: string): string | undefined => {
      const value = props[key];
      return typeof value === 'string' ? value : undefined;
    };

    return collection.features.map((feature, index) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const name = getStringProp(props, 'name')
        ?? getStringProp(props, 'postal_code')
        ?? `Unknown ${adminLevel}`;

      // Calculate bounds
      let bounds: BoundingBox | undefined;
      if (feature.geometry) {
        try {
          bounds = getBoundingBox(feature.geometry);
        } catch (error) {
          console.warn('Error calculating bounds:', error);
        }
      }

      return {
        id: getStringProp(props, 'id') ?? `spatial-${adminLevel}-${index}`,
        name,
        nameEn: getStringProp(props, 'nameEn'),
        adminLevel,
        hierarchy: {
          country: 'Ελλάδα',
          region: getStringProp(props, 'region') ?? 'Unknown'
        },
        geometry: feature.geometry ?? undefined,
        bounds,
        confidence: 0.8 // Base confidence for spatial results
      };
    });
  }

  /**
   * Test spatial relationship between two geometries
   */
  private testSpatialRelationship(
    geometry1: SpatialGeometry,
    geometry2: SpatialGeometry,
    relationshipType: 'intersects' | 'contains' | 'within' | 'touches' | 'crosses'
  ): boolean {
    try {
      // Get bounding boxes for quick rejection test
      const bbox1 = getBoundingBox(geometry1);
      const bbox2 = getBoundingBox(geometry2);

      // Quick bbox tests
      switch (relationshipType) {
        case 'intersects':
          return bboxIntersects(bbox1, bbox2);

        case 'contains':
          // geometry1 contains geometry2
          return bboxContains(bbox1, bbox2);

        case 'within':
          // geometry1 is within geometry2
          return bboxContains(bbox2, bbox1);

        case 'touches':
        case 'crosses':
          // For now, just check intersection
          return bboxIntersects(bbox1, bbox2);

        default:
          return false;
      }

      // Note: This is a simplified implementation using bounding boxes
      // A full implementation would need proper geometric algorithms
      // for precise spatial relationship testing

    } catch (error) {
      console.warn('Spatial relationship test error:', error);
      return false;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Generate cache key για spatial query
   */
  private generateCacheKey(query: SpatialQuery): string {
    const geomStr = JSON.stringify(query.geometry).substring(0, 100);
    const levelsStr = query.targetAdminLevels?.join(',') || 'all';
    return `spatial:${query.type}:${levelsStr}:${btoa(geomStr).substring(0, 20)}`;
  }

  /**
   * Clear spatial query cache
   */
  clearCache(): void {
    this.spatialCache.clear();
    console.debug('🗺️ Spatial query cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, value] of this.spatialCache.entries()) {
      if (now - value.timestamp < this.cacheExpiryMs) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.spatialCache.size,
      validEntries,
      expiredEntries,
      cacheExpiryMinutes: this.cacheExpiryMs / (1000 * 60)
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(
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

    return R * c; // Distance in meters
  }

  /**
   * Create circular buffer around point
   */
  createCircularBuffer(
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
      const dLat = dy / 111320; // meters per degree latitude
      const dLng = dx / (111320 * Math.cos(centerLat * Math.PI / 180));

      coordinates.push([centerLng + dLng, centerLat + dLat]);
    }

    return {
      type: 'Polygon',
      coordinates: [coordinates]
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton Spatial Query Service instance
 */
export const spatialQueryService = new SpatialQueryService();

export default spatialQueryService;
