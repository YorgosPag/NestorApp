'use client';

/**
 * ADR-543 — useBim3DWallPlacement hook.
 *
 * Lets the user draw a wall directly on the 3D canvas with the SAME 2-click gesture as
 * the 2D plan view. The interaction lifecycle (AbortController listeners, orbit-drag
 * guard, cursor, arm-FSM) is owned by the `usePlacementInteractionEffect` primitive
 * (ADR-618); this hook supplies ONLY the wall controller — ghost + OSNAP glyph + ambient
 * alignment tracking (Revit COL traces) + the 3D wall HUD + the cursor-snap sync. No
 * `useSyncExternalStore` (store reads happen at event time, ADR-040).
 *
 * Armed only while the wall tool is active AND the viewport is in 3D — the SAME
 * `activeTool === 'wall'` the 2D pipeline uses, so the existing `useWallTool` FSM stays
 * the single source of truth. On each click the screen point is projected onto the
 * active floor plane, OSNAP-resolved in plan mm, converted to scene units, and handed to
 * `useWallTool.onCanvasClick` via the `bim:place-wall-3d` EventBus bridge — reusing the
 * whole 2-click commit path with zero duplication.
 *
 * Ghost: `WallPlacementGhost` reads the same `wallPreviewStore` the FSM writes and
 * renders via the SAME `generateWallPreview` + `wallToMesh` as a committed wall, so the
 * ghost == commit (WYSIWYG).
 */

