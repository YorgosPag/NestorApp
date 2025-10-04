/**
 * Selection duplicate patterns utilities
 * Consolidates the most common duplicate patterns in selection system
 */

import type { EntityModel } from '../../../rendering/types/Types';
import type { Point2D } from '../../../rendering/types/Types';
import type { AnySceneEntity } from '../../../types/scene';
import { calculateVerticesBounds } from '../../../utils/geometry/GeometryUtils';

/**
 * Calculate bounding box for entities
 */
export function calculateBoundingBox(entities: EntityModel[]): {
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
    // Extract bounds from different entity types
    if (entity.type === 'line') {
      const start = entity.start as Point2D;
      const end = entity.end as Point2D;
      if (start && end) {
        minX = Math.min(minX, start.x, end.x);
        minY = Math.min(minY, start.y, end.y);
        maxX = Math.max(maxX, start.x, end.x);
        maxY = Math.max(maxY, start.y, end.y);
      }
    } else if (entity.type === 'circle') {
      const center = entity.center as Point2D;
      const radius = entity.radius as number;
      if (center && radius) {
        minX = Math.min(minX, center.x - radius);
        minY = Math.min(minY, center.y - radius);
        maxX = Math.max(maxX, center.x + radius);
        maxY = Math.max(maxY, center.y + radius);
      }
    } else if (entity.type === 'rectangle') {
      const topLeft = entity.topLeft as Point2D;
      const width = entity.width as number;
      const height = entity.height as number;
      if (topLeft && width && height) {
        minX = Math.min(minX, topLeft.x);
        minY = Math.min(minY, topLeft.y);
        maxX = Math.max(maxX, topLeft.x + width);
        maxY = Math.max(maxY, topLeft.y + height);
      }
    }
  });

  return { minX, minY, maxX, maxY };
}

/**
 * Check if point is inside bounding rectangle
 */
export function isPointInBounds(
  point: Point2D,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return point.x >= bounds.minX && 
         point.x <= bounds.maxX && 
         point.y >= bounds.minY && 
         point.y <= bounds.maxY;
}

/**
 * Filter entities by visibility and layer status
 */
export function filterVisibleEntities(entities: EntityModel[]): EntityModel[] {
  return entities.filter(entity => {
    // Check if entity itself is visible
    if (entity.visible === false) return false;
    
    // Additional layer checks can be added here
    return true;
  });
}

/**
 * Standard entity selection validation pattern
 */
export function isEntitySelectable(
  entity: EntityModel,
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
    case 'rectangle':
    case 'rect': {
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