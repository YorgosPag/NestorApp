/**
 * 🏛️ GEOMETRY SIMPLIFICATION ENGINE - Phase 7.3
 *
 * Enterprise geometry simplification system για administrative boundaries
 * Douglas-Peucker algorithm, dynamic LOD, viewport optimization
 *
 * @module services/geometry/GeometrySimplificationEngine
 */

import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import type { AdminSearchResult, BoundingBox } from '../../types/administrative-types';

// ============================================================================
// GEOMETRY TYPES & INTERFACES
// ============================================================================

export interface SimplificationConfig {
  enableSimplification: boolean;
  dynamicLOD: boolean;
  preserveTopology: boolean;
  maxComplexityThreshold: number; // Maximum points per boundary
  minComplexityThreshold: number; // Minimum points to preserve
  adaptiveSimplification: boolean; // Adjust based on viewport
}

export interface ViewportContext {
  zoom: number;
  bounds: BoundingBox;
  mapWidth: number;
  mapHeight: number;
  pixelRatio: number;
}

export interface SimplificationResult {
  originalGeometry: GeoJSON.Geometry;
  simplifiedGeometry: GeoJSON.Geometry;
  originalPoints: number;
  simplifiedPoints: number;
  reductionRatio: number; // 0-1 (0 = no reduction, 1 = maximum reduction)
  processingTime: number; // milliseconds
  qualityScore: number; // 0-1 (visual fidelity score)
  optimizationLevel: 'none' | 'light' | 'medium' | 'heavy';
}

export interface LODLevel {
  name: string;
  minZoom: number;
  maxZoom: number;
  tolerance: number; // Douglas-Peucker tolerance
  maxPoints: number;
  preserveArea: boolean;
  preserveShape: boolean;
}

// ============================================================================
// DOUGLAS-PEUCKER ALGORITHM IMPLEMENTATION
// ============================================================================

/**
 * Douglas-Peucker line simplification algorithm
 * Recursively removes points that don't contribute significantly to line shape
 */
class DouglasPeuckerSimplifier {

  /**
   * Simplify a line string using Douglas-Peucker algorithm
   */
  public static simplifyLineString(
    coordinates: number[][],
    tolerance: number
  ): number[][] {
    if (coordinates.length <= 2) return coordinates;

    const simplified = this.douglasPeucker(coordinates, tolerance);

    // Ensure we keep at least start and end points
    if (simplified.length < 2) {
      return [coordinates[0], coordinates[coordinates.length - 1]];
    }

    return simplified;
  }

  /**
   * Simplify a polygon using Douglas-Peucker algorithm
   */
  public static simplifyPolygon(
    coordinates: number[][][],
    tolerance: number
  ): number[][][] {
    return coordinates.map(ring => {
      if (ring.length <= 3) return ring; // Triangle is minimum for polygon

      const simplified = this.douglasPeucker(ring, tolerance);

      // Ensure polygon closure
      if (simplified.length >= 3) {
        const first = simplified[0];
        const last = simplified[simplified.length - 1];

        // Close polygon if not already closed
        if (first[0] !== last[0] || first[1] !== last[1]) {
          simplified.push([...first]);
        }

        // Ensure minimum 4 points for closed polygon
        if (simplified.length < 4) {
          return ring; // Return original if too simplified
        }
      }

      return simplified.length >= 4 ? simplified : ring;
    });
  }

  /**
   * Core Douglas-Peucker recursive algorithm
   */
  private static douglasPeucker(
    points: number[][],
    tolerance: number
  ): number[][] {
    if (points.length <= 2) return points;

    // Find the point with maximum distance from line segment
    let maxDistance = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(points[i], start, end);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      // Recursively simplify both segments
      const leftSegment = this.douglasPeucker(
        points.slice(0, maxIndex + 1),
        tolerance
      );
      const rightSegment = this.douglasPeucker(
        points.slice(maxIndex),
        tolerance
      );

      // Combine results (remove duplicate point at junction)
      return [
        ...leftSegment.slice(0, -1),
        ...rightSegment
      ];
    }

