/**
 * 🗺️ SPATIAL QUERY SERVICE - Phase 6.2
 *
 * Enterprise service για spatial relationship queries
 * Geometric analysis, spatial indexing, και boundary relationships
 *
 * @module services/spatial/SpatialQueryService
 */

import { GreekAdminLevel, GREECE_COUNTRY_NAME } from '../../types/administrative-types';
import type {
  SpatialQuery,
  AdminSearchResult,
  BoundingBox
} from '../../types/administrative-types';
import { getString } from '@/lib/firestore/field-extractors';
import { administrativeBoundaryService } from '../administrative-boundaries/AdministrativeBoundaryService';
import {
  getBoundingBox,
  bboxIntersects,
  bboxContains,
  calculateDistance,
  createCircularBuffer,
  type SpatialGeometry,
} from './spatial-utils';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('SpatialQueryService');

// ============================================================================
// TYPES
// ============================================================================

type FeatureCollectionLike = {
  type: 'FeatureCollection';
  features: Array<{
    geometry: GeoJSON.Geometry | null;
    properties: Record<string, unknown> | null;
  }>;
};

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
      logger.error('Spatial query error', { error });
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
      logger.warn(`Error querying admin level ${adminLevel}`, { error });
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
        logger.warn('Error getting postal codes', { error });
      }
    }

    // For other admin levels, we would need more sophisticated spatial indexing
    // For now, return empty array - this could be enhanced with proper spatial database
    logger.warn(`Spatial query for admin level ${adminLevel} not fully implemented`);
    return [];
  }

  /**
   * Convert GeoJSON FeatureCollection to AdminSearchResult[]
   */
  private convertGeoJSONToSearchResults(
    collection: FeatureCollectionLike,
    adminLevel: GreekAdminLevel
  ): AdminSearchResult[] {
    // ADR-219: getStringProp replaced by centralized getString

    return collection.features.map((feature, index) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const name = getString(props, 'name')
        ?? getString(props, 'postal_code')
        ?? `Unknown ${adminLevel}`;

      // Calculate bounds
      let bounds: BoundingBox | undefined;
      if (feature.geometry) {
        try {
          bounds = getBoundingBox(feature.geometry);
        } catch (error) {
          logger.warn('Error calculating bounds', { error });
        }
      }

      return {
        id: getString(props, 'id') ?? `spatial-${adminLevel}-${index}`,
        name,
        nameEn: getString(props, 'nameEn'),
        adminLevel,
        hierarchy: {
          country: GREECE_COUNTRY_NAME,
          region: getString(props, 'region') ?? 'Unknown'
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
      logger.warn('Spatial relationship test error', { error });
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

  /** Delegate to spatial-utils */
  calculateDistance(point1: [number, number], point2: [number, number]): number {
    return calculateDistance(point1, point2);
  }

  /** Delegate to spatial-utils */
  createCircularBuffer(center: [number, number], radiusMeters: number, points = 32): GeoJSON.Polygon {
    return createCircularBuffer(center, radiusMeters, points);
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
