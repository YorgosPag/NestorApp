/**
 * Base Snap Engine Interface
 * Κοινό interface για όλα τα snap engines
 */

import { Point2D, Entity, ExtendedSnapType, SnapCandidate } from '../extended-types';
import { GeometricCalculations } from './GeometricCalculations';

export interface SnapEngineContext {
  entities: Entity[];
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

export abstract class BaseSnapEngine {
  protected snapType: ExtendedSnapType;
  
  constructor(snapType: ExtendedSnapType) {
    this.snapType = snapType;
  }

  abstract findSnapCandidates(
    cursorPoint: Point2D, 
    context: SnapEngineContext
  ): SnapEngineResult;

  abstract initialize(entities: Entity[]): void;

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
    entities: Entity[],
    context: SnapEngineContext,
    cursorPoint: Point2D,
    priority: number,
    getPointsFromEntity: (entity: Entity, ...args: any[]) => Array<{point: Point2D, type: string}>,
    createDescriptionLabel: (type: string) => string,
    ...extraArgs: any[]
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
        const distance = GeometricCalculations.calculateDistance(cursorPoint, pointData.point);
        
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
}

export interface SnapEngineOptions {
  enabled: boolean;
  priority: number;
  description: string;
  tolerance?: number;
}