'use client';

/**
 * use-placement-pass — the column-placement layer of the unified overlay dispatch (ADR-555). Carries
 * the EXACT draw of the former `BimPlacementOverlay2D` (ADR-544): the polar/cartesian magnetic grid,
 * live dimensions, and alignment guides drawn with the SAME 2D painters (`paintPlacement3DOverlay`),
 * projected through the live camera via `makePlacementOverlayProjector`.
 *
 * Occlusion («μόνο μπροστινά», ADR-542): the shared `GripDepthOccluder` (from the dispatch) hides the
 * whole layer when the snap point sits behind a solid. ADR-040 micro-leaf: subscribes ONLY to the
 * low-frequency `meta` (drives the dispatch RAF on/off); the projection is imperative per frame.
 */

import { useSyncExternalStore } from 'react';
import { getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { dxfPlanToWorld } from '../coordinate-transforms';
import { usePlacement3DOverlayStore } from '../../stores/Placement3DOverlayStore';
import { makePlacementOverlayProjector } from '../../placement/placement-overlay-project';
import { scenePointToPlanMm } from '../../placement/world-to-scene-point';
import { paintPlacement3DOverlay } from '../placement/placement-overlay-paint';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** One dispatch frame for the column-placement layer — occlusion-cull, then the SAME 2D painters. */
function paintPlacementOverlay({ ctx, camera, canvas, manager, occluder }: BimOverlayFrame): void {
  const cur = usePlacement3DOverlayStore.getState().meta;
  if (!cur) return;

  // Occlusion («μόνο μπροστινά»): snap point behind a solid → hide the whole layer this frame.
  if (occluder) {
    const planMm = scenePointToPlanMm(cur.anchorScene, cur.sceneUnits);
    const world = dxfPlanToWorld(planMm.x, planMm.y, cur.elevMm);
    const vis = occluder.computeVisibility(manager.renderer, manager.scene, camera, [world]);
    if (vis && vis[0] === false) return;
  }

  const project = makePlacementOverlayProjector(camera, canvas, cur.sceneUnits, cur.elevMm);
  const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
  paintPlacement3DOverlay(ctx, cur, project, getImmediateTransform(), viewport);
}

/** The column-placement layer as a dispatch pass. Active while the low-frequency `meta` is set. */
export function usePlacementPass(): BimOverlayPass {
  const meta = useSyncExternalStore(
    usePlacement3DOverlayStore.subscribe,
    () => usePlacement3DOverlayStore.getState().meta,
    () => null,
  );
  return { active: meta !== null, hideOnMotion: true, paint: paintPlacementOverlay };
}
