/**
 * HIT TESTER — Unified API for hit-testing with spatial optimization
 * ADR-065 SRP split: 960 lines -> 4 files (types, entity-tests, utils, main)
 */

import type { Viewport } from '../types/Types';
import type { Entity } from '../../types/entities';
import { SpatialFactory, type ISpatialIndex, type SpatialQueryResult } from '../../core/spatial';
import type { Point2D } from '../types/Types';
import { BoundingBox, BoundsCalculator, BoundsOperations } from './Bounds';
import { SNAP_TOLERANCE } from '../../config/tolerance-config';

// Re-export types for consumers
export type { HitTestOptions, HitTestResult, SnapResult } from './hit-tester-types';
import type { HitTestOptions, HitTestResult, SnapResult } from './hit-tester-types';

// Extracted modules
import { performDetailedHitTest, getVertexSnap, getEdgeSnap, getCenterSnap, getGridSnap } from './hit-test-entity-tests';
import {
  calculateBoundsFromEntities, calculateEntityBounds as calcEntityBounds,
  calculatePriority, passesFilters, normalizeResults, getLayerNameOrDefault,
} from './hit-tester-utils';

export class HitTester {
  private spatialIndex: ISpatialIndex | null = null;
  private entities: Entity[] = [];
  private enabled = true;

  private defaultTolerance = 5;
  private snapTolerance: number = SNAP_TOLERANCE;
  private maxResults = 50;

  private stats = {
    hitTests: 0,
    spatialQueries: 0,
    linearSearches: 0,
    averageQueryTime: 0,
    lastQueryTime: 0,
  };

  constructor(entities: Entity[] = [], useSpatialIndex = true) {
    this.setEntities(entities, useSpatialIndex);
  }

  // ===== ENTITY MANAGEMENT =====

  setEntities(entities: Entity[], useSpatialIndex = true): void {
    this.entities = entities;

    if (useSpatialIndex && entities.length > 100) {
      const bounds = calculateBoundsFromEntities(entities);
      if (bounds) {
        this.spatialIndex = SpatialFactory.forHitTesting(bounds);
      } else {
        console.warn('HitTester: Could not calculate bounds, using linear search');
        this.spatialIndex = null;
        return;
      }
      entities.forEach((entity, index) => {
        const entityBounds = calcEntityBounds(entity);
        if (entityBounds && this.spatialIndex) {
          this.spatialIndex.insert({
            id: entity.id || `entity-${index}`,
            bounds: { minX: entityBounds.minX, minY: entityBounds.minY, maxX: entityBounds.maxX, maxY: entityBounds.maxY },
            data: entity,
          });
        }
      });
    } else {
      this.spatialIndex = null;
    }
  }

  addEntity(entity: Entity): void {
    if (!entity.id) return;
    this.removeEntity(entity.id);
    this.entities.push(entity);

    if (this.spatialIndex) {
      const entityBounds = calcEntityBounds(entity);
      if (entityBounds) {
        this.spatialIndex.insert({
          id: entity.id,
          bounds: { minX: entityBounds.minX, minY: entityBounds.minY, maxX: entityBounds.maxX, maxY: entityBounds.maxY },
          data: entity,
        });
      }
    }
  }

  removeEntity(entityId: string): boolean {
    const index = this.entities.findIndex(e => e.id === entityId);
    if (index === -1) return false;
    this.entities.splice(index, 1);
    if (this.spatialIndex) this.spatialIndex.remove(entityId);
    return true;
  }

  updateEntity(entity: Entity): void {
    if (!entity.id) return;
    this.removeEntity(entity.id);
    this.addEntity(entity);
  }

  // ===== HIT TEST POINT =====

