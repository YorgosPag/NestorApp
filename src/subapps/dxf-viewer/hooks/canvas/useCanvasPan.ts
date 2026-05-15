'use client';

/**
 * Canvas keyboard pan — EventBus listener for 'canvas-pan' events.
 * Emitted by useKeyboardShortcuts when arrow keys are pressed with no selection.
 * Applies the pixel delta directly to offsetX / offsetY.
 *
 * Direction semantics (AutoCAD / Giorgio spec):
 *   ArrowUp   → dy > 0 → content moves DOWN  (viewport scrolls up)
 *   ArrowDown → dy < 0 → content moves UP     (viewport scrolls down)
 *   ArrowLeft → dx > 0 → content moves RIGHT  (viewport scrolls left)
 *   ArrowRight→ dx < 0 → content moves LEFT   (viewport scrolls right)
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseCanvasPanParams {
  transformRef: MutableRefObject<ViewTransform>;
  setTransform: (t: ViewTransform) => void;
}

export function useCanvasPan({ transformRef, setTransform }: UseCanvasPanParams): void {
  useEffect(() => {
    return EventBus.on('canvas-pan', ({ dx, dy }) => {
      const current = transformRef.current;
      if (!current) return;
      setTransform({
        scale: current.scale,
        offsetX: current.offsetX + dx,
        offsetY: current.offsetY + dy,
      });
    });
  }, [transformRef, setTransform]);
}
