/**
 * Midpoint Snap Engine
 * Υπεύθυνο για εύρεση snap points στα μέσα των entities
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_MIDPOINT_SNAP_ENGINE = false;

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialFactory } from '../../core/spatial';
import type { ISpatialIndex, SpatialBounds } from '../../core/spatial';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { findStandardSnapCandidates, StandardSnapCandidate } from './shared/snap-engine-utils';

export class MidpointSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.MIDPOINT);
  }

  initialize(entities: Entity[]): void {
    // Calculate bounds from entities
    const bounds = this.calculateEntityBounds(entities);

    // Create optimized Grid index for snapping
    this.spatialIndex = SpatialFactory.forSnapping(bounds);

    // Build midpoint index using core spatial system
    for (const entity of entities) {
      if (!entity.visible) continue;

      const midpoints = GeometricCalculations.getEntityMidpoints(entity);
      for (const midpoint of midpoints) {
        this.spatialIndex.insert({
          id: `${entity.id}_midpoint_${midpoint.x}_${midpoint.y}`,
          bounds: {
            minX: midpoint.x,
            minY: midpoint.y,
            maxX: midpoint.x,
            maxY: midpoint.y
          },
          data: { point: midpoint, entity }
        });
      }
    }
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) {
      return { candidates: [] };
    }

    const candidates: any[] = [];
    const priority = 1; // Second priority after endpoints

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

  private calculateEntityBounds(entities: Entity[]): SpatialBounds {
    if (entities.length === 0) {
      return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of entities) {
      const midpoints = GeometricCalculations.getEntityMidpoints(entity);
      for (const point of midpoints) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    if (minX === Infinity) {
      return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    }

    // Add margin
    const margin = Math.max((maxX - minX), (maxY - minY)) * 0.1;
    return {
      minX: minX - margin,
      minY: minY - margin,
      maxX: maxX + margin,
      maxY: maxY + margin
    };
  }
}