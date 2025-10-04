/**
 * Midpoint Snap Engine
 * Υπεύθυνο για εύρεση snap points στα μέσα των entities
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_MIDPOINT_SNAP_ENGINE = false;

import { Point2D, Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialIndex } from '../shared/SpatialIndex';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findStandardSnapCandidates, StandardSnapCandidate } from './shared/snap-engine-utils';

export class MidpointSnapEngine extends BaseSnapEngine {
  private spatialIndex = new SpatialIndex();

  constructor() {
    super(ExtendedSnapType.MIDPOINT);
  }

  initialize(entities: Entity[]): void {
    if (DEBUG_MIDPOINT_SNAP_ENGINE) console.log('🎯 MidpointSnapEngine: Initialize with', entities.length, 'entities');
    
    // Debug: Test getEntityMidpoints on first few entities
    entities.slice(0, 3).forEach((entity, i) => {
      const midpoints = GeometricCalculations.getEntityMidpoints(entity);
      if (DEBUG_MIDPOINT_SNAP_ENGINE) console.log(`🎯 Entity ${i} midpoints:`, {
        id: entity.id,
        type: entity.type,
        midpointsFound: midpoints.length,
        midpoints: midpoints
      });
    });
    
    this.spatialIndex.buildMidpointIndex(
      entities,
      (entity) => GeometricCalculations.getEntityMidpoints(entity)
    );
    
    // Debug: Check spatial index stats
    const stats = this.spatialIndex.getStats();
    if (DEBUG_MIDPOINT_SNAP_ENGINE) console.log('🎯 MidpointSnapEngine: Spatial index built', stats);
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Use shared snap candidate finder to eliminate duplication
    return findStandardSnapCandidates(
      this.spatialIndex,
      cursorPoint,
      context,
      {
        snapType: ExtendedSnapType.MIDPOINT,
        displayName: 'Midpoint',
        priority: 1  // Second priority after endpoints
      },
      (spatialIndex, cursorPoint, radius) => spatialIndex.queryNearbyMidpoints(cursorPoint, radius)
    );
  }

  dispose(): void {
    this.spatialIndex.clear();
  }

  getStats(): {
    midpointCount: number;
    gridCells: number;
  } {
    const stats = this.spatialIndex.getStats();
    return {
      midpointCount: stats.midpointCount,
      gridCells: stats.gridCells
    };
  }
}