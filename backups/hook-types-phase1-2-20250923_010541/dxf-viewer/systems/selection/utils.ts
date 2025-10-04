/**
 * SELECTION SYSTEM UTILITIES
 * Core entity selection logic for point, window, crossing, and lasso selection
 */

'use client';

import { coordTransforms, type Point2D, type ViewTransform } from '../rulers-grid/config';
import { type AnySceneEntity, type SceneLayer } from '../../types/scene';
import { pointToLineDistance } from '../../utils/geometry-utils';
import { calculateVerticesBounds, createRectangleVertices, calculateEntityBounds } from './shared/selection-duplicate-utils';
import { extractAngleMeasurementPoints } from '../../utils/renderers/shared/geometry-rendering-utils';

// Helper function to get rectangle vertices (eliminates code duplication)
export function getRectangleVertices(entity: any): Point2D[] | null {
  let vertices: Point2D[] | undefined = entity.vertices as Point2D[];
  
  // If no vertices, try to create from corners
  if (!vertices || vertices.length === 0) {
    const corner1 = entity.corner1 || entity.start;
    const corner2 = entity.corner2 || entity.end;
    
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
    entities: AnySceneEntity[],
    layers: Record<string, SceneLayer>,
    transform: ViewTransform,
    canvasRect: DOMRect,
    tolerance: number = 8
  ): { entityId: string, entity: AnySceneEntity } | null {

    const worldPoint = coordTransforms.screenToWorld(screenPoint, transform, canvasRect);
    const toleranceInWorld = tolerance / transform.scale;
    
    // Iterate backwards to find topmost entity
    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i];
      const layer = layers[entity.layer];
      
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
    entities: AnySceneEntity[],
    transform: ViewTransform,
    canvasRect: DOMRect
  ): string[] {
    const marqueeWorldStart = coordTransforms.screenToWorld(startPoint, transform, canvasRect);
    const marqueeWorldEnd = coordTransforms.screenToWorld(endPoint, transform, canvasRect);
    
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
    entities: AnySceneEntity[],
    transform: ViewTransform,
    canvasRect: DOMRect
  ): string[] {
    if (lassoPoints.length < 3) return [];
    
    const worldLassoPoints = lassoPoints.map(p => coordTransforms.screenToWorld(p, transform, canvasRect));

    const selectedIds: string[] = [];
    
    for (const entity of entities) {
      const entityCenter = this.getEntityCenter(entity);
      if (entityCenter && this.isPointInPolygon(entityCenter, worldLassoPoints)) {
        selectedIds.push(entity.id);
      }
    }
    
    return selectedIds;
  }
  
  // --- PRIVATE HELPER METHODS ---

  private static isPointNearEntity(point: Point2D, entity: AnySceneEntity, tolerance: number): boolean {
    switch (entity.type) {
      case 'line':
        return pointToLineDistance(point, entity.start, entity.end) <= tolerance;
      case 'circle': {
        const distToCenter = Math.hypot(point.x - entity.center.x, point.y - entity.center.y);
        return Math.abs(distToCenter - entity.radius) <= tolerance;
      }
      case 'polyline':
        for (let i = 0; i < entity.vertices.length - 1; i++) {
          if (pointToLineDistance(point, entity.vertices[i], entity.vertices[i + 1]) <= tolerance) {
            return true;
          }
        }
        if (entity.closed && entity.vertices.length > 1) {
          if (pointToLineDistance(point, entity.vertices[entity.vertices.length - 1], entity.vertices[0]) <= tolerance) {
            return true;
          }
        }
        return false;
      case 'rectangle':
      case 'rect': {
        const vertices = getRectangleVertices(entity as any);
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
        const angleMeasurement = extractAngleMeasurementPoints(entity);
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

  private static getEntityBounds(entity: AnySceneEntity): { min: Point2D, max: Point2D } | null {
    // Use unified bounds calculation to eliminate duplication
    return calculateEntityBounds(entity);
  }

  private static entityIntersectsBounds(entity: AnySceneEntity, bounds: { min: Point2D, max: Point2D }): boolean {
    const entityBounds = this.getEntityBounds(entity);
    if (!entityBounds) return false;

    return !(
        entityBounds.max.x < bounds.min.x ||
        entityBounds.min.x > bounds.max.x ||
        entityBounds.max.y < bounds.min.y ||
        entityBounds.min.y > bounds.max.y
    );
  }

  private static isEntityFullyInsideBounds(entity: AnySceneEntity, bounds: { min: Point2D, max: Point2D }): boolean {
    const entityBounds = this.getEntityBounds(entity);
    if (!entityBounds) return false;

    return (
        entityBounds.min.x >= bounds.min.x &&
        entityBounds.max.x <= bounds.max.x &&
        entityBounds.min.y >= bounds.min.y &&
        entityBounds.max.y <= bounds.max.y
    );
  }

  private static getEntityCenter(entity: AnySceneEntity): Point2D | null {
    const bounds = this.getEntityBounds(entity);
    if (!bounds) return null;
    return {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2
    };
  }

  private static isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
  }
}

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