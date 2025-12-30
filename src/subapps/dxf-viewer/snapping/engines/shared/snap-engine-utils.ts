/**
 * Snap engine utilities
 * Consolidates duplicate patterns across snap engines
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_ENGINE_UTILS = false;

import type { Point2D } from '../../../rendering/types/Types';
import type { SnapCandidate, SnapConfig } from '../../extended-types';
import type { Entity, RectangleEntity } from '../../../types/entities';
import { GeometricCalculations } from '../../shared/GeometricCalculations';

// Legacy rectangle entity with corner1/corner2 properties
export interface LegacyRectangleEntity extends Entity {
  corner1?: Point2D;
  corner2?: Point2D;
  rotation?: number;
}

// Snap context interface
interface SnapContext {
  maxCandidates: number;
  lastPoint?: Point2D; // ✅ ENTERPRISE FIX: Added lastPoint για AISnappingEngine.ts
}

/**
 * Create snap candidate with standard format
 */
export function createSnapCandidate(
  point: Point2D,
  config: SnapConfig,
  sourceEntity?: Entity,
  distance = 0
): SnapCandidate {
  return {
    point: point,
    type: config.snapType,
    description: config.displayName,
    distance: distance,
    priority: config.priority || 0,
    entityId: sourceEntity?.id
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
  entities: Entity[],
  excludeEntityId?: string
): Entity[] {
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
      (a.point.x - cursorPosition.x) ** 2 +
      (a.point.y - cursorPosition.y) ** 2
    );
    const distB = Math.sqrt(
      (b.point.x - cursorPosition.x) ** 2 +
      (b.point.y - cursorPosition.y) ** 2
    );
    return distA - distB;
  });
}

/**
 * Shared rectangle corner logic for snap engines
 */
export function processRectangleSnapping(
  entity: LegacyRectangleEntity | RectangleEntity,
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
  context: SnapContext,
  entity: Entity,
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
 * Generic snap point interface
 */
export interface GenericSnapPoint {
  point: Point2D;
  type: string;
}

/**
 * Find standard snap candidates - compatibility function for snap engines
 */
export function findStandardSnapCandidates(
  cursorPoint: Point2D,
  entities: Entity[],
  radius: number,
  context: SnapContext,
  getPointsFunc: (entity: Entity) => Point2D[],
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
        
        if (candidates.length >= context.maxCandidates) break;
      }
    }
  }
  
  return candidates.sort((a, b) => a.distance - b.distance);
}

/**
 * Find entity-based snap candidates for snap engines
 */
export function findEntityBasedSnapCandidates(
  entities: Entity[],
  cursorPoint: Point2D,
  context: any,
  config: any,
  pointsGenerator: (entity: Entity, cursorPoint: Point2D, radius: number) => Point2D[]
): any {
  const candidates: any[] = [];
  const filteredEntities = filterValidEntities(entities);

  for (const entity of filteredEntities) {
    const points = pointsGenerator(entity, cursorPoint, context.snapRadius || 20);

    for (const point of points) {
      if (isWithinTolerance(cursorPoint, point, context.snapRadius || 20)) {
        candidates.push(createSnapCandidate(point, config, entity));
      }
    }
  }

  return {
    candidates: sortCandidatesByDistance(candidates, cursorPoint),
    hasResults: candidates.length > 0
  };
}

/**
 * Find circle-based snap candidates for snap engines
 */
export function findCircleBasedSnapCandidates(
  entities: Entity[],
  cursorPoint: Point2D,
  context: any,
  config: any,
  pointsGenerator: (center: Point2D, radius: number, entity: Entity) => Point2D[]
): any {
  const candidates: any[] = [];
  const filteredEntities = filterValidEntities(entities);

  for (const entity of filteredEntities) {
    // Handle circle and arc entities
    if (entity.type === 'circle' || entity.type === 'arc') {
      const center = (entity as any).center;
      const radius = (entity as any).radius;

      if (center && radius) {
        const points = pointsGenerator(center, radius, entity);

        for (const point of points) {
          if (isWithinTolerance(cursorPoint, point, context.snapRadius || 20)) {
            candidates.push(createSnapCandidate(point, config, entity));
          }
        }
      }
    }
  }

  return {
    candidates: sortCandidatesByDistance(candidates, cursorPoint),
    hasResults: candidates.length > 0
  };
}