    // All points between start and end are within tolerance
    return [start, end];
  }

  /**
   * Calculate perpendicular distance from point to line segment
   */
  private static perpendicularDistance(
    point: number[],
    lineStart: number[],
    lineEnd: number[]
  ): number {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    // Handle case where line segment is actually a point
    if (x1 === x2 && y1 === y2) {
      return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2);
    }

    // Calculate perpendicular distance using formula:
    // distance = |ax + by + c| / sqrt(a² + b²)
    // where line equation is ax + by + c = 0
    const A = y2 - y1;
    const B = x1 - x2;
    const C = x2 * y1 - x1 * y2;

    return Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B);
  }
}

// ============================================================================
// LEVEL OF DETAIL (LOD) SYSTEM
// ============================================================================

/**
 * Level of Detail management για administrative boundaries
 * Different simplification levels based on zoom and importance
 */
class LODManager {

  private static readonly LOD_LEVELS: LODLevel[] = [
    {
      name: 'overview',
      minZoom: 0,
      maxZoom: 4,
      tolerance: 0.01, // ~1km at equator
      maxPoints: 50,
      preserveArea: true,
      preserveShape: false
    },
    {
      name: 'regional',
      minZoom: 4,
      maxZoom: 8,
      tolerance: 0.005, // ~500m at equator
      maxPoints: 100,
      preserveArea: true,
      preserveShape: true
    },
    {
      name: 'detailed',
      minZoom: 8,
      maxZoom: 12,
      tolerance: 0.001, // ~100m at equator
      maxPoints: 200,
      preserveArea: true,
      preserveShape: true
    },
    {
      name: 'precise',
      minZoom: 12,
      maxZoom: 18,
      tolerance: 0.0005, // ~50m at equator
      maxPoints: 500,
      preserveArea: true,
      preserveShape: true
    }
  ];

  /**
   * Get appropriate LOD level based on zoom
   */
  public static getLODLevel(zoom: number): LODLevel {
    for (const level of this.LOD_LEVELS) {
      if (zoom >= level.minZoom && zoom < level.maxZoom) {
        return level;
      }
    }

    // Default to most detailed level
    return this.LOD_LEVELS[this.LOD_LEVELS.length - 1];
  }

  /**
   * Calculate adaptive tolerance based on viewport
   */
  public static calculateAdaptiveTolerance(
    viewport: ViewportContext,
    baseLevel: LODLevel
  ): number {
    let tolerance = baseLevel.tolerance;

    // Adjust based on pixel ratio (high DPI screens)
    tolerance *= Math.max(0.5, 2 / viewport.pixelRatio);

    // Adjust based on viewport size (larger viewports can handle more detail)
    const viewportArea = viewport.mapWidth * viewport.mapHeight;
    const baseArea = 1920 * 1080; // Full HD reference
    const areaFactor = Math.sqrt(viewportArea / baseArea);
    tolerance *= Math.max(0.5, 1 / areaFactor);

    return tolerance;
  }
}

// ============================================================================
// GEOMETRY SIMPLIFICATION ENGINE
// ============================================================================

/**
 * Main Geometry Simplification Engine
 * Handles boundary simplification με dynamic LOD και performance optimization
 */
export class GeometrySimplificationEngine {

  private static instance: GeometrySimplificationEngine | null = null;

  private config: SimplificationConfig;
  private simplificationCache = new Map<string, SimplificationResult>();
  private readonly cacheExpiryMs = 30 * 60 * 1000; // 30 minutes

