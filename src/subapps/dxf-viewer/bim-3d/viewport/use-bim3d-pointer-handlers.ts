/**
 * use-bim3d-pointer-handlers — pointer interaction (hover-raycast + click-select +
 * Alt+click orbit-pivot) extracted from BimViewport3D so the component stays under
 * the 500-line SRP limit. ADR-366 §A.6.Q5 (Alt+click pivot) + B.2 (hover popover).
 *
 * Behaviour is identical to the inline handlers: hover is debounced, click picks
 * an entity (or sets the orbit pivot when Alt is held), leave clears the hover.
 */

import { useCallback, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { useQuickProperties3DStore } from '../stores/QuickProperties3DStore';
import { useBim3DEditStore } from '../stores/Bim3DEditStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
// ADR-539 — Cinema 4D «Polygon Mode»: click picks a FACE instead of the whole entity.
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
// ADR-539 Φ3f — right-click on a face → per-face context menu (clear/copy/paste appearance).
import { useFaceContextMenuStore } from '../stores/FaceContextMenuStore';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { applyDxfEntityClickSelection } from '../../systems/selection/resolve-dxf-entity-click';
// ADR-538 — unified hover state SSoT (same store the 2D canvas writes/reads).
import { setHoveredEntity } from '../../systems/hover/HoverStore';
// ADR-542 — 3D snap marker: same global snap engine + same glyph/label as the 2D canvas.
import { useSnap3DOverlayStore } from '../stores/Snap3DOverlayStore';
import { pickDxfEntityAcrossFloors } from '../grips/dxf-wireframe-hit-test';
// ADR-537 δ — pick over the active floor scope (single active floor, or every stacked floor).
import { getDxfFloorScope } from '../scene/dxf-3d-floor-scope';
import { applyBimHover } from '../scene/scene-manager-actions';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { DXF_TIMING } from '../../config/dxf-timing';
// ADR-040 Φ-3D-pointer — hover+snap pick decoupled to a RAF slot (mirror the 2D snap-scheduler).
import { requestPointerPick, clearPointerPick } from './snap/bim3d-pointer-scheduler';
// ADR-366 §B.2.Q1 follow-up — clear the live X/Y/Z status-bar readout on leave (the writer
// itself runs in the pointer scheduler's RAF slot, reusing its geometry-hit world point).
import { clearBim3DCursorReadout } from '../stores/Bim3DCursorReadoutStore';

const HOVER_DEBOUNCE_MS = DXF_TIMING.gesture.HOVER_REVEAL; // ADR-516 (popover reveal)

interface PointerHandlers {
  handleMouseMove: (e: ReactMouseEvent) => void;
  handleClick: (e: ReactMouseEvent) => void;
  handleContextMenu: (e: ReactMouseEvent) => void;
  handleMouseLeave: () => void;
}

export function useBim3DPointerHandlers(
  managerRef: RefObject<ThreeJsSceneManager | null>,
  debounceTimerRef: { current: ReturnType<typeof setTimeout> | null },
): PointerHandlers {
  const handleMouseMove = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    const { clientX, clientY } = e;
    // ADR-040 Φ-3D-pointer — ARM the decoupled pick scheduler (cheap: store + flag). The heavy,
    // BVH-accelerated hover+snap raycast runs in a RAF slot, never blocking this handler, so the
    // cursor/crosshair stays 1:1 with the physical mouse (parity with the 2D canvas).
    const manager = managerRef.current;
    if (manager) requestPointerPick({ manager, clientX, clientY });
    // ADR-366 §B.2 — the hover popover stays debounced (off the hot path) with its own pick.
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
    // ADR-539 — Polygon Mode: a click selects a FACE of a faced solid (for paint), not
    // the whole entity. The entity selection is left untouched so the «Polygon» panel stays
    // anchored to the same solid.
    // Φ4b — Shift+click adds/removes the face from the multi-selection (Cinema 4D Polygon Mode),
    // mirroring the entity-level shift-toggle below (`toggleBimEntity`/`selectBimEntity`); a plain
    // click replaces it. Shift+miss keeps the set (Cinema 4D); a plain miss clears it.
    if (usePolygonMode3DStore.getState().active) {
      const store = usePolygonMode3DStore.getState();
      const faceHit = manager.raycastBimFace(e.clientX, e.clientY);
      if (faceHit?.bimId && faceHit.faceKey) {
        const face = { bimId: faceHit.bimId, faceKey: faceHit.faceKey };
        if (e.shiftKey) store.toggleFace(face);
        else store.selectFace(face);
        manager.setSelectedFaces(usePolygonMode3DStore.getState().selectedFaces);
      } else if (!e.shiftKey) {
        store.clearFaces();
        manager.setSelectedFaces([]);
      }
      return;
    }
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
    const dxfId = camera && dom
      ? pickDxfEntityAcrossFloors(getDxfFloorScope(), camera, dom, e.clientX, e.clientY)?.entityId ?? null
      : null;
    if (dxfId) {
      // ADR-543 — only clear the BIM selection when it actually holds something. Calling
      // clearSelection() when already empty fires the universal bridge → replaceEntitySelection([])
      // which WIPES the accumulated DXF multi-selection on every click (blocked 3D multi-select).
      if (useSelection3DStore.getState().selectedBimIds.length > 0) {
        useSelection3DStore.getState().clearSelection();
      }
      // SSoT parity with the 2D canvas: SAME PICKADD=1 + Shift-toggle decision as
      // SelectionSystem.handleEntityClick, so 3D picks accumulate two lines just like 2D.
      applyDxfEntityClickSelection(dxfId, e.shiftKey, {
        toggle: (id) => SelectedEntitiesStore.toggleEntity({ id, type: 'dxf-entity' }),
        add: (id) => SelectedEntitiesStore.addEntity({ id, type: 'dxf-entity' }),
        replaceWithSingle: (id) => SelectedEntitiesStore.replaceEntitySelection([id]),
        isSelected: (id) => SelectedEntitiesStore.isSelected(id),
        selectedDxfCount: () => SelectedEntitiesStore.countByType('dxf-entity'),
      });
      return;
    }
    // Empty space → clear both selections.
    manager.selectBimEntity(null);
    SelectedEntitiesStore.clearByType('dxf-entity');
  }, [managerRef]);

  // ADR-539 Φ3f — right-click on a face (Polygon Mode) opens the per-face context menu
  // (clear/copy/paste appearance) at the cursor. Outside Polygon Mode the contextmenu is
  // left to the default (no BIM action). A miss closes any open menu. The native browser
  // menu is suppressed so the Radix menu is the only one shown.
  const handleContextMenu = useCallback((e: ReactMouseEvent) => {
    if (!usePolygonMode3DStore.getState().active) return;
    const manager = managerRef.current;
    if (!manager) return;
    e.preventDefault();
    e.stopPropagation();
    const faceHit = manager.raycastBimFace(e.clientX, e.clientY);
    if (faceHit?.bimId && faceHit.faceKey) {
      // Anchor the menu on the right-clicked face (also select it, mirror left-click).
      usePolygonMode3DStore.getState().selectFace({ bimId: faceHit.bimId, faceKey: faceHit.faceKey });
      manager.setSelectedFace(faceHit.bimId, faceHit.faceKey);
      useFaceContextMenuStore.getState().show(
        { bimId: faceHit.bimId, faceKey: faceHit.faceKey },
        { x: e.clientX, y: e.clientY },
      );
    } else {
      useFaceContextMenuStore.getState().hide();
    }
  }, [managerRef]);

  const handleMouseLeave = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    // ADR-040 Φ-3D-pointer — stop the decoupled pick scheduler (no stale work while off-canvas).
    clearPointerPick();
    // ADR-366 §B.2.Q1 follow-up — clear the X/Y/Z readout (status bar falls back to 2D channel).
    clearBim3DCursorReadout();
    useQuickProperties3DStore.getState().clearHover();
    // ADR-538 — leaving the viewport clears the hover highlight (badge + glow + silhouette).
    setHoveredEntity(null);
    // ADR-542 — clear the 3D snap marker when the cursor leaves the viewport.
    useSnap3DOverlayStore.getState().setSnap(null);
    const manager = managerRef.current;
    if (manager) {
      applyBimHover(manager.hoverHighlighter, null);
      manager.setHoveredFace(null, null); // ADR-539 Φ2 — clear the per-face hover preview.
      manager.markSceneDirty();
    }
  }, [debounceTimerRef, managerRef]);

  // ADR-040 Φ-3D-pointer — clear the scheduler on unmount (manager teardown / route change), so a
  // stale manager reference is never picked against after the viewport is gone. Also clear the
  // X/Y/Z readout so the status bar reverts to the 2D channel when 3D is torn down.
  useEffect(() => () => { clearPointerPick(); clearBim3DCursorReadout(); }, []);

  return { handleMouseMove, handleClick, handleContextMenu, handleMouseLeave };
}
