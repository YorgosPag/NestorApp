'use client';

/**
 * ADR-605 — createBim3DPointPlacementHook SSoT factory.
 *
 * The 7 `use-bim3d-*-placement.ts` point-placement hooks (electrical-panel,
 * furniture, mep-boiler, mep-fixture, mep-manifold, mep-radiator,
 * mep-water-heater) repeated the SAME body verbatim, differing ΜΟΝΟ σε 5
 * παραμέτρους: the ghost kind, the arming tool id(s), the tool-bridge store, the
 * default mounting elevation, and the `bim:place-*-3d` EventBus event. This factory
 * is that single source — it builds a {@link PlacementInteractionController} (ghost +
 * shared `PlacementSnapMarker` on a mounting-elevation work-plane) and delegates the
 * whole interaction lifecycle to the `usePlacementInteractionEffect` primitive
 * (ADR-618), so the AbortController listeners / orbit-drag guard / cursor / arm-FSM are
 * owned in ONE place. No `useSyncExternalStore` (store reads at event time, ADR-040).
 * Mirror of the 2D `createSingleClickPlacementTool` (ADR-600).
 *
 * Armed only while one of the config tools is active AND the viewport is in 3D. On
 * click the screen point is projected onto the active mounting-elevation work-plane,
 * converted to scene units, and handed to the 2D tool via the `bim:place-*-3d` EventBus
 * bridge — reusing the whole commit path.
 *
 * OSNAP: when snap is ON the floor point is resolved against the shared snap engine in
 * plan mm before conversion; the SAME snap runs on move and click so ghost == commit.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-605-bim3d-point-placement-hook-ssot.md
 * @see ./use-placement-interaction-effect.ts — the interaction lifecycle primitive (ADR-618)
 */

import { type MutableRefObject } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { ToolType } from '../../ui/toolbar/types';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import {
  PLACEMENT_GHOST_3D_FACTORIES,
  type PointGhostBimType,
} from './placement-ghost-3d-contracts';
import type { PlacementGhost } from './create-placement-ghost';
import { planMmToScenePoint } from './world-to-scene-point';
import { usePlacementInteractionEffect, type PlacementInteractionContext } from './use-placement-interaction-effect';
import { createSnapMarkerPlacementController } from './snap-marker-placement-controller';
import type { SceneUnits } from '../../utils/scene-units';

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
  /**
   * `mountingElevationMm` είναι optional επειδή έτσι το δηλώνουν τα
   * `BodyPlacementParamOverrides` κάθε tool bridge handle — ο hook πέφτει πίσω στο
   * `defaultMountingElevationMm` όταν λείπει.
   */
  readonly overrides: { readonly mountingElevationMm?: number };
  getSceneUnits(): SceneUnits;
}

export interface PointPlacementBridgeStore {
  get(): PointPlacementBridgeHandle | null;
}

export interface Bim3DPointPlacementConfig {
  /** Ghost kind key into `PLACEMENT_GHOST_3D_FACTORIES` — μόνο point ghosts. */
  readonly ghostKind: PointGhostBimType;
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

  return function useBim3DPointPlacement({ managerRef, canvasEl }: UseBim3DPointPlacementParams): void {
    usePlacementInteractionEffect({
      managerRef,
      canvasEl,
      tools,
      createController: (ctx: PlacementInteractionContext) => {
        const ghost: PlacementGhost = PLACEMENT_GHOST_3D_FACTORIES[ghostKind](ctx.manager.scene);
        const unitsNow = (): SceneUnits => bridgeStore.get()?.getSceneUnits() ?? 'mm';
        // The box is centred on `mountingElevationMm`, so the cursor projects onto that
        // work-plane. The SAME elevation feeds the raycast and `*ToMesh` (FFL + mounting)
        // so ghost == cursor (WYSIWYG).
        const mountingElevationMmNow = (): number =>
          bridgeStore.get()?.overrides.mountingElevationMm ?? defaultMountingElevationMm;

        return createSnapMarkerPlacementController(ctx, {
          offsetMm: mountingElevationMmNow,
          showGhost: (hit) => {
            const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
            // Pass the FLOOR elevation — `*ToMesh` re-adds `mountingElevationMm` and centres
            // the box, so the ghost lands back on the work-plane the cursor was raycast against.
            ghost.update(planMmToScenePoint(hit.planMm, unitsNow()), hit.floorElev, levelId);
            ghost.setVisible(true);
            return hit.planeElev; // the marker sits on the mounting work-plane
          },
          hideGhost: () => ghost.setVisible(false),
          commit: (hit) => EventBus.emit(placeEvent, { point: planMmToScenePoint(hit.planMm, unitsNow()) }),
          disposeGhost: () => ghost.dispose(),
        });
      },
    });
  };
}
