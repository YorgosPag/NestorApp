/**
 * Base Snap Engine Interface
 * Κοινό interface για όλα τα snap engines
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { SpatialFactory, type ISpatialIndex, type SpatialQueryResult } from '../../core/spatial';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds, isInfinityBounds } from '../../config/geometry-constants';

export interface SnapEngineContext {
  entities: EntityModel[];
  worldRadiusAt: (point: Point2D) => number;
  worldRadiusForType: (point: Point2D, snapType: ExtendedSnapType) => number;
  pixelTolerance: number;
  perModePxTolerance?: Record<ExtendedSnapType, number>;
  excludeEntityId?: string;
  maxCandidates: number;
}

export interface SnapEngineResult {
  candidates: SnapCandidate[];
  earlyReturn?: {
    found: boolean;
    snapPoint: SnapCandidate;
    allCandidates: SnapCandidate[];
    originalPoint: Point2D;
    snappedPoint: Point2D;
    activeMode: ExtendedSnapType;
    timestamp: number;
  };
}

type SnapSpatialData = {
  point: Point2D;
  entity: EntityModel;
};

export abstract class BaseSnapEngine {
  protected snapType: ExtendedSnapType;
  
  constructor(snapType: ExtendedSnapType) {
    this.snapType = snapType;
  }

  abstract findSnapCandidates(
    cursorPoint: Point2D, 
    context: SnapEngineContext
  ): SnapEngineResult;

  abstract initialize(entities: EntityModel[]): void;

  abstract dispose(): void;

  protected createCandidate(
    point: Point2D,
    description: string,
    distance: number,
    priority: number,
    entityId?: string
  ): SnapCandidate {
    return {
      point,
      type: this.snapType,
      description,
      distance,
      priority,
      entityId
    };
  }

  protected shouldEarlyReturn(
    candidate: SnapCandidate,
    cursorPoint: Point2D,
    distanceThreshold: number
  ): boolean {
    return candidate.distance <= distanceThreshold;
  }

  protected processCandidateLoop<T>(
    entities: EntityModel[],
    context: SnapEngineContext,
    cursorPoint: Point2D,
    priority: number,
    getPointsFromEntity: (entity: EntityModel, ...args: unknown[]) => Array<{point: Point2D, type: string}>,
    createDescriptionLabel: (type: string) => string,
    ...extraArgs: unknown[]
  ): SnapCandidate[] {
    const candidates: SnapCandidate[] = [];
    const radius = context.worldRadiusForType(cursorPoint, this.snapType);
    
    // Guard against non-iterable entities
    if (!Array.isArray(entities)) {
      console.warn('[BaseSnapEngine] entities is not an array:', typeof entities, entities);
      return candidates;
    }
    
    for (const entity of entities) {
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
      if (!entity.visible) continue;
      
      const points = getPointsFromEntity(entity, ...extraArgs);
      
      for (const pointData of points) {
        const distance = calculateDistance(cursorPoint, pointData.point);
        
        if (distance <= radius) {
          const candidate = this.createCandidate(
            pointData.point,
            createDescriptionLabel(pointData.type),
            distance,
            priority,
            entity.id
          );
          
          candidates.push(candidate);
          
          if (candidates.length >= context.maxCandidates) break;
        }
      }
      
      if (candidates.length >= context.maxCandidates) break;
    }

    return candidates;
  }

  /**
   * 🎯 CENTRALIZED: Initialize spatial index with points from entities
   * Used by snap engines to build spatial indices in a unified way
   *
   * @param entities - Entities to index
   * @param getPoints - Function to extract points from each entity
   * @param pointType - Type label for the points (e.g., 'endpoint', 'midpoint', 'center')
   * @returns Initialized spatial index
   */
  protected initializeSpatialIndex(
    entities: EntityModel[],
    getPoints: (entity: EntityModel) => Point2D[],
    pointType: string
  ): ISpatialIndex {
    // Calculate bounds
    const bounds = this.calculateBoundsFromPoints(entities, getPoints);

    // 🏢 ENTERPRISE: Use imported SpatialFactory (no require)
    const spatialIndex = SpatialFactory.forSnapping(bounds);

    // Build index
    for (const entity of entities) {
      if (!entity.visible) continue;

      const points = getPoints(entity);
      for (const point of points) {
        spatialIndex.insert({
          id: `${entity.id}_${pointType}_${point.x}_${point.y}`,
          bounds: {
            minX: point.x,
            minY: point.y,
            maxX: point.x,
            maxY: point.y
          },
          data: { point, entity }
        });
      }
    }

    return spatialIndex;
  }

  /**
   * 🎯 CENTRALIZED: Calculate spatial bounds from entity points
   * Used by snap engines to create spatial indices
   *
   * @param entities - Entities to calculate bounds from
   * @param getPoints - Function to extract points from each entity
   * @returns Spatial bounds with margin
   */
  protected calculateBoundsFromPoints(
    entities: EntityModel[],
    getPoints: (entity: EntityModel) => Point2D[]
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    if (entities.length === 0) {
      return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    }

    // 🏢 ADR-158: Centralized Infinity Bounds Initialization
    const bounds = createInfinityBounds();

    for (const entity of entities) {
      const points = getPoints(entity);
      for (const point of points) {
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.maxY = Math.max(bounds.maxY, point.y);
      }
    }

    // 🏢 ADR-158: Use centralized isInfinityBounds check
    if (isInfinityBounds(bounds)) {
      return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    }

    // Add margin (10% or minimum 100 units)
    const margin = Math.max((bounds.maxX - bounds.minX), (bounds.maxY - bounds.minY)) * 0.1 || 100;
    return {
      minX: bounds.minX - margin,
      minY: bounds.minY - margin,
      maxX: bounds.maxX + margin,
      maxY: bounds.maxY + margin
    };
  }

  protected normalizeSnapResults(results: SpatialQueryResult[]): Array<SpatialQueryResult<SnapSpatialData>> {
    return results
      .map(result => {
        const data = result.data;
        if (!this.isSnapSpatialData(data)) {
          return null;
        }
        return { ...result, data };
      })
      .filter((result): result is SpatialQueryResult<SnapSpatialData> => Boolean(result));
  }

  private isSnapSpatialData(value: unknown): value is SnapSpatialData {
    if (!value || typeof value !== 'object') return false;
    if (!('point' in value) || !('entity' in value)) return false;
    const entity = (value as { entity?: unknown }).entity;
    return Boolean(entity && typeof entity === 'object' && 'id' in entity);
  }
}

export interface SnapEngineOptions {
  enabled: boolean;
  priority: number;
  description: string;
  tolerance?: number;
}
