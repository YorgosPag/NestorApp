'use client';

/**
 * ADR-618 — resolveWorkPlaneHit SSoT.
 *
 * The point-placement factory (`create-bim3d-point-placement-hook`) and the mep-segment
 * hook both project a screen point onto a floor-relative work-plane and OSNAP it in plan
 * mm — the SAME `resolveActiveFloorElevationMm` → `raycastFloorPoint` → `worldToPlanMm` →
 * `resolvePlacementSnap` chain. This helper is that single source; the mep-segment caller
 * layers its connector-Z mate (Φ-B1) on top of the returned `snap`.
 *
 * @see ./create-bim3d-point-placement-hook.ts · ./use-bim3d-mep-segment-placement.ts
 */

import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from './raycast-floor-point';
import { worldToPlanMm } from './world-to-scene-point';
import { resolvePlacementSnap, type PlacementSnapResolution } from './placement-snap';

export interface WorkPlaneHit {
  /** OSNAP-corrected (or raw) placement point, plan mm. */
  readonly planMm: { x: number; y: number };
  /** The snap target for the 3D marker, plan mm — null when no snap. */
  readonly markerMm: { x: number; y: number } | null;
  /** The raw snap resolution (host id / candidate type) for connector-Z mate — null when no snap. */
  readonly snap: PlacementSnapResolution | null;
  /** The active floor (storey datum) elevation, mm. */
  readonly floorElev: number;
  /** The work-plane elevation the cursor was raycast against (`floorElev + offsetMm`), mm. */
  readonly planeElev: number;
}

/**
 * Raycast a screen point onto the `floor + offsetMm` work-plane and OSNAP it in plan mm.
 * Returns `null` when the ray misses the floor. The SAME resolution feeds both the ghost
 * (onMove) and the commit (onCommit), so they cannot disagree (WYSIWYG).
 */
export function resolveWorkPlaneHit(
  manager: ThreeJsSceneManager,
  canvasEl: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  offsetMm: number,
): WorkPlaneHit | null {
  const floorElev = resolveActiveFloorElevationMm();
  const planeElev = floorElev + offsetMm;
  const world = raycastFloorPoint(manager.getCamera(), canvasEl, clientX, clientY, planeElev);
  if (!world) return null;
  const rawMm = worldToPlanMm(world);
  const snap = resolvePlacementSnap(rawMm);
  return {
    planMm: snap ? snap.snappedMm : rawMm,
    markerMm: snap ? snap.markerMm : null,
    snap,
    floorElev,
    planeElev,
  };
}
