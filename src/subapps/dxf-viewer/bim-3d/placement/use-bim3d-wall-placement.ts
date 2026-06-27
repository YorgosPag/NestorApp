'use client';

/**
 * ADR-543 — useBim3DWallPlacement hook.
 *
 * Lets the user draw a wall directly on the 3D canvas with the SAME 2-click
 * gesture as the 2D plan view. Mirror of `useBim3DColumnPlacement` (ADR-403) /
 * `useBim3DMepSegmentPlacement` (ADR-408 Φ8): one `useEffect` + AbortController-
 * gated DOM listeners on the renderer canvas, no `useSyncExternalStore` (store
 * reads happen at event time, ADR-040).
 *
 * Armed only while the wall tool is active AND the viewport is in 3D — the SAME
 * `activeTool === 'wall'` the 2D pipeline uses, so the existing `useWallTool` FSM
 * stays the single source of truth. On each click the screen point is projected
 * onto the active floor plane, OSNAP-resolved in plan mm, converted to scene
 * units, and handed to `useWallTool.onCanvasClick` via the `bim:place-wall-3d`
 * EventBus bridge — reusing the whole 2-click commit path (face-snap, length/angle
 * lock, opening-conflict, trims, persistence) with zero duplication.
 *
 * A wall stands on the storey datum: the click carries no per-endpoint z (unlike a
 * sloped MEP run). Height comes from the wall params (storey-aware default), so the
 * placement is a pure floor-plane 2-click — simpler than the MEP segment.
 *
 * Ghost: `WallPlacementGhost` reads the same `wallPreviewStore` the FSM writes and
 * renders via the SAME `generateWallPreview` + `wallToMesh` as a committed wall, so
 * the ghost == commit (WYSIWYG).
 *
 * OSNAP: when snap is ON the floor point is resolved against the shared snap engine
 * in plan mm BEFORE the conversion; the SAME snap runs on move and click so ghost ==
 * commit. When snap misses (or is off) the raw point is used.
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { wallToolBridgeStore } from '../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { Point2D } from '../../rendering/types/Types';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { dxfPlanToWorld, getPixelWorldSize } from '../viewport/coordinate-transforms';
import { WallPlacementGhost } from './WallPlacementGhost';
import { PlacementSnapMarker } from './PlacementSnapMarker';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnap } from './placement-snap';
import { acquirePlacementCursor, releasePlacementCursor } from './placement-cursor';
import { setWall3DHud, clearWall3DHud } from '../viewport/wall-hud/wall-3d-hud-store';
// ADR-543 (COL traces 3D) — Revit-style ambient alignment tracking, SAME brain as 2D.
import { setTracking3D, clearTracking3D, type Tracking3DPayload } from '../viewport/tracking/tracking-3d-store';
import { composeTrackingSnap } from '../../systems/tracking/ambient-tracking-compose';
import { collectAmbientAlignmentAnchors } from '../../systems/tracking/ambient-alignment-source';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { TrackingPointStore } from '../../systems/tracking/TrackingPointStore';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { formatLengthForDisplay } from '../../config/display-length-format';

/** A click whose pointer moved more than this (px) since pointerdown was an orbit
 *  drag, not a placement — skip it (avoids accidental wall endpoints). */
const ORBIT_DRAG_PX = 5;

export interface UseBim3DWallPlacementParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

