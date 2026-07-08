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
      id: `${entityId}-vertex-${index + startIndex}`,
      entityId,
      type: 'vertex',
      gripIndex: index + startIndex,
      position: point,
      isVisible: true
    });
  });
  
  return grips;
}

/**
 * 🔺 ADR-559 — ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΔΗΜΙΟΥΡΓΙΑ QUADRANT GRIPS (circle/ellipse cardinal points).
 * Same shape as `createGripsFromPoints` but tags the grips as `'quadrant'` so the «Εμφάνιση
 * Quadrants» toggle can gate them via `isGripTypeVisible` — without affecting real polyline vertices.
 */
export function createQuadrantGrips(
  entityId: string,
  points: Point2D[],
  startIndex: number = 1
): GripInfo[] {
  return points.map((position, index) => ({
    id: `${entityId}-quadrant-${index + startIndex}`,
    entityId,
    type: 'quadrant' as const,
    gripIndex: index + startIndex,
    position,
    isVisible: true,
  }));
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΔΗΜΙΟΥΡΓΊΑ CENTER GRIP - για όλα τα circular entities
 */
export function createCenterGrip(entityId: string, center: Point2D, gripIndex: number = 0): GripInfo {
  return {
    id: `${entityId}-center-${gripIndex}`,
    entityId,
    type: 'center',
    gripIndex,
    position: center,
    isVisible: true
  };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΔΗΜΙΟΥΡΓΊΑ VERTEX GRIP
 */
export function createVertexGrip(entityId: string, position: Point2D, gripIndex: number): GripInfo {
  return {
    id: `${entityId}-vertex-${gripIndex}`,
    entityId,
    type: 'vertex',
    gripIndex,
    position,
    isVisible: true
  };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗ ΔΗΜΙΟΥΡΓΊΑ EDGE GRIP
 */
export function createEdgeGrip(entityId: string, position: Point2D, gripIndex: number): GripInfo {
  return {
    id: `${entityId}-edge-${gripIndex}`,
    entityId,
    type: 'edge',
    gripIndex,
    position,
    isVisible: true
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

/**
 * ADR-561/583 — Domain grip (getArcGrips / getAnnotationSymbolGrips / getLineGrips)
 * → render `GripInfo` (SSoT for the entity renderers' `getGrips`). The `shape` is
 * resolved at the call-site via `gripGlyphShape(g.<x>GripKind)` — the grip-kind
 * field name differs per entity type — and passed in, so the common object shape
 * lives here once instead of being copy-pasted per renderer.
 */
export function toRenderGripInfo(
  grip: { entityId: string; gripIndex: number; type: GripInfo['type']; position: Point2D },
  shape: GripInfo['shape'],
): GripInfo {
  return {
    id: `${grip.entityId}-grip-${grip.gripIndex}`,
    entityId: grip.entityId,
    type: grip.type,
    gripIndex: grip.gripIndex,
    position: grip.position,
    isVisible: true,
    shape,
  };
}