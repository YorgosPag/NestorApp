'use client';

/**
 * wall-hud-3d-projector — the ONE `WallHudProjector` builder for the 3D overlay dispatch (ADR-543/537).
 *
 * Both the wall-placement HUD (`use-wall-hud-pass`) and the raw-DXF grip-drag HUD (`use-grip-hud-pass`)
 * feed the SAME projector-based `paintWallHudCore` (the 2D↔3D length/angle layout SSoT). The seam that
 * adapts it to the perspective camera — scene→plan-mm→px projection, the screen-constant scale, and the
 * projected aligned-dim primitive — used to be copied verbatim in both passes. This module owns it once.
 *
 * `units='mm'` + a plan-mm reference (grip HUD, whose reshaped vertices are already plan-mm) → identity
 * unit factor; any scene unit + a scene-unit reference (wall HUD) → the wall's native scale. One builder,
 * both consumers, zero duplicate.
 */

import type * as THREE from 'three';
import type { Point2D } from '../../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { dxfPlanToWorld, cameraSceneUnitsPerPixel } from '../coordinate-transforms';
import {
  paintProjectedAlignedDim,
  type WallHudProjector,
} from '../../../canvas-v2/preview-canvas/wall-hud-paint';

/**
 * Build the `WallHudProjector` for the live camera + overlay canvas at floor datum `elevMm`. HUD meta
 * points are in `units`; `refScenePoint` (same `units`) is the world anchor the screen-constant scale is
 * measured at (the wall midpoint / the live grip position). `ctx` binds the projected aligned-dim drawer.
 */
export function makeWallHud3DProjector(
  ctx: CanvasRenderingContext2D,
  camera: THREE.Camera,
  canvas: HTMLElement,
  units: SceneUnits,
  elevMm: number,
  refScenePoint: Point2D,
): WallHudProjector {
  const mmFactor = 1 / mmToSceneUnits(units);
  const mmProject = makeGripPlanToCanvas(camera, canvas, () => elevMm);
  const toScreen = (pScene: Point2D): Point2D =>
    mmProject({ x: pScene.x * mmFactor, y: pScene.y * mmFactor });
  const refWorld = dxfPlanToWorld(refScenePoint.x * mmFactor, refScenePoint.y * mmFactor, elevMm);
  return {
    toScreen,
    worldPerPixel: cameraSceneUnitsPerPixel(camera, canvas, refWorld, units),
    drawAlignedDim: (p1, p2, dimRef, label, color) =>
      paintProjectedAlignedDim(ctx, p1, p2, dimRef, label, toScreen, color),
  };
}
