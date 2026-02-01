/**
 * Midpoint Snap Engine
 * Υπεύθυνο για εύρεση snap points στα μέσα των entities
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Τεκμηρίωση ενδείξεων έλξης
 * @see docs/features/snapping/ARCHITECTURE.md - Αρχιτεκτονική snap system
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_MIDPOINT_SNAP_ENGINE = false;

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialFactory } from '../../core/spatial';
import type { ISpatialIndex, SpatialBounds } from '../../core/spatial';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findStandardSnapCandidates, StandardSnapCandidate } from './shared/snap-engine-utils';
// 🏢 ADR-149: Centralized Snap Engine Priorities
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

export class MidpointSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.MIDPOINT);
  }

  initialize(entities: EntityModel[]): void {
    // ✅ CENTRALIZED: Use base class method for spatial index initialization
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => GeometricCalculations.getEntityMidpoints(entity),
      'midpoint'
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) {
      return { candidates: [] };
    }

    const candidates: SnapCandidate[] = [];
    // 🏢 ADR-149: Use centralized snap engine priorities
    const priority = SNAP_ENGINE_PRIORITIES.MIDPOINT;

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.MIDPOINT);

    // Query using modern core spatial system
    const results = this.spatialIndex.querySnap(cursorPoint, radius, 'midpoint');

    for (const result of results) {
      const { point, entity } = result.data;

      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'Midpoint',
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
    midpointCount: number;
    gridCells: number;
  } {
    if (!this.spatialIndex) {
      return { midpointCount: 0, gridCells: 0 };
    }

    const stats = this.spatialIndex.getStats();
    return {
      midpointCount: stats.itemCount || 0,
      gridCells: 1 // Grid spatial index
    };
  }

}