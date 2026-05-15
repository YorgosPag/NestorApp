/**
 * USE EXTEND DRAG CAPTURE — ADR-353
 *
 * Pointer-event capture hook mounted inside ExtendPreviewOverlay (ADR-040 leaf).
 * Routes pointermove → ExtendToolStore.execHoverMove for live hover preview.
 *
 * Fence/crossing drag is reserved for a future phase; for now the hook
 * handles hover-only (no button held). Matches useTrimDragCapture pattern.
 *
 * @module hooks/tools/useExtendDragCapture
 */

import { useEffect, useRef } from 'react';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { ExtendToolStore } from '../../systems/extend/ExtendToolStore';

export interface UseExtendDragCaptureProps {
  transform: ViewTransform;
  getViewportElement: () => HTMLElement | null;
}

export function useExtendDragCapture(props: UseExtendDragCaptureProps): void {
  const { transform, getViewportElement } = props;
  const transformRef = useRef(transform);
  transformRef.current = transform;

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

    function onPointerMove(e: PointerEvent): void {
      if (e.buttons !== 0) return;
      if (ExtendToolStore.getState().phase === 'picking') {
        ExtendToolStore.execHoverMove(screenToWorld(e.clientX, e.clientY), e.shiftKey);
      }
    }

    function onPointerLeave(): void {
      ExtendToolStore.setHoverPreview(null);
    }

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [getViewportElement]);
}
