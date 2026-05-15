/**
 * USE TRIM DRAG CAPTURE — ADR-350 Phase 3 (B3)
 *
 * Pointer-event capture hook mounted inside TrimPreviewMount (ADR-040 leaf).
 * Detects click vs. drag on the DXF viewport element and routes accordingly:
 *
 *   click  → handled by useCanvasClickHandler (unchanged)
 *   drag   → fence mode: records dragStart/dragCurrent in TrimToolStore;
 *             on drag-end, calls TrimToolStore.execFence() for entity detection
 *
 * 5 px screen-space threshold separates click from drag (FENCE_DRAG_THRESHOLD_PX).
 *
 * @module hooks/tools/useTrimDragCapture
 */

import { useEffect, useRef } from 'react';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { TrimToolStore } from '../../systems/trim/TrimToolStore';

/** Screen-space pixel threshold for click-vs-drag discrimination. */
const FENCE_DRAG_THRESHOLD_PX = 5;

export interface UseTrimDragCaptureProps {
  transform: ViewTransform;
  getViewportElement: () => HTMLElement | null;
}

export function useTrimDragCapture(props: UseTrimDragCaptureProps): void {
  const { transform, getViewportElement } = props;
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const dragStartScreenRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const el = getViewportElement();
    if (!el) return;

    function screenToWorld(screenX: number, screenY: number): Point2D {
      const rect = el!.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };
      return CoordinateTransforms.screenToWorld(
        { x: screenX - rect.left, y: screenY - rect.top },
        transformRef.current,
        viewport,
      );
    }

    function onPointerDown(e: PointerEvent): void {
      const phase = TrimToolStore.getState().phase;
      if (phase !== 'picking') return;
      dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
    }

    function onPointerMove(e: PointerEvent): void {
      const start = dragStartScreenRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!isDraggingRef.current) {
        if (Math.hypot(dx, dy) < FENCE_DRAG_THRESHOLD_PX) return;
        isDraggingRef.current = true;
        TrimToolStore.setPhase('fence');
        TrimToolStore.setDrag(screenToWorld(start.x, start.y), screenToWorld(e.clientX, e.clientY));
      } else {
        const start3d = TrimToolStore.getState().dragStart;
        TrimToolStore.setDrag(start3d, screenToWorld(e.clientX, e.clientY));
      }
    }

    function onPointerUp(e: PointerEvent): void {
      if (!isDraggingRef.current) {
        dragStartScreenRef.current = null;
        return;
      }
      // TODO: compute which entities the fence segment crosses and call
      // TrimToolStore.execPick(worldPoint, e.shiftKey) for each hit.
      // Requires spatial index or entity-bbox scan (Phase 4 work item).
      TrimToolStore.setDrag(null, null);
      TrimToolStore.setPhase('picking');
      dragStartScreenRef.current = null;
      isDraggingRef.current = false;
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [getViewportElement]);
}