  hitTestPoint(point: Point2D, options: HitTestOptions = {}): HitTestResult[] {
    if (!this.enabled) return [];

    const startTime = performance.now();
    const tolerance = options.tolerance || this.defaultTolerance;

    let candidates: SpatialQueryResult<Entity>[];

    if (this.spatialIndex && options.useSpatialIndex !== false) {
      const rawCandidates = this.spatialIndex.queryNear(point, tolerance, {
        maxResults: options.maxCandidates || this.maxResults,
        includeInvisible: options.includeInvisible,
        layerFilter: options.layerFilter,
        typeFilter: options.typeFilter,
      });
      candidates = normalizeResults(rawCandidates);
      this.stats.spatialQueries++;
    } else {
      candidates = this.linearHitTest(point, tolerance, options);
      this.stats.linearSearches++;
    }

    const results: HitTestResult[] = [];
    for (const candidate of candidates) {
      const hitResult = this.analyzeHit(candidate, point, tolerance);
      if (hitResult) results.push(hitResult);
    }

    results.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.distance - b.distance;
    });

    this.updateStats(performance.now() - startTime);
    return results.slice(0, options.maxResults || this.maxResults);
  }

  // ===== SNAP TO POINT =====

  snapToPoint(point: Point2D, options: HitTestOptions = {}): SnapResult | null {
    const snapTolerance = options.tolerance || this.snapTolerance;
    let bestSnap: SnapResult | null = null;
    let minDistance = snapTolerance;

    const hits = this.hitTestPoint(point, { ...options, tolerance: snapTolerance, maxResults: 10 });

    for (const hit of hits) {
      if (options.snapToVertices) {
        const vertexSnap = getVertexSnap(hit.data, point, minDistance);
        if (vertexSnap && vertexSnap.distance < minDistance) { bestSnap = vertexSnap; minDistance = vertexSnap.distance; }
      }
      if (options.snapToEdges) {
        const edgeSnap = getEdgeSnap(hit.data, point, minDistance);
        if (edgeSnap && edgeSnap.distance < minDistance) { bestSnap = edgeSnap; minDistance = edgeSnap.distance; }
      }
      if (options.snapToCenters) {
        const centerSnap = getCenterSnap(hit.data, point, minDistance);
        if (centerSnap && centerSnap.distance < minDistance) { bestSnap = centerSnap; minDistance = centerSnap.distance; }
      }
    }

    if (options.snapToGrid && (!bestSnap || bestSnap.distance > snapTolerance / 2)) {
      const gridSnap = getGridSnap(point, snapTolerance);
      if (gridSnap && gridSnap.distance < minDistance) bestSnap = gridSnap;
    }

    return bestSnap;
  }

  // ===== HIT TEST REGION =====

  hitTestRegion(region: BoundingBox, options: HitTestOptions = {}): HitTestResult[] {
    if (!this.enabled) return [];

    let candidates: SpatialQueryResult<Entity>[];

    if (this.spatialIndex && options.useSpatialIndex !== false) {
      const rawCandidates = this.spatialIndex.queryBounds({
        minX: region.minX, minY: region.minY, maxX: region.maxX, maxY: region.maxY,
      }, options);
      candidates = normalizeResults(rawCandidates);
    } else {
      candidates = this.linearRegionTest(region, options);
    }

    const results: HitTestResult[] = [];
    for (const candidate of candidates) {
      const entityBounds = candidate.item?.bounds;
      if (entityBounds && BoundsOperations.intersects(entityBounds as BoundingBox, region)) {
        results.push({
          ...candidate,
          hitType: 'entity',
          hitPoint: {
            x: (entityBounds.minX + entityBounds.maxX) / 2,
            y: (entityBounds.minY + entityBounds.maxY) / 2,
          },
          layer: getLayerNameOrDefault('layer' in candidate.data ? (candidate.data as { layer?: string }).layer : undefined),
          selectable: ('selectable' in candidate.data ? candidate.data.selectable : true) !== false,
          priority: calculatePriority(candidate.data),
          vertexIndex: undefined,
          edgeIndex: undefined,
        });
      }
    }
    return results;
  }

  // ===== VISIBLE ENTITIES =====

  getVisibleEntities(
    viewport: Viewport,
    transform: { scale: number; offsetX: number; offsetY: number },
    options: HitTestOptions = {}
  ): Entity[] {
    if (this.spatialIndex) {
      const viewportBounds = {
        minX: (viewport.x ?? 0) - transform.offsetX,
        minY: (viewport.y ?? 0) - transform.offsetY,
        maxX: (viewport.x ?? 0) - transform.offsetX + viewport.width / transform.scale,
        maxY: (viewport.y ?? 0) - transform.offsetY + viewport.height / transform.scale,
      };
      const rawResults = this.spatialIndex.queryBounds(viewportBounds, options);
      return normalizeResults(rawResults).map(result => result.data);
    } else {
      return this.entities.filter(entity => {
        const bounds = BoundsCalculator.calculateEntityBounds(entity);
        if (!bounds) return true;
        const viewportBounds = {
          minX: viewport.x ?? 0, minY: viewport.y ?? 0,
          maxX: (viewport.x ?? 0) + viewport.width, maxY: (viewport.y ?? 0) + viewport.height,
        };
        return BoundsOperations.intersects(viewportBounds as BoundingBox, bounds as BoundingBox);
      });
    }
  }

  // ===== PRIVATE: LINEAR SEARCH FALLBACKS =====

  private linearHitTest(point: Point2D, tolerance: number, options: HitTestOptions): SpatialQueryResult<Entity>[] {
    const results: SpatialQueryResult<Entity>[] = [];
    for (const entity of this.entities) {
      if (!passesFilters(entity, options)) continue;
      const bounds = BoundsCalculator.calculateEntityBounds(entity, tolerance);
      if (!bounds) continue;
      if (BoundsOperations.containsPoint(bounds as BoundingBox, point)) {
        const distance = BoundsOperations.distanceFromPoint(bounds as BoundingBox, point);
        results.push({ item: { id: entity.id!, bounds, data: entity }, data: entity, distance, bounds });
      }
    }
    return results.sort((a, b) => a.distance - b.distance);
  }

  private linearRegionTest(region: BoundingBox, options: HitTestOptions): SpatialQueryResult<Entity>[] {
    const results: SpatialQueryResult<Entity>[] = [];
    for (const entity of this.entities) {
      if (!passesFilters(entity, options)) continue;
      const bounds = BoundsCalculator.calculateEntityBounds(entity);
      if (!bounds) continue;
      if (BoundsOperations.intersects(bounds as BoundingBox, region)) {
        results.push({ item: { id: entity.id!, bounds, data: entity }, data: entity, distance: 0, bounds });
      }
    }
    return results;
  }

  // ===== PRIVATE: ANALYZE HIT =====

  private analyzeHit(candidate: SpatialQueryResult<Entity>, point: Point2D, tolerance: number): HitTestResult | null {
    const entity = candidate.data;
    const detailedHit = performDetailedHitTest(entity, point, tolerance);
    if (!detailedHit) return null;

    return {
      ...candidate,
      ...detailedHit,
      entityId: entity.id,
      entityType: entity.type,
      layer: getLayerNameOrDefault(entity.layer),
      selectable: entity.selected !== false,
      priority: calculatePriority(entity),
    } as HitTestResult;
  }

  // ===== PUBLIC API =====

  getStatistics() {
    return {
      ...this.stats,
      entityCount: this.entities.length,
      spatialIndexEnabled: !!this.spatialIndex,
      spatialIndexStats: this.spatialIndex ? 'available' : 'disabled',
    };
  }

  setEnabled(enabled: boolean): void { this.enabled = enabled; }
  isEnabled(): boolean { return this.enabled; }

  configure(options: { tolerance?: number; snapTolerance?: number; maxResults?: number }): void {
    if (options.tolerance !== undefined) this.defaultTolerance = options.tolerance;
    if (options.snapTolerance !== undefined) this.snapTolerance = options.snapTolerance;
    if (options.maxResults !== undefined) this.maxResults = options.maxResults;
  }

  private updateStats(queryTime: number): void {
    this.stats.hitTests++;
    this.stats.lastQueryTime = queryTime;
    this.stats.averageQueryTime =
      (this.stats.averageQueryTime * (this.stats.hitTests - 1) + queryTime) / this.stats.hitTests;
  }
}

/** Factory function */
export function createHitTester(entities: Entity[] = [], useSpatialIndex = true): HitTester {
  return new HitTester(entities, useSpatialIndex);
}
