/**
 * @module useCanvasContainerHandlers
 * @enterprise ADR-189 B5 — Container mouseDown/mouseUp with guide drag support
 *
 * Extracted from CanvasSection.tsx for SRP compliance (Google 500-line limit).
 * Handles: guide drag initiation, guide drag completion (MoveGuideCommand),
 * and unified grip mouseDown/mouseUp delegation.
 */
import { useState, useCallback, useRef } from 'react';
import { MOVEMENT_DETECTION } from '../../config/tolerance-config';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
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
  mouseWorld: Point2D | null;
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
  const { activeTool, transform, containerRef, mouseWorld, executeCommand, unified } = params;

  // Ref to avoid stale mouseWorld in callbacks (mouseWorld may be null initially)
  const mouseWorldRef = useRef(mouseWorld);
  mouseWorldRef.current = mouseWorld;

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

  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

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
      mouseWorldRef.current ?? { x: 0, y: 0 },
      e.shiftKey,
    );
    if (consumed) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }, [unified, activeTool, containerRef, transform, setDraggingGuide]);

  const handleContainerMouseUp = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
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
    let worldPos = mouseWorldRef.current ?? { x: 0, y: 0 };
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
