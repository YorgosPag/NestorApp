/**
 * DXF GRIP COMPUTATION — PURE FUNCTIONS
 *
 * AutoCAD-style grip point computation from DXF entity geometry.
 * No React dependency — pure math functions.
 *
 * @module hooks/grip-computation
 * @see useDxfGripInteraction.ts (deprecated hook)
 * @see hooks/grips/useUnifiedGripInteraction (active replacement)
 */

import type { Point2D } from '../rendering/types/Types';
import type { DxfEntityUnion } from '../canvas-v2/dxf-canvas/dxf-types';
import type { GripInfo } from './useGripMovement';
import { calculateMidpoint } from '../rendering/entities/shared/geometry-utils';

// ============================================================================
// TYPES (still used by grips/ modules and CanvasLayerStack)
// ============================================================================

/** Interaction phase of the grip state machine */
export type GripPhase = 'idle' | 'hovering' | 'warm' | 'dragging';

/** Unique grip identifier for rendering pipeline */
export interface GripIdentifier {
  entityId: string;
  gripIndex: number;
}

/** Drag preview data for live rendering */
export interface DxfGripDragPreview {
  entityId: string;
  gripIndex: number;
  delta: Point2D;
  movesEntity: boolean;
  edgeVertexIndices?: [number, number];
}

/** Grip interaction state for rendering pipeline */
export interface DxfGripInteractionState {
  hoveredGrip?: GripIdentifier;
  activeGrip?: GripIdentifier;
}

/** Return type of useDxfGripInteraction */
export interface UseDxfGripInteractionReturn {
  gripInteractionState: DxfGripInteractionState;
  isDraggingGrip: boolean;
  /** @deprecated Use isDraggingGrip */
  isFollowingGrip: boolean;
  handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => boolean;
  handleGripMouseDown: (worldPos: Point2D) => boolean;
  handleGripMouseUp: (worldPos: Point2D) => boolean;
  /** @deprecated No-op in drag-release model */
  handleGripClick: (worldPos: Point2D) => boolean;
  handleGripEscape: () => boolean;
  handleGripRightClick: () => boolean;
  dragPreview: DxfGripDragPreview | null;
}

// ============================================================================
// PURE: Compute grips from DXF entity geometry
// ============================================================================

export function computeDxfEntityGrips(entity: DxfEntityUnion): GripInfo[] {
  const grips: GripInfo[] = [];

  switch (entity.type) {
    case 'line': {
      grips.push({
        entityId: entity.id, gripIndex: 0, type: 'vertex',
        position: entity.start, movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 1, type: 'vertex',
        position: entity.end, movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 2, type: 'edge',
        position: calculateMidpoint(entity.start, entity.end),
        movesEntity: false, edgeVertexIndices: [0, 1],
      });
      break;
    }

    case 'circle': {
      grips.push({
        entityId: entity.id, gripIndex: 0, type: 'center',
        position: entity.center, movesEntity: true,
      });
      const quadrants: Point2D[] = [
        { x: entity.center.x + entity.radius, y: entity.center.y },
        { x: entity.center.x, y: entity.center.y + entity.radius },
        { x: entity.center.x - entity.radius, y: entity.center.y },
        { x: entity.center.x, y: entity.center.y - entity.radius },
      ];
      quadrants.forEach((pos, i) => {
        grips.push({
          entityId: entity.id, gripIndex: i + 1, type: 'vertex',
          position: pos, movesEntity: false,
        });
      });
      break;
    }

    case 'polyline': {
      entity.vertices.forEach((v, i) => {
        grips.push({
          entityId: entity.id, gripIndex: i, type: 'vertex',
          position: v, movesEntity: false,
        });
      });
      const vLen = entity.vertices.length;
      const edgeCount = entity.closed ? vLen : vLen - 1;
      for (let i = 0; i < edgeCount; i++) {
        const next = (i + 1) % vLen;
        grips.push({
          entityId: entity.id, gripIndex: vLen + i, type: 'edge',
          position: calculateMidpoint(entity.vertices[i], entity.vertices[next]),
          movesEntity: false, edgeVertexIndices: [i, next],
        });
      }
      break;
    }

    case 'arc': {
      const startRad = (entity.startAngle * Math.PI) / 180;
      const endRad = (entity.endAngle * Math.PI) / 180;
      const midRad = (startRad + endRad) / 2;

      grips.push({
        entityId: entity.id, gripIndex: 0, type: 'center',
        position: entity.center, movesEntity: true,
      });
      grips.push({
        entityId: entity.id, gripIndex: 1, type: 'vertex',
        position: {
          x: entity.center.x + entity.radius * Math.cos(startRad),
          y: entity.center.y + entity.radius * Math.sin(startRad),
        },
        movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 2, type: 'vertex',
        position: {
          x: entity.center.x + entity.radius * Math.cos(endRad),
          y: entity.center.y + entity.radius * Math.sin(endRad),
        },
        movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 3, type: 'edge',
        position: {
          x: entity.center.x + entity.radius * Math.cos(midRad),
          y: entity.center.y + entity.radius * Math.sin(midRad),
        },
        movesEntity: true,
      });
      break;
    }

    case 'text': {
      grips.push({
        entityId: entity.id, gripIndex: 0, type: 'center',
        position: entity.position, movesEntity: true,
      });
      break;
    }

    case 'angle-measurement': {
      grips.push({
        entityId: entity.id, gripIndex: 0, type: 'vertex',
        position: entity.vertex, movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 1, type: 'vertex',
        position: entity.point1, movesEntity: false,
      });
      grips.push({
        entityId: entity.id, gripIndex: 2, type: 'vertex',
        position: entity.point2, movesEntity: false,
      });
      break;
    }
  }

  return grips;
}

/** Recalculate angle (degrees) between two arms meeting at a vertex */
export function computeAngleDegrees(vertex: Point2D, p1: Point2D, p2: Point2D): number {
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let deg = Math.abs(a2 - a1) * (180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}
