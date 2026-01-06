/**
 * Endpoint Snap Engine
 * Υπεύθυνο για εύρεση snap points στα άκρα των entities
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Τεκμηρίωση ενδείξεων έλξης
 * @see docs/features/snapping/ARCHITECTURE.md - Αρχιτεκτονική snap system
 */

// 🔍 DEBUG FLAG - Enable to diagnose snap issues
const DEBUG_ENDPOINT_SNAP = false;

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
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

  initialize(entities: EntityModel[]): void {
    if (DEBUG_ENDPOINT_SNAP) {
      console.log('🔍 [EndpointSnapEngine] initialize called with', entities.length, 'entities');

      // Count entity types and visibility
      const typeCounts: Record<string, number> = {};
      let visibleCount = 0;
      let hiddenCount = 0;
      entities.forEach(e => {
        typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
        if (e.visible === false) {
          hiddenCount++;
        } else {
          visibleCount++;
        }
      });
      console.log('🔍 [EndpointSnapEngine] Entity types:', typeCounts);
      console.log('🔍 [EndpointSnapEngine] Visible entities:', visibleCount, '/ Hidden:', hiddenCount);

      // Count endpoints per entity type
      let totalEndpoints = 0;
      entities.forEach(e => {
        const endpoints = GeometricCalculations.getEntityEndpoints(e);
        if (endpoints.length > 0) {
          console.log(`🔍 [EndpointSnapEngine] ${e.type} entity ${e.id} (visible=${e.visible}): ${endpoints.length} endpoints`, endpoints.slice(0, 2));
        }
        totalEndpoints += endpoints.length;
      });
      console.log('🔍 [EndpointSnapEngine] Total endpoints found:', totalEndpoints);
    }

    // ✅ CENTRALIZED: Use base class method for spatial index initialization
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => GeometricCalculations.getEntityEndpoints(entity),
      'endpoint'
    );

    if (DEBUG_ENDPOINT_SNAP) {
      const stats = this.spatialIndex.getStats();
      console.log('🔍 [EndpointSnapEngine] Spatial index stats after init:', stats);
    }
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) {
      if (DEBUG_ENDPOINT_SNAP) console.log('🔍 [EndpointSnapEngine] findSnapCandidates: No spatial index!');
      return { candidates: [] };
    }

    const candidates: SnapCandidate[] = [];
    const priority = 0; // Highest priority for endpoints

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.ENDPOINT);

    if (DEBUG_ENDPOINT_SNAP) {
      const stats = this.spatialIndex.getStats();
      console.log('🔍 [EndpointSnapEngine] findSnapCandidates:', {
        cursor: cursorPoint,
        radius,
        indexItems: stats.itemCount
      });
    }

    // Query using modern core spatial system
    const results = this.spatialIndex.querySnap(cursorPoint, radius, 'endpoint');

    if (DEBUG_ENDPOINT_SNAP) {
      console.log('🔍 [EndpointSnapEngine] querySnap returned', results.length, 'results');
    }

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