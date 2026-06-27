/**
 * underlay-pass.ts — Revit/Maxon-grade CAD underlay rendering (ADR-537 underlay-depth).
 *
 * PROBLEM: the raw-DXF wireframe + text underlay sits coplanar (Y=floor elevation) with the
 * BIM bases. Rendered INSIDE the main scene it (a) z-fights the coplanar surfaces and, worse,
 * (b) the idle SSAO composer path multiplies the ambient-occlusion term over it and blends the
 * warm sun/ground lighting through the translucent lines → the lines turn "mustard" / vanish
 * the instant the camera settles (motion uses the raster path, no SSAO → correct white). Plain
 * `depthTest:false` band-aids failed because the corruption is the post-FX composite, not z-fight.
 *
 * SOLUTION (how Revit / Cinema 4D draw CAD linework): the underlay is NOT shaded geometry — it is
 * reference linework drawn in a DEDICATED FORWARD PASS *after* the lit scene + post-FX, depth-
 * tested against the scene depth but never touched by SSAO / GI / tone-mapping. The underlay group
 * stays a normal child of the scene (so picking / bounds / section keep seeing it) but the converter
 * keeps it `visible = false` so the MAIN render skips it; this module renders ONLY that subtree, on
 * top of the already-laid scene depth, into whichever target the caller has bound:
 *   • composer path  → `UnderlayPass` inserted before the final CopyPass renders into the composer
 *                      readBuffer (which still holds the RenderPass scene depth) → no AO multiply.
 *   • raster/section → `renderUnderlay()` called after the direct scene render (screen depth intact).
 *
 * The underlay root is resolved through its OWNER (`DxfToThreeConverter.getRoot()`, mirror of
 * `getBounds()`) — the same accessor-dep SSoT the section renderer uses for `getDxfBounds` /
 * `getBimGroup`; this module never re-scans the scene graph for it.
 *
 * Because the underlay is drawn AFTER the scene depth with the default `LessEqualDepth` func, a
 * coplanar line at exactly the floor plane deterministically WINS the equal-depth test (drawn on
 * top, no z-fight race), while a wall genuinely in front has strictly smaller depth and correctly
 * OCCLUDES the underlay — exactly a DWG-link underlay. Identical in motion and at idle.
 */

import type * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';

/** Resolves the underlay root from its owner (`DxfToThreeConverter.getRoot()`); null = nothing to draw. */
export type UnderlayRootGetter = () => THREE.Object3D | null;

/**
 * Render the DXF underlay subtree into the CURRENTLY BOUND render target, on top of the existing
 * depth, without clearing. No-op when there is no underlay. The group is rendered standalone
 * (`renderer.render(root, camera)`) so only its linework/text is drawn — a Group root carries no
 * background/fog/overrideMaterial, so nothing else in the bound target is disturbed. The converter
 * keeps the root `visible=false` (so the main render skips it); this flips it on only for this pass.
 */
export function renderUnderlay(
  renderer: THREE.WebGLRenderer,
  root: THREE.Object3D | null,
  camera: THREE.Camera,
): void {
  if (!root) return;
  const prevAutoClear = renderer.autoClear;
  const prevVisible = root.visible;
  renderer.autoClear = false; // never wipe the lit scene already in the target
  root.visible = true;
  renderer.render(root, camera);
  root.visible = prevVisible; // restore to false → main render keeps skipping it
  renderer.autoClear = prevAutoClear;
}

/**
 * EffectComposer pass that draws the underlay into the composer readBuffer AFTER SSAO but before
 * the final CopyPass. `needsSwap = false` keeps it on the same buffer the SSAO multiply wrote
 * (and whose depth attachment still holds the RenderPass scene depth), so the underlay is depth-
 * correct yet untouched by the AO composite.
 */
export class UnderlayPass extends Pass {
  private readonly getRoot: UnderlayRootGetter;
  private readonly getCamera: () => THREE.Camera;

  constructor(getRoot: UnderlayRootGetter, getCamera: () => THREE.Camera) {
    super();
    this.getRoot = getRoot;
    this.getCamera = getCamera;
    this.needsSwap = false;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderUnderlay(renderer, this.getRoot(), this.getCamera());
  }
}
