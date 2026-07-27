/** Renderer-sizing helpers for ThreeJsSceneManager — viewport resize + dpr re-sync (ADR-549/ADR-556). */

import type * as THREE from 'three';
import type { ViewportCamera } from '../viewport/viewport-types';
import type { ViewCubeEngine } from '../viewport/view-cube/view-cube';
import type { SSAOModulator } from '../lighting/ssao-modulator';
import { VIEWCUBE_HIDE_WIDTH_PX } from '../viewport/viewport-constants';
import { getRendererViewportSize, bimPixelRatio } from './scene-setup';
import { bimEdgeResolutionStore } from '../edges/bim-edge-resolution-store';

export interface SceneResizeDeps {
  renderer: THREE.WebGLRenderer;
  viewport: ViewportCamera;
  viewCube: ViewCubeEngine;
  ssaoModulator: SSAOModulator;
  markDirty: () => void;
  /**
   * ADR-549 Φ5 — «άλλαξε το drawing buffer ⇒ κανένα cached καρέ δεν ισχύει πια». Και οι δύο frame
   * caches (`DxfBackdropCache`, `HoverBeautyCache`) κρατούν εικόνα σε συγκεκριμένο μέγεθος· χωρίς
   * αυτό ένα φθηνό overlay καρέ μπορεί να blit-άρει τεντωμένο καρέ άλλης ανάλυσης. Ζει ΕΔΩ και όχι
   * στα call sites: το resize είναι η μοναδική κατηγορία αλλαγής που ΔΕΝ την καλύπτει το «κάθε FULL
   * redraw ξανα-πιάνει snapshot», άρα ο κανόνας ανήκει στον ιδιοκτήτη του resize — μία φορά, όχι δύο.
   */
  invalidateFrameCaches: () => void;
}

/** Assemble the renderer-sizing deps bundle from the manager's subsystems (keeps the manager wrapper one line, N.7.1). */
export function buildSceneResizeDeps(
  renderer: SceneResizeDeps['renderer'],
  viewport: SceneResizeDeps['viewport'],
  viewCube: SceneResizeDeps['viewCube'],
  ssaoModulator: SceneResizeDeps['ssaoModulator'],
  markDirty: () => void,
  invalidateFrameCaches: () => void,
): SceneResizeDeps {
  return { renderer, viewport, viewCube, ssaoModulator, markDirty, invalidateFrameCaches };
}

/** ResizeObserver-driven viewport resize (aspect + renderer + SSAO + ViewCube + edge resolution). */
export function applyViewportResize(deps: SceneResizeDeps, width: number, height: number): void {
  if (width === 0 || height === 0) return;
  deps.viewport.updateAspect(width, height);
  deps.renderer.setSize(width, height);
  deps.ssaoModulator.resize(width, height);
  deps.viewCube.setVisible(width >= VIEWCUBE_HIDE_WIDTH_PX);
  // ADR-375 Phase C.7 — feed renderer size + pixel ratio into every fat-line `LineMaterial`.
  bimEdgeResolutionStore.setSize(width, height, bimPixelRatio());
  deps.invalidateFrameCaches();
  deps.markDirty();
}

/**
 * ADR-549 Phase 7 — re-apply the device pixel ratio after a `devicePixelRatio` CHANGE
 * (window dragged to a monitor with different OS scaling, or scaling changed live). No
 * ResizeObserver fires then, so the drawing buffer would stay sized for the old dpr → a
 * stale/blurry region. Re-setting pixelRatio + size re-rasterizes the buffer at the new
 * ratio. Driven by the `subscribeDevicePixelRatio` SSoT from `BimViewport3D`.
 *
 * ADR-650 M8β/Γ v2 — it must ALSO re-publish the resolution store. No `ResizeObserver` fires on a
 * pure dpr change and the CSS size is unchanged, so the store's identity guard would swallow a
 * `setSize(width, height)` call: the ratio is the only field that moved, and every fat-line
 * `linewidth`/`resolution` in the scene is derived from it. Without this line the whole 3D view
 * kept the OLD screen's line widths after a monitor change — silently, and only on HiDPI.
 */
export function applyDevicePixelRatioSync(deps: SceneResizeDeps): void {
  deps.renderer.setPixelRatio(bimPixelRatio());
  const { width, height } = getRendererViewportSize(deps.renderer.domElement);
  deps.renderer.setSize(width, height);
  deps.ssaoModulator.resize(width, height);
  bimEdgeResolutionStore.setSize(width, height, bimPixelRatio());
  deps.invalidateFrameCaches();
  deps.markDirty();
}
