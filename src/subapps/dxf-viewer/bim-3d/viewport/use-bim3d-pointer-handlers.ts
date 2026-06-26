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
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { pickDxfEntityAt } from '../grips/dxf-wireframe-hit-test';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { DXF_TIMING } from '../../config/dxf-timing';

const HOVER_DEBOUNCE_MS = DXF_TIMING.gesture.HOVER_REVEAL; // ADR-516

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
    // ADR-408 — while a 3D edit gizmo is mounted, Ctrl+click is reserved for relocating
    // its base point / rotation centre (handled by the edit interaction); never let it
    // change the selection. No gizmo → Ctrl is free (left for future use).
    if (e.ctrlKey && useBim3DEditStore.getState().editToolActive) return;
    // ADR-366 §A.6.Q5 — Alt+click sets the orbit pivot to the picked point.
    // A static Alt+click reaches here (Alt+drag is consumed by tumble rotation);
    // selection is left untouched (Blender/CAD pivot-pick convention).
    if (e.altKey) {
      managerRef.current?.setOrbitPivotAt(e.clientX, e.clientY);
      return;
    }
    const manager = managerRef.current;
    if (!manager) return;
    const hit = manager.raycastBimEntities(e.clientX, e.clientY);
    // ADR-402 Phase C — Shift+click adds/removes from the multi-selection;
    // a plain click replaces it (or clears on empty space).
    if (hit?.bimId) {
      // ADR-537 — a BIM pick wins; clear any unified DXF selection so the single grip
      // overlay is exclusively BIM's.
      SelectedEntitiesStore.clearByType('dxf-entity');
      if (e.shiftKey) manager.toggleBimEntity(hit.bimId);
      else manager.selectBimEntity(hit.bimId);
      return;
    }
    // ADR-537 — BIM miss → try a RAW DXF entity (plan-space pick over the floor wireframe).
    // A hit selects it in the SAME `SelectedEntitiesStore` the 2D grips use (unified
    // selection) + clears the 3D BIM selection so the DXF edit hook owns the grip overlay.
    const camera = manager.getCamera();
    const dom = manager.getRendererCanvas();
    const dxfScene = useDxfOverlay3DStore.getState().dxfScene;
    const dxfId = camera && dom ? pickDxfEntityAt(dxfScene, camera, dom, e.clientX, e.clientY) : null;
    if (dxfId) {
      useSelection3DStore.getState().clearSelection();
      SelectedEntitiesStore.replaceEntitySelection([dxfId]);
      return;
    }
    // Empty space → clear both selections.
    manager.selectBimEntity(null);
    SelectedEntitiesStore.clearByType('dxf-entity');
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
