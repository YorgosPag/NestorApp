/**
 * SELECTION SYSTEM UTILITIES
 * Core entity selection logic for point, window, crossing, and lasso selection
 */

'use client';

// ✅ ΦΑΣΗ 7: Use unified coordinate transforms
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { type SceneLayer } from '../../types/scene';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import {
  isLineEntity,
  isCircleEntity,
  isPolylineEntity,
  isRectangleEntity,
  isAngleMeasurementEntity,
  type Entity
} from '../../types/entities';
// ADR-130: Centralized Default Layer Name
import { getLayerNameOrDefault } from '../../config/layer-config';
// 🏢 ADR-358 Phase 9D-3: id-first reader SSoT
import { resolveEntityLayerName } from '../../stores/LayerStore';
import { createRectangleVertices, calculateEntityBounds } from './shared/selection-duplicate-utils';
import { extractAngleMeasurementPoints } from '../../rendering/entities/shared/geometry-rendering-utils';
import { isPointInPolygon, segmentsIntersect } from '../../utils/geometry/GeometryUtils';

// Helper function to get rectangle vertices (eliminates code duplication)
export function getRectangleVertices(entity: Entity): Point2D[] | null {
  // ✅ ENTERPRISE FIX: Use type guards to safely access entity properties
  let vertices: Point2D[] | undefined;

  // Check if entity has vertices (polyline or rectangle with vertices)
  if (isPolylineEntity(entity)) {
    vertices = entity.vertices;
  } else if (isRectangleEntity(entity)) {
    // Try to get vertices from rectangle entity or create from corners
    const rectEntity = entity; // Now properly typed as RectangleEntity
    vertices = rectEntity.corner1 && rectEntity.corner2
      ? createRectangleVertices(rectEntity.corner1, rectEntity.corner2)
      : undefined;
  } else if (isLineEntity(entity)) {
    // For line entities, try to create rectangle from start/end points
    const lineEntity = entity; // Now properly typed as LineEntity
    const corner1 = lineEntity.start;
    const corner2 = lineEntity.end;
    if (corner1 && corner2) {
      vertices = createRectangleVertices(corner1, corner2);
    }
  }

  return vertices && vertices.length >= 4 ? vertices : null;
}

/**
 * Enhanced Entity Selection Logic
 * Unified, efficient approach for all selection types
 */
export class UnifiedEntitySelection {
    
  /**
   * Finds the topmost entity at a given screen point.
   */
  static findEntityAtPoint(
    screenPoint: Point2D,
    entities: Entity[],
    layers: Record<string, SceneLayer>,
    transform: ViewTransform,
    canvasRect: DOMRect,
    tolerance: number = 8
  ): { entityId: string, entity: Entity } | null {

    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };
    const worldPoint = CoordinateTransforms.screenToWorld(screenPoint, transform, viewport);
    const toleranceInWorld = tolerance / transform.scale;
    
