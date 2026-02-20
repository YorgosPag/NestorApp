/**
 * HIT TESTER - Unified API για hit-testing με spatial optimization
 * ✅ ΦΑΣΗ 5: Αντικαθιστά το linear search με O(log n) queries
 */

import type { Viewport } from '../types/Types';
import type { Entity } from '../../types/entities';
import { SpatialFactory, type ISpatialIndex, type SpatialQueryOptions, type SpatialQueryResult } from '../../core/spatial';
import type { Point2D } from '../types/Types';
import { BoundingBox, BoundsCalculator, BoundsOperations } from './Bounds';
// 🏢 ADR-071: Centralized geometry utilities
import { pointToLineDistance, clamp, degToRad } from '../entities/shared/geometry-utils';
// 🏢 ADR-107: Text metrics for text hit-testing width estimation
import { TEXT_METRICS_RATIOS } from '../../config/text-rendering-config';
// 🏢 ENTERPRISE (2026-02-15): Centralized point-in-polygon for closed polyline/area hit-test
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
// 🏢 ADR-109: Centralized Distance Calculation
import { calculateDistance } from '../entities/shared/geometry-rendering-utils';
// 🏢 Arc hit-testing: reuse centralized arc distance utility
import { pointToArcDistance } from '../../utils/angle-entity-math';
// 🏢 ADR-095: Centralized Snap Tolerance
import { SNAP_TOLERANCE } from '../../config/tolerance-config';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds, isInfinityBounds } from '../../config/geometry-constants';

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

export interface HitTestResult extends SpatialQueryResult<Entity> {
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
  private snapTolerance: number = SNAP_TOLERANCE; // 🏢 ADR-095: Centralized
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

    // 🏢 ADR-158: Centralized Infinity Bounds Initialization
    const bounds = createInfinityBounds();

    for (const entity of entities) {
      // ✅ ENTERPRISE FIX: Use Bounds utility to calculate entity bounds
      try {
        const entityBounds = BoundsCalculator.calculateEntityBounds(entity, 0);
        if (entityBounds) {
          bounds.minX = Math.min(bounds.minX, entityBounds.minX);
          bounds.minY = Math.min(bounds.minY, entityBounds.minY);
          bounds.maxX = Math.max(bounds.maxX, entityBounds.maxX);
          bounds.maxY = Math.max(bounds.maxY, entityBounds.maxY);
        }
      } catch (error) {
        // Skip entities that can't have bounds calculated
        continue;
      }
    }

    // 🏢 ADR-158: Use centralized isInfinityBounds check
    if (isInfinityBounds(bounds)) return null;

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      width,
      height,
      centerX: bounds.minX + width / 2,
      centerY: bounds.minY + height / 2
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
    let candidates: SpatialQueryResult<Entity>[];

