'use client';

/**
 * ADR-605 — createBim3DPointPlacementHook SSoT factory.
 *
 * The 7 `use-bim3d-*-placement.ts` point-placement hooks (electrical-panel,
 * furniture, mep-boiler, mep-fixture, mep-manifold, mep-radiator,
 * mep-water-heater) repeated the SAME ~120-line body verbatim, differing ΜΟΝΟ σε
 * 5 παραμέτρους: the ghost kind, the arming tool id(s), the tool-bridge store, the
 * default mounting elevation, and the `bim:place-*-3d` EventBus event. This factory
 * is that single source — one `useEffect` + AbortController-gated DOM listeners on
 * the renderer canvas, no `useSyncExternalStore` (store reads at event time,
 * ADR-040). Mirror of the 2D `createSingleClickPlacementTool` (ADR-600).
 *
 * Armed only while one of the config tools is active AND the viewport is in 3D —
 * the SAME `activeTool` the 2D pipeline uses, so the existing per-tool FSM stays the
 * single source of truth. On click the screen point is projected onto the active
 * mounting-elevation work-plane, converted to scene units, and handed to the 2D tool
 * via the `bim:place-*-3d` EventBus bridge — reusing the whole commit path.
 *
 * OSNAP: when snap is ON the floor point is resolved against the shared snap engine
 * in plan mm before conversion; the SAME snap runs on move and click so ghost ==
 * commit (WYSIWYG).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-605-bim3d-point-placement-hook-ssot.md
 */

import { useEffect, type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { toolStateStore } from '../../stores/ToolStateStore';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import type { ToolType } from '../../ui/toolbar/types';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import {
  PLACEMENT_GHOST_3D_FACTORIES,
  type GhostBimType,
} from './placement-ghost-3d-contracts';
import { PlacementSnapMarker } from './PlacementSnapMarker';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnap } from './placement-snap';
import { acquirePlacementCursor, releasePlacementCursor } from './placement-cursor';
import type { SceneUnits } from '../../utils/scene-units';

const ORBIT_DRAG_PX = 5;

/**
 * The `bim:place-*-3d` EventBus events routed by point-placement hooks. All share
 * the `{ point: Point2D }` payload, so the factory can emit any of them uniformly.
 */
export type Bim3DPlacePointEvent =
  | 'bim:place-electrical-panel-3d'
  | 'bim:place-furniture-3d'
  | 'bim:place-mep-boiler-3d'
  | 'bim:place-mep-fixture-3d'
  | 'bim:place-mep-manifold-3d'
  | 'bim:place-mep-radiator-3d'
  | 'bim:place-mep-water-heater-3d';

/**
 * Minimal structural contract the factory needs from a `*-tool-bridge-store`:
 * the active scene units (for mm→scene conversion) and the current mounting
 * elevation override. Every `ToolBridgeStore<T>` whose handle carries these is
 * assignable here.
 */
export interface PointPlacementBridgeHandle {
  readonly overrides: { readonly mountingElevationMm: number };
  getSceneUnits(): SceneUnits;
}

export interface PointPlacementBridgeStore {
  get(): PointPlacementBridgeHandle | null;
}

export interface Bim3DPointPlacementConfig {
  /** Ghost kind key into `PLACEMENT_GHOST_3D_FACTORIES`. */
  readonly ghostKind: GhostBimType;
  /** Tool id(s) that arm this placement (usually one; some share an FSM). */
  readonly tools: readonly ToolType[];
  /** The tool bridge store published by the 2D tool hook. */
  readonly bridgeStore: PointPlacementBridgeStore;
  /** Fallback mounting elevation when the bridge handle is absent. */
  readonly defaultMountingElevationMm: number;
  /** The `bim:place-*-3d` event that reuses the 2D commit path. */
  readonly placeEvent: Bim3DPlacePointEvent;
}

export interface UseBim3DPointPlacementParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

/**
 * Build a point-placement hook for a wall/floor/ceiling-mounted BIM entity. The
 * returned hook is the parametric SSoT for all 7 `use-bim3d-*-placement.ts` cells.
 */
export function createBim3DPointPlacementHook(
  config: Bim3DPointPlacementConfig,
): (params: UseBim3DPointPlacementParams) => void {
  const { ghostKind, tools, bridgeStore, defaultMountingElevationMm, placeEvent } = config;

  return function useBim3DPointPlacement(
    { managerRef, canvasEl }: UseBim3DPointPlacementParams,
  ): void {
    useEffect(() => {
      const manager = managerRef.current;
      if (!canvasEl || !manager) return;

      const ghost = PLACEMENT_GHOST_3D_FACTORIES[ghostKind](manager.scene);
      const snapMarker = new PlacementSnapMarker(manager.scene);
      let abort: AbortController | null = null;
      let downPos: { x: number; y: number } | null = null;

      // The visible cursor is owned by the viewport interaction surface (the
      // `role="application"` overlay carries the Tailwind `cursor-grab`), NOT the
      // renderer <canvas> underneath it (ADR-406 fixture lesson).
      const cursorEl = (canvasEl.closest('[role="application"]') as HTMLElement | null) ?? canvasEl;

      const unitsNow = (): SceneUnits => bridgeStore.get()?.getSceneUnits() ?? 'mm';

      // The box is centred on `mountingElevationMm`, so the cursor projects onto
      // that work-plane. The SAME elevation feeds the raycast and `*ToMesh` (FFL +
      // mounting) so ghost == cursor (WYSIWYG).
      const mountingElevationMmNow = (): number =>
        bridgeStore.get()?.overrides.mountingElevationMm ?? defaultMountingElevationMm;

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
        // Pass the FLOOR elevation — `*ToMesh` re-adds `mountingElevationMm` and
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
        EventBus.emit(placeEvent, { point: planMmToScenePoint(hit.planMm, unitsNow()) });
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
        // Release the placement cursor ONLY if we held it (balanced acquire/release).
        if (wasActive) releasePlacementCursor(cursorEl);
        manager.markSceneDirty();
      };

      const apply = (): void => {
        const active =
          tools.includes(toolStateStore.get().activeTool) &&
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
  };
}
