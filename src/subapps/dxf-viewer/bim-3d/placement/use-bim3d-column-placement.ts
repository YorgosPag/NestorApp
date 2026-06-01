'use client';

/**
 * ADR-403 (3D BIM Element Placement) — useBim3DColumnPlacement hook.
 *
 * React glue that lets the user place a BIM column directly on the 3D canvas.
 * Mirrors the `useBim3DEditInteraction` shape (ADR-402): one `useEffect` +
 * AbortController-gated DOM listeners on the renderer canvas, no
 * `useSyncExternalStore` (store reads happen at event time, ADR-040).
 *
 * Armed only while the column tool is active AND the viewport is in 3D — the
 * SAME `activeTool === 'column'` the 2D pipeline uses, so the existing column
 * FSM stays the single source of truth. On click the screen point is projected
 * onto the active floor plane, converted to the active scene units, and handed
 * to the 2D `useColumnTool.onCanvasClick` via the `bim:place-column-3d` EventBus
 * bridge — reusing the whole commit path (enterprise id, scene append, auto
 * 3D-resync, hosted-opening cascade) with zero duplication.
 *
 * OSNAP (ADR-403 Phase 2): when snap is ON the floor point is resolved against
 * the shared snap-engine SSoT in plan mm (`resolvePlacementSnap`) BEFORE the
 * conversion to scene units, so the ghost — and the committed point — "click"
 * onto the nearest corner/endpoint/midpoint of an existing element, with a 3D
 * snap marker shown on the target. The SAME snap runs on move and on click, so
 * ghost == commit (WYSIWYG); when snap misses (or is off) the raw point is used.
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { ColumnPlacementGhost } from './ColumnPlacementGhost';
import { PlacementSnapMarker } from './PlacementSnapMarker';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnap } from './placement-snap';

/** A click whose pointer moved more than this (px) since pointerdown was an
 *  orbit drag, not a placement — skip it (avoids accidental columns). */
const ORBIT_DRAG_PX = 5;

export interface UseBim3DColumnPlacementParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DColumnPlacement({ managerRef, canvasEl }: UseBim3DColumnPlacementParams): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const ghost = new ColumnPlacementGhost(manager.scene);
    const snapMarker = new PlacementSnapMarker(manager.scene);
    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    const unitsNow = (): ReturnType<NonNullable<ReturnType<typeof columnToolBridgeStore.get>>['getSceneUnits']> =>
      columnToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

    /**
     * Project a screen point to the active-floor plan point in **mm**, then apply
     * OSNAP. Returns the (possibly snapped) plan-mm point plus the marker target,
     * or `null` when the ray misses the floor. The SAME resolution feeds both the
     * ghost (onMove) and the commit (onClick), so they cannot disagree (WYSIWYG).
     */
    const resolveFloorPlanMm = (
      clientX: number,
      clientY: number,
      elev: number,
    ): { planMm: { x: number; y: number }; markerMm: { x: number; y: number } | null } | null => {
      const world = raycastFloorPoint(manager.getCamera(), canvasEl, clientX, clientY, elev);
      if (!world) return null;
      const rawMm = worldToPlanMm(world);
      const snap = resolvePlacementSnap(rawMm);
      return snap
        ? { planMm: snap.snappedMm, markerMm: snap.markerMm }
        : { planMm: rawMm, markerMm: null };
    };

    const onMove = (e: PointerEvent): void => {
      const elev = resolveActiveFloorElevationMm();
      const hit = resolveFloorPlanMm(e.clientX, e.clientY, elev);
      if (!hit) {
        ghost.setVisible(false);
        snapMarker.hide();
        manager.markSceneDirty();
        return;
      }
      const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
      ghost.update(planMmToScenePoint(hit.planMm, unitsNow()), elev, levelId);
      ghost.setVisible(true);
      if (hit.markerMm) snapMarker.show(dxfPlanToWorld(hit.markerMm.x, hit.markerMm.y, elev), manager.getCamera());
      else snapMarker.hide();
      manager.markSceneDirty();
    };

    const onLeave = (): void => {
      ghost.setVisible(false);
      snapMarker.hide();
      manager.markSceneDirty();
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent): void => {
      const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
      downPos = null;
      if (moved > ORBIT_DRAG_PX) return; // orbit drag, not a place
      const elev = resolveActiveFloorElevationMm();
      const hit = resolveFloorPlanMm(e.clientX, e.clientY, elev);
      if (!hit) return;
      // Block the 3D selection handler underneath (React onClick on the overlay).
      e.preventDefault();
      e.stopPropagation();
      // SAME snapped point the ghost previewed → ghost == commit (WYSIWYG).
      EventBus.emit('bim:place-column-3d', { point: planMmToScenePoint(hit.planMm, unitsNow()) });
    };

    const setup = (): void => {
      if (abort) return;
      // Industry standard (Revit / AutoCAD): arming a placement tool clears the
      // current selection, so the edit gizmo on a previously-selected entity
      // tears down (`useBim3DEditInteraction` reacts to Selection3DStore). Only
      // ONE mode is ever active — edit-selected OR place-new, never both.
      useSelection3DStore.getState().clearSelection();
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointermove', onMove, { signal });
      canvasEl.addEventListener('pointerleave', onLeave, { signal });
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('click', onClick, { signal });
      // Placement-mode cursor (mirrors the 2D DXF canvas `crosshair`) so the
      // pointer signals "place a column", not the orbit-grab hand the 3D
      // overlay shows by default.
      canvasEl.style.cursor = 'crosshair';
    };

    const teardown = (): void => {
      abort?.abort();
      abort = null;
      downPos = null;
      ghost.setVisible(false);
      snapMarker.hide();
      // Restore the orbit-grab cursor owned by the viewport overlay.
      canvasEl.style.cursor = '';
      manager.markSceneDirty();
    };

    const apply = (): void => {
      const active =
        toolStateStore.get().activeTool === 'column' &&
        selectIs3D(useViewMode3DStore.getState());
      if (active) setup();
      else teardown();
    };

    apply();
    const unsubTool = toolStateStore.subscribe(apply);
    const unsubView = useViewMode3DStore.subscribe(apply);

    return () => {
      unsubTool();
      unsubView();
      teardown();
      ghost.dispose();
      snapMarker.dispose();
    };
  }, [canvasEl, managerRef]);
}
