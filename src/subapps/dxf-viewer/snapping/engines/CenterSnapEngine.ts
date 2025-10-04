/**
 * Center Snap Engine
 * Υπεύθυνο για εύρεση snap points στα κέντρα των entities (circles, rectangles)
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialFactory } from '../../core/spatial';
import type { ISpatialIndex, SpatialBounds } from '../../core/spatial';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { findStandardSnapCandidates, StandardSnapCandidate } from './shared/snap-engine-utils';

export class CenterSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;
  private maxEntitiesCheck = 10000; // Limit για performance

  constructor() {
    super(ExtendedSnapType.CENTER);
  }

  initialize(entities: Entity[]): void {
    // ✅ CENTRALIZED: Use base class method for spatial index initialization
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => {
        const center = GeometricCalculations.getEntityCenter(entity);
        return center ? [center] : [];
      },
      'center'
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) {
      return { candidates: [] };
    }

    const candidates: StandardSnapCandidate[] = [];
    const priority = 3; // After endpoints, midpoints, intersections

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.CENTER);

    // Query centers using standard spatial query
    const nearbyIndexedCenters = this.spatialIndex.querySnap(cursorPoint, radius, 'center');

    for (const result of nearbyIndexedCenters) {
      const { point: center, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      const distance = result.distance;
      
      if (distance <= radius) {
        const candidate = this.createCandidate(
          center,
          'Center',
          distance,
          priority,
          entity.id
        );
        
        candidates.push(candidate);
        
        if (candidates.length >= context.maxCandidates) break;
      }
    }
    
    // Μετά ελέγχουμε και μη-indexed entities (fallback για rectangles)
    if (candidates.length < context.maxCandidates) {
      let checkedEntities = 0;
      
      // Guard against non-iterable entities
      if (!Array.isArray(context.entities)) {
        console.warn('[CenterSnapEngine] entities is not an array:', typeof context.entities, context.entities);
        return { candidates };
      }
      
      for (const entity of context.entities) {
        if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
        if (!entity.visible) continue;
        if (checkedEntities > this.maxEntitiesCheck) break;
        
        checkedEntities++;
        
        // Ειδικός έλεγχος για rectangles
        if (entity.type.toLowerCase() === 'rectangle') {
          const center = GeometricCalculations.getEntityCenter(entity);
          if (center) {
            const distance = calculateDistance(cursorPoint, center);
            
            if (distance <= radius) {
              // Ελέγχουμε αν έχουμε ήδη αυτό το center από το index
              const alreadyExists = candidates.some(c => 
                calculateDistance(c.point, center) < 0.001
              );
              
              if (!alreadyExists) {
                const candidate = this.createCandidate(
                  center,
                  'Center',
                  distance,
                  priority,
                  entity.id
                );
                
                candidates.push(candidate);
                
                if (candidates.length >= context.maxCandidates) break;
              }
            }
          }
        }
      }
    }

    return { candidates };
  }

  dispose(): void {
    if (this.spatialIndex) {
      this.spatialIndex.clear();
    }
  }

  getStats(): {
    centerCount: number;
    gridCells: number;
    entitiesChecked: number;
  } {
    const stats = this.spatialIndex?.getStats() || { totalItems: 0, queryCount: 0, averageItemsPerQuery: 0 };
    return {
      centerCount: (stats as any).centerCount || 0,
      gridCells: (stats as any).gridCells || 0,
      entitiesChecked: this.maxEntitiesCheck
    };
  }
}