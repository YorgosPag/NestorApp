/**
 * HIT TESTER - Unified API για hit-testing με spatial optimization
 * ✅ ΦΑΣΗ 5: Αντικαθιστά το linear search με O(log n) queries
 */

import type { Viewport } from '../types/Types';
import type { Entity, BaseEntity } from '../../types/entities';
import { getEntityBounds } from '../../types/entities';
import { SpatialFactory, type ISpatialIndex, type SpatialQueryOptions, type SpatialQueryResult } from '../../core/spatial';
import type { Point2D } from '../types/Types';
import { BoundingBox, BoundsCalculator, BoundsOperations } from './Bounds';
// 🏢 ADR-071: Centralized geometry utilities
import { pointToLineDistance, clamp } from '../entities/shared/geometry-utils';
// 🏢 ADR-095: Centralized Snap Tolerance
import { SNAP_TOLERANCE } from '../../config/tolerance-config';

export interface HitTestOptions extends SpatialQueryOptions {
  // Hit-test specific options
  snapToVertices?: boolean;
  snapToEdges?: boolean;
  snapToCenters?: boolean;
  snapToGrid?: boolean;

  // Performance options
  useSpatialIndex?: boolean;
  maxCandidates?: number;

  // Visual options
  highlightCandidates?: boolean;
  debugMode?: boolean;
}

export interface HitTestResult extends SpatialQueryResult {
  // Extended hit information
  hitType: 'entity' | 'vertex' | 'edge' | 'center' | 'grid';
  hitPoint: Point2D;
  snapPoint?: Point2D;

  // Geometric details
  vertexIndex?: number;
  edgeIndex?: number;

  // Metadata
  layer: string;
  selectable: boolean;
  priority: number;
}

export interface SnapResult {
  point: Point2D;
  type: 'vertex' | 'edge' | 'center' | 'grid' | 'intersection';
  entityId?: string;
  distance: number;
  visual?: {
    showGuides: boolean;
    guideColor: string;
    snapRadius: number;
  };
}

/**
 * 🔺 HIT TESTER ΚΕΝΤΡΙΚΗ ΚΛΑΣΗ
 * Unified API για όλα τα hit-testing needs
 */
export class HitTester {
  private spatialIndex: ISpatialIndex | null = null;
  private entities: Entity[] = [];
  private enabled = true;

  // Configuration
  private defaultTolerance = 5; // pixels
  private snapTolerance = SNAP_TOLERANCE; // 🏢 ADR-095: Centralized
  private maxResults = 50;

  // Performance tracking
  private stats = {
    hitTests: 0,
    spatialQueries: 0,
    linearSearches: 0,
    averageQueryTime: 0,
    lastQueryTime: 0
  };

  constructor(entities: Entity[] = [], useSpatialIndex = true) {
    this.setEntities(entities, useSpatialIndex);
  }

  /**
   * 🔺 SET ENTITIES
   * Ενημερώνει τα entities και rebuilds το spatial index
   */
  setEntities(entities: Entity[], useSpatialIndex = true): void {
    this.entities = entities;

    if (useSpatialIndex && entities.length > 100) { // Spatial index αξίζει για 100+ entities
      // ✅ FIX: Calculate bounds from entities
      const bounds = this.calculateBoundsFromEntities(entities);
      if (bounds) {
        this.spatialIndex = SpatialFactory.forHitTesting(bounds);
      } else {
        console.warn('🚨 HitTester: Could not calculate bounds from entities, using linear search');
        this.spatialIndex = null;
        return;
      }
      // ✅ ENTERPRISE FIX: Use proper ISpatialIndex API
      // Convert entities to SpatialItems and insert them
      entities.forEach((entity, index) => {
        const entityBounds = this.calculateEntityBounds(entity);
        if (entityBounds && this.spatialIndex) {
          this.spatialIndex.insert({
            id: entity.id || `entity-${index}`,
            bounds: {
              minX: entityBounds.minX,
              minY: entityBounds.minY,
              maxX: entityBounds.maxX,
              maxY: entityBounds.maxY
            },
            data: entity
          });
        }
      });
    } else {
      this.spatialIndex = null; // Fallback to linear search
    }
  }

