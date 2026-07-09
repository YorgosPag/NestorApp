'use client';

/**
 * ADR-618 — createSnapMarkerPlacementController SSoT.
 *
 * The point-placement factory (`create-bim3d-point-placement-hook`) and the mep-segment
 * hook are BOTH "snap-marker work-plane" placements: a ghost + a shared
 * `PlacementSnapMarker`, projected onto a floor-relative work-plane via
 * `resolveWorkPlaneHit`, with the SAME onMove/onCommit/hideFeedback skeleton (resolve →
 * hide-on-miss → update ghost → show/hide marker → mark dirty; commit → resolve → emit).
 * They differ ONLY in the ghost update arity + the marker elevation + the commit payload
 * (point vs point+z). This controller owns the skeleton + the snap marker; each hook
 * supplies a thin {@link SnapMarkerPlacementStrategy}. It sits between the interaction
 * primitive (ADR-618 `usePlacementInteractionEffect`) and the concrete hooks.
 *
 * @see ./use-placement-interaction-effect.ts · ./resolve-work-plane-hit.ts
 */

import { dxfPlanToWorld } from '../viewport/coordinate-transforms';
import { PlacementSnapMarker } from './PlacementSnapMarker';
import { resolveWorkPlaneHit, type WorkPlaneHit } from './resolve-work-plane-hit';
import type {
  PlacementInteractionContext,
  PlacementInteractionController,
} from './use-placement-interaction-effect';

/** The per-domain variance the snap-marker skeleton delegates. */
export interface SnapMarkerPlacementStrategy {
  /** Work-plane offset above the active floor (mounting elevation / centreline), mm. */
  offsetMm(): number;
  /**
   * Update + show the ghost for this frame's resolved hit. Returns the elevation (mm) the
   * snap marker should sit at (a snapped connector's z for a riser, else the work-plane).
   */
  showGhost(hit: WorkPlaneHit): number;
  /** Hide the ghost (feedback reset on miss / disarm). */
  hideGhost(): void;
  /** Emit the place event for a committing click. */
  commit(hit: WorkPlaneHit): void;
  /** Dispose the ghost on effect cleanup. */
  disposeGhost(): void;
}

/**
 * Build the interaction controller for a snap-marker work-plane placement. The strategy
 * owns its ghost (created with `ctx.manager.scene`); this controller owns the shared snap
 * marker + the whole onMove/onCommit/hideFeedback/dispose skeleton.
 */
export function createSnapMarkerPlacementController(
  ctx: PlacementInteractionContext,
  strategy: SnapMarkerPlacementStrategy,
): PlacementInteractionController {
  const { manager, canvasEl } = ctx;
  const snapMarker = new PlacementSnapMarker(manager.scene);

  const hideFeedback = (): void => {
    strategy.hideGhost();
    snapMarker.hide();
    manager.markSceneDirty();
  };

  return {
    onMove: (e: PointerEvent): void => {
      const hit = resolveWorkPlaneHit(manager, canvasEl, e.clientX, e.clientY, strategy.offsetMm());
      if (!hit) {
        hideFeedback();
        return;
      }
      const markerElevMm = strategy.showGhost(hit);
      if (hit.markerMm) {
        snapMarker.show(dxfPlanToWorld(hit.markerMm.x, hit.markerMm.y, markerElevMm), manager.getCamera());
      } else snapMarker.hide();
      manager.markSceneDirty();
    },
    hideFeedback,
    onCommit: (e: MouseEvent): void => {
      const hit = resolveWorkPlaneHit(manager, canvasEl, e.clientX, e.clientY, strategy.offsetMm());
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      strategy.commit(hit);
    },
    dispose: (): void => {
      strategy.disposeGhost();
      snapMarker.dispose();
    },
  };
}
