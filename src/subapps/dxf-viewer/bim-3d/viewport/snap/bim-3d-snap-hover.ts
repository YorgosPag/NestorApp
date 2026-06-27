'use client';

/**
 * bim-3d-snap-hover — resolve the snap marker under the 3D cursor by reusing the ONE global
 * snap engine (ADR-542). NO new snap logic, NO new geometry, NO new labels:
 *
 *   cursor (clientX/Y)
 *     → raycastWorldPoint (front-most BIM surface under the cursor)         [SSoT raycaster]
 *     → worldToDxfPlan (3D world → DXF-plan mm + elevation)                 [SSoT transforms]
 *     → syncSnapEngineViewport3D (pixel tolerance from the 3D camera zoom)  [SSoT, ADR-402]
 *     → getGlobalSnapEngine().findSnapPoint (same corners/midpoints/labels) [SSoT, ADR-370]
 *     → toSnapIndicatorView (the 2D-shared overlay view-model)              [SSoT, ADR-137]
 *
 * The returned `elevMm` is the front-most hit's elevation, so the marker rides the surface the
 * cursor is actually on (a column corner shows where you point at it, not at the floor datum).
 * Returns null when OSNAP is off, the cursor is off the model, or no characteristic point is in
 * tolerance — exactly like the 2D `findSnapPoint` returning `found:false`.
 */

import * as THREE from 'three';
import { raycastWorldPoint } from '../../systems/raycaster/BimEntityRaycaster';
import { worldToDxfPlan } from '../coordinate-transforms';
import { getGlobalSnapEngine } from '../../../snapping/global-snap-engine';
import { toSnapIndicatorView } from '../../../snapping/extended-types';
import { syncSnapEngineViewport3D } from '../../animation/bim3d-edit-drag-snap';
import type { Snap3DMarker } from '../../stores/Snap3DOverlayStore';

/**
 * Compute the active snap marker for the cursor over the 3D BIM group, or null. `group` is the
 * BIM scene group (`manager.bimLayer.group`); the raycast hits its meshes (columns/walls/…).
 */
export function computeSnap3DHover(
  group: THREE.Group,
  camera: THREE.Camera,
  dom: HTMLElement,
  clientX: number,
  clientY: number,
): Snap3DMarker | null {
  const engine = getGlobalSnapEngine();
  if (!engine.getSettings().enabled) return null;

  // Front-most surface under the cursor → its plan (x,y) + elevation. No hit ⇒ no snap.
  const world = raycastWorldPoint(group, camera, dom, clientX, clientY);
  if (!world) return null;
  const plan = worldToDxfPlan(world);

  // Scale the magnet pull to the 3D zoom (same viewport sync the gizmo/grip drags use).
  syncSnapEngineViewport3D(engine, camera, dom, world);

  const result = engine.findSnapPoint({ x: plan.x, y: plan.y });
  if (!result.found) return null;
  const view = toSnapIndicatorView(result);
  if (!view) return null;

  return { view, elevMm: plan.z };
}
