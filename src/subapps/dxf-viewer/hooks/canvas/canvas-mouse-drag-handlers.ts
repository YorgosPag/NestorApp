/**
 * Drag end handlers for useCanvasMouse hook
 * Extracted per ADR-065 (file size limit: max 500 lines)
 *
 * Contains the pure logic for handling mouse-up events during
 * vertex drag, edge midpoint drag, and overlay body drag operations.
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { VertexMovement } from '../../core/commands';
import type { ICommand } from '../../core/commands/interfaces';
import type { useOverlayStore } from '../../overlays/overlay-store';
import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot
} from '../../rendering/core/CoordinateTransforms';
import type { DraggingVertexState, DraggingEdgeMidpointState, DraggingOverlayBodyState } from './canvas-mouse-types';

// ============================================================================
// DRAG END HANDLER PARAMS
// ============================================================================

export interface DragEndContext {
  e: React.MouseEvent<HTMLDivElement>;
  transform: ViewTransform;
  containerRef: React.RefObject<HTMLDivElement>;
  overlayStoreRef: React.MutableRefObject<ReturnType<typeof useOverlayStore>>;
  executeCommand: (command: ICommand) => void;
  setDragPreviewPosition: (pos: Point2D | null) => void;
  markDragFinished: () => void;
  movementDetectionThreshold: number;
}

// ============================================================================
// VERTEX DRAG END
// ============================================================================

/**
 * 🏢 ENTERPRISE: Handle multi-vertex drag end
 * ADR-031: Multi-Grip Selection System - updates all dragged vertices
 */
export async function handleVertexDragEnd(
  ctx: DragEndContext,
  draggingVertices: DraggingVertexState[],
  setDraggingVertices: (state: DraggingVertexState[] | null) => void,
): Promise<void> {
  const overlayStore = ctx.overlayStoreRef.current;
  if (!overlayStore) return;

  const container = ctx.containerRef.current;
  if (container) {
    const snap = getPointerSnapshotFromElement(container);
    if (!snap) return;
    const screenPos = getScreenPosFromEvent(ctx.e, snap);
    const worldPos = screenToWorldWithSnapshot(screenPos, ctx.transform, snap);

    // Calculate delta from first grip's start point
    const delta = {
      x: worldPos.x - draggingVertices[0].startPoint.x,
      y: worldPos.y - draggingVertices[0].startPoint.y
    };

    // Command Pattern for multi-grip movement (imported dynamically to avoid circular deps)
    const movements: VertexMovement[] = draggingVertices.map(drag => ({
      overlayId: drag.overlayId,
      vertexIndex: drag.vertexIndex,
      oldPosition: [drag.originalPosition.x, drag.originalPosition.y] as [number, number],
      newPosition: [
        drag.originalPosition.x + delta.x,
        drag.originalPosition.y + delta.y
      ] as [number, number]
    }));

    // Execute through command history
    const { MoveMultipleOverlayVerticesCommand } = await import('../../core/commands');
    const command = new MoveMultipleOverlayVerticesCommand(movements, overlayStore);
    ctx.executeCommand(command);
  }

  // Clear drag states but NOT selectedGrips
  setDraggingVertices(null);
  ctx.setDragPreviewPosition(null);
  ctx.markDragFinished();
}

// ============================================================================
// EDGE MIDPOINT DRAG END
// ============================================================================

/**
 * 🏢 ENTERPRISE: Handle edge midpoint drag end
 */
export async function handleEdgeMidpointDragEnd(
  ctx: DragEndContext,
  draggingEdgeMidpoint: DraggingEdgeMidpointState,
  setDraggingEdgeMidpoint: (state: DraggingEdgeMidpointState | null) => void,
): Promise<void> {
  const overlayStore = ctx.overlayStoreRef.current;
  if (!overlayStore) return;

  const container = ctx.containerRef.current;
  if (container) {
    const snap = getPointerSnapshotFromElement(container);
    if (!snap) return;
    const screenPos = getScreenPosFromEvent(ctx.e, snap);
    const worldPos = screenToWorldWithSnapshot(screenPos, ctx.transform, snap);

    if (!draggingEdgeMidpoint.newVertexCreated) {
      // First time - insert new vertex
      await overlayStore.addVertex(
        draggingEdgeMidpoint.overlayId,
        draggingEdgeMidpoint.insertIndex,
        [worldPos.x, worldPos.y]
      );
    } else {
      // Vertex already created - just update position
      await overlayStore.updateVertex(
        draggingEdgeMidpoint.overlayId,
        draggingEdgeMidpoint.insertIndex,
        [worldPos.x, worldPos.y]
      );
    }
  }

  setDraggingEdgeMidpoint(null);
  ctx.setDragPreviewPosition(null);
  ctx.markDragFinished();
}

// ============================================================================
// OVERLAY BODY DRAG END (MOVE TOOL)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Handle overlay body drag end (move tool)
 */
export async function handleOverlayBodyDragEnd(
  ctx: DragEndContext,
  draggingOverlayBody: DraggingOverlayBodyState,
  setDraggingOverlayBody: (state: DraggingOverlayBodyState | null) => void,
): Promise<void> {
  const overlayStore = ctx.overlayStoreRef.current;
  if (!overlayStore) return;

  const container = ctx.containerRef.current;
  if (container) {
    const snap = getPointerSnapshotFromElement(container);
    if (!snap) return;
    const screenPos = getScreenPosFromEvent(ctx.e, snap);
    const worldPos = screenToWorldWithSnapshot(screenPos, ctx.transform, snap);

    // Calculate delta from start position
    const delta = {
      x: worldPos.x - draggingOverlayBody.startPoint.x,
      y: worldPos.y - draggingOverlayBody.startPoint.y
    };

    // Only execute if there was actual movement
    const hasMovement = Math.abs(delta.x) > ctx.movementDetectionThreshold ||
                       Math.abs(delta.y) > ctx.movementDetectionThreshold;

    if (hasMovement) {
      const { MoveOverlayCommand } = await import('../../core/commands');
      const command = new MoveOverlayCommand(
        draggingOverlayBody.overlayId,
        delta,
        overlayStore,
        true // isDragging = true
      );
      ctx.executeCommand(command);
    }
  }

  setDraggingOverlayBody(null);
  ctx.setDragPreviewPosition(null);
  ctx.markDragFinished();
}
