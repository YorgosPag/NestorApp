/**
 * Endpoint Snap Engine
 * Υπεύθυνο για εύρεση snap points στα άκρα των entities
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialFactory } from '../../core/spatial';
import type { ISpatialIndex, SpatialBounds } from '../../core/spatial';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findStandardSnapCandidates, StandardSnapCandidate } from './shared/snap-engine-utils';

export class EndpointSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.ENDPOINT);
  }

  initialize(entities: Entity[]): void {
    // ✅ CENTRALIZED: Use base class method for spatial index initialization
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => GeometricCalculations.getEntityEndpoints(entity),
      'endpoint'
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) {
      return { candidates: [] };
    }

    const candidates: any[] = [];
    const priority = 0; // Highest priority for endpoints

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.ENDPOINT);

    // Query using modern core spatial system
    const results = this.spatialIndex.querySnap(cursorPoint, radius, 'endpoint');

    for (const result of results) {
      const { point, entity } = result.data;

      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'Endpoint',
        result.distance,
        priority,
        entity.id
      ));
    }

    return { candidates };
  }

  dispose(): void {
    if (this.spatialIndex) {
      this.spatialIndex.clear();
    }
  }

  getStats(): {
    endpointCount: number;
    gridCells: number;
  } {
    if (!this.spatialIndex) {
      return { endpointCount: 0, gridCells: 0 };
    }

    const stats = this.spatialIndex.getStats();
    return {
      endpointCount: stats.itemCount || 0,
      gridCells: 1 // Grid spatial index
    };
  }

}