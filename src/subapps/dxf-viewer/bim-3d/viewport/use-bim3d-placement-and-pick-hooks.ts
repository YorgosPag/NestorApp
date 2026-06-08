'use client';

/**
 * useBim3DPlacementAndPickHooks — aggregator for all 3D viewport placement and
 * pick hooks mounted by BimViewport3D.
 *
 * Each hook wires DOM pointer events on the renderer canvas to a specific 2D
 * tool FSM via EventBus bridges — pure side-effect hooks with no return value.
 * Extracted from BimViewport3D.tsx (N.7.1 file-size rule) to keep that file
 * under 500 lines. Zero behavioral change: hooks are called in identical order.
 *
 * ADR-040: none of these hooks call useSyncExternalStore — store reads happen
 * at event time (getState()), never as React subscriptions.
 */

import type { RefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useBim3DColumnPlacement } from '../placement/use-bim3d-column-placement';
import { useBim3DMepFixturePlacement } from '../placement/use-bim3d-mep-fixture-placement';
import { useBim3DFurniturePlacement } from '../placement/use-bim3d-furniture-placement';
import { useBim3DElectricalPanelPlacement } from '../placement/use-bim3d-electrical-panel-placement';
import { useBim3DMepManifoldPlacement } from '../placement/use-bim3d-mep-manifold-placement';
import { useBim3DMepSegmentPlacement } from '../placement/use-bim3d-mep-segment-placement';
import { useBim3DMepRadiatorPlacement } from '../placement/use-bim3d-mep-radiator-placement';
import { useBim3DMepBoilerPlacement } from '../placement/use-bim3d-mep-boiler-placement';
import { useBim3DMepWaterHeaterPlacement } from '../placement/use-bim3d-mep-water-heater-placement';
import { useBim3DAttachPick } from './use-bim3d-attach-pick';
import { useBim3DBeamFromWallPick } from './use-bim3d-beam-from-wall-pick';
import { useBim3DWireWaypointInteraction } from '../animation/use-bim3d-wire-waypoint-interaction-3d';

interface UseBim3DPlacementAndPickHooksParams {
  managerRef: RefObject<ThreeJsSceneManager | null>;
  canvasEl: HTMLCanvasElement | null;
}

/**
 * Mounts all 3D placement and pick hooks for BimViewport3D.
 *
 * Call order matches the original order in BimViewport3D (ADR-403, ADR-406,
 * ADR-410, ADR-408 Φ3/Φ8/Φ12/ΕύροςΒ#1/#2, ADR-401, ADR-363, ADR-408 Φ7 FU#3).
 */
export function useBim3DPlacementAndPickHooks({
  managerRef,
  canvasEl,
}: UseBim3DPlacementAndPickHooksParams): void {
  // ADR-403 — 3D column placement. Armed only while the column tool is active
  // AND the viewport is in 3D: raycasts the active floor plane, shows a WYSIWYG
  // ghost on pointer move, and on click routes the scene-units point through the
  // existing 2D column FSM (`useColumnTool.onCanvasClick`) via the
  // `bim:place-column-3d` EventBus bridge (zero duplication, full commit path).
  useBim3DColumnPlacement({ managerRef, canvasEl });

  // ADR-406 — 3D MEP fixture placement (mirror of column placement above).
  useBim3DMepFixturePlacement({ managerRef, canvasEl });

  // ADR-410 — 3D furniture placement (mirror of MEP fixture placement).
  useBim3DFurniturePlacement({ managerRef, canvasEl });

  // ADR-408 Φ3 — 3D electrical panel placement (mirror of MEP fixture placement).
  useBim3DElectricalPanelPlacement({ managerRef, canvasEl });

  // ADR-408 Φ12 — 3D plumbing manifold placement (mirror of electrical panel placement).
  useBim3DMepManifoldPlacement({ managerRef, canvasEl });

  // ADR-408 Φ8 — 3D MEP segment (duct/pipe) 2-click placement (linear mirror of manifold).
  useBim3DMepSegmentPlacement({ managerRef, canvasEl });

  // ADR-408 Εύρος Β #1 — 3D heating radiator placement (point-based mirror of manifold).
  useBim3DMepRadiatorPlacement({ managerRef, canvasEl });

  // ADR-408 Εύρος Β #2 — 3D heating boiler placement (point-based mirror of manifold).
  useBim3DMepBoilerPlacement({ managerRef, canvasEl });

  // ADR-408 DHW — 3D domestic hot water heater placement (point-based mirror of boiler).
  useBim3DMepWaterHeaterPlacement({ managerRef, canvasEl });

  // ADR-401 — 3D manual attach pick-host. Armed only while a `*-attach-top/-base`
  // tool is active AND the viewport is in 3D: a click raycasts a structural host
  // and emits `bim:attach-host-picked-3d`; the 2D `useWallAttachTool` commits the
  // existing Attach{Walls|Columns|Stairs} command for the captured target(s).
  useBim3DAttachPick({ managerRef, canvasEl });

  // ADR-363 «Δοκάρι από τοίχο» — 3D from-wall pick. Armed only while the
  // `beam-from-wall` tool is active AND the viewport is in 3D: pointer move shows
  // a WYSIWYG beam ghost on the hovered wall's axis, and a click emits
  // `bim:beam-from-wall-picked-3d`; the 2D `useBeamTool` builds the beam via its
  // existing from-wall commit core (auto-attaches the wall top, ADR-401 D).
  useBim3DBeamFromWallPick({ managerRef, canvasEl });

  // ADR-408 Φ7 FU#3 — 3D wire waypoint editing. Armed in 3D + `select` tool:
  // sphere handles on the active circuit's waypoints; drag a node / a segment to
  // insert+move, right-click a node to delete — reusing the 2D plan-space SSoT.
  useBim3DWireWaypointInteraction({ managerRef, canvasEl });
}
