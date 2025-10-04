/**
 * Endpoint Snap Engine
 * Υπεύθυνο για εύρεση snap points στα άκρα των entities
 */

import { Point2D, Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialIndex } from '../shared/SpatialIndex';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findStandardSnapCandidates, StandardSnapCandidate } from './shared/snap-engine-utils';

export class EndpointSnapEngine extends BaseSnapEngine {
  private spatialIndex = new SpatialIndex();

  constructor() {
    super(ExtendedSnapType.ENDPOINT);
  }

  initialize(entities: Entity[]): void {
    this.spatialIndex.buildEndpointIndex(
      entities,
      (entity) => GeometricCalculations.getEntityEndpoints(entity)
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Use shared snap candidate finder to eliminate duplication
    return findStandardSnapCandidates(
      this.spatialIndex,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.ENDPOINT,
        displayName: 'Endpoint',
        priority: 0  // Highest priority for endpoints
      },
      (spatialIndex, cursorPoint, radius) => spatialIndex.queryNearbyEndpoints(cursorPoint, radius)
    );
  }

  dispose(): void {
    this.spatialIndex.clear();
  }

  getStats(): {
    endpointCount: number;
    gridCells: number;
  } {
    const stats = this.spatialIndex.getStats();
    return {
      endpointCount: stats.endpointCount,
      gridCells: stats.gridCells
    };
  }
}