export function useBim3DWallPlacement({ managerRef, canvasEl }: UseBim3DWallPlacementParams): void {
  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const ghost = new WallPlacementGhost(manager.scene);
    const snapMarker = new PlacementSnapMarker(manager.scene);
    let abort: AbortController | null = null;
    let downPos: { x: number; y: number } | null = null;

    // The visible cursor is owned by the viewport interaction surface (the
    // `role="application"` overlay), NOT the renderer <canvas> underneath it
    // (mirror column/segment placement).
    const cursorEl = (canvasEl.closest('[role="application"]') as HTMLElement | null) ?? canvasEl;

    const unitsNow = (): SceneUnits => wallToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

    /**
     * Resolve the placement point for a screen position: raycast the floor → OSNAP (mm)
     * → ambient Object-Snap-Tracking (Revit COL traces, scene units). Returns the final
     * scene-unit point (what the ghost shows AND the click commits — WYSIWYG), the OSNAP
     * marker (plan mm, or null when tracking superseded it), and the tracking overlay
     * payload (or null). `null` when the ray misses the floor.
     *
     * Tracking reuses the SAME `composeTrackingSnap` brain as the 2D `drawing-hover-handler`,
     * fed the SAME ambient member set (via the wall bridge) and a camera-derived screen scale
     * — so the alignment behaviour is identical on both canvases.
     */
    const resolvePlacement = (
      clientX: number,
      clientY: number,
      elev: number,
    ): { scenePt: Point2D; markerMm: Point2D | null; trackingPayload: Tracking3DPayload | null } | null => {
      const camera = manager.getCamera();
      const world = raycastFloorPoint(camera, canvasEl, clientX, clientY, elev);
      if (!world) return null;
      const units = unitsNow();
      const rawMm = worldToPlanMm(world);
      const snap = resolvePlacementSnap(rawMm);
      let scenePt = planMmToScenePoint(snap ? snap.snappedMm : rawMm, units);
      let markerMm: Point2D | null = snap ? snap.markerMm : null;

      // Ambient COL traces (ADR-357): scene-units domain, screen scale derived from the
      // live camera at the cursor (mirror of `WallHudOverlay3D`'s `scenePerPx`), so the
      // "members near my cursor on screen" feel and the adaptive step stay zoom-constant.
      const dist = camera.position.distanceTo(world);
      const scenePerPx = getPixelWorldSize(dist, camera, canvasEl) * 1000 * mmToSceneUnits(units);
      const cfg = ambientAlignmentConfigStore.getSnapshot();
      const sceneEntities = cfg.enabled ? (wallToolBridgeStore.get()?.getSceneEntities() ?? []) : [];
      const ambient = sceneEntities.length > 0
        ? collectAmbientAlignmentAnchors(scenePt, sceneEntities, {
            radiusWorld: cfg.radiusPx * scenePerPx,
            maxMembers: cfg.maxMembers,
            axisToleranceWorld: 3 * scenePerPx,
          })
        : [];
      const acquired = TrackingPointStore.getPoints();
      const composed = composeTrackingSnap(scenePt, acquired, ambient, {
        polar: {
          incrementAngle: polarTrackingStore.incrementAngle,
          additionalAngles: polarTrackingStore.additionalAngles,
          polarEnabled: false, // 3D wall: H/V ambient COL traces (no F8/F10 surface yet)
        },
        worldTolerance: 3 * scenePerPx,
        worldPerPixel: scenePerPx,
      });

      let trackingPayload: Tracking3DPayload | null = null;
      if (composed) {
        // Tracking wins → the ghost AND the commit adopt the aligned point (ghost == commit);
        // the alignment line supersedes the OSNAP dot.
        scenePt = composed.point;
        markerMm = null;
        const r = composed.result;
        const distScene = Math.hypot(composed.point.x - r.anchorPoint.x, composed.point.y - r.anchorPoint.y);
        const distMm = distScene / Math.max(mmToSceneUnits(units), 1e-9);
        const label = r.snappedAngle !== null
          ? `${r.snappedAngle.toFixed(0)}° / ${formatLengthForDisplay(distMm)}`
          : null;
        trackingPayload = {
          paths: r.activePaths,
          intersections: r.intersections,
          markers: acquired,
          snappedPoint: composed.point,
          label,
        };
      }
      return { scenePt, markerMm, trackingPayload };
    };

    const onMove = (e: PointerEvent): void => {
      const elev = resolveActiveFloorElevationMm();
      const res = resolvePlacement(e.clientX, e.clientY, elev);
      if (!res) {
        ghost.setVisible(false);
        snapMarker.hide();
        clearWall3DHud();
        clearTracking3D();
        manager.markSceneDirty();
        return;
      }
      const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
      const units = unitsNow();
      // The ghost decides its own visibility by FSM phase (smart-ghost before the
      // first click, rubber-band in awaitingEnd) via the shared wallPreviewStore. The
      // returned `wallHud` meta (length/angle/thickness·height) feeds the 3D HUD overlay.
      const hud = ghost.update(res.scenePt, elev, levelId, units);
      ghost.setVisible(true);
      setWall3DHud(hud, elev, units);
      if (res.markerMm) snapMarker.show(dxfPlanToWorld(res.markerMm.x, res.markerMm.y, elev), manager.getCamera());
      else snapMarker.hide();
      // ADR-543 (COL traces 3D) — publish the active alignment lines for the 3D overlay.
      setTracking3D(res.trackingPayload, elev, units);
      manager.markSceneDirty();
    };

    const onLeave = (): void => {
      ghost.setVisible(false);
      snapMarker.hide();
      clearWall3DHud();
      clearTracking3D();
      manager.markSceneDirty();
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
    };

    const onClick = (e: MouseEvent): void => {
      const moved = downPos ? Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) : 0;
      downPos = null;
      if (moved > ORBIT_DRAG_PX) return; // orbit drag, not a placement
      const elev = resolveActiveFloorElevationMm();
      const res = resolvePlacement(e.clientX, e.clientY, elev);
      if (!res) return;
      // Block the 3D selection handler underneath (React onClick on the overlay).
      e.preventDefault();
      e.stopPropagation();
      // SAME point the ghost previewed (OSNAP + ambient tracking applied) → ghost == commit.
      // The 2-click FSM advances awaitingStart → awaitingEnd → commit across two of these emits.
      EventBus.emit('bim:place-wall-3d', { point: res.scenePt });
    };

    const setup = (): void => {
      if (abort) return;
      // Industry standard (Revit / AutoCAD): arming a placement tool clears the current
      // selection so the edit gizmo on a previously-selected entity tears down. Only ONE
      // mode is ever active — edit-selected OR place-new, never both.
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
      clearWall3DHud();
      clearTracking3D();
      if (wasActive) releasePlacementCursor(cursorEl);
      manager.markSceneDirty();
    };

    const apply = (): void => {
      const active =
        toolStateStore.get().activeTool === 'wall' &&
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
