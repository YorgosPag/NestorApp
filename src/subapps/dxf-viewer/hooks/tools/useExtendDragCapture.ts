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

import { useEffect } from 'react';
import { screenToWorldCached } from '../../rendering/core/CoordinateTransforms';
import { ExtendToolStore } from '../../systems/extend/ExtendToolStore';

export interface UseExtendDragCaptureProps {
  getViewportElement: () => HTMLElement | null;
}

export function useExtendDragCapture(props: UseExtendDragCaptureProps): void {
  const { getViewportElement } = props;

  useEffect(() => {
    const el = getViewportElement();
    if (!el) return;

    function onPointerMove(e: PointerEvent): void {
      if (e.buttons !== 0) return;
      if (ExtendToolStore.getState().phase === 'picking') {
        ExtendToolStore.execHoverMove(screenToWorldCached(el!, e.clientX, e.clientY), e.shiftKey);
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
