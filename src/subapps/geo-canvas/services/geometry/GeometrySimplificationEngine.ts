/**
 * 🏛️ GEOMETRY SIMPLIFICATION ENGINE - Phase 7.3
 *
 * Enterprise geometry simplification for administrative boundaries.
 * Split structure (ADR-065 SRP):
 * - geometry-simplification-algorithms.ts — DP algorithm + LOD + types
 * - GeometrySimplificationEngine.ts       — This file: main engine class
 */

import { deepClone } from '@/lib/clone-utils';
import { adminBoundariesAnalytics } from '../performance/AdminBoundariesPerformanceAnalytics';
import type { AdminSearchResult } from '../../types/administrative-types';
import {
  DouglasPeuckerSimplifier,
  LODManager
} from './geometry-simplification-algorithms';
import type {
  SimplificationConfig,
  ViewportContext,
  SimplificationResult,
  LODLevel
} from './geometry-simplification-algorithms';

// Re-export types for consumers
export type {
  SimplificationConfig,
  ViewportContext,
  SimplificationResult,
  LODLevel
} from './geometry-simplification-algorithms';

/**
 * Main Geometry Simplification Engine
 */
export class GeometrySimplificationEngine {
  private static instance: GeometrySimplificationEngine | null = null;

  private config: SimplificationConfig;
  private simplificationCache = new Map<string, SimplificationResult>();

