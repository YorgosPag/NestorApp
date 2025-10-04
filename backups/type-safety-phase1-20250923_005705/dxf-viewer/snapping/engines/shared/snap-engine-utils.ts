/**
 * Snap engine utilities
 * Consolidates duplicate patterns across snap engines
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_ENGINE_UTILS = false;

import type { Point2D } from '../../../systems/rulers-grid/config';
import type { SnapCandidate, SnapConfig } from '../../types';
import type { EntityModel } from '../../../types/renderer';
import { GeometricCalculations } from '../../shared/GeometricCalculations';

/**
 * Create snap candidate with standard format
 */
export function createSnapCandidate(
  point: Point2D,
  config: SnapConfig,
  sourceEntity?: EntityModel
): SnapCandidate {
  return {
    position: point,
    type: config.snapType,
    description: config.displayName,
    entityId: sourceEntity?.id,
    priority: config.priority || 0
  };
}

/**
 * Check if point is within snap tolerance
 */
export function isWithinTolerance(
  point1: Point2D,
  point2: Point2D,
  tolerance: number
): boolean {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= tolerance;
}

/**
 * Filter valid entities for snapping
 */
export function filterValidEntities(
  entities: EntityModel[],
  excludeEntityId?: string
): EntityModel[] {
  // Guard against non-iterable entities
  if (!Array.isArray(entities)) {
    if (DEBUG_SNAP_ENGINE_UTILS) console.warn('[filterValidEntities] entities is not an array:', typeof entities, entities);
    return [];
  }
  
  return entities.filter(entity => {
    // Skip if this is the entity being excluded
    if (excludeEntityId && entity.id === excludeEntityId) {
      return false;
    }
    
    // Skip if entity is not visible
    if (entity.visible === false) {
      return false;
    }
    
    return true;
  });
}

/**
 * Calculate perpendicular foot point on line
 */
export function getPerpendicularFoot(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D
): Point2D {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return { ...lineStart };
  }
  
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  
  return {
    x: lineStart.x + t * dx,
    y: lineStart.y + t * dy
  };
}

/**
 * Check if point lies on line segment
 */
import { TOLERANCE_CONFIG } from '../../../config/tolerance-config';

export function isPointOnSegment(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
  tolerance = TOLERANCE_CONFIG.SNAP_PRECISION
): boolean {
  const minX = Math.min(lineStart.x, lineEnd.x) - tolerance;
  const maxX = Math.max(lineStart.x, lineEnd.x) + tolerance;
  const minY = Math.min(lineStart.y, lineEnd.y) - tolerance;
  const maxY = Math.max(lineStart.y, lineEnd.y) + tolerance;
  
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

/**
 * Sort candidates by distance to cursor
 */
export function sortCandidatesByDistance(
  candidates: SnapCandidate[],
  cursorPosition: Point2D
): SnapCandidate[] {
  return candidates.sort((a, b) => {
    const distA = Math.sqrt(
      (a.position.x - cursorPosition.x) ** 2 + 
      (a.position.y - cursorPosition.y) ** 2
    );
    const distB = Math.sqrt(
      (b.position.x - cursorPosition.x) ** 2 + 
      (b.position.y - cursorPosition.y) ** 2
    );
    return distA - distB;
  });
}

/**
 * Shared rectangle corner logic for snap engines
 */
export function processRectangleSnapping(
  entity: any,
  pointProcessor: (corner: Point2D, index: number, type: string) => void
): void {
  if (entity.corner1 && entity.corner2) {
    const corners = GeometricCalculations.getRectangleCorners(entity);
    corners.forEach((corner, index) => {
      pointProcessor(corner, index, `Corner ${index + 1}`);
    });
  }
}

/**
 * Shared candidate processing logic for snap engines
 */
export function processSnapCandidates<T>(
  points: Array<{point: Point2D, type: string}>,
  cursorPoint: Point2D,
  radius: number,
  context: any,
  entity: any,
  createCandidateFunc: (point: Point2D, label: string, distance: number, priority: number, entityId: string) => T,
  labelPrefix: string,
  priority: number
): T[] {
  const candidates: T[] = [];
  
  for (const pointData of points) {
    // Calculate distance from cursor
    const dx = cursorPoint.x - pointData.point.x;
    const dy = cursorPoint.y - pointData.point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= radius) {
      const candidate = createCandidateFunc(
        pointData.point,
        `${labelPrefix} (${pointData.type})`,
        distance,
        priority,
        entity.id
      );
      
      candidates.push(candidate);
      
      if (candidates.length >= context.maxCandidates) break;
    }
  }
  
  return candidates;
}

/**
 * Standard snap candidate type for compatibility
 */
export interface StandardSnapCandidate {
  point: Point2D;
  distance: number;
  priority: number;
  entityId: string;
  label: string;
}

/**
 * Find standard snap candidates - compatibility function for snap engines
 */
export function findStandardSnapCandidates(
  cursorPoint: Point2D,
  entities: any[],
  radius: number,
  context: any,
  getPointsFunc: (entity: any) => Point2D[],
  labelPrefix = 'Snap'
): StandardSnapCandidate[] {
  const candidates: StandardSnapCandidate[] = [];
  
  // Guard against non-iterable entities
  if (!Array.isArray(entities)) {
    if (DEBUG_SNAP_ENGINE_UTILS) console.warn('[findStandardSnapCandidates] entities is not an array:', entities);
    return candidates;
  }
  
  for (const entity of entities) {
    if (!entity || entity.visible === false) continue;
    
    const points = getPointsFunc(entity);
    for (const point of points) {
      const dx = cursorPoint.x - point.x;
      const dy = cursorPoint.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= radius) {
        candidates.push({
          point,
          distance,
          priority: 0,
          entityId: entity.id || 'unknown',
          label: labelPrefix
        });
        
        if (candidates.length >= (context?.maxCandidates || 10)) break;
      }
    }
  }
  
  return candidates.sort((a, b) => a.distance - b.distance);
}