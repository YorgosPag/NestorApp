/** Intersection Snap Engine — pre-computed intersections with spatial grid (ADR-065). */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate, type Entity } from '../extended-types';
import type { SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import type { IntersectionResult } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ENTERPRISE: Intersection calculators (extracted per ADR-065)
import {
  lineLineIntersection,
  lineCircleIntersection,
  circleCircleIntersection,
  polylineLineIntersection,
  polylinePolylineIntersection,
  polylineCircleIntersection,
  rectangleLineIntersection,
  rectangleCircleIntersection,
  rectanglePolylineIntersection,
  rectangleRectangleIntersection,
} from './intersection-calculators';
// 🏢 ADR-149: Centralized Snap Engine Priorities
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

// 🚀 PERFORMANCE: Spatial grid cell size for intersection lookup
const GRID_CELL_SIZE = 100; // World units - tune based on typical DXF scale

// 🚀 PERFORMANCE: Pre-computed intersection with entity references
interface CachedIntersection {
  point: Point2D;
  type: string;
  entity1Id: string;
  entity2Id: string;
}

// 🚀 PERFORMANCE: Spatial grid cell
interface GridCell {
  intersections: CachedIntersection[];
}

export class IntersectionSnapEngine extends BaseSnapEngine {
  // 🚀 PERFORMANCE: Pre-computed intersection cache
  private intersectionCache: CachedIntersection[] = [];

  // 🚀 PERFORMANCE: Spatial grid for O(1) lookup
  private spatialGrid: Map<string, GridCell> = new Map();

  // 🚀 PERFORMANCE: Track if cache is valid
  private cacheValid = false;
  private entityVersion = 0;

  constructor() {
    super(ExtendedSnapType.INTERSECTION);
  }

  initialize(entities: EntityModel[]): void {
    // 🚀 PERFORMANCE: Pre-compute ALL intersections during initialization
    // This moves O(n²) work from every mouse move to scene load time
    this.preComputeIntersections(entities);
    this.cacheValid = true;
    this.entityVersion++;
  }

  /**
   * 🚀 PERFORMANCE: Pre-compute all intersections and build spatial grid
   * Called once during initialize() instead of on every mouse move
   */
  private preComputeIntersections(entities: EntityModel[]): void {
    this.intersectionCache = [];
    this.spatialGrid.clear();

    if (!entities || entities.length === 0) return;

    // Filter visible entities only
    const visibleEntities = entities.filter(e => e.visible !== false);

    // 🚀 PERFORMANCE: Calculate all pairwise intersections (O(n²) but only once!)
    for (let i = 0; i < visibleEntities.length; i++) {
      for (let j = i + 1; j < visibleEntities.length; j++) {
        const entity1 = visibleEntities[i] as Entity;
        const entity2 = visibleEntities[j] as Entity;

        const intersections = this.calculateIntersections(entity1, entity2);

        for (const intersection of intersections) {
          const cached: CachedIntersection = {
            point: intersection.point,
            type: intersection.type,
            entity1Id: entity1.id,
            entity2Id: entity2.id
          };

          this.intersectionCache.push(cached);

          // 🚀 PERFORMANCE: Add to spatial grid for O(1) lookup
          const cellKey = this.getCellKey(intersection.point);
          let cell = this.spatialGrid.get(cellKey);
          if (!cell) {
            cell = { intersections: [] };
            this.spatialGrid.set(cellKey, cell);
          }
          cell.intersections.push(cached);
        }
      }
    }
  }

  /**
   * 🚀 PERFORMANCE: Get grid cell key for a point
   */
  private getCellKey(point: Point2D): string {
    const cellX = Math.floor(point.x / GRID_CELL_SIZE);
    const cellY = Math.floor(point.y / GRID_CELL_SIZE);
    return `${cellX},${cellY}`;
  }

  /**
   * 🚀 PERFORMANCE: Get neighboring cell keys (3x3 grid around point)
   */
  private getNearbyCellKeys(point: Point2D): string[] {
    const cellX = Math.floor(point.x / GRID_CELL_SIZE);
    const cellY = Math.floor(point.y / GRID_CELL_SIZE);

    const keys: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        keys.push(`${cellX + dx},${cellY + dy}`);
      }
    }
    return keys;
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    // 🏢 ADR-149: Use centralized snap engine priorities
    const priority = SNAP_ENGINE_PRIORITIES.INTERSECTION;

    // 🚀 PERFORMANCE: Use pre-computed cache with spatial grid lookup
    // This is O(1) instead of O(n²) on every mouse move!

    if (!this.cacheValid || this.intersectionCache.length === 0) {
      return { candidates };
    }

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.INTERSECTION);

    // 🚀 PERFORMANCE: Only check intersections in nearby grid cells (O(1) lookup)
    const nearbyCellKeys = this.getNearbyCellKeys(cursorPoint);
    const checkedPoints = new Set<string>(); // Avoid duplicates

    for (const cellKey of nearbyCellKeys) {
      const cell = this.spatialGrid.get(cellKey);
      if (!cell) continue;

      for (const cached of cell.intersections) {
        // Skip if entity is excluded
        if (context.excludeEntityId &&
            (cached.entity1Id === context.excludeEntityId || cached.entity2Id === context.excludeEntityId)) {
          continue;
        }

        // Skip duplicates
        const pointKey = `${cached.point.x.toFixed(4)},${cached.point.y.toFixed(4)}`;
        if (checkedPoints.has(pointKey)) continue;
        checkedPoints.add(pointKey);

        const distance = calculateDistance(cursorPoint, cached.point);

        if (distance <= radius) {
          const candidate = this.createCandidate(
            cached.point,
            `Intersection (${cached.type})`,
            distance,
            priority,
            cached.entity1Id
          );

          candidates.push(candidate);

          if (candidates.length >= context.maxCandidates) {
            return { candidates };
          }
        }
      }
    }

    return { candidates };
  }

  /**
   * 🚀 PERFORMANCE: Invalidate cache when entities change
   * Should be called when scene is modified
   */
  invalidateCache(): void {
    this.cacheValid = false;
    this.intersectionCache = [];
    this.spatialGrid.clear();
  }

  private calculateIntersections(entity1: Entity, entity2: Entity): IntersectionResult[] {
    const type1 = entity1.type.toLowerCase();
    const type2 = entity2.type.toLowerCase();

    if (type1 === 'line' && type2 === 'line') return lineLineIntersection(entity1, entity2);
    if ((type1 === 'line' && type2 === 'circle') || (type1 === 'circle' && type2 === 'line')) {
      return lineCircleIntersection(type1 === 'line' ? entity1 : entity2, type1 === 'circle' ? entity1 : entity2);
    }
    if (type1 === 'circle' && type2 === 'circle') return circleCircleIntersection(entity1, entity2);

    if ((type1 === 'polyline' || type1 === 'lwpolyline') && type2 === 'line') return polylineLineIntersection(entity1, entity2);
    if (type1 === 'line' && (type2 === 'polyline' || type2 === 'lwpolyline')) return polylineLineIntersection(entity2, entity1);
    if ((type1 === 'polyline' || type1 === 'lwpolyline') && type2 === 'circle') return polylineCircleIntersection(entity1, entity2);
    if (type1 === 'circle' && (type2 === 'polyline' || type2 === 'lwpolyline')) return polylineCircleIntersection(entity2, entity1);
    if ((type1 === 'polyline' || type1 === 'lwpolyline') && (type2 === 'polyline' || type2 === 'lwpolyline')) return polylinePolylineIntersection(entity1, entity2);

    if (type1 === 'rectangle' && type2 === 'line') return rectangleLineIntersection(entity1, entity2);
    if (type1 === 'line' && type2 === 'rectangle') return rectangleLineIntersection(entity2, entity1);
    if (type1 === 'rectangle' && type2 === 'circle') return rectangleCircleIntersection(entity1, entity2);
    if (type1 === 'circle' && type2 === 'rectangle') return rectangleCircleIntersection(entity2, entity1);
    if ((type1 === 'rectangle' && (type2 === 'polyline' || type2 === 'lwpolyline')) ||
        ((type1 === 'polyline' || type1 === 'lwpolyline') && type2 === 'rectangle')) {
      return rectanglePolylineIntersection(type1 === 'rectangle' ? entity1 : entity2, type1 === 'rectangle' ? entity2 : entity1);
    }
    if (type1 === 'rectangle' && type2 === 'rectangle') return rectangleRectangleIntersection(entity1, entity2);

    return [];
  }

  dispose(): void {
    // 🚀 PERFORMANCE: Clean up cache
    this.invalidateCache();
  }

  getStats(): {
    intersectionCalculations: number;
    cachedIntersections: number;
    gridCells: number;
  } {
    return {
      intersectionCalculations: 0,
      cachedIntersections: this.intersectionCache.length,
      gridCells: this.spatialGrid.size
    };
  }
}