    if (this.spatialIndex && options.useSpatialIndex !== false) {
      // ✅ ENTERPRISE FIX: Use proper ISpatialIndex API
      // Use queryNear for radius-based search
      const rawCandidates = this.spatialIndex.queryNear(point, tolerance, {
        maxResults: options.maxCandidates || this.maxResults,
        includeInvisible: options.includeInvisible,
        layerFilter: options.layerFilter,
        typeFilter: options.typeFilter
      });
      candidates = this.normalizeResults(rawCandidates);
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

    let candidates: SpatialQueryResult<Entity>[];

    if (this.spatialIndex && options.useSpatialIndex !== false) {
      // ✅ ENTERPRISE FIX: Use queryBounds instead of queryRegion
      const rawCandidates = this.spatialIndex.queryBounds({
        minX: region.minX,
        minY: region.minY,
        maxX: region.maxX,
        maxY: region.maxY
      }, options);
      candidates = this.normalizeResults(rawCandidates);
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
          // ADR-130: Centralized default layer
          layer: getLayerNameOrDefault('layer' in candidate.data ? (candidate.data as { layer?: string }).layer : undefined),
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
      const rawResults = this.spatialIndex.queryBounds(viewportBounds, options);
      return this.normalizeResults(rawResults).map(result => result.data);
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
  private linearHitTest(point: Point2D, tolerance: number, options: HitTestOptions): SpatialQueryResult<Entity>[] {
    const results: SpatialQueryResult<Entity>[] = [];

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
  private linearRegionTest(region: BoundingBox, options: HitTestOptions): SpatialQueryResult<Entity>[] {
    const results: SpatialQueryResult<Entity>[] = [];

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
  private analyzeHit(candidate: SpatialQueryResult<Entity>, point: Point2D, tolerance: number, options: HitTestOptions): HitTestResult | null {
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
      // ADR-130: Centralized default layer
      layer: getLayerNameOrDefault(entity.layer),
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
      // 🏢 ENTERPRISE FIX (2026-02-01): Rectangles need special handling
      // RectangleEntity has x,y,width,height - NOT vertices
      case 'rectangle':
      case 'rect':
        return this.hitTestRectangle(entity, point, tolerance);
      // 🏢 FIX (2026-02-20): Precise text hit-test — rotation-aware bounding box
      // BEFORE: text/mtext fell through to default → any spatial index candidate accepted
      // This caused text to highlight from huge distances (especially with inflated bounds)
      case 'text':
      case 'mtext':
        return this.hitTestText(entity, point, tolerance);
      // 🏢 ENTERPRISE (2026-02-15): Angle measurement hit-test — test both arm segments
      case 'arc':
        return this.hitTestArc(entity, point, tolerance);
      case 'angle-measurement':
        return this.hitTestAngleMeasurement(entity, point, tolerance);
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

    // 🏢 ADR-109: Use centralized distance calculation
    const distanceFromCenter = calculateDistance(point, center);

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

  /**
   * 🏢 ENTERPRISE (2026-02-21): Arc hit testing
   * Uses centralized pointToArcDistance — handles angular range + distance from circumference.
   */
  private hitTestArc(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    if (!('center' in entity) || !('radius' in entity) || !('startAngle' in entity) || !('endAngle' in entity)) {
      return null;
    }
    const arcEntity = entity as { center: Point2D; radius: number; startAngle: number; endAngle: number };

    const distance = pointToArcDistance(point, arcEntity);
    if (distance <= tolerance) {
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
    const polylineEntity = entity as { vertices: Point2D[]; closed?: boolean };
    const vertices = polylineEntity.vertices;
    if (!vertices || vertices.length < 2) return null;

    // Test edge proximity (all segments including closing edge for closed polylines)
    const edgeCount = polylineEntity.closed ? vertices.length : vertices.length - 1;
    for (let i = 0; i < edgeCount; i++) {
      const nextIndex = (i + 1) % vertices.length;
      const distance = pointToLineDistance(point, vertices[i], vertices[nextIndex]);

      if (distance <= tolerance) {
        return {
          hitType: 'entity',
          hitPoint: this.closestPointOnLine(point, vertices[i], vertices[nextIndex]),
          edgeIndex: i
        };
      }
    }

    // 🏢 ENTERPRISE (2026-02-15): For closed polylines (area measurements), also detect
    // cursor inside the polygon body — not just near edges
    if (polylineEntity.closed && vertices.length >= 3 && isPointInPolygon(point, vertices)) {
      return {
        hitType: 'entity',
        hitPoint: point
      };
    }

    return null;
  }

  /**
   * 🏢 ENTERPRISE FIX (2026-02-01): Rectangle hit testing
   * Rectangles have x,y,width,height - NOT vertices property
   * We compute 4 vertices and test all 4 edges of the closed rectangle
   */
  private hitTestRectangle(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    // ✅ Type-safe property access for rectangle
    if (!('x' in entity) || !('y' in entity) || !('width' in entity) || !('height' in entity)) {
      return null;
    }

    const rect = entity as { x: number; y: number; width: number; height: number };

    // 🏢 Compute 4 vertices from rectangle dimensions
    // Vertex order: top-left, top-right, bottom-right, bottom-left (clockwise)
    const vertices: Point2D[] = [
      { x: rect.x, y: rect.y },                           // Top-left
      { x: rect.x + rect.width, y: rect.y },              // Top-right
      { x: rect.x + rect.width, y: rect.y + rect.height }, // Bottom-right
      { x: rect.x, y: rect.y + rect.height }              // Bottom-left
    ];

    // Test all 4 edges (including closing edge from last to first vertex)
    for (let i = 0; i < 4; i++) {
      const nextIndex = (i + 1) % 4;
      const distance = pointToLineDistance(point, vertices[i], vertices[nextIndex]);

      if (distance <= tolerance) {
        return {
          hitType: 'entity',
          hitPoint: this.closestPointOnLine(point, vertices[i], vertices[nextIndex]),
          edgeIndex: i
        };
      }
    }

    return null;
  }

  /**
   * 🏢 FIX (2026-02-20): Precise text/mtext hit testing
   * Rotation-aware bounding box check — same logic as TextRenderer.hitTest().
   *
   * BEFORE: text/mtext fell through to generic default (always accepted if in spatial index).
   * Combined with inflated spatial index bounds (fontSize fallback = 12 vs actual height = 2.5),
   * this caused texts to highlight from huge distances.
   *
   * AFTER: Proper width/height estimation, rotation transform, and tolerance-aware AABB check.
   */
  private hitTestText(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    if (!('position' in entity) || !('text' in entity)) return null;

    const position = entity.position as Point2D;
    const text = entity.text as string;
    if (!position || !text) return null;

    // Height priority chain matching TextRenderer.extractTextHeight() and Bounds.calculateTextBounds()
    const height = ('height' in entity && typeof entity.height === 'number' && entity.height > 0)
      ? entity.height as number
      : ('fontSize' in entity && typeof entity.fontSize === 'number' && entity.fontSize > 0)
        ? entity.fontSize as number
        : 2.5; // AutoCAD Standard DIMTXT default

    const rotation = ('rotation' in entity && typeof entity.rotation === 'number')
      ? entity.rotation as number
      : 0;

    // 🏢 ADR-107: Width estimation matching Bounds.ts and TextRenderer.ts
    const width = text.length * height * TEXT_METRICS_RATIOS.CHAR_WIDTH_MONOSPACE;

    // Rotation-aware hit test: transform test point into text's local coordinate system
    let testPoint = point;
    if (rotation !== 0) {
      const rad = degToRad(-rotation); // Inverse rotation: world → local
      const dx = point.x - position.x;
      const dy = point.y - position.y;
      testPoint = {
        x: position.x + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: position.y + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    }

    // Axis-aligned bounding box check in local coordinates
    const minX = position.x;
    const maxX = position.x + width;
    const minY = position.y - height;
    const maxY = position.y;

    if (testPoint.x >= minX - tolerance &&
        testPoint.x <= maxX + tolerance &&
        testPoint.y >= minY - tolerance &&
        testPoint.y <= maxY + tolerance) {
      return {
        hitType: 'entity',
        hitPoint: point
      };
    }

    return null;
  }

  /**
   * 🏢 ENTERPRISE (2026-02-15): Angle measurement hit testing
   * AngleMeasurementEntity has vertex (center), point1, point2 — two arm segments
   * Hit if cursor is near either arm (vertex→point1 or vertex→point2)
   */
  private hitTestAngleMeasurement(entity: Entity, point: Point2D, tolerance: number): Partial<HitTestResult> | null {
    // ✅ Type-safe property access for angle measurement
    if (!('vertex' in entity) || !('point1' in entity) || !('point2' in entity)) {
      return null;
    }
    const angleMeasurement = entity as { vertex: Point2D; point1: Point2D; point2: Point2D };

    // Test arm 1: vertex → point1
    const distArm1 = pointToLineDistance(point, angleMeasurement.vertex, angleMeasurement.point1);
    if (distArm1 <= tolerance) {
      return {
        hitType: 'entity',
        hitPoint: this.closestPointOnLine(point, angleMeasurement.vertex, angleMeasurement.point1)
      };
    }

    // Test arm 2: vertex → point2
    const distArm2 = pointToLineDistance(point, angleMeasurement.vertex, angleMeasurement.point2);
    if (distArm2 <= tolerance) {
      return {
        hitType: 'entity',
        hitPoint: this.closestPointOnLine(point, angleMeasurement.vertex, angleMeasurement.point2)
      };
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

  private normalizeResults(results: SpatialQueryResult[]): SpatialQueryResult<Entity>[] {
    return results
      .map(result => this.normalizeResult(result))
      .filter((result): result is SpatialQueryResult<Entity> => Boolean(result));
  }

  private normalizeResult(result: SpatialQueryResult): SpatialQueryResult<Entity> | null {
    const directEntity = this.isEntity(result.data) ? result.data : null;
    const itemEntity = !directEntity && this.isEntity(result.item?.data) ? result.item.data : null;
    const entity = directEntity ?? itemEntity;
    if (!entity) return null;

    return {
      ...result,
      data: entity,
      item: {
        ...result.item,
        data: entity
      }
    };
  }

  private isEntity(value: unknown): value is Entity {
    if (!value || typeof value !== 'object') return false;
    if (!('id' in value) || !('type' in value)) return false;
    return typeof (value as { id?: unknown }).id === 'string';
  }
}

/**
 * 🔺 FACTORY FUNCTION
 */
export function createHitTester(entities: Entity[] = [], useSpatialIndex = true): HitTester {
  return new HitTester(entities, useSpatialIndex);
}
