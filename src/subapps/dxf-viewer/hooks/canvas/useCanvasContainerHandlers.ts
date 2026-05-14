/**
 * @module useCanvasContainerHandlers
 * @enterprise ADR-189 B5 — Container mouseDown/mouseUp with guide drag support
 *
 * Extracted from CanvasSection.tsx for SRP compliance (Google 500-line limit).
 * Handles: guide drag initiation, guide drag completion (MoveGuideCommand),
 * and unified grip mouseDown/mouseUp delegation.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { MOVEMENT_DETECTION } from '../../config/tolerance-config';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { getImmediateWorldPosition } from '../../systems/cursor/ImmediatePositionStore';
import { LassoFreehandStore } from '../../systems/lasso/LassoFreehandStore';
import type { GridAxis } from '../../systems/guides/guide-types';
import { MoveGuideCommand } from '../../systems/guides/commands';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import type { Point2D } from '../../rendering/types/Types';
import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import type { ICommand } from '../../core/commands/interfaces';
import type { DraggingGuideState } from './useCanvasMouse';

export interface UseCanvasContainerHandlersParams {
  activeTool: string;
  transform: { scale: number; offsetX: number; offsetY: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
  executeCommand: (cmd: ICommand) => void;
  unified: {
    handleMouseDown: (worldPos: Point2D, shiftKey: boolean) => boolean;
    handleMouseUp: (worldPos: Point2D) => Promise<boolean>;
  };
}

export interface UseCanvasContainerHandlersReturn {
  draggingGuide: DraggingGuideState | null;
  setDraggingGuide: (state: DraggingGuideState | null) => void;
  handleGuideDragComplete: (
    guideId: string, axis: GridAxis,
    oldOffset: number, newOffset: number,
    oldStart?: Point2D, oldEnd?: Point2D,
    newStart?: Point2D, newEnd?: Point2D,
  ) => void;
  handleContainerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleContainerMouseUp: (e: React.MouseEvent<HTMLDivElement>) => Promise<void>;
}

export function useCanvasContainerHandlers(
  params: UseCanvasContainerHandlersParams,
): UseCanvasContainerHandlersReturn {
  const { activeTool, transform, containerRef, executeCommand, unified } = params;

  // 🚀 PERF (2026-05-09): mouse world pos read live from ImmediatePositionStore
  // instead of CanvasSection useState — avoids full subtree re-render on
  // mousemove. Store updates synchronously from mouse-handler-move.

  // ADR-189 B5: Guide drag & drop state
  const [draggingGuide, setDraggingGuide] = useState<DraggingGuideState | null>(null);

  // ADR-189 B5: Guide drag completion — creates MoveGuideCommand for undo/redo
  const handleGuideDragComplete = useCallback((
    guideId: string,
    axis: GridAxis,
    oldOffset: number,
    newOffset: number,
    oldStart?: Point2D,
    oldEnd?: Point2D,
    newStart?: Point2D,
    newEnd?: Point2D,
  ) => {
    const store = getGlobalGuideStore();
    const cmd = new MoveGuideCommand(
      store, guideId, axis,
      oldOffset, newOffset,
      oldStart, oldEnd,
      newStart, newEnd,
    );
    if (axis === 'XZ' && oldStart && oldEnd) {
      store.moveDiagonalGuideById(guideId, oldStart, oldEnd);
    } else {
      store.moveGuideById(guideId, oldOffset);
    }
    executeCommand(cmd);
  }, [executeCommand]);

  // Min screen distance (px²) to add a new lasso point — avoids redundant points
  const _lastLassoScreen = useRef<{ x: number; y: number } | null>(null);

  // Freehand lasso: pointermove → addPoint when distance ≥ 3px screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el || activeTool !== 'lasso-crop') return;
    const onMove = (e: PointerEvent) => {
      if (!LassoFreehandStore.isActive()) return;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const last = _lastLassoScreen.current;
      if (last) {
        const dx = sx - last.x;
        const dy = sy - last.y;
        if (dx * dx + dy * dy < 9) return; // < 3px
      }
      _lastLassoScreen.current = { x: sx, y: sy };
      const worldX = (sx - transform.offsetX) / transform.scale;
      const worldY = (sy - transform.offsetY) / transform.scale;
      LassoFreehandStore.addPoint(worldX, worldY);
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [activeTool, containerRef, transform]);

  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    // Freehand lasso-crop: mousedown starts the lasso trace
    if (activeTool === 'lasso-crop') {
      const worldPos = getImmediateWorldPosition() ?? { x: 0, y: 0 };
      _lastLassoScreen.current = null;
      LassoFreehandStore.startAt(worldPos.x, worldPos.y);
      return;
    }

    // ADR-189 B5: Guide drag initiation — highest priority for guide-move tool
    if (activeTool === 'guide-move' && containerRef.current) {
      const snap = getPointerSnapshotFromElement(containerRef.current);
      if (snap) {
        const screenPos = getScreenPosFromEvent(e, snap);
        const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);
        const store = getGlobalGuideStore();
        const hitTolerance = 30 / transform.scale;
        const nearest = store.findNearestGuide(worldPos.x, worldPos.y, hitTolerance);

        if (nearest && !nearest.locked) {
          e.preventDefault();
          e.stopPropagation();
          setDraggingGuide({
            guideId: nearest.id,
            axis: nearest.axis,
            startMouseWorld: worldPos,
            originalOffset: nearest.offset,
            originalStartPoint: nearest.startPoint ? { x: nearest.startPoint.x, y: nearest.startPoint.y } : undefined,
            originalEndPoint: nearest.endPoint ? { x: nearest.endPoint.x, y: nearest.endPoint.y } : undefined,
          });
          return;
        }
      }
      return;
    }

    const consumed = unified.handleMouseDown(
      getImmediateWorldPosition() ?? { x: 0, y: 0 },
      e.shiftKey,
    );
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }, [unified, activeTool, containerRef, transform, setDraggingGuide]);

  const handleContainerMouseUp = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    // Freehand lasso-crop: mouseup finishes the trace and emits crop:lasso-polygon
    if (LassoFreehandStore.isActive()) {
      _lastLassoScreen.current = null;
      LassoFreehandStore.finish();
      return;
    }

    // ADR-189 B5: Guide drag end — create MoveGuideCommand
    if (draggingGuide && containerRef.current) {
      const snap = getPointerSnapshotFromElement(containerRef.current);
      if (snap) {
        const screenPos = getScreenPosFromEvent(e, snap);
        const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);
        const deltaX = worldPos.x - draggingGuide.startMouseWorld.x;
        const deltaY = worldPos.y - draggingGuide.startMouseWorld.y;
        const hasMovement = Math.abs(deltaX) > MOVEMENT_DETECTION.MIN_MOVEMENT ||
                            Math.abs(deltaY) > MOVEMENT_DETECTION.MIN_MOVEMENT;

        if (hasMovement) {
          if (draggingGuide.axis === 'XZ' && draggingGuide.originalStartPoint && draggingGuide.originalEndPoint) {
            const newStart = { x: draggingGuide.originalStartPoint.x + deltaX, y: draggingGuide.originalStartPoint.y + deltaY };
            const newEnd = { x: draggingGuide.originalEndPoint.x + deltaX, y: draggingGuide.originalEndPoint.y + deltaY };
            handleGuideDragComplete(
              draggingGuide.guideId, draggingGuide.axis,
              draggingGuide.originalOffset, draggingGuide.originalOffset,
              draggingGuide.originalStartPoint, draggingGuide.originalEndPoint,
              newStart, newEnd,
            );
          } else {
            const delta1D = draggingGuide.axis === 'X' ? deltaX : deltaY;
            const newOffset = draggingGuide.originalOffset + delta1D;
            handleGuideDragComplete(
              draggingGuide.guideId, draggingGuide.axis,
              draggingGuide.originalOffset, newOffset,
            );
          }
        } else {
          // No movement — revert the live store mutation
          const store = getGlobalGuideStore();
          if (draggingGuide.axis === 'XZ' && draggingGuide.originalStartPoint && draggingGuide.originalEndPoint) {
            store.moveDiagonalGuideById(draggingGuide.guideId, draggingGuide.originalStartPoint, draggingGuide.originalEndPoint);
          } else {
            store.moveGuideById(draggingGuide.guideId, draggingGuide.originalOffset);
          }
        }
      }
      setDraggingGuide(null);
      return;
    }

    // Snap-aligned mouseUp for overlay grip alignment
    let worldPos = getImmediateWorldPosition() ?? { x: 0, y: 0 };
    const snapResult = getImmediateSnap();
    if (snapResult?.found && snapResult.point) {
      worldPos = snapResult.point;
    }
    const consumed = await unified.handleMouseUp(worldPos);
    if (consumed) return;
  }, [unified, draggingGuide, containerRef, transform, setDraggingGuide, handleGuideDragComplete]);

  return {
    draggingGuide,
    setDraggingGuide,
    handleGuideDragComplete,
    handleContainerMouseDown,
    handleContainerMouseUp,
  };
}
