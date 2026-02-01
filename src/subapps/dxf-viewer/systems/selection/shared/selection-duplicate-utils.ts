/**
 * Selection duplicate patterns utilities
 * Consolidates the most common duplicate patterns in selection system
 */

import type { Entity, LineEntity, CircleEntity, RectangleEntity } from '../../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isLineEntity, isCircleEntity, isRectangleEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { AnySceneEntity } from '../../../types/scene';
import { calculateVerticesBounds } from '../../../utils/geometry/GeometryUtils';
// 🏢 ADR-089: Centralized Point-In-Bounds
import { SpatialUtils } from '../../../core/spatial/SpatialUtils';

/**
 * Calculate bounding box for entities
 * ✅ ENTERPRISE FIX: Uses proper Entity type with type narrowing for type safety
 */
export function calculateBoundingBox(entities: Entity[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (entities.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  entities.forEach(entity => {
    // Extract bounds from different entity types using type narrowing
    // 🏢 ADR-102: Use centralized type guards
    if (isLineEntity(entity)) {
      const lineEntity = entity as LineEntity;
      const { start, end } = lineEntity;
      if (start && end) {
        minX = Math.min(minX, start.x, end.x);
        minY = Math.min(minY, start.y, end.y);
        maxX = Math.max(maxX, start.x, end.x);
        maxY = Math.max(maxY, start.y, end.y);
      }
    } else if (isCircleEntity(entity)) {
      const circleEntity = entity as CircleEntity;
      const { center, radius } = circleEntity;
      if (center && radius !== undefined) {
        minX = Math.min(minX, center.x - radius);
        minY = Math.min(minY, center.y - radius);
        maxX = Math.max(maxX, center.x + radius);
        maxY = Math.max(maxY, center.y + radius);
      }
    } else if (isRectangleEntity(entity)) {
      const rectEntity = entity as RectangleEntity;
      const { x, y, width, height } = rectEntity;
      if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
      }
    }
  });

  return { minX, minY, maxX, maxY };
}

/**
 * Check if point is inside bounding rectangle
 * 🏢 ADR-089: Wrapper για SpatialUtils.pointInBounds() - Single Source of Truth
 * @deprecated Prefer using SpatialUtils.pointInBounds() directly for new code
 */
export function isPointInBounds(
  point: Point2D,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return SpatialUtils.pointInBounds(point, bounds);
}

/**
 * Filter entities by visibility and layer status
 * ✅ ENTERPRISE FIX: Uses proper Entity type for type safety
 */
export function filterVisibleEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => {
    // Check if entity itself is visible
    if (entity.visible === false) return false;

    // Additional layer checks can be added here
    return true;
  });
}

/**
 * Standard entity selection validation pattern
 * ✅ ENTERPRISE FIX: Uses proper Entity type for type safety
 */
export function isEntitySelectable(
  entity: Entity,
  selectionCriteria?: {
    types?: string[];
    excludeIds?: string[];
    visibleOnly?: boolean;
  }
): boolean {
  const criteria = selectionCriteria || {};
  
  // Check type filter
  if (criteria.types && !criteria.types.includes(entity.type)) {
    return false;
  }
  
  // Check exclusion list
  if (criteria.excludeIds && criteria.excludeIds.includes(entity.id)) {
    return false;
  }
  
  // Check visibility
  if (criteria.visibleOnly !== false && entity.visible === false) {
    return false;
  }
  
  return true;
}

// 🗑️ REMOVED: calculateVerticesBounds method - now using centralized version from GeometryUtils
// Import: import { calculateVerticesBounds } from '../../../utils/geometry/GeometryUtils';

/**
 * Create rectangle vertices from corners - eliminates duplicate logic
 */
export function createRectangleVertices(corner1: Point2D, corner2: Point2D): Point2D[] {
  return [
    corner1,
    { x: corner2.x, y: corner1.y },
    corner2,
    { x: corner1.x, y: corner2.y }
  ];
}

/**
 * Unified entity bounds calculation - eliminates duplicate bounds logic
 */
export function calculateEntityBounds(entity: AnySceneEntity): { min: Point2D, max: Point2D } | null {
  switch(entity.type) {
    case 'line':
      return {
        min: { x: Math.min(entity.start.x, entity.end.x), y: Math.min(entity.start.y, entity.end.y) },
        max: { x: Math.max(entity.start.x, entity.end.x), y: Math.max(entity.start.y, entity.end.y) }
      };
    case 'circle':
      return {
        min: { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius },
        max: { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius }
      };
    case 'polyline':
      return calculateVerticesBounds(entity.vertices);
    case 'rectangle': {
      // Handle both corner-based and vertex-based rectangles
      let vertices: Point2D[] | undefined = ('vertices' in entity ? entity.vertices as Point2D[] : undefined);
      if (!vertices || vertices.length === 0) {
        const corner1 = ('corner1' in entity ? entity.corner1 : 'start' in entity ? entity.start : undefined) as Point2D | undefined;
        const corner2 = ('corner2' in entity ? entity.corner2 : 'end' in entity ? entity.end : undefined) as Point2D | undefined;
        if (corner1 && corner2) {
          vertices = createRectangleVertices(corner1, corner2);
        }
      }
      return vertices ? calculateVerticesBounds(vertices) : null;
    }
    case 'angle-measurement': {
      const vertex = ('vertex' in entity ? entity.vertex : undefined) as Point2D | undefined;
      const point1 = ('point1' in entity ? entity.point1 : undefined) as Point2D | undefined;
      const point2 = ('point2' in entity ? entity.point2 : undefined) as Point2D | undefined;
      
      if (!vertex || !point1 || !point2) return null;
      
      const minX = Math.min(vertex.x, point1.x, point2.x);
      const minY = Math.min(vertex.y, point1.y, point2.y);
      const maxX = Math.max(vertex.x, point1.x, point2.x);
      const maxY = Math.max(vertex.y, point1.y, point2.y);
      
      return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
    }
    default:
      return null;
  }
}