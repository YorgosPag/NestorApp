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
import { createRectangleVertices, calculateEntityBounds } from './shared/selection-duplicate-utils';
import { extractAngleMeasurementPoints } from '../../rendering/entities/shared/geometry-rendering-utils';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

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
      const layer = layers[getLayerNameOrDefault('layer' in entity ? entity.layer : '')];
      
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
   * Finds entities inside a lasso (polygon) selection.
   */
  static findEntitiesInLasso(
    lassoPoints: Point2D[],
    entities: Entity[],
    transform: ViewTransform,
    canvasRect: DOMRect
  ): string[] {
    if (lassoPoints.length < 3) return [];
    
    const viewport: Viewport = { width: canvasRect.width, height: canvasRect.height };
    const worldLassoPoints = lassoPoints.map(p => CoordinateTransforms.screenToWorld(p, transform, viewport));

    const selectedIds: string[] = [];
    
    for (const entity of entities) {
      const entityCenter = this.getEntityCenter(entity);
      if (entityCenter && isPointInPolygon(entityCenter, worldLassoPoints)) {
        selectedIds.push(entity.id);
      }
    }
    
    return selectedIds;
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