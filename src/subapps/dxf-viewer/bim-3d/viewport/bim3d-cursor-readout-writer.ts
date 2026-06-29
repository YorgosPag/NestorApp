/**
 * bim3d-cursor-readout-writer — feed the status-bar X/Y/Z readout in 3D.
 *
 * Projects the cursor onto the ACTIVE floor work-plane (Giorgio 2026-06-29: CAD
 * default — the cursor's vertical coordinate is the work-plane elevation, stable and
 * real-time, like AutoCAD/Revit) and writes the DXF-plan triple (mm) to
 * `Bim3DCursorReadoutStore`.
 *
 * Pure SSoT reuse — no new raycast / coordinate math:
 *   - `raycastFloorPoint` (ADR-403) — screen → active-floor plane → world point.
 *   - `resolveActiveFloorElevationMm` (ADR-403) — the active floor's elevation.
 *   - `worldToDxfPlan` (ADR-366 §4) — world (m, Y-up) → DXF plan (mm): {x,y,z}.
 *
 * Cheap enough for the hot mousemove path (one ray↔plane intersect, no BVH), so the
 * readout stays 1:1 with the cursor (parity with the 2D world-position channel).
 *
 * ADR-366 §B.2.Q1 follow-up (3D status-bar coordinates).
 */

import { raycastFloorPoint, resolveActiveFloorElevationMm } from '../placement/raycast-floor-point';
import { worldToDxfPlan } from './coordinate-transforms';
import { setBim3DCursorReadout } from '../stores/Bim3DCursorReadoutStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

/**
 * Recompute + publish the 3D cursor readout for a client-pixel position. Clears the
 * readout when the cursor ray is parallel to the floor (no plane hit) or the manager
 * has no camera/canvas yet.
 */
export function updateBim3DCursorReadout(
  manager: ThreeJsSceneManager,
  clientX: number,
  clientY: number,
): void {
  const camera = manager.getCamera();
  const dom = manager.getRendererCanvas();
  if (!camera || !dom) {
    setBim3DCursorReadout(null);
    return;
  }
  const world = raycastFloorPoint(camera, dom, clientX, clientY, resolveActiveFloorElevationMm());
  if (!world) {
    setBim3DCursorReadout(null);
    return;
  }
  const plan = worldToDxfPlan(world); // { x, y, z } in mm — x=east, y=north, z=elevation
  setBim3DCursorReadout({ x: plan.x, y: plan.y, z: plan.z });
}
