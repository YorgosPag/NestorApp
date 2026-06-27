/**
 * project-snap3d-marker — ONE SSoT for «where (and whether) the active 3D snap marker shows»
 * on screen this frame (ADR-542 / ADR-545).
 *
 * Both the 3D snap-indicator glyph (`BimSnapIndicatorOverlay3D`) AND the 3D CAD crosshair
 * (`BimCrosshairOverlay3D`) need the SAME thing: take the stored `Snap3DMarker` (plan-mm point
 * at its surface elevation), project it through the LIVE camera to canvas-local px, and decide
 * if it should be shown — hidden while the camera moves (orbit/zoom/pan) or when occluded by a
 * solid surface (Giorgio «μόνο μπροστινά»). This was duplicated in both overlays; it now lives
 * here once, reusing the projection SSoT (`makeGripPlanToCanvas`) + the occlusion SSoT
 * (`GripDepthOccluder`).
 *
 * The camera-motion flag is passed in (the `useCameraMotionGate` hook is stateful and must be
 * called exactly once per frame inside the caller's `draw`).
 *
 * @module project-snap3d-marker
 */

import type { ThreeJsSceneManager } from '../../scene/ThreeJsSceneManager';
import type { Snap3DMarker } from '../../stores/Snap3DOverlayStore';
import type { GripDepthOccluder } from '../../grips/grip-3d-depth-occluder';
import type { Point2D } from '../../../rendering/types/Types';
import { makeGripPlanToCanvas, GRIP_OFFSCREEN } from '../../grips/grip-3d-screen-project';
import { dxfPlanToWorld } from '../coordinate-transforms';

/** The minimal scene-manager surface this projection needs (structural — test-friendly). */
export type SnapProjectionManager = Pick<
  ThreeJsSceneManager,
  'getCamera' | 'getRendererCanvas' | 'renderer' | 'scene'
>;

export interface SnapMarkerScreen {
  /** The snap point in canvas-local px (valid whenever the marker is on-screen). */
  readonly point: Point2D;
  /** True when the marker should be shown / glued: on-screen, camera settled, not occluded. */
  readonly visible: boolean;
}

/**
 * Project the active 3D snap marker to canvas-local px and decide visibility for this frame.
 * Returns `null` when there is no camera/canvas or the point is behind the camera (off-screen).
 *
 * @param manager   live scene manager (camera/canvas + renderer/scene for occlusion)
 * @param snap      the stored snap marker (plan-mm point + surface elevation)
 * @param cameraMoving result of the per-frame `useCameraMotionGate` (hide the marker mid-navigation)
 * @param occluder  the shared GPU depth-occluder, or null to skip occlusion culling
 */
export function projectSnap3DMarker(
  manager: SnapProjectionManager,
  snap: Snap3DMarker,
  cameraMoving: boolean,
  occluder: GripDepthOccluder | null,
): SnapMarkerScreen | null {
  const camera = manager.getCamera();
  const canvas = manager.getRendererCanvas();
  if (!camera || !canvas) return null;

  // Project plan→canvas-local px via the SAME projector the grips use (one projection SSoT).
  const project = makeGripPlanToCanvas(camera, canvas, () => snap.elevMm);
  const point = project(snap.view.point);
  if (point === GRIP_OFFSCREEN) return null; // behind the camera

  // Occlusion (μόνο μπροστινά): a snap point behind a solid surface is not a valid target.
  let occluded = false;
  if (occluder) {
    const world = dxfPlanToWorld(snap.view.point.x, snap.view.point.y, snap.elevMm);
    const vis = occluder.computeVisibility(manager.renderer, manager.scene, camera, [world]);
    occluded = vis ? vis[0] === false : false;
  }

  return { point, visible: !cameraMoving && !occluded };
}