import { EventBus } from '../../systems/events/EventBus';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { wallToolBridgeStore } from '../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
import { type SceneUnits } from '../../utils/scene-units';
import type { Point2D } from '../../rendering/types/Types';
import type { ToolType } from '../../ui/toolbar/types';
import { cameraSceneUnitsPerPixel } from '../viewport/coordinate-transforms';
import { PLACEMENT_GHOST_3D_FACTORIES } from './placement-ghost-3d-contracts';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm, planMmToScenePoint } from './world-to-scene-point';
import { resolvePlacementSnapWithView } from './placement-snap';
// ADR-544/542 — ίδιο OSNAP glyph+label με το 2D & την κολόνα, μέσω του κοινού Snap3DOverlayStore.
import { useSnap3DOverlayStore } from '../stores/Snap3DOverlayStore';
import type { SnapIndicatorView } from '../../snapping/extended-types';
import { setWall3DHud, clearWall3DHud } from '../viewport/wall-hud/wall-3d-hud-store';
// ADR-543 ① — ΕΝΑ cursor-snap SSoT 2D+3D: ο smart-ghost διαβάζει το `ImmediateSnap`· συγχρονίζουμε
// το store με το 3D snapped point → ghost ταυτίζεται με το σταυρόνημα.
import { setImmediateSnap, clearImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
// ADR-543 (COL traces 3D) — Revit-style ambient alignment tracking, SAME brain as 2D.
import { setTracking3D, clearTracking3D, type Tracking3DPayload } from '../viewport/tracking/tracking-3d-store';
import { resolveAlignmentTracking } from '../../systems/tracking/resolve-alignment-tracking';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { TrackingPointStore } from '../../systems/tracking/TrackingPointStore';
import { composedTrackingLabel } from '../../hooks/dimensions/dim-alignment-tracking';
import { sceneDistanceToMeters } from '../../bim/labels/move-readout';
import {
  usePlacementInteractionEffect,
  type PlacementInteractionContext,
  type PlacementInteractionController,
} from './use-placement-interaction-effect';
import type { UseBim3DPointPlacementParams } from './create-bim3d-point-placement-hook';

/** The wall tool arms this 3D placement. */
const WALL_TOOLS: readonly ToolType[] = ['wall'];

export type UseBim3DWallPlacementParams = UseBim3DPointPlacementParams;

export function useBim3DWallPlacement({ managerRef, canvasEl }: UseBim3DWallPlacementParams): void {
  usePlacementInteractionEffect({
    managerRef,
    canvasEl,
    tools: WALL_TOOLS,
    createController: ({ manager, canvasEl: el }: PlacementInteractionContext): PlacementInteractionController => {
      const ghost = PLACEMENT_GHOST_3D_FACTORIES.wall(manager.scene);

      const unitsNow = (): SceneUnits => wallToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

      /**
       * Resolve the placement point for a screen position: raycast the floor → OSNAP (mm)
       * → ambient Object-Snap-Tracking (Revit COL traces, scene units). Returns the final
       * scene-unit point (ghost AND commit — WYSIWYG), the OSNAP view (or null when tracking
       * superseded it), and the tracking overlay payload (or null). `null` when the ray
       * misses the floor. Tracking reuses the SAME canonical `resolveAlignmentTracking` as
       * the 2D `drawing-hover-handler`.
       */
      const resolvePlacement = (
        clientX: number,
        clientY: number,
        elev: number,
      ): { scenePt: Point2D; view: SnapIndicatorView | null; trackingPayload: Tracking3DPayload | null } | null => {
        const camera = manager.getCamera();
        const world = raycastFloorPoint(camera, el, clientX, clientY, elev);
        if (!world) return null;
        const units = unitsNow();
        const rawMm = worldToPlanMm(world);
        const snap = resolvePlacementSnapWithView(rawMm);
        let scenePt = planMmToScenePoint(snap ? snap.snappedMm : rawMm, units);
        let view: SnapIndicatorView | null = snap ? snap.view : null;

        // Ambient COL traces (ADR-357): scene-units domain, screen scale derived from the
        // live camera at the cursor, so "members near my cursor" feel + adaptive step stay
        // zoom-constant. ΕΝΑΣ canonical resolver — ΤΟ ΙΔΙΟ SSoT με τη 2D σχεδίαση. F8/F10 δεν
        // εκτίθενται ακόμα σε 3D → `polarEnabled:false` (H/V ambient COL traces only).
        const scenePerPx = cameraSceneUnitsPerPixel(camera, el, world, units);
        const cfg = ambientAlignmentConfigStore.getSnapshot();
        const sceneEntities = cfg.enabled ? (wallToolBridgeStore.get()?.getSceneEntities() ?? []) : null;
        const acquired = TrackingPointStore.getPoints();
        const composed = resolveAlignmentTracking(scenePt, {
          scale: 1 / Math.max(scenePerPx, 1e-9),
          polarEnabled: false,
          sceneEntities,
        });

        let trackingPayload: Tracking3DPayload | null = null;
        if (composed) {
          // Tracking wins → the ghost AND the commit adopt the aligned point (ghost == commit);
          // the alignment line supersedes the OSNAP glyph.
          scenePt = composed.point;
          view = null;
          const r = composed.result;
          const label = composedTrackingLabel(composed, (d) => sceneDistanceToMeters(d, units) * 1000);
          trackingPayload = {
            paths: r.activePaths,
            intersections: r.intersections,
            markers: acquired,
            snappedPoint: composed.point,
            label,
          };
        }
        return { scenePt, view, trackingPayload };
      };

      return {
        onMove: (e: PointerEvent): void => {
          const elev = resolveActiveFloorElevationMm();
          const res = resolvePlacement(e.clientX, e.clientY, elev);
          if (!res) {
            ghost.setVisible(false);
            useSnap3DOverlayStore.getState().setSnap(null);
            clearImmediateSnap();
            clearWall3DHud();
            clearTracking3D();
            manager.markSceneDirty();
            return;
          }
          const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
          const units = unitsNow();
          // ADR-543 ① — sync the cursor-snap SSoT BEFORE building the ghost: the smart-ghost
          // reads `getImmediateSnap()`. `found` only when OSNAP/tracking hit; `point` is always
          // the resolved cursor so the ghost axis lands on the crosshair.
          const snapHit = res.view !== null || res.trackingPayload !== null;
          setImmediateSnap({ found: snapHit, point: res.scenePt, mode: res.trackingPayload ? 'tracking' : 'osnap' });
          // The ghost decides its own visibility by FSM phase via the shared wallPreviewStore.
          // The returned `wallHud` meta (length/angle/thickness·height) feeds the 3D HUD.
          const hud = ghost.update(res.scenePt, elev, levelId, units);
          ghost.setVisible(true);
          setWall3DHud(hud, elev, units);
          // ADR-544/542 — ΙΔΙΟ OSNAP glyph+label με το 2D. `null` view = tracking/no-snap.
          useSnap3DOverlayStore.getState().setSnap(res.view ? { view: res.view, elevMm: elev } : null);
          // ADR-543 (COL traces 3D) — publish the active alignment lines for the 3D overlay.
          setTracking3D(res.trackingPayload, elev, units);
          manager.markSceneDirty();
        },
        hideFeedback: (): void => {
          ghost.setVisible(false);
          useSnap3DOverlayStore.getState().setSnap(null);
          clearImmediateSnap();
          clearWall3DHud();
          clearTracking3D();
          manager.markSceneDirty();
        },
        onCommit: (e: MouseEvent): void => {
          const elev = resolveActiveFloorElevationMm();
          const res = resolvePlacement(e.clientX, e.clientY, elev);
          if (!res) return;
          // Block the 3D selection handler underneath (React onClick on the overlay).
          e.preventDefault();
          e.stopPropagation();
          // SAME point the ghost previewed (OSNAP + ambient tracking applied) → ghost == commit.
          // The 2-click FSM advances awaitingStart → awaitingEnd → commit across two emits.
          EventBus.emit('bim:place-wall-3d', { point: res.scenePt });
        },
        dispose: (): void => {
          ghost.dispose();
        },
      };
    },
  });
}
