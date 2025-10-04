/**
 * Shared grip utilities for renderers
 */

import type { GripInfo } from '../../types/Types';
import type { Point2D } from '../../types/Types';

/**
 * Creates grip info objects from an array of points
 * @param entityId - The entity ID
 * @param points - Array of grip positions
 * @param startIndex - Starting grip index (default: 1)
 * @returns Array of grip info objects
 */
export function createGripsFromPoints(
  entityId: string, 
  points: Point2D[], 
  startIndex: number = 1
): GripInfo[] {
  const grips: GripInfo[] = [];
  
  points.forEach((point, index) => {
    grips.push({
      entityId,
      gripType: 'vertex',
      gripIndex: index + startIndex,
      position: point,
      state: 'cold'
    });
  });
  
  return grips;
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΔΗΜΙΟΥΡΓΊΑ CENTER GRIP - για όλα τα circular entities
 */
export function createCenterGrip(entityId: string, center: Point2D, gripIndex: number = 0): GripInfo {
  return {
    entityId,
    gripType: 'center',
    gripIndex,
    position: center,
    state: 'cold'
  };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΔΗΜΙΟΥΡΓΊΑ VERTEX GRIP
 */
export function createVertexGrip(entityId: string, position: Point2D, gripIndex: number): GripInfo {
  return {
    entityId,
    gripType: 'vertex',
    gripIndex,
    position,
    state: 'cold'
  };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΔΗΜΙΟΥΡΓΊΑ EDGE GRIP
 */
export function createEdgeGrip(entityId: string, position: Point2D, gripIndex: number): GripInfo {
  return {
    entityId,
    gripType: 'edge',
    gripIndex,
    position,
    state: 'cold'
  };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΔΗΜΙΟΥΡΓΊΑ ARC GRIPS PATTERN
 * Κοινό pattern για arc entities (center + start + end + mid)
 */
export function createArcGripPattern(
  entityId: string, 
  center: Point2D, 
  startPoint: Point2D, 
  endPoint: Point2D, 
  midPoint: Point2D
): GripInfo[] {
  return [
    createCenterGrip(entityId, center, 0),
    createVertexGrip(entityId, startPoint, 1),
    createVertexGrip(entityId, endPoint, 2), 
    createEdgeGrip(entityId, midPoint, 3)
  ];
}