  // Statistics
  private stats = {
    totalSimplifications: 0,
    totalTimeSaved: 0,
    totalPointsReduced: 0,
    averageReductionRatio: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  // ============================================================================
  // SINGLETON PATTERN
  // ============================================================================

  private constructor() {
    this.config = this.getDefaultConfig();
    console.log('🔧 GeometrySimplificationEngine initialized');
  }

  public static getInstance(): GeometrySimplificationEngine {
    if (!GeometrySimplificationEngine.instance) {
      GeometrySimplificationEngine.instance = new GeometrySimplificationEngine();
    }
    return GeometrySimplificationEngine.instance;
  }

  // ============================================================================
  // MAIN SIMPLIFICATION METHODS
  // ============================================================================

  /**
   * Simplify administrative boundary geometry με dynamic optimization
   */
  public simplifyBoundary(
    boundary: AdminSearchResult,
    viewport?: ViewportContext
  ): SimplificationResult | null {
    if (!boundary.geometry || !this.config.enableSimplification) {
      return null;
    }

    const startTime = performance.now();

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(boundary, viewport);

      // Check cache first
      const cached = this.simplificationCache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }

      this.stats.cacheMisses++;

      // Get appropriate LOD level
      const lodLevel = viewport
        ? LODManager.getLODLevel(viewport.zoom)
        : LODManager.getLODLevel(10); // Default to detailed level

      // Calculate tolerance
      const tolerance = viewport && this.config.adaptiveSimplification
        ? LODManager.calculateAdaptiveTolerance(viewport, lodLevel)
        : lodLevel.tolerance;

      // Perform simplification
      const result = this.performGeometrySimplification(
        boundary.geometry,
        tolerance,
        lodLevel
      );

      // Add processing time
      result.processingTime = performance.now() - startTime;

      // Cache result
      this.simplificationCache.set(cacheKey, result);

      // Update statistics
      this.updateStatistics(result);

      // Report to performance analytics
      adminBoundariesAnalytics.recordBoundaryProcessing(
        1,
        result.processingTime,
        result.simplifiedPoints,
        result.reductionRatio
      );

      console.log(
        `🔧 Simplified boundary: ${result.originalPoints} → ${result.simplifiedPoints} points ` +
        `(${Math.round(result.reductionRatio * 100)}% reduction, ${result.processingTime.toFixed(1)}ms)`
      );

      return result;

    } catch (error) {
      console.error('Geometry simplification error:', error);
      return null;
    }
  }

  /**
   * Simplify multiple boundaries με batch processing
   */
  public simplifyBoundaries(
    boundaries: AdminSearchResult[],
    viewport?: ViewportContext
  ): Map<string, SimplificationResult> {
    const results = new Map<string, SimplificationResult>();

    const startTime = performance.now();
    let totalProcessed = 0;
    let totalSimplified = 0;

    for (const boundary of boundaries) {
      if (boundary.id) {
        const result = this.simplifyBoundary(boundary, viewport);
        if (result) {
          results.set(boundary.id, result);
          totalSimplified++;
        }
        totalProcessed++;
      }
    }

    const batchTime = performance.now() - startTime;

    console.log(
      `📦 Batch simplification: ${totalSimplified}/${totalProcessed} boundaries ` +
      `processed in ${batchTime.toFixed(1)}ms`
    );

    return results;
  }

  // ============================================================================
  // GEOMETRY PROCESSING
  // ============================================================================

  /**
   * Core geometry simplification logic
   */
  private performGeometrySimplification(
    geometry: GeoJSON.Geometry,
    tolerance: number,
    lodLevel: LODLevel
  ): SimplificationResult {
    const originalGeometry = JSON.parse(JSON.stringify(geometry));
    const originalPoints = this.countGeometryPoints(geometry);

    let simplifiedGeometry: GeoJSON.Geometry;

    switch (geometry.type) {
      case 'Polygon':
        simplifiedGeometry = {
          type: 'Polygon',
          coordinates: DouglasPeuckerSimplifier.simplifyPolygon(
            geometry.coordinates as number[][][],
            tolerance
          )
        };
        break;

      case 'MultiPolygon':
        simplifiedGeometry = {
          type: 'MultiPolygon',
          coordinates: (geometry.coordinates as number[][][][]).map(polygon =>
            DouglasPeuckerSimplifier.simplifyPolygon(polygon, tolerance)
          )
        };
        break;

      case 'LineString':
        simplifiedGeometry = {
          type: 'LineString',
          coordinates: DouglasPeuckerSimplifier.simplifyLineString(
            geometry.coordinates as number[][],
            tolerance
          )
        };
        break;

      case 'MultiLineString':
        simplifiedGeometry = {
          type: 'MultiLineString',
          coordinates: (geometry.coordinates as number[][][]).map(lineString =>
            DouglasPeuckerSimplifier.simplifyLineString(lineString, tolerance)
          )
        };
        break;

      default:
        // Point, MultiPoint, GeometryCollection - return as-is
        simplifiedGeometry = geometry;
    }

    // Apply point count limit if specified
    simplifiedGeometry = this.applyPointLimit(simplifiedGeometry, lodLevel.maxPoints);

    const simplifiedPoints = this.countGeometryPoints(simplifiedGeometry);
    const reductionRatio = originalPoints > 0
      ? (originalPoints - simplifiedPoints) / originalPoints
      : 0;

    // Calculate quality score (simplified heuristic)
    const qualityScore = this.calculateQualityScore(
      originalGeometry,
      simplifiedGeometry,
      reductionRatio
    );

    // Determine optimization level
    const optimizationLevel = this.determineOptimizationLevel(reductionRatio);

    return {
      originalGeometry,
      simplifiedGeometry,
      originalPoints,
      simplifiedPoints,
      reductionRatio,
      processingTime: 0, // Will be set by caller
      qualityScore,
      optimizationLevel
    };
  }

  /**
   * Apply point count limits to geometry
   */
  private applyPointLimit(
    geometry: GeoJSON.Geometry,
    maxPoints: number
  ): GeoJSON.Geometry {
    const currentPoints = this.countGeometryPoints(geometry);

    if (currentPoints <= maxPoints) {
      return geometry;
    }

    // If still too many points, apply additional simplification
    const reductionFactor = maxPoints / currentPoints;
    const additionalTolerance = (1 - reductionFactor) * 0.01; // Adaptive tolerance

    switch (geometry.type) {
      case 'Polygon':
        return {
          type: 'Polygon',
          coordinates: DouglasPeuckerSimplifier.simplifyPolygon(
            geometry.coordinates as number[][][],
            additionalTolerance
          )
        };

      case 'MultiPolygon':
        return {
          type: 'MultiPolygon',
          coordinates: (geometry.coordinates as number[][][][]).map(polygon =>
            DouglasPeuckerSimplifier.simplifyPolygon(polygon, additionalTolerance)
          )
        };

      default:
        return geometry;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Count total points in geometry
   */
  private countGeometryPoints(geometry: GeoJSON.Geometry): number {
    switch (geometry.type) {
      case 'Point':
        return 1;

      case 'MultiPoint':
        return (geometry.coordinates as number[][]).length;

      case 'LineString':
        return (geometry.coordinates as number[][]).length;

      case 'MultiLineString':
        return (geometry.coordinates as number[][][])
          .reduce((sum, line) => sum + line.length, 0);

      case 'Polygon':
        return (geometry.coordinates as number[][][])
          .reduce((sum, ring) => sum + ring.length, 0);

      case 'MultiPolygon':
        return (geometry.coordinates as number[][][][])
          .reduce((sum, polygon) =>
            sum + polygon.reduce((ringSum, ring) => ringSum + ring.length, 0), 0);

      case 'GeometryCollection':
        return (geometry.geometries as GeoJSON.Geometry[])
          .reduce((sum, geom) => sum + this.countGeometryPoints(geom), 0);

      default:
        return 0;
    }
  }

  /**
   * Calculate quality score based on geometry comparison
   */
  private calculateQualityScore(
    original: GeoJSON.Geometry,
    simplified: GeoJSON.Geometry,
    reductionRatio: number
  ): number {
    // Simplified quality scoring based on reduction ratio and geometry type
    let baseScore = 1.0 - (reductionRatio * 0.5); // 50% penalty for full reduction

    // Bonus for keeping important geometry types intact
    if (original.type === simplified.type) {
      baseScore += 0.1;
    }

    // Penalty for excessive simplification
    if (reductionRatio > 0.8) {
      baseScore -= 0.2;
    }

    return Math.max(0, Math.min(1, baseScore));
  }

  /**
   * Determine optimization level based on reduction ratio
   */
  private determineOptimizationLevel(reductionRatio: number): SimplificationResult['optimizationLevel'] {
    if (reductionRatio < 0.1) return 'none';
    if (reductionRatio < 0.3) return 'light';
    if (reductionRatio < 0.6) return 'medium';
    return 'heavy';
  }

  /**
   * Generate cache key for simplification result
   */
  private generateCacheKey(
    boundary: AdminSearchResult,
    viewport?: ViewportContext
  ): string {
    const geometryHash = this.hashGeometry(boundary.geometry);
    const viewportHash = viewport ? this.hashViewport(viewport) : 'default';
    return `simplify:${boundary.id}:${geometryHash}:${viewportHash}`;
  }

  private hashGeometry(geometry: GeoJSON.Geometry | undefined): string {
    if (!geometry) return 'none';
    const str = JSON.stringify(geometry);
    return btoa(str.substring(0, 100)).substring(0, 12);
  }

  private hashViewport(viewport: ViewportContext): string {
    return `z${Math.round(viewport.zoom)}_${Math.round(viewport.bounds.west * 1000)}`;
  }

  /**
   * Update internal statistics
   */
  private updateStatistics(result: SimplificationResult): void {
    this.stats.totalSimplifications++;
    this.stats.totalTimeSaved += result.processingTime;
    this.stats.totalPointsReduced += (result.originalPoints - result.simplifiedPoints);

    // Update running average
    const totalReductions = this.stats.totalSimplifications;
    this.stats.averageReductionRatio =
      (this.stats.averageReductionRatio * (totalReductions - 1) + result.reductionRatio) / totalReductions;
  }

  // ============================================================================
  // CONFIGURATION & MANAGEMENT
  // ============================================================================

  /**
   * Update simplification configuration
   */
  public updateConfig(newConfig: Partial<SimplificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Geometry simplification configuration updated');
  }

  /**
   * Get current statistics
   */
  public getStatistics() {
    const cacheStats = {
      totalEntries: this.simplificationCache.size,
      hitRate: this.stats.cacheHits + this.stats.cacheMisses > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
        : 0
    };

    return {
      ...this.stats,
      cache: cacheStats,
      averagePointsPerGeometry: this.stats.totalSimplifications > 0
        ? this.stats.totalPointsReduced / this.stats.totalSimplifications
        : 0
    };
  }

  /**
   * Clear simplification cache
   */
  public clearCache(): void {
    this.simplificationCache.clear();
    console.log('🧹 Geometry simplification cache cleared');
  }

  /**
   * Default configuration
   */
  private getDefaultConfig(): SimplificationConfig {
    return {
      enableSimplification: true,
      dynamicLOD: true,
      preserveTopology: true,
      maxComplexityThreshold: 1000,
      minComplexityThreshold: 10,
      adaptiveSimplification: true
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  public dispose(): void {
    this.clearCache();
    GeometrySimplificationEngine.instance = null;
    console.log('🔧 GeometrySimplificationEngine disposed');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance για Geometry Simplification Engine
 */
export const geometrySimplificationEngine = GeometrySimplificationEngine.getInstance();
export default geometrySimplificationEngine;