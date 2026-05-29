/**
 * use-bim3d-pointer-handlers — pointer interaction (hover-raycast + click-select +
 * Alt+click orbit-pivot) extracted from BimViewport3D so the component stays under
 * the 500-line SRP limit. ADR-366 §A.6.Q5 (Alt+click pivot) + B.2 (hover popover).
 *
 * Behaviour is identical to the inline handlers: hover is debounced, click picks
 * an entity (or sets the orbit pivot when Alt is held), leave clears the hover.
 */

import { useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { useQuickProperties3DStore } from '../stores/QuickProperties3DStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

const HOVER_DEBOUNCE_MS = 800;

interface PointerHandlers {
  handleMouseMove: (e: ReactMouseEvent) => void;
  handleClick: (e: ReactMouseEvent) => void;
  handleMouseLeave: () => void;
}

export function useBim3DPointerHandlers(
  managerRef: RefObject<ThreeJsSceneManager | null>,
  debounceTimerRef: { current: ReturnType<typeof setTimeout> | null },
): PointerHandlers {
  const handleMouseMove = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    const { clientX, clientY } = e;
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const hit = managerRef.current?.raycastBimEntities(clientX, clientY);
      if (hit) {
        useQuickProperties3DStore.getState().setHovered(hit.bimId, hit.bimType, clientX, clientY);
      } else {
        useQuickProperties3DStore.getState().clearHover();
      }
    }, HOVER_DEBOUNCE_MS);
  }, [managerRef, debounceTimerRef]);

  const handleClick = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    // ADR-366 §A.6.Q5 — Alt+click sets the orbit pivot to the picked point.
    // A static Alt+click reaches here (Alt+drag is consumed by tumble rotation);
    // selection is left untouched (Blender/CAD pivot-pick convention).
    if (e.altKey) {
      managerRef.current?.setOrbitPivotAt(e.clientX, e.clientY);
      return;
    }
    const hit = managerRef.current?.raycastBimEntities(e.clientX, e.clientY);
    managerRef.current?.selectBimEntity(hit?.bimId ?? null);
  }, [managerRef]);

  const handleMouseLeave = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    useQuickProperties3DStore.getState().clearHover();
  }, [debounceTimerRef]);

  return { handleMouseMove, handleClick, handleMouseLeave };
}
