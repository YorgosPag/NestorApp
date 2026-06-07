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
 * (1st click → awaitingEnd, 2nd click → commit). Each click carries its endpoint
 * elevation `z` (mm, floor-relative): a snapped MEP connector's true z (Φ-B1
 * connector-mate, Revit "Connect To") or the current centreline offset at click
 * time. Differing start/end elevations ⇒ a sloped run / riser (Φ-A per-endpoint z);
 * equal ⇒ a horizontal run. The completion (`completeMepSegmentFromTwoClicks`) is
 * the SSoT for both — unchanged.
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
import { resolveSnapConnectorElevationMm } from '../../bim/mep-segments/mep-snap-connector-elevation';
import type { Entity } from '../../types/entities';

const ORBIT_DRAG_PX = 5;

/**
 * Look up a pipe-connectable MEP host by id from the live 3D entity store, for
 * connector-Z mate (ADR-408 Φ-B1). Event-time read (no subscription) — ADR-040.
 * Mirrors the 2D path's `scene.entities.find`, scoped to the connectable hosts the
 * elevation resolver understands (segment / manifold / radiator / boiler / fixture
 * / underfloor; a panel is not pipe-connectable and resolves to null downstream).
 */
function findMepConnectorHostById(id: string): Entity | undefined {
  const s = useBim3DEntitiesStore.getState();
  return (
    s.mepSegments.find((e) => e.id === id) ??
    s.manifolds.find((e) => e.id === id) ??
    s.radiators.find((e) => e.id === id) ??
    s.boilers.find((e) => e.id === id) ??
    s.fixtures.find((e) => e.id === id) ??
    s.underfloors.find((e) => e.id === id)
  ) as Entity | undefined;
}

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
    ): {
      planMm: { x: number; y: number };
      markerMm: { x: number; y: number } | null;
      // mm, floor-relative — the elevation the endpoint inherits from a snapped MEP
      // connector (Φ-B1). null ⇒ no connector snap; caller uses the centreline offset.
      connectorElevationMm: number | null;
    } | null => {
      const world = raycastFloorPoint(manager.getCamera(), canvasEl, clientX, clientY, planeElevMm);
      if (!world) return null;
      const rawMm = worldToPlanMm(world);
      const snap = resolvePlacementSnap(rawMm);
      const planMm = snap ? snap.snappedMm : rawMm;
      const markerMm = snap ? snap.markerMm : null;
      // Connector-Z mate: the nearest-connector pick compares against the host's
      // plan position in SCENE units (the entity's `startPoint`/connector space),
      // so resolve in scene units — NOT plan mm. z stays mm (Φ-A endpoint elevation).
      let connectorElevationMm: number | null = null;
      if (snap && snap.snapType !== undefined) {
        const scenePt = planMmToScenePoint(planMm, unitsNow());
        connectorElevationMm = resolveSnapConnectorElevationMm(
          { type: snap.snapType, entityId: snap.snapEntityId },
          scenePt.x,
          scenePt.y,
          findMepConnectorHostById,
        );
      }
      return { planMm, markerMm, connectorElevationMm };
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
      // Cursor-end elevation: a snapped connector's z (Φ-B1) or the current centreline
      // offset (Revit per-click elevation). Feeds the ghost so a riser/slope previews.
      const endElevMm = hit.connectorElevationMm ?? centerlineMmNow();
      // The ghost decides its own visibility by FSM phase (rubber-band only in
      // awaitingEnd). Pass the floor elevation as the building datum so the ghost
      // lands back on the work-plane the cursor was raycast against.
      ghost.update(planMmToScenePoint(hit.planMm, unitsNow()), floorElev, levelId, endElevMm);
      // Marker sits at the elevation the click will inherit: a snapped connector's
      // real z, else the centreline plane — so the marker tracks a riser endpoint.
      if (hit.markerMm) {
        snapMarker.show(dxfPlanToWorld(hit.markerMm.x, hit.markerMm.y, floorElev + endElevMm), manager.getCamera());
      } else snapMarker.hide();
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
      // Each click carries its endpoint elevation (mm, floor-relative): a snapped
      // connector's z (Φ-B1 connector-mate) or the current centreline offset (Revit
      // per-click elevation). Differing start/end ⇒ a sloped run/riser; equal ⇒ flat.
      // The FSM advances awaitingStart → awaitingEnd → commit across two clicks.
      const scenePt = planMmToScenePoint(hit.planMm, unitsNow());
      const z = hit.connectorElevationMm ?? centerlineMmNow();
      EventBus.emit('bim:place-mep-segment-3d', { point: { ...scenePt, z } });
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