  /**
   * ✅ HELPER: Calculate bounds from entities
   */
  private calculateBoundsFromEntities(entities: Entity[]): BoundingBox | null {
    if (!entities.length) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of entities) {
      // ✅ ENTERPRISE FIX: Use Bounds utility to calculate entity bounds
      try {
        const entityBounds = BoundsCalculator.calculateEntityBounds(entity, 0);
        if (entityBounds) {
          minX = Math.min(minX, entityBounds.minX);
          minY = Math.min(minY, entityBounds.minY);
          maxX = Math.max(maxX, entityBounds.maxX);
          maxY = Math.max(maxY, entityBounds.maxY);
        }
      } catch (error) {
        // Skip entities that can't have bounds calculated
        continue;
      }
    }

    if (minX === Infinity) return null;

    const width = maxX - minX;
    const height = maxY - minY;
    return {
      minX,
      minY,
      maxX,
      maxY,
      width,
      height,
      centerX: minX + width / 2,
      centerY: minY + height / 2
    };
  }

  /**
   * 🔺 ADD ENTITY
   * Προσθέτει ένα entity
   */
  addEntity(entity: Entity): void {
    if (!entity.id) return;

    // Αφαίρεση παλιάς έκδοσης
    this.removeEntity(entity.id);

    // Προσθήκη νέας έκδοσης
    this.entities.push(entity);

    if (this.spatialIndex) {
      // ✅ ENTERPRISE FIX: Use proper ISpatialIndex API
      const entityBounds = this.calculateEntityBounds(entity);
      if (entityBounds) {
        this.spatialIndex.insert({
          id: entity.id,
          bounds: {
            minX: entityBounds.minX,
            minY: entityBounds.minY,
            maxX: entityBounds.maxX,
            maxY: entityBounds.maxY
          },
          data: entity
        });
      }
    }
  }

  /**
   * 🔺 REMOVE ENTITY
   * Αφαιρεί ένα entity
   */
  removeEntity(entityId: string): boolean {
    const index = this.entities.findIndex(e => e.id === entityId);
    if (index === -1) return false;

    this.entities.splice(index, 1);

    if (this.spatialIndex) {
      // ✅ ENTERPRISE FIX: Use proper ISpatialIndex API
      this.spatialIndex.remove(entityId);
    }

    return true;
  }

  /**
   * 🔺 UPDATE ENTITY
   * Ενημερώνει ένα entity
   */
  updateEntity(entity: Entity): void {
    if (!entity.id) return;

    this.removeEntity(entity.id);
    this.addEntity(entity);
  }

  /**
   * 🔺 HIT TEST POINT
   * Κύρια μέθοδος για hit-testing ενός point
   */
  hitTestPoint(point: Point2D, options: HitTestOptions = {}): HitTestResult[] {
    if (!this.enabled) return [];

    const startTime = performance.now();
    const tolerance = options.tolerance || this.defaultTolerance;

    // Επιλογή μεθόδου query
    let candidates: SpatialQueryResult[];

    if (this.spatialIndex && options.useSpatialIndex !== false) {
      // ✅ ENTERPRISE FIX: Use proper ISpatialIndex API
      // Use queryNear for radius-based search
      candidates = this.spatialIndex.queryNear(point, tolerance, {
        maxResults: options.maxCandidates || this.maxResults,
        includeInvisible: options.includeInvisible,
        layerFilter: options.layerFilter,
        typeFilter: options.typeFilter
      });
      this.stats.spatialQueries++;
    } else {
      // Linear search fallback
      candidates = this.linearHitTest(point, tolerance, options);
      this.stats.linearSearches++;
    }

    // Μετατροπή σε HitTestResult με detailed hit information
    const results: HitTestResult[] = [];

    for (const candidate of candidates) {
      const hitResult = this.analyzeHit(candidate, point, tolerance, options);
      if (hitResult) {
        results.push(hitResult);
      }
    }

    // Ταξινόμηση κατά priority και distance
    results.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority; // Higher priority first
      return a.distance - b.distance; // Closer distance first
    });

    // Update statistics
    const queryTime = performance.now() - startTime;
    this.updateStats(queryTime);

    return results.slice(0, options.maxResults || this.maxResults);
  }

  /**
   * 🔺 SNAP TO POINT
   * Βρίσκει το κοντινότερο snap point
   */
  snapToPoint(point: Point2D, options: HitTestOptions = {}): SnapResult | null {
    const snapTolerance = options.tolerance || this.snapTolerance;

    let bestSnap: SnapResult | null = null;
    let minDistance = snapTolerance;

    // Hit test για entities
    const hits = this.hitTestPoint(point, {
      ...options,
      tolerance: snapTolerance,
      maxResults: 10
    });

    for (const hit of hits) {
      // Snap to vertices
      if (options.snapToVertices) {
        // ✅ ENTERPRISE FIX: Access entity through data property
        const vertexSnap = this.getVertexSnap(hit.data, point, minDistance);
        if (vertexSnap && vertexSnap.distance < minDistance) {
          bestSnap = vertexSnap;
          minDistance = vertexSnap.distance;
        }
      }

      // Snap to edges
      if (options.snapToEdges) {
        // ✅ ENTERPRISE FIX: Access entity through data property
        const edgeSnap = this.getEdgeSnap(hit.data, point, minDistance);
        if (edgeSnap && edgeSnap.distance < minDistance) {
          bestSnap = edgeSnap;
          minDistance = edgeSnap.distance;
        }
      }

      // Snap to centers
      if (options.snapToCenters) {
        // ✅ ENTERPRISE FIX: Access entity through data property
        const centerSnap = this.getCenterSnap(hit.data, point, minDistance);
        if (centerSnap && centerSnap.distance < minDistance) {
          bestSnap = centerSnap;
          minDistance = centerSnap.distance;
        }
      }
    }

    // Snap to grid
    if (options.snapToGrid && (!bestSnap || bestSnap.distance > snapTolerance / 2)) {
      const gridSnap = this.getGridSnap(point, snapTolerance);
      if (gridSnap && gridSnap.distance < minDistance) {
        bestSnap = gridSnap;
      }
    }

    return bestSnap;
  }

  /**
   * 🔺 HIT TEST REGION
   * Hit test για μια περιοχή (selection rectangle)
   */
  hitTestRegion(region: BoundingBox, options: HitTestOptions = {}): HitTestResult[] {
    if (!this.enabled) return [];

    let candidates: SpatialQueryResult[];

    if (this.spatialIndex && options.useSpatialIndex !== false) {
      // ✅ ENTERPRISE FIX: Use queryBounds instead of queryRegion
      candidates = this.spatialIndex.queryBounds({
        minX: region.minX,
        minY: region.minY,
        maxX: region.maxX,
        maxY: region.maxY
      }, options);
    } else {
      candidates = this.linearRegionTest(region, options);
    }

    const results: HitTestResult[] = [];

    for (const candidate of candidates) {
      // ✅ ENTERPRISE FIX: Use item.bounds from SpatialQueryResult
      const entityBounds = candidate.item?.bounds;

      if (entityBounds && BoundsOperations.intersects(entityBounds as BoundingBox, region)) {
        results.push({
          ...candidate,
          hitType: 'entity',
          hitPoint: {
            // ✅ ENTERPRISE FIX: Calculate center from bounds (SpatialBounds doesn't guarantee centerX/centerY)
            x: (entityBounds.minX + entityBounds.maxX) / 2,
            y: (entityBounds.minY + entityBounds.maxY) / 2
          },
          // ✅ ENTERPRISE FIX: Access entity properties with type safety
          layer: ('layer' in candidate.data ? candidate.data.layer : undefined) || 'default',
          selectable: ('selectable' in candidate.data ? candidate.data.selectable : true) !== false,
          priority: this.calculatePriority(candidate.data),
          vertexIndex: undefined,
          edgeIndex: undefined
        });
      }
    }

    return results;
  }

  /**
   * 🔺 GET VISIBLE ENTITIES
   * Επιστρέφει τα entities που είναι ορατά στο viewport
   */
  getVisibleEntities(
    viewport: Viewport,
    transform: { scale: number; offsetX: number; offsetY: number },
    options: HitTestOptions = {}
  ): Entity[] {
    if (this.spatialIndex) {
      // ✅ ENTERPRISE FIX: Create viewport bounds manually
      const viewportBounds = {
        minX: (viewport.x ?? 0) - transform.offsetX,
        minY: (viewport.y ?? 0) - transform.offsetY,
        maxX: (viewport.x ?? 0) - transform.offsetX + viewport.width / transform.scale,
        maxY: (viewport.y ?? 0) - transform.offsetY + viewport.height / transform.scale
      };
      const results = this.spatialIndex.queryBounds(viewportBounds, options);
      return results.map(r => r.data);
    } else {
      // Linear viewport culling
      return this.entities.filter(entity => {
        const bounds = BoundsCalculator.calculateEntityBounds(entity);
        if (!bounds) return true; // Include if can't calculate bounds

        // ✅ ENTERPRISE FIX: Simple bounds check without transform utility
        const viewportBounds = {
          minX: viewport.x ?? 0,
          minY: viewport.y ?? 0,
          maxX: (viewport.x ?? 0) + viewport.width,
          maxY: (viewport.y ?? 0) + viewport.height
        };

        return BoundsOperations.intersects(viewportBounds as BoundingBox, bounds as BoundingBox);
      });
    }
  }

  /**
   * 🔺 LINEAR HIT TEST
   * Fallback linear search implementation
   */
  private linearHitTest(point: Point2D, tolerance: number, options: HitTestOptions): SpatialQueryResult[] {
    const results: SpatialQueryResult[] = [];

    for (const entity of this.entities) {
      if (!this.passesFilters(entity, options)) continue;

      const bounds = BoundsCalculator.calculateEntityBounds(entity, tolerance);
      if (!bounds) continue;

      if (BoundsOperations.containsPoint(bounds as BoundingBox, point)) {
        const distance = BoundsOperations.distanceFromPoint(bounds as BoundingBox, point);

        results.push({
          item: { id: entity.id!, bounds, data: entity },
          data: entity, // ✅ ENTERPRISE FIX: Use data property for SpatialQueryResult
          distance,
          bounds
        });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * 🔺 LINEAR REGION TEST
   * Fallback linear region test
   */
  private linearRegionTest(region: BoundingBox, options: HitTestOptions): SpatialQueryResult[] {
    const results: SpatialQueryResult[] = [];

    for (const entity of this.entities) {
      if (!this.passesFilters(entity, options)) continue;

      const bounds = BoundsCalculator.calculateEntityBounds(entity);
      if (!bounds) continue;

      if (BoundsOperations.intersects(bounds as BoundingBox, region)) {
        results.push({
          item: { id: entity.id!, bounds, data: entity },
          data: entity, // ✅ ENTERPRISE FIX: Use data property for SpatialQueryResult
          distance: 0,
          bounds
        });
      }
    }

    return results;
  }

  /**
   * 🔺 ANALYZE HIT
   * Μετατρέπει SpatialQueryResult σε HitTestResult με detailed analysis
   */
  private analyzeHit(candidate: SpatialQueryResult, point: Point2D, tolerance: number, options: HitTestOptions): HitTestResult | null {
    // ✅ ENTERPRISE FIX: Access entity through data property
    const entity = candidate.data;

    // Detailed hit analysis based on entity type
    const detailedHit = this.performDetailedHitTest(entity, point, tolerance);
    if (!detailedHit) return null;

    return {
      ...candidate,
      ...detailedHit,
      entityId: entity.id, // ✅ ENTERPRISE FIX: Add required entityId property
      entityType: entity.type, // ✅ ENTERPRISE FIX: Add entity type
      layer: entity.layer || 'default',
      selectable: entity.selected !== false,
      priority: this.calculatePriority(entity)
    } as HitTestResult;
  }

  /**
   * 🔺 DETAILED HIT TEST
   * Precise hit testing per entity type
   */
  private performDetailedHitTest(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    switch (entity.type) {
      case 'line':
        return this.hitTestLine(entity, point, tolerance);
      case 'circle':
        return this.hitTestCircle(entity, point, tolerance);
      case 'polyline':
      case 'lwpolyline':
        return this.hitTestPolyline(entity, point, tolerance);
      default:
        // Generic hit test - point inside bounds
        return {
          hitType: 'entity',
          hitPoint: point
        };
    }
  }

  /**
   * 🔺 ENTITY-SPECIFIC HIT TESTS
   */
  private hitTestLine(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    // ✅ ENTERPRISE FIX: Type-safe property access
    if (!('start' in entity) || !('end' in entity)) return null;
    const lineEntity = entity as { start: Point2D; end: Point2D };
    const start = lineEntity.start;
    const end = lineEntity.end;

    // Distance from point to line segment
    const distance = pointToLineDistance(point, start, end);

    if (distance <= tolerance) {
      return {
        hitType: 'entity',
        hitPoint: this.closestPointOnLine(point, start, end)
      };
    }

    return null;
  }

  private hitTestCircle(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    // ✅ ENTERPRISE FIX: Type-safe property access
    if (!('center' in entity) || !('radius' in entity)) return null;
    const circleEntity = entity as { center: Point2D; radius: number };
    const center = circleEntity.center;
    const radius = circleEntity.radius;

    const distanceFromCenter = Math.sqrt(
      Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
    );

    // Hit if close to circumference
    const distanceFromCircumference = Math.abs(distanceFromCenter - radius);

    if (distanceFromCircumference <= tolerance) {
      return {
        hitType: 'entity',
        hitPoint: point
      };
    }

    return null;
  }

  private hitTestPolyline(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    // ✅ ENTERPRISE FIX: Type-safe property access
    if (!('vertices' in entity)) return null;
    const polylineEntity = entity as { vertices: Point2D[] };
    const vertices = polylineEntity.vertices;
    if (!vertices || vertices.length < 2) return null;

    for (let i = 0; i < vertices.length - 1; i++) {
      const distance = pointToLineDistance(point, vertices[i], vertices[i + 1]);

      if (distance <= tolerance) {
        return {
          hitType: 'entity',
          hitPoint: this.closestPointOnLine(point, vertices[i], vertices[i + 1]),
          edgeIndex: i
        };
      }
    }

    return null;
  }

  /**
   * 🔺 SNAP METHODS
   */
  private getVertexSnap(entity: Entity, point: Point2D, maxDistance: number): SnapResult | null {
    // Implementation depends on entity type
    return null; // Simplified for now
  }

  private getEdgeSnap(entity: Entity, point: Point2D, maxDistance: number): SnapResult | null {
    // Implementation depends on entity type
    return null; // Simplified for now
  }

  private getCenterSnap(entity: Entity, point: Point2D, maxDistance: number): SnapResult | null {
    // Implementation depends on entity type
    return null; // Simplified for now
  }

  private getGridSnap(point: Point2D, tolerance: number): SnapResult | null {
    // Grid snapping implementation
    return null; // Simplified for now
  }

  // Διαγράφηκε το διπλότυπο pointToLineDistance - χρησιμοποιούμε το unified από geometry-utils

  private closestPointOnLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D): Point2D {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return lineStart;

    // 🏢 ADR-071: Using centralized clamp
    const param = clamp(dot / lenSq, 0, 1);

    return {
      x: lineStart.x + param * C,
      y: lineStart.y + param * D
    };
  }

  private calculatePriority(entity: Entity): number {
    // Higher values = higher priority
    let priority = 0;

    // Type-based priority
    switch (entity.type) {
      case 'point': priority += 100; break;
      case 'line': priority += 80; break;
      case 'circle': priority += 70; break;
      case 'text': priority += 60; break;
      default: priority += 50; break;
    }

    // Type-safe layer access
    const entityWithLayer = entity as { layer?: string };
    const layer = entityWithLayer.layer;
    if (layer === 'construction') priority -= 20;
    if (layer === 'annotation') priority += 10;

    return priority;
  }

  private passesFilters(entity: Entity, options: HitTestOptions): boolean {
    // Type-safe visibility check
    const entityWithVisibility = entity as { visible?: boolean };
    if (!options.includeInvisible && entityWithVisibility.visible === false) return false;

    // Type-safe layer filter
    const entityWithLayer = entity as { layer?: string };
    const entityLayer = entityWithLayer.layer;
    if (options.layerFilter?.length && (!entityLayer || !options.layerFilter.includes(entityLayer))) {
      return false;
    }

    // Type filter
    if (options.typeFilter?.length && !options.typeFilter.includes(entity.type)) {
      return false;
    }

    return true;
  }

  /**
   * ✅ ENTERPRISE FIX: Calculate entity bounds using BoundsCalculator
   */
  private calculateEntityBounds(entity: Entity): BoundingBox | null {
    try {
      return BoundsCalculator.calculateEntityBounds(entity, 0);
    } catch (error) {
      console.warn(`Failed to calculate bounds for entity ${entity.id}:`, error);
      return null;
    }
  }

  private updateStats(queryTime: number): void {
    this.stats.hitTests++;
    this.stats.lastQueryTime = queryTime;
    this.stats.averageQueryTime =
      (this.stats.averageQueryTime * (this.stats.hitTests - 1) + queryTime) / this.stats.hitTests;
  }

  /**
   * 🔺 PUBLIC API METHODS
   */
  getStatistics() {
    return {
      ...this.stats,
      entityCount: this.entities.length,
      spatialIndexEnabled: !!this.spatialIndex,
      // ✅ ENTERPRISE FIX: getStatistics may not exist on ISpatialIndex
      spatialIndexStats: this.spatialIndex ? 'available' : 'disabled'
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  configure(options: { tolerance?: number; snapTolerance?: number; maxResults?: number }): void {
    if (options.tolerance !== undefined) this.defaultTolerance = options.tolerance;
    if (options.snapTolerance !== undefined) this.snapTolerance = options.snapTolerance;
    if (options.maxResults !== undefined) this.maxResults = options.maxResults;
  }
}

/**
 * 🔺 FACTORY FUNCTION
 */
export function createHitTester(entities: Entity[] = [], useSpatialIndex = true): HitTester {
  return new HitTester(entities, useSpatialIndex);
}