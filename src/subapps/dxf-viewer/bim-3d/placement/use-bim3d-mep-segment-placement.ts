'use client';

/**
 * ADR-403 / ADR-408 Φ8 — useBim3DMepSegmentPlacement hook.
 *
 * Lets the user draw a duct/pipe segment directly on the 3D canvas with the same
 * 2-click gesture as the 2D plan view. Mirror of `useBim3DMepManifoldPlacement`
 * (point-based) extended for the LINEAR 2-click FSM: one `useEffect` +
 * AbortController-gated DOM listeners on the renderer canvas, no
 * `useSyncExternalStore` (store reads at event time, ADR-040).
 *
 * Armed only while a segment tool is active AND the viewport is in 3D — the SAME
 * `activeTool` the 2D pipeline uses (`mep-pipe` / `mep-duct` / `mep-drain-pipe`),
 * so the existing `useMepSegmentTool` FSM stays the single source of truth. On
 * each click the screen point is projected onto the centreline work-plane,
 * converted to scene units, and handed to `useMepSegmentTool.onCanvasClick` via
 * the `bim:place-mep-segment-3d` EventBus bridge — reusing the whole commit path
 * (1st click → awaitingEnd, 2nd click → commit). The points carry NO `z`, so the
 * completion defaults both ends to the centreline (a horizontal run), exactly
 * like the 2D free-point gesture. Connector-Z mate in 3D is a documented
 * follow-up.
 *
 * Ghost: the rubber-band axis (start → cursor) is drawn by
 * `MepSegmentPlacementGhost`, which reads the same FSM phase from the bridge.
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
import { mepSegmentToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store';
import { DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM } from '../../bim/types/mep-segment-types';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { MepSegmentPlacementGhost } from './MepSegmentPlacementGhost';
import { PlacementSnapMarker } from './PlacementSnapMarker';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnap } from './placement-snap';
import { acquirePlacementCursor, releasePlacementCursor } from './placement-cursor';

const ORBIT_DRAG_PX = 5;

export interface UseBim3DMepSegmentPlacementParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DMepSegmentPlacement(
  { managerRef, canvasEl }: UseBim3DMepSegmentPlacementParams,
): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const ghost = new MepSegmentPlacementGhost(manager.scene);
    const snapMarker = new PlacementSnapMarker(manager.scene);
    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    // The visible cursor is owned by the viewport interaction surface (the
    // `role="application"` overlay), NOT the renderer <canvas> underneath it
    // (mirror ADR-406 fixture lesson).
    const cursorEl = (canvasEl.closest('[role="application"]') as HTMLElement | null) ?? canvasEl;

    const unitsNow = (): ReturnType<NonNullable<ReturnType<typeof mepSegmentToolBridgeStore.get>>['getSceneUnits']> =>
      mepSegmentToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

    // A pipe/duct is drawn on its centreline work-plane: the cursor projects onto
    // `floor + centreline` so the run lands where it is committed (the completion
    // defaults free ends to the SAME centreline). WYSIWYG with the ghost.
    const centerlineMmNow = (): number =>
      mepSegmentToolBridgeStore.get()?.overrides.centerlineElevationMm ?? DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM;

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
      const planeElev = floorElev + centerlineMmNow();
      const hit = resolveWorkPlaneMm(e.clientX, e.clientY, planeElev);
      if (!hit) {
        ghost.setVisible(false);
        snapMarker.hide();
        manager.markSceneDirty();
        return;
      }
      const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
      // The ghost decides its own visibility by FSM phase (rubber-band only in
      // awaitingEnd). Pass the floor elevation as the building datum so the ghost
      // lands back on the work-plane the cursor was raycast against.
      ghost.update(planMmToScenePoint(hit.planMm, unitsNow()), floorElev, levelId);
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
      const planeElev = floorElev + centerlineMmNow();
      const hit = resolveWorkPlaneMm(e.clientX, e.clientY, planeElev);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      // No `z`: free-point ends default to the centreline in the completion (the
      // 2D free-point convention). The FSM advances awaitingStart → awaitingEnd →
      // commit across two clicks.
      EventBus.emit('bim:place-mep-segment-3d', { point: planMmToScenePoint(hit.planMm, unitsNow()) });
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
      // 'mep-pipe', 'mep-duct' and 'mep-drain-pipe' all drive the ONE
      // useMepSegmentTool instance; the domain/classification preset is set by the
      // active tool id, so any of them arms the SAME 3D segment placement.
      const tool = toolStateStore.get().activeTool;
      const active =
        (tool === 'mep-pipe' || tool === 'mep-duct' || tool === 'mep-drain-pipe') &&
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