    // Iterate backwards to find topmost entity
    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i];
      // ADR-130: Centralized default layer
      // ADR-358 Phase 9D-3b: id-first via LayerStore, name fallback
      const layer = layers[getLayerNameOrDefault(resolveEntityLayerName(entity))];
      
      if (layer && !layer.visible) {
        continue;
      }
      
      if (this.isPointNearEntity(worldPoint, entity, toleranceInWorld)) {
        return { entityId: entity.id, entity };
      }
    }
    
    return null;
  }

  /**
   * Finds all entities within a rectangular marquee selection.
   */
  static findEntitiesInMarquee(
    startPoint: Point2D,
    endPoint: Point2D,
    entities: Entity[],
    transform: ViewTransform,
    canvasRect: DOMRect
  ): string[] {
    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };
    const marqueeWorldStart = CoordinateTransforms.screenToWorld(startPoint, transform, viewport);
    const marqueeWorldEnd = CoordinateTransforms.screenToWorld(endPoint, transform, viewport);
    
    const minX = Math.min(marqueeWorldStart.x, marqueeWorldEnd.x);
    const minY = Math.min(marqueeWorldStart.y, marqueeWorldEnd.y);
    const maxX = Math.max(marqueeWorldStart.x, marqueeWorldEnd.x);
    const maxY = Math.max(marqueeWorldStart.y, marqueeWorldEnd.y);

    const marqueeBounds = {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY }
    };
    
    // Window (L->R) vs Crossing (R->L) selection
    const isCrossing = startPoint.x > endPoint.x;
    
    const selectedIds: string[] = [];
    
    for (const entity of entities) {
      if (isCrossing) {
        // Crossing: select if any part of the entity is inside
        if (this.entityIntersectsBounds(entity, marqueeBounds)) {
          selectedIds.push(entity.id);
        }
      } else {
        // Window: select only if the entire entity is inside
        if (this.isEntityFullyInsideBounds(entity, marqueeBounds)) {
          selectedIds.push(entity.id);
        }
      }
    }
    
    return selectedIds;
  }
  
  /**
   * Finds entities inside a lasso (free-form polygon) selection.
   *
   * mode='window':   entity FULLY inside lasso polygon (all key points inside)
   * mode='crossing': entity INTERSECTS OR is inside (any key point inside OR
   *                  any entity segment crosses lasso boundary)
   */
  static findEntitiesInLasso(
    lassoPoints: Point2D[],
    entities: Entity[],
    transform: ViewTransform,
    canvasRect: DOMRect,
    mode: 'window' | 'crossing' = 'window'
  ): string[] {
    if (lassoPoints.length < 3) return [];

    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };
    const worldLasso = lassoPoints.map(p => CoordinateTransforms.screenToWorld(p, transform, viewport));

    const selectedIds: string[] = [];

    for (const entity of entities) {
      const keyPts = this.getEntityKeyPoints(entity);
      if (keyPts.length === 0) continue;

      if (mode === 'window') {
        if (keyPts.every(p => isPointInPolygon(p, worldLasso))) {
          selectedIds.push(entity.id);
        }
      } else {
        const anyInside = keyPts.some(p => isPointInPolygon(p, worldLasso));
        if (anyInside) {
          selectedIds.push(entity.id);
          continue;
        }
        const segs = this.getEntitySegments(entity);
        if (this.lassoIntersectsSegments(worldLasso, segs)) {
          selectedIds.push(entity.id);
        }
      }
    }

    return selectedIds;
  }

  private static lassoIntersectsSegments(
    lasso: Point2D[], segs: Array<[Point2D, Point2D]>,
  ): boolean {
    for (let i = 0; i < lasso.length; i++) {
      const la = lasso[i];
      const lb = lasso[(i + 1) % lasso.length];
      for (const [sa, sb] of segs) {
        if (segmentsIntersect(la, lb, sa, sb)) return true;
      }
    }
    return false;
  }

  /** Representative key points for window-mode testing. */
  private static getEntityKeyPoints(entity: Entity): Point2D[] {
    if (isLineEntity(entity)) {
      return [entity.start, entity.end];
    }
    if (isCircleEntity(entity)) {
      const { center, radius } = entity;
      const pts: Point2D[] = [center];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
      }
      return pts;
    }
    if (isPolylineEntity(entity)) return entity.vertices;
    if (isRectangleEntity(entity)) {
      const verts = getRectangleVertices(entity);
      return verts ?? [];
    }
    if (isAngleMeasurementEntity(entity)) {
      const pts = extractAngleMeasurementPoints(entity);
      if (!pts) return [];
      return [pts.vertex, pts.point1, pts.point2];
    }
    const center = this.getEntityCenter(entity);
    return center ? [center] : [];
  }

  /** Entity boundary segments for crossing-mode intersection test. */
  private static getEntitySegments(entity: Entity): Array<[Point2D, Point2D]> {
    if (isLineEntity(entity)) {
      return [[entity.start, entity.end]];
    }
    if (isCircleEntity(entity)) {
      const { center, radius } = entity;
      const N = 12;
      const segs: Array<[Point2D, Point2D]> = [];
      for (let i = 0; i < N; i++) {
        const a1 = (i / N) * Math.PI * 2;
        const a2 = ((i + 1) / N) * Math.PI * 2;
        segs.push([
          { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) },
          { x: center.x + radius * Math.cos(a2), y: center.y + radius * Math.sin(a2) },
        ]);
      }
      return segs;
    }
    if (isPolylineEntity(entity)) {
      const { vertices, closed } = entity;
      const segs: Array<[Point2D, Point2D]> = [];
      for (let i = 0; i < vertices.length - 1; i++) {
        segs.push([vertices[i], vertices[i + 1]]);
      }
      if (closed && vertices.length > 1) {
        segs.push([vertices[vertices.length - 1], vertices[0]]);
      }
      return segs;
    }
    if (isRectangleEntity(entity)) {
      const verts = getRectangleVertices(entity);
      if (!verts || verts.length < 4) return [];
      return [
        [verts[0], verts[1]], [verts[1], verts[2]],
        [verts[2], verts[3]], [verts[3], verts[0]],
      ];
    }
    if (isAngleMeasurementEntity(entity)) {
      const pts = extractAngleMeasurementPoints(entity);
      if (!pts) return [];
      return [[pts.vertex, pts.point1], [pts.vertex, pts.point2]];
    }
    return [];
  }
  
  // --- PRIVATE HELPER METHODS ---

  private static isPointNearEntity(point: Point2D, entity: Entity, tolerance: number): boolean {
    // ✅ ENTERPRISE FIX: Use type guards to safely access entity-specific properties
    switch (entity.type) {
      case 'line': {
        if (!isLineEntity(entity)) return false;
        const lineEntity = entity; // Now properly typed as LineEntity
        return pointToLineDistance(point, lineEntity.start, lineEntity.end) <= tolerance;
      }
      case 'circle': {
        if (!isCircleEntity(entity)) return false;
        const circleEntity = entity; // Now properly typed as CircleEntity
        const distToCenter = Math.hypot(point.x - circleEntity.center.x, point.y - circleEntity.center.y);
        return Math.abs(distToCenter - circleEntity.radius) <= tolerance;
      }
      case 'polyline': {
        if (!isPolylineEntity(entity)) return false;
        const polylineEntity = entity; // Now properly typed as PolylineEntity
        for (let i = 0; i < polylineEntity.vertices.length - 1; i++) {
          if (pointToLineDistance(point, polylineEntity.vertices[i], polylineEntity.vertices[i + 1]) <= tolerance) {
            return true;
          }
        }
        if (polylineEntity.closed && polylineEntity.vertices.length > 1) {
          if (pointToLineDistance(point, polylineEntity.vertices[polylineEntity.vertices.length - 1], polylineEntity.vertices[0]) <= tolerance) {
            return true;
          }
        }
        return false;
      }
      case 'rectangle': {
        const vertices = getRectangleVertices(entity);
        if (!vertices) return false;

        // Check each edge of the rectangle
        for (let i = 0; i < vertices.length; i++) {
          const next = (i + 1) % vertices.length;
          if (pointToLineDistance(point, vertices[i], vertices[next]) <= tolerance) {
            return true;
          }
        }
        return false;
      }
      case 'angle-measurement': {
        if (!isAngleMeasurementEntity(entity)) return false;
        const angleEntity = entity; // Now properly typed as AngleMeasurementEntity
        const angleMeasurement = extractAngleMeasurementPoints(angleEntity);
        if (!angleMeasurement) return false;

        const { vertex, point1, point2 } = angleMeasurement;

        // Check if point is near either line of the angle measurement
        return pointToLineDistance(point, vertex, point1) <= tolerance ||
               pointToLineDistance(point, vertex, point2) <= tolerance;
      }
      default:
        return false;
    }
  }

  private static getEntityBounds(entity: Entity): { min: Point2D, max: Point2D } | null {
    // Use unified bounds calculation to eliminate duplication
    return calculateEntityBounds(entity);
  }

  private static entityIntersectsBounds(entity: Entity, bounds: { min: Point2D, max: Point2D }): boolean {
    const entityBounds = this.getEntityBounds(entity);
    if (!entityBounds) return false;

    return !(
        entityBounds.max.x < bounds.min.x ||
        entityBounds.min.x > bounds.max.x ||
        entityBounds.max.y < bounds.min.y ||
        entityBounds.min.y > bounds.max.y
    );
  }

  private static isEntityFullyInsideBounds(entity: Entity, bounds: { min: Point2D, max: Point2D }): boolean {
    const entityBounds = this.getEntityBounds(entity);
    if (!entityBounds) return false;

    return (
        entityBounds.min.x >= bounds.min.x &&
        entityBounds.max.x <= bounds.max.x &&
        entityBounds.min.y >= bounds.min.y &&
        entityBounds.max.y <= bounds.max.y
    );
  }

  private static getEntityCenter(entity: Entity): Point2D | null {
    const bounds = this.getEntityBounds(entity);
    if (!bounds) return null;
    return {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2
    };
  }

  // 🗑️ REMOVED: isPointInPolygon method - now using centralized version from GeometryUtils
}

// 🔧 CLEAN: Marquee selection logic moved to UniversalMarqueeSelection.ts
// All marquee functionality is now centralized in one universal selector

// Additional selection utilities
export interface SelectionResult {
  entityIds: string[];
  selectionType: 'point' | 'window' | 'crossing' | 'lasso';
  bounds?: { min: Point2D, max: Point2D };
}

export function createSelectionResult(
  entityIds: string[],
  selectionType: SelectionResult['selectionType'],
  bounds?: { min: Point2D, max: Point2D }
): SelectionResult {
  return { entityIds, selectionType, bounds };
}

export function isValidSelection(result: SelectionResult): boolean {
  return result.entityIds.length > 0;
}