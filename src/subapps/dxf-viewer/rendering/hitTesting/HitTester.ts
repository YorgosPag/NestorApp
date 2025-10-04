/**
 * HIT TESTER - Unified API για hit-testing με spatial optimization
 * ✅ ΦΑΣΗ 5: Αντικαθιστά το linear search με O(log n) queries
 */

import type { EntityModel, Viewport } from '../types/Types';
import { SpatialFactory, type ISpatialIndex, type SpatialQueryOptions, type SpatialQueryResult } from '../../core/spatial';
import type { Point2D } from '../types/Types';
import { BoundingBox, BoundsCalculator, BoundsOperations } from './Bounds';
import { pointToLineDistance } from '../entities/shared/geometry-utils';

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
  private entities: EntityModel[] = [];
  private enabled = true;

  // Configuration
  private defaultTolerance = 5; // pixels
  private snapTolerance = 10; // pixels
  private maxResults = 50;

  // Performance tracking
  private stats = {
    hitTests: 0,
    spatialQueries: 0,
    linearSearches: 0,
    averageQueryTime: 0,
    lastQueryTime: 0
  };

  constructor(entities: EntityModel[] = [], useSpatialIndex = true) {
    this.setEntities(entities, useSpatialIndex);
  }

  /**
   * 🔺 SET ENTITIES
   * Ενημερώνει τα entities και rebuilds το spatial index
   */
  setEntities(entities: EntityModel[], useSpatialIndex = true): void {
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
      this.spatialIndex.buildIndex(entities);
    } else {
      this.spatialIndex = null; // Fallback to linear search
    }
  }

  /**
   * ✅ HELPER: Calculate bounds from entities
   */
  private calculateBoundsFromEntities(entities: EntityModel[]): BoundingBox | null {
    if (!entities.length) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const entity of entities) {
      if (entity.bounds) {
        minX = Math.min(minX, entity.bounds.minX);
        minY = Math.min(minY, entity.bounds.minY);
        maxX = Math.max(maxX, entity.bounds.maxX);
        maxY = Math.max(maxY, entity.bounds.maxY);
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
  addEntity(entity: EntityModel): void {
    if (!entity.id) return;

    // Αφαίρεση παλιάς έκδοσης
    this.removeEntity(entity.id);

    // Προσθήκη νέας έκδοσης
    this.entities.push(entity);

    if (this.spatialIndex) {
      this.spatialIndex.addEntity(entity);
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
      this.spatialIndex.removeEntity(entityId);
    }

    return true;
  }

  /**
   * 🔺 UPDATE ENTITY
   * Ενημερώνει ένα entity
   */
  updateEntity(entity: EntityModel): void {
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
      // Spatial index query
      candidates = this.spatialIndex.queryPoint(point, {
        ...options,
        tolerance,
        maxResults: options.maxCandidates || this.maxResults
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
        const vertexSnap = this.getVertexSnap(hit.entity, point, minDistance);
        if (vertexSnap && vertexSnap.distance < minDistance) {
          bestSnap = vertexSnap;
          minDistance = vertexSnap.distance;
        }
      }

      // Snap to edges
      if (options.snapToEdges) {
        const edgeSnap = this.getEdgeSnap(hit.entity, point, minDistance);
        if (edgeSnap && edgeSnap.distance < minDistance) {
          bestSnap = edgeSnap;
          minDistance = edgeSnap.distance;
        }
      }

      // Snap to centers
      if (options.snapToCenters) {
        const centerSnap = this.getCenterSnap(hit.entity, point, minDistance);
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
      candidates = this.spatialIndex.queryRegion(region, options);
    } else {
      candidates = this.linearRegionTest(region, options);
    }

    const results: HitTestResult[] = [];

    for (const candidate of candidates) {
      // Detailed intersection check
      const entityBounds = candidate.bounds;

      if (BoundsOperations.intersects(entityBounds, region)) {
        results.push({
          ...candidate,
          hitType: 'entity',
          hitPoint: { x: entityBounds.centerX, y: entityBounds.centerY },
          layer: candidate.entity.layer || 'default',
          selectable: candidate.entity.selectable !== false,
          priority: this.calculatePriority(candidate.entity),
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
  ): EntityModel[] {
    if (this.spatialIndex) {
      const results = this.spatialIndex.queryViewport(viewport, transform, options);
      return results.map(r => r.entity);
    } else {
      // Linear viewport culling
      return this.entities.filter(entity => {
        const bounds = BoundsCalculator.calculateEntityBounds(entity);
        if (!bounds) return true; // Include if can't calculate bounds

        const screenBounds = BoundsOperations.transform(bounds, transform);
        const viewportBounds = BoundsOperations.fromViewport(viewport.x ?? 0, viewport.y ?? 0, viewport.width, viewport.height);

        return BoundsOperations.intersects(screenBounds, viewportBounds);
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

      if (BoundsOperations.containsPoint(bounds, point)) {
        const distance = BoundsOperations.distanceFromPoint(bounds, point);

        results.push({
          entityId: entity.id!,
          entity,
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

      if (BoundsOperations.intersects(bounds, region)) {
        results.push({
          entityId: entity.id!,
          entity,
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
    const entity = candidate.entity;

    // Detailed hit analysis based on entity type
    const detailedHit = this.performDetailedHitTest(entity, point, tolerance);
    if (!detailedHit) return null;

    return {
      ...candidate,
      ...detailedHit,
      layer: entity.layer || 'default',
      selectable: entity.selectable !== false,
      priority: this.calculatePriority(entity)
    };
  }

  /**
   * 🔺 DETAILED HIT TEST
   * Precise hit testing per entity type
   */
  private performDetailedHitTest(entity: EntityModel, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
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
  private hitTestLine(entity: EntityModel, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    const start = entity.start as Point2D;
    const end = entity.end as Point2D;

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

  private hitTestCircle(entity: EntityModel, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    const center = entity.center as Point2D;
    const radius = entity.radius as number;

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

  private hitTestPolyline(entity: EntityModel, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    const vertices = entity.vertices as Point2D[];
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
  private getVertexSnap(entity: EntityModel, point: Point2D, maxDistance: number): SnapResult | null {
    // Implementation depends on entity type
    return null; // Simplified for now
  }

  private getEdgeSnap(entity: EntityModel, point: Point2D, maxDistance: number): SnapResult | null {
    // Implementation depends on entity type
    return null; // Simplified for now
  }

  private getCenterSnap(entity: EntityModel, point: Point2D, maxDistance: number): SnapResult | null {
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

    const param = Math.max(0, Math.min(1, dot / lenSq));

    return {
      x: lineStart.x + param * C,
      y: lineStart.y + param * D
    };
  }

  private calculatePriority(entity: EntityModel): number {
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

    // Layer-based priority
    if (entity.layer === 'construction') priority -= 20;
    if (entity.layer === 'annotation') priority += 10;

    return priority;
  }

  private passesFilters(entity: EntityModel, options: HitTestOptions): boolean {
    // Visibility
    if (!options.includeInvisible && entity.visible === false) return false;

    // Layer filter
    if (options.layerFilter?.length && (!entity.layer || !options.layerFilter.includes(entity.layer))) {
      return false;
    }

    // Type filter
    if (options.typeFilter?.length && !options.typeFilter.includes(entity.type)) {
      return false;
    }

    return true;
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
      spatialIndexStats: this.spatialIndex?.getStatistics()
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
export function createHitTester(entities: EntityModel[] = [], useSpatialIndex = true): HitTester {
  return new HitTester(entities, useSpatialIndex);
}