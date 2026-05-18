/**
 * Overlay grip commit adapters.
 * Split from `grip-commit-adapters.ts` (N.7.1 — keeps the DXF dispatcher below
 * the 500-line cap as new entity grip kinds get wired in).
 *
 * @see grip-commit-adapters.ts — DXF native side of the same Strategy pattern.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { VertexMovement } from '../../core/commands';
import type { UnifiedGripInfo } from './unified-grip-types';
import type { OverlayCommitDeps } from './unified-grip-types';

/**
 * Commit an overlay vertex grip drag (single or multi-vertex).
 * Extracted from useCanvasMouse.ts:520-557.
 */
export async function commitOverlayVertexDrag(
  grips: UnifiedGripInfo[],
  delta: Point2D,
  deps: OverlayCommitDeps,
): Promise<void> {
  const { overlayStore, executeCommand, movementDetectionThreshold } = deps;
  // 🐛 FIX (2026-05-09): Click-without-drag teleported vertex to (0,0).
  // Two root causes: (1) no movement threshold guard so a bare click committed
  // a zero-delta move that, combined with (2) the `?? 0` fallback when the
  // vertex was missing in the store, produced (0,0) targets. Now: skip commit
  // entirely if there is no real movement, and skip any grip whose vertex is
  // not currently in the polygon (no silent (0,0) substitution).
  const hasMovement = Math.abs(delta.x) > movementDetectionThreshold ||
                      Math.abs(delta.y) > movementDetectionThreshold;
  if (!hasMovement) return;
  const movements: VertexMovement[] = [];
  for (const grip of grips) {
    const overlay = overlayStore.overlays[grip.overlayId!];
    const polygon = overlay?.polygon;
    const vertexIndex = grip.gripIndex;
    const vertex = polygon?.[vertexIndex];
    if (!vertex) continue;
    const oldX = vertex[0];
    const oldY = vertex[1];
    movements.push({
      overlayId: grip.overlayId!,
      vertexIndex,
      oldPosition: [oldX, oldY] as [number, number],
      newPosition: [oldX + delta.x, oldY + delta.y] as [number, number],
    });
  }
  if (movements.length === 0) return;
  const { MoveMultipleOverlayVerticesCommand } = await import('../../core/commands');
  const command = new MoveMultipleOverlayVerticesCommand(movements, overlayStore);
  executeCommand(command);
}

/**
 * Commit an overlay edge midpoint grip drag (vertex insertion).
 * Extracted from useCanvasMouse.ts:559-589.
 */
export async function commitOverlayEdgeMidpointDrag(
  grip: UnifiedGripInfo,
  worldPos: Point2D,
  newVertexCreated: boolean,
  deps: OverlayCommitDeps,
): Promise<void> {
  const { overlayStore } = deps;
  if (!grip.overlayId || grip.edgeInsertIndex === undefined) return;
  if (!newVertexCreated) {
    await overlayStore.addVertex(
      grip.overlayId,
      grip.edgeInsertIndex,
      [worldPos.x, worldPos.y]
    );
  } else {
    await overlayStore.updateVertex(
      grip.overlayId,
      grip.edgeInsertIndex,
      [worldPos.x, worldPos.y]
    );
  }
}

/**
 * Commit an overlay body drag (move entire overlay).
 * Extracted from useCanvasMouse.ts:591-626.
 */
export async function commitOverlayBodyDrag(
  overlayId: string,
  delta: Point2D,
  deps: OverlayCommitDeps,
): Promise<void> {
  const { overlayStore, executeCommand, movementDetectionThreshold } = deps;
  const hasMovement = Math.abs(delta.x) > movementDetectionThreshold ||
                      Math.abs(delta.y) > movementDetectionThreshold;
  if (hasMovement) {
    const { MoveOverlayCommand } = await import('../../core/commands');
    const command = new MoveOverlayCommand(
      overlayId,
      delta,
      overlayStore,
      true // isDragging = true
    );
    executeCommand(command);
  }
}