  private stats = {
    totalSimplifications: 0,
    totalTimeSaved: 0,
    totalPointsReduced: 0,
    averageReductionRatio: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  private constructor() {
    this.config = this.getDefaultConfig();
    console.debug('🔧 GeometrySimplificationEngine initialized');
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

  public simplifyBoundary(boundary: AdminSearchResult, viewport?: ViewportContext): SimplificationResult | null {
    if (!boundary.geometry || !this.config.enableSimplification) return null;

    const startTime = performance.now();

    try {
      const cacheKey = this.generateCacheKey(boundary, viewport);
      const cached = this.simplificationCache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
      this.stats.cacheMisses++;

      const lodLevel = viewport
        ? LODManager.getLODLevel(viewport.zoom)
        : LODManager.getLODLevel(10);

      const tolerance = viewport && this.config.adaptiveSimplification
        ? LODManager.calculateAdaptiveTolerance(viewport, lodLevel)
        : lodLevel.tolerance;

      const result = this.performGeometrySimplification(boundary.geometry, tolerance, lodLevel);
      result.processingTime = performance.now() - startTime;

      this.simplificationCache.set(cacheKey, result);
      this.updateStatistics(result);

      adminBoundariesAnalytics.recordBoundaryProcessing(
        1, result.processingTime, result.simplifiedPoints, result.reductionRatio
      );

      console.debug(
        `🔧 Simplified boundary: ${result.originalPoints} → ${result.simplifiedPoints} points ` +
        `(${Math.round(result.reductionRatio * 100)}% reduction, ${result.processingTime.toFixed(1)}ms)`
      );

      return result;
    } catch (error) {
      console.error('Geometry simplification error:', error);
      return null;
    }
  }

  public simplifyBoundaries(
    boundaries: AdminSearchResult[], viewport?: ViewportContext
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
    console.debug(
      `📦 Batch simplification: ${totalSimplified}/${totalProcessed} boundaries ` +
      `processed in ${batchTime.toFixed(1)}ms`
    );

    return results;
  }

  // ============================================================================
  // GEOMETRY PROCESSING
  // ============================================================================

  private performGeometrySimplification(
    geometry: GeoJSON.Geometry, tolerance: number, lodLevel: LODLevel
  ): SimplificationResult {
    const originalGeometry = deepClone(geometry);
    const originalPoints = this.countGeometryPoints(geometry);

    let simplifiedGeometry: GeoJSON.Geometry;

    switch (geometry.type) {
      case 'Polygon':
        simplifiedGeometry = {
          type: 'Polygon',
          coordinates: DouglasPeuckerSimplifier.simplifyPolygon(geometry.coordinates as number[][][], tolerance)
        };
        break;
      case 'MultiPolygon':
        simplifiedGeometry = {
          type: 'MultiPolygon',
          coordinates: (geometry.coordinates as number[][][][]).map(p =>
            DouglasPeuckerSimplifier.simplifyPolygon(p, tolerance)
          )
        };
        break;
      case 'LineString':
        simplifiedGeometry = {
          type: 'LineString',
          coordinates: DouglasPeuckerSimplifier.simplifyLineString(geometry.coordinates as number[][], tolerance)
        };
        break;
      case 'MultiLineString':
        simplifiedGeometry = {
          type: 'MultiLineString',
          coordinates: (geometry.coordinates as number[][][]).map(ls =>
            DouglasPeuckerSimplifier.simplifyLineString(ls, tolerance)
          )
        };
        break;
      default:
        simplifiedGeometry = geometry;
    }

    simplifiedGeometry = this.applyPointLimit(simplifiedGeometry, lodLevel.maxPoints);

    const simplifiedPoints = this.countGeometryPoints(simplifiedGeometry);
    const reductionRatio = originalPoints > 0
      ? (originalPoints - simplifiedPoints) / originalPoints : 0;

    const qualityScore = this.calculateQualityScore(originalGeometry, simplifiedGeometry, reductionRatio);

    return {
      originalGeometry, simplifiedGeometry,
      originalPoints, simplifiedPoints, reductionRatio,
      processingTime: 0,
      qualityScore,
      optimizationLevel: this.determineOptimizationLevel(reductionRatio)
    };
  }

  private applyPointLimit(geometry: GeoJSON.Geometry, maxPoints: number): GeoJSON.Geometry {
    const currentPoints = this.countGeometryPoints(geometry);
    if (currentPoints <= maxPoints) return geometry;

    const reductionFactor = maxPoints / currentPoints;
    const additionalTolerance = (1 - reductionFactor) * 0.01;

    switch (geometry.type) {
      case 'Polygon':
        return {
          type: 'Polygon',
          coordinates: DouglasPeuckerSimplifier.simplifyPolygon(geometry.coordinates as number[][][], additionalTolerance)
        };
      case 'MultiPolygon':
        return {
          type: 'MultiPolygon',
          coordinates: (geometry.coordinates as number[][][][]).map(p =>
            DouglasPeuckerSimplifier.simplifyPolygon(p, additionalTolerance)
          )
        };
      default:
        return geometry;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private countGeometryPoints(geometry: GeoJSON.Geometry): number {
    switch (geometry.type) {
      case 'Point': return 1;
      case 'MultiPoint': return (geometry.coordinates as number[][]).length;
      case 'LineString': return (geometry.coordinates as number[][]).length;
      case 'MultiLineString':
        return (geometry.coordinates as number[][][]).reduce((sum, line) => sum + line.length, 0);
      case 'Polygon':
        return (geometry.coordinates as number[][][]).reduce((sum, ring) => sum + ring.length, 0);
      case 'MultiPolygon':
        return (geometry.coordinates as number[][][][]).reduce((sum, polygon) =>
          sum + polygon.reduce((ringSum, ring) => ringSum + ring.length, 0), 0);
      case 'GeometryCollection':
        return (geometry.geometries as GeoJSON.Geometry[]).reduce((sum, geom) => sum + this.countGeometryPoints(geom), 0);
      default: return 0;
    }
  }

  private calculateQualityScore(
    original: GeoJSON.Geometry, simplified: GeoJSON.Geometry, reductionRatio: number
  ): number {
    let baseScore = 1.0 - (reductionRatio * 0.5);
    if (original.type === simplified.type) baseScore += 0.1;
    if (reductionRatio > 0.8) baseScore -= 0.2;
    return Math.max(0, Math.min(1, baseScore));
  }

  private determineOptimizationLevel(reductionRatio: number): SimplificationResult['optimizationLevel'] {
    if (reductionRatio < 0.1) return 'none';
    if (reductionRatio < 0.3) return 'light';
    if (reductionRatio < 0.6) return 'medium';
    return 'heavy';
  }

  private generateCacheKey(boundary: AdminSearchResult, viewport?: ViewportContext): string {
    const geometryHash = this.hashGeometry(boundary.geometry);
    const viewportHash = viewport ? `z${Math.round(viewport.zoom)}_${Math.round(viewport.bounds.west * 1000)}` : 'default';
    return `simplify:${boundary.id}:${geometryHash}:${viewportHash}`;
  }

  private hashGeometry(geometry: GeoJSON.Geometry | undefined): string {
    if (!geometry) return 'none';
    return btoa(JSON.stringify(geometry).substring(0, 100)).substring(0, 12);
  }

  private updateStatistics(result: SimplificationResult): void {
    this.stats.totalSimplifications++;
    this.stats.totalTimeSaved += result.processingTime;
    this.stats.totalPointsReduced += (result.originalPoints - result.simplifiedPoints);
    const total = this.stats.totalSimplifications;
    this.stats.averageReductionRatio =
      (this.stats.averageReductionRatio * (total - 1) + result.reductionRatio) / total;
  }

  // ============================================================================
  // CONFIGURATION & MANAGEMENT
  // ============================================================================

  public updateConfig(newConfig: Partial<SimplificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.debug('🔧 Geometry simplification configuration updated');
  }

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
        ? this.stats.totalPointsReduced / this.stats.totalSimplifications : 0
    };
  }

  public clearCache(): void {
    this.simplificationCache.clear();
    console.debug('🧹 Geometry simplification cache cleared');
  }

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

  public dispose(): void {
    this.clearCache();
    GeometrySimplificationEngine.instance = null;
    console.debug('🔧 GeometrySimplificationEngine disposed');
  }
}

export const geometrySimplificationEngine = GeometrySimplificationEngine.getInstance();
export default geometrySimplificationEngine;
