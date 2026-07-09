'use client';

/**
 * ADR-403 / ADR-408 Φ8 — useBim3DMepSegmentPlacement hook.
 *
 * Lets the user draw a duct/pipe segment directly on the 3D canvas with the same
 * 2-click gesture as the 2D plan view. The interaction lifecycle (AbortController
 * listeners, orbit-drag guard, cursor, arm-FSM) is owned by the
 * `usePlacementInteractionEffect` primitive (ADR-618); this hook supplies ONLY the
 * segment controller — ghost + `PlacementSnapMarker` on the centreline work-plane, with
 * per-endpoint z (Φ-B1 connector-mate). No `useSyncExternalStore` (store reads at event
 * time, ADR-040).
 *
 * Armed only while a segment tool is active AND the viewport is in 3D — the SAME
 * `activeTool` the 2D pipeline uses (`mep-pipe` / `mep-duct` / `mep-drain-pipe`), so the
 * existing `useMepSegmentTool` FSM stays the single source of truth. On each click the
 * screen point is projected onto the centreline work-plane, converted to scene units,
 * and handed to `useMepSegmentTool.onCanvasClick` via the `bim:place-mep-segment-3d`
 * EventBus bridge — reusing the whole commit path (1st click → awaitingEnd, 2nd click →
 * commit). Each click carries its endpoint elevation `z` (mm, floor-relative): a snapped
 * MEP connector's true z (Φ-B1 connector-mate) or the current centreline offset.
 *
 * OSNAP: when snap is ON the floor point is resolved against the shared snap engine in
 * plan mm before conversion; the SAME snap runs on move and click so ghost == commit.
 */

import { EventBus } from '../../systems/events/EventBus';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { mepSegmentToolBridgeStore } from '../../ui/ribbon/hooks/bridge/mep-segment-tool-bridge-store';
import { DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM } from '../../bim/types/mep-segment-types';
import type { ToolType } from '../../ui/toolbar/types';
import type { SceneUnits } from '../../utils/scene-units';
import { PLACEMENT_GHOST_3D_FACTORIES } from './placement-ghost-3d-contracts';
import { planMmToScenePoint } from './world-to-scene-point';
import { type WorkPlaneHit } from './resolve-work-plane-hit';
import { resolveSnapConnectorElevationMm } from '../../bim/mep-segments/mep-snap-connector-elevation';
import type { Entity } from '../../types/entities';
import { usePlacementInteractionEffect, type PlacementInteractionContext } from './use-placement-interaction-effect';
import { createSnapMarkerPlacementController } from './snap-marker-placement-controller';
import type { UseBim3DPointPlacementParams } from './create-bim3d-point-placement-hook';

/** The three segment tools all drive the ONE `useMepSegmentTool` instance. */
const MEP_SEGMENT_TOOLS: readonly ToolType[] = ['mep-pipe', 'mep-duct', 'mep-drain-pipe'];

/**
 * Look up a pipe-connectable MEP host by id from the live 3D entity store, for
 * connector-Z mate (ADR-408 Φ-B1). Event-time read (no subscription) — ADR-040.
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

export type UseBim3DMepSegmentPlacementParams = UseBim3DPointPlacementParams;

export function useBim3DMepSegmentPlacement(
  { managerRef, canvasEl }: UseBim3DMepSegmentPlacementParams,
): void {
  usePlacementInteractionEffect({
    managerRef,
    canvasEl,
    tools: MEP_SEGMENT_TOOLS,
    createController: (ctx: PlacementInteractionContext) => {
      const ghost = PLACEMENT_GHOST_3D_FACTORIES['mep-segment'](ctx.manager.scene);
      const unitsNow = (): SceneUnits => mepSegmentToolBridgeStore.get()?.getSceneUnits() ?? 'mm';

      // A pipe/duct is drawn on its centreline work-plane: the cursor projects onto
      // `floor + centreline` so the run lands where it is committed. WYSIWYG with the ghost.
      const centerlineMmNow = (): number =>
        mepSegmentToolBridgeStore.get()?.overrides.centerlineElevationMm ?? DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM;

      /**
       * Connector-Z mate (Φ-B1): the nearest-connector pick compares against the host's
       * plan position in SCENE units, so resolve in scene units. z stays mm (Φ-A endpoint
       * elevation). `null` ⇒ no connector snap; caller falls back to the centreline offset.
       */
      const resolveConnectorZ = (hit: WorkPlaneHit): number | null => {
        const snap = hit.snap;
        if (!snap || snap.snapType === undefined) return null;
        const scenePt = planMmToScenePoint(hit.planMm, unitsNow());
        return resolveSnapConnectorElevationMm(
          { type: snap.snapType, entityId: snap.snapEntityId },
          scenePt.x,
          scenePt.y,
          findMepConnectorHostById,
        );
      };

      return createSnapMarkerPlacementController(ctx, {
        offsetMm: centerlineMmNow,
        showGhost: (hit) => {
          const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
          // Cursor-end elevation: a snapped connector's z (Φ-B1) or the current centreline
          // offset (Revit per-click elevation). Feeds the ghost so a riser/slope previews.
          const endElevMm = resolveConnectorZ(hit) ?? centerlineMmNow();
          ghost.update(planMmToScenePoint(hit.planMm, unitsNow()), hit.floorElev, levelId, endElevMm);
          ghost.setVisible(true);
          // Marker tracks the riser endpoint: floor + the elevation the click will inherit.
          return hit.floorElev + endElevMm;
        },
        hideGhost: () => ghost.setVisible(false),
        commit: (hit) => {
          // Each click carries its endpoint elevation (mm, floor-relative). The FSM advances
          // awaitingStart → awaitingEnd → commit across two clicks.
          const scenePt = planMmToScenePoint(hit.planMm, unitsNow());
          const z = resolveConnectorZ(hit) ?? centerlineMmNow();
          EventBus.emit('bim:place-mep-segment-3d', { point: { ...scenePt, z } });
        },
        disposeGhost: () => ghost.dispose(),
      });
    },
  });
}
