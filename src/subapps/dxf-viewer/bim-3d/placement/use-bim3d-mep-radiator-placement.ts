'use client';

/**
 * ADR-408 Εύρος Β #1 — useBim3DMepRadiatorPlacement hook.
 *
 * Lets the user place a point-based heating radiator directly on the 3D canvas.
 * Mirror of `useBim3DMepManifoldPlacement` (ADR-408 Φ12): one `useEffect` +
 * AbortController-gated DOM listeners on the renderer canvas, no
 * `useSyncExternalStore` (store reads at event time, ADR-040).
 *
 * Armed only while the radiator tool is active AND the viewport is in 3D — the
 * SAME `activeTool === 'mep-radiator'` the 2D pipeline uses, so the existing
 * radiator FSM stays the single source of truth. On click the screen point is
 * projected onto the active mounting-elevation work-plane, converted to scene
 * units, and handed to the 2D `useMepRadiatorTool.onCanvasClick` via the
 * `bim:place-mep-radiator-3d` EventBus bridge — reusing the whole commit path.
 *
 * OSNAP: when snap is ON the floor point is resolved against the shared snap
 * engine in plan mm before conversion; the SAME snap runs on move and click so
 * ghost == commit (WYSIWYG).
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { mepRadiatorToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-radiator-tool-bridge-store';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { MepRadiatorPlacementGhost } from './MepRadiatorPlacementGhost';
import { PlacementSnapMarker } from './PlacementSnapMarker';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnap } from './placement-snap';
import { acquirePlacementCursor, releasePlacementCursor } from './placement-cursor';
import { DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM } from '../../bim/types/mep-radiator-types';

const ORBIT_DRAG_PX = 5;

export interface UseBim3DMepRadiatorPlacementParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DMepRadiatorPlacement(
  { managerRef, canvasEl }: UseBim3DMepRadiatorPlacementParams,
): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const ghost = new MepRadiatorPlacementGhost(manager.scene);
    const snapMarker = new PlacementSnapMarker(manager.scene);
    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    // The visible cursor is owned by the viewport interaction surface (the
    // `role="application"` overlay carries the Tailwind `cursor-grab`), NOT the
    // renderer <canvas> underneath it (mirror ADR-406 fixture lesson).
    const cursorEl = (canvasEl.closest('[role="application"]') as HTMLElement | null) ?? canvasEl;

    const unitsNow = (): ReturnType<NonNullable<ReturnType<typeof mepRadiatorToolBridgeStore.get>>['getSceneUnits']> =>
      mepRadiatorToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

    // A radiator is wall-mounted: the box is centred on `mountingElevationMm`, so
    // the cursor projects onto that work-plane (mirror of the manifold work-plane).
    // The SAME elevation feeds the raycast and `radiatorToMesh` (FFL + mounting) so
    // ghost == cursor (WYSIWYG).
    const mountingElevationMmNow = (): number =>
      mepRadiatorToolBridgeStore.get()?.overrides.mountingElevationMm ?? DEFAULT_RADIATOR_MOUNTING_ELEVATION_MM;

    const resolveWorkPlaneMm = (
      clientX: number,
      clientY: number,
      planeElevMm: number,
    ): { planMm: { x: number; y: number }; markerMm: { x: number; y: number } | null } | null => {
      const world = raycastFloorPoint(manager.getCamera(), canvasEl, clientX, clientY, planeElevMm);
      if (!world) return null;
      const rawMm = worldToPlanMm(world);
      const snap = resolvePlacementSnap(rawMm);
      return snap
        ? { planMm: snap.snappedMm, markerMm: snap.markerMm }
        : { planMm: rawMm, markerMm: null };
    };

    const onMove = (e: PointerEvent): void => {
      const floorElev = resolveActiveFloorElevationMm();
      const planeElev = floorElev + mountingElevationMmNow();
      const hit = resolveWorkPlaneMm(e.clientX, e.clientY, planeElev);
      if (!hit) {
        ghost.setVisible(false);
        snapMarker.hide();
        manager.markSceneDirty();
        return;
      }
      const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
      // Pass the FLOOR elevation — `radiatorToMesh` re-adds `mountingElevationMm` and
      // centres the box, so the ghost lands back on the work-plane the cursor was
      // raycast against.
      ghost.update(planMmToScenePoint(hit.planMm, unitsNow()), floorElev, levelId);
      ghost.setVisible(true);
      if (hit.markerMm) snapMarker.show(dxfPlanToWorld(hit.markerMm.x, hit.markerMm.y, planeElev), manager.getCamera());
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
      if (moved > ORBIT_DRAG_PX) return;
      const floorElev = resolveActiveFloorElevationMm();
      const planeElev = floorElev + mountingElevationMmNow();
      const hit = resolveWorkPlaneMm(e.clientX, e.clientY, planeElev);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      EventBus.emit('bim:place-mep-radiator-3d', { point: planMmToScenePoint(hit.planMm, unitsNow()) });
    };

    const setup = (): void => {
      if (abort) return;
      useSelection3DStore.getState().clearSelection();
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointermove', onMove, { signal });
      canvasEl.addEventListener('pointerleave', onLeave, { signal });
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('click', onClick, { signal });
      acquirePlacementCursor(cursorEl);
    };

    const teardown = (): void => {
      const wasActive = abort !== null;
      abort?.abort();
      abort = null;
      downPos = null;
      ghost.setVisible(false);
      snapMarker.hide();
      if (wasActive) releasePlacementCursor(cursorEl);
      manager.markSceneDirty();
    };

    const apply = (): void => {
      const tool = toolStateStore.get().activeTool;
      const active = tool === 'mep-radiator' && selectIs3D(useViewMode3DStore.getState());
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
