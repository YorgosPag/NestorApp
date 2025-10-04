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
    // Calculate bounds from entities
    const bounds = this.calculateEntityBounds(entities);

    // Create optimized Grid index for snapping
    this.spatialIndex = SpatialFactory.forSnapping(bounds);

    // Build endpoint index using core spatial system
    for (const entity of entities) {
      if (!entity.visible) continue;

      const endpoints = GeometricCalculations.getEntityEndpoints(entity);
      for (const endpoint of endpoints) {
        this.spatialIndex.insert({
          id: `${entity.id}_endpoint_${endpoint.x}_${endpoint.y}`,
          bounds: {
            minX: endpoint.x,
            minY: endpoint.y,
            maxX: endpoint.x,
            maxY: endpoint.y
          },
          data: { point: endpoint, entity }
        });
      }
    }
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

  private calculateEntityBounds(entities: Entity[]): SpatialBounds {
    if (entities.length === 0) {
      return { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of entities) {
      const endpoints = GeometricCalculations.getEntityEndpoints(entity);
      for (const point of endpoints) {
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