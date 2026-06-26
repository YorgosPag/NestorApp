'use client';

/**
 * use-bim3d-dxf-edit-interaction — ADR-537: select + grip-edit RAW DXF entities
 * (line / polyline / circle / arc) in the 3D viewport with the SAME grips + commit as 2D.
 *
 * The raw-DXF sibling of `useBim3DEditInteraction` (BIM). It reuses the ADR-535 3D grip
 * infrastructure VERBATIM — the `BimGripController3D` drag FSM, the `Grip3DOverlayStore`
 * grip set, and the `BimGripOverlay2D` Canvas2D renderer — and the 2D SSoT for grip
 * computation (`computeDxfEntityGrips`) + commit (`commitDxfGrip3D` → `StretchEntityCommand`).
 *
 * Selection is UNIFIED with the 2D canvas: a 3D DXF pick writes `SelectedEntitiesStore`
 * (the same store the 2D grips read), so selecting in 3D selects in 2D and vice versa.
 * Mutually exclusive with the BIM edit path: grips are seated ONLY when there is no 3D
 * BIM selection AND exactly one dxf entity is selected (arbitration in the pointer pick).
 *
 * ADR-040: one `useEffect` + AbortController, no `useSyncExternalStore`; store reads
 * happen at event time. ADR-371: disabled when there is no levels context.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { computeDxfEntityGrips } from '../../hooks/grip-computation';
import { getGlobalSnapEngine } from '../../snapping/global-snap-engine';
import { makeResizeSnapFn, type SnapFn } from '../gizmo/bim3d-snap-bridge';
import { SelectedEntitiesStore, subscribeSelection } from '../../systems/selection/SelectedEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useGrip3DOverlayStore } from '../stores/Grip3DOverlayStore';
import { BimGripController3D } from '../grips/bim-grip-controller-3d';
import { rawDxfReshapeGrips } from '../grips/grip-3d-dxf-raw-grips';
import { commitDxfGrip3D } from '../grips/grip-3d-dxf-commit';
import type { PlanElevationMmFor } from '../grips/grip-3d-screen-project';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { syncSnapEngineViewport3D } from './bim3d-edit-drag-snap';
import { resolveEntityLevelId } from './bim3d-edit-live-preview-apply';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

export interface UseBim3DDxfEditInteractionParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

/** DXF wireframe lives flat on the floor plane (Y=0, single floor) — one elevation. */
const DXF_PLAN_ELEVATION: PlanElevationMmFor = () => 0;

/** Resolve the single selected raw-DXF entity (no BIM selection + exactly one dxf id), or null. */
function resolveEligibleDxfEntity(): DxfEntityUnion | null {
  if (useSelection3DStore.getState().selectedBimIds.length > 0) return null;
  const ids = SelectedEntitiesStore.getSelectedEntityIds();
  if (ids.length !== 1) return null;
  const scene = useDxfOverlay3DStore.getState().dxfScene;
  if (scene?.units && scene.units !== 'mm') return null; // v1: mm scenes only
  return scene?.entities.find((e) => e.id === ids[0]) ?? null;
}

/** Build the per-drag OSNAP callback from the ONE snap engine (null = free drag). */
function buildDxfReshapeSnapFn(
  manager: ThreeJsSceneManager,
  canvas: HTMLElement,
  entityId: string,
  anchor: Point2D,
): SnapFn | null {
  const engine = getGlobalSnapEngine();
  if (!engine.getSettings().enabled) return null;
  const camera = manager.getCamera();
  if (!camera) return null;
  syncSnapEngineViewport3D(engine, camera, canvas, dxfPlanToWorld(anchor.x, anchor.y, 0));
  return makeResizeSnapFn(engine, entityId); // dragged vertex = the one control point
}

