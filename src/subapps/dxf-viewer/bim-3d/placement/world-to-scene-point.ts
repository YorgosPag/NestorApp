/**
 * world-to-scene-point — SSoT for the 3D-placement coordinate bridge.
 *
 * ADR-403 (3D BIM Element Placement). Pure function — no React, no scene
 * mutation. The inverse direction of the converters: given a Three.js world
 * point on the floor plane (metres, Y-up), produce the 2D plan point in the
 * ACTIVE SCENE UNITS that the existing BIM draw tools' `onCanvasClick(point)`
 * already understand (the same point the 2D `screenToWorld` pipeline yields).
 *
 * Why two conversions chained:
 *   1. `worldToDxfPlan(world)` → DXF plan in **mm** (x = wx·1000, y = -wz·1000;
 *      the Z sign-flip is the world-Z = -DXF-north convention, ADR-009).
 *   2. `· mmToSceneUnits(units)` → the scene's native units, because the draw
 *      tools store `clickPoint` verbatim as `params.position` alongside
 *      `sceneUnits` (see `buildDefaultColumnParams`). For a metre scene that is
 *      `×0.001` (mm→m) so the net effect is `position = world` 1:1; for a mm
 *      scene it is `×1` so `position = world·1000`. Skipping the unit factor is
 *      the classic 1000× off-screen bug (see `mmScaleFor` history).
 *
 * The caller MUST source `units` from the SAME place the draw tool does — the
 * `columnToolBridgeStore.getSceneUnits()` handle — so the round-trip cannot
 * disagree on units.
 */

import type * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import { worldToDxfPlan } from '../viewport/coordinate-transforms';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/**
 * Convert a Three.js world point (metres) to a 2D plan point in `units`.
 * Only the horizontal plane matters for placement; the world-Y (elevation) is
 * dropped because the floor plane already fixed the height.
 */
export function worldToScenePoint(
  worldPoint: THREE.Vector3,
  units: SceneUnits,
): Point2D {
  const planMm = worldToDxfPlan(worldPoint); // { x, y, z } in mm
  const factor = mmToSceneUnits(units);
  return { x: planMm.x * factor, y: planMm.y * factor };
}
