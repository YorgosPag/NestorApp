/**
 * Center Snap Engine
 * Υπεύθυνο για εύρεση snap points στα κέντρα των entities (circles, rectangles)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-079: Centralized Geometric Precision Constants
// 🏢 ADR-149: Centralized Snap Engine Priorities
import { GEOMETRY_PRECISION, SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

export class CenterSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;
  private maxEntitiesCheck = 10000; // Limit για performance

  constructor() {
    super(ExtendedSnapType.CENTER);
  }

  initialize(entities: EntityModel[]): void {
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

    const candidates: SnapCandidate[] = [];
    // 🏢 ADR-149: Use centralized snap engine priorities
    const priority = SNAP_ENGINE_PRIORITIES.CENTER;

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.CENTER);

    // Query centers using standard spatial query
    const nearbyIndexedCenters = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'center')
    );

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
              // 🏢 ADR-079: Use centralized point match threshold
              const alreadyExists = candidates.some(c =>
                calculateDistance(c.point, center) < GEOMETRY_PRECISION.POINT_MATCH
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
    // 🎯 TYPE-SAFE: Spatial index stats may have optional centerCount/gridCells properties
    const extendedStats = stats as typeof stats & { centerCount?: number; gridCells?: number };
    return {
      centerCount: extendedStats.centerCount || 0,
      gridCells: extendedStats.gridCells || 0,
      entitiesChecked: this.maxEntitiesCheck
    };
  }
}