export function useBim3DDxfEditInteraction({ managerRef, canvasEl }: UseBim3DDxfEditInteractionParams): void {
  const levels = useLevelsOptional();
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;
    const gripController = new BimGripController3D();
    let activeAbort: AbortController | null = null;

    const store = () => useGrip3DOverlayStore.getState();
    /** True when WE own the current grip set (raw DXF) — guards against wiping BIM grips. */
    const ownsGrips = (): boolean => store().dxfGhostEntityId !== null;

    const teardownListeners = (): void => {
      activeAbort?.abort();
      activeAbort = null;
      if (gripController.isDragging()) {
        gripController.cancelDrag();
        manager.viewport.setControlsEnabled(true);
      }
    };

    const seatGrips = (entity: DxfEntityUnion): boolean => {
      const grips = rawDxfReshapeGrips(computeDxfEntityGrips(entity));
      if (grips.length === 0) return false;
      store().setGrips(grips, DXF_PLAN_ELEVATION, DXF_PLAN_ELEVATION);
      store().setDxfGhostEntityId(entity.id);
      return true;
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      const camera = manager.getCamera();
      if (!camera) return;
      if (!gripController.beginDrag(camera, canvasEl, e.clientX, e.clientY)) return;
      e.preventDefault();
      e.stopPropagation();
      manager.viewport.setControlsEnabled(false);
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
      const cur = gripController.currentDrag();
      if (cur?.grip.entityId) {
        gripController.setSnapFn(buildDxfReshapeSnapFn(manager, canvasEl, cur.grip.entityId, cur.grip.position));
      }
      manager.markSceneDirty();
    };

    const onPointerMove = (e: PointerEvent): void => {
      const camera = manager.getCamera();
      if (!camera) return;
      if (gripController.isDragging()) {
        if (gripController.updateDrag(camera, canvasEl, e.clientX, e.clientY)) {
          e.preventDefault();
          e.stopPropagation();
          manager.markSceneDirty(); // overlay RAF paints the live square + ghost
        }
        return;
      }
      if (gripController.updateHover(camera, canvasEl, e.clientX, e.clientY)) manager.markSceneDirty();
    };

    const commitDrag = (): void => {
      const result = gripController.endDrag();
      const lv = levelsRef.current;
      if (!result || !lv || !result.grip.entityId) return;
      const levelId = resolveEntityLevelId(lv, result.grip.entityId) ?? lv.currentLevelId;
      if (levelId) commitDxfGrip3D(result.grip, result.deltaMm, lv, levelId);
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (!gripController.isDragging()) return;
      const camera = manager.getCamera();
      e.preventDefault();
      e.stopPropagation();
      canvasEl.releasePointerCapture?.(e.pointerId);
      if (camera) gripController.updateDrag(camera, canvasEl, e.clientX, e.clientY);
      commitDrag();
      manager.viewport.setControlsEnabled(true);
      // Re-seat onto the committed geometry (the scene re-sync replaces the entity ref).
      syncFromSelection();
      manager.markSceneDirty();
    };

    const onPointerCancel = (): void => {
      if (!gripController.isDragging()) return;
      gripController.cancelDrag();
      manager.viewport.setControlsEnabled(true);
      syncFromSelection();
      manager.markSceneDirty();
    };

    const setupListeners = (): void => {
      if (activeAbort) return;
      activeAbort = new AbortController();
      const { signal } = activeAbort;
      canvasEl.addEventListener('pointerdown', onPointerDown, { signal });
      canvasEl.addEventListener('pointermove', onPointerMove, { signal });
      canvasEl.addEventListener('pointerup', onPointerUp, { signal });
      canvasEl.addEventListener('pointercancel', onPointerCancel, { signal });
    };

    // Arrow (not a hoisted declaration) so the `manager` non-null narrowing from the
    // guard above is preserved in this closure. Referenced by the pointer handlers above
    // via closure (called at event time, after this binding initialises).
    const syncFromSelection = (): void => {
      // Never re-seat mid-drag (the controller owns the grips).
      if (gripController.isDragging()) return;
      const entity = levelsRef.current ? resolveEligibleDxfEntity() : null;
      if (entity && seatGrips(entity)) {
        setupListeners();
        manager.markSceneDirty();
        return;
      }
      // Not eligible → drop OUR grips only (leave a BIM grip set untouched).
      if (ownsGrips()) store().clear();
      teardownListeners();
      manager.markSceneDirty();
    };

    syncFromSelection();
    const unsubSel = subscribeSelection(syncFromSelection);
    const unsubBim = useSelection3DStore.subscribe(syncFromSelection);
    // Auto-resync (commit / external edit) rebuilds the dxfScene → re-seat on the new geometry.
    const unsubScene = useDxfOverlay3DStore.subscribe(syncFromSelection);

    return () => {
      unsubSel();
      unsubBim();
      unsubScene();
      teardownListeners();
      if (ownsGrips()) store().clear();
    };
  }, [canvasEl, managerRef]);
}
