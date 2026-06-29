/**
 * bim3d-cursor-readout-writer — feed the status-bar X/Y/Z readout in 3D.
 *
 * The vertical (Z) coordinate reflects the REAL point under the cursor: when the cursor
 * is over geometry the readout uses the actual surface hit (so Z = surface height and
 * changes as you sweep up/down an element, Giorgio 2026-06-29); in empty space it falls
 * back to the active-floor work-plane (Z = floor elevation). Without the geometry hit Z
 * would be pinned to the floor (0 on the ground storey) — the «πάντα μηδέν» symptom.
 *
 * Pure SSoT reuse — no new raycast / coordinate math:
 *   - `hit.worldPoint` — REUSED from the 3D pointer scheduler's unified BVH raycast
 *     (`raycastBimHitAndWorld`), so no second raycast is spent here.
 *   - `raycastFloorPoint` (ADR-403) — screen → active-floor plane → world point (fallback).
 *   - `resolveActiveFloorElevationMm` (ADR-403) — the active floor's elevation.
 *   - `worldToDxfPlan` (ADR-366 §4) — world (m, Y-up) → DXF plan (mm): {x,y,z}.
 *
 * ADR-366 §B.2.Q1 follow-up (3D status-bar coordinates).
 */

import type * as THREE from 'three';
import { raycastFloorPoint, resolveActiveFloorElevationMm } from '../placement/raycast-floor-point';
import { worldToDxfPlan } from './coordinate-transforms';
import { setBim3DCursorReadout } from '../stores/Bim3DCursorReadoutStore';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

/**
 * Recompute + publish the 3D cursor readout for a client-pixel position. Prefers the
 * geometry hit point (`worldPoint`, from the scheduler's BVH raycast) so Z tracks the
 * real surface height; falls back to the active-floor plane in empty space. Clears the
 * readout when neither resolves (ray parallel to the floor / no camera-canvas yet).
 */
export function updateBim3DCursorReadout(
  manager: ThreeJsSceneManager,
  clientX: number,
  clientY: number,
  worldPoint?: THREE.Vector3 | null,
): void {
  let world: THREE.Vector3 | null = worldPoint ?? null;
  if (!world) {
    const camera = manager.getCamera();
    const dom = manager.getRendererCanvas();
    if (!camera || !dom) {
      setBim3DCursorReadout(null);
      return;
    }
    world = raycastFloorPoint(camera, dom, clientX, clientY, resolveActiveFloorElevationMm());
  }
  if (!world) {
    setBim3DCursorReadout(null);
    return;
  }
  const plan = worldToDxfPlan(world); // { x, y, z } in mm — x=east, y=north, z=elevation
  setBim3DCursorReadout({ x: plan.x, y: plan.y, z: plan.z });
}
