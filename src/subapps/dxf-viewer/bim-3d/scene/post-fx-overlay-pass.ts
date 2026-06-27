/**
 * post-fx-overlay-pass.ts — Revit/Maxon-grade post-FX UI/reference overlay pass (ADR-537).
 *
 * PROBLEM (generalised from the DXF underlay): any overlay that lives in the MAIN scene — the raw
 * DXF underlay (translucent wireframe + text) AND the edit gizmo (translucent negative axes /
 * plane handles / markers) — is corrupted by the idle render path. At settle the SSAO composer
 * multiplies the ambient-occlusion term over the whole frame and the warm sun/ground lighting
 * blends through the translucent fragments → the lines / gizmo axes turn "mustard" (and during
 * fast raster navigation translucent fragments accumulate to white). The opaque parts stay
 * correct, the translucent ones flip white-in-motion → mustard-at-settle. Plain `depthTest:false`
 * does NOT help: the corruption is the post-FX composite, not z-fighting.
 *
 * SOLUTION (how Revit / Cinema 4D draw CAD linework + manipulators): these are NOT shaded
 * geometry — they are reference/UI overlays drawn in a DEDICATED FORWARD PASS *after* the lit
 * scene + post-FX, depth-tested against the scene depth but never touched by SSAO / GI / tone-
 * mapping. Each overlay root is kept `visible = false` by its owner (so the MAIN render skips it);
 * this pass renders ONLY those roots, on top of the already-laid scene depth, into whichever
 * target the caller has bound:
 *   • composer path  → `PostFxOverlayPass` inserted before the final CopyPass renders into the
 *                      composer readBuffer (which still holds the RenderPass scene depth).
 *   • raster/section → `renderPostFxOverlays()` after the direct scene render (screen depth intact).
 *
 * Per-root MATERIALS decide depth behaviour in the SAME pass: the underlay uses `depthTest:true`
 * (occluded by walls, drawn on top of coplanar bases via the `LessEqualDepth` win), the gizmo uses
 * `depthTest:false` (always-on-top manipulator). One pass, mixed depth, all AO-immune.
 *
 * REGISTRY SSoT: owners (`DxfToThreeConverter`, `BimGizmoOverlay`) live in different layers
 * (scene-manager vs React) and recreate their roots, so they REGISTER a provider (keyed by the
 * scene they belong to) instead of being threaded through constructors. The pass reads the
 * registry — one mechanism for every "overlay that must bypass post-FX", scene-scoped so multiple
 * viewports never cross-talk.
 */

import type * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';

/** Returns the overlay roots to draw THIS frame (empty = nothing shown right now). */
export type OverlayRootsProvider = () => readonly THREE.Object3D[];

/** Per-scene set of overlay providers (scene-scoped → no cross-viewport bleed). */
const registries = new WeakMap<THREE.Object3D, Set<OverlayRootsProvider>>();

/**
 * Register a post-FX overlay provider for `scene`. The owner keeps its roots `visible=false` (so
 * the main render skips them) and returns, each frame, the subset that should currently be drawn.
 * Returns an unregister function (call it on dispose).
 */
export function registerPostFxOverlay(scene: THREE.Object3D, provider: OverlayRootsProvider): () => void {
  let set = registries.get(scene);
  if (!set) {
    set = new Set();
    registries.set(scene, set);
  }
  set.add(provider);
  return () => { set?.delete(provider); };
}

/** Collect every overlay root currently shown for `scene` (flattened across providers). */
export function collectPostFxOverlayRoots(scene: THREE.Object3D): THREE.Object3D[] {
  const set = registries.get(scene);
  if (!set || set.size === 0) return [];
  const out: THREE.Object3D[] = [];
  for (const provider of set) {
    for (const root of provider()) out.push(root);
  }
  return out;
}

/**
 * Render the registered overlay roots for `scene` into the CURRENTLY BOUND render target, on top
 * of the existing depth, without clearing. No-op when nothing is registered/shown. Each root is
 * rendered standalone (`renderer.render(root, camera)`) so only its geometry is drawn — a Group
 * root carries no background/fog/overrideMaterial. Roots are kept `visible=false` by their owners;
 * this flips each on ONLY for its own draw, then restores it (so the main render keeps skipping it).
 */
export function renderPostFxOverlays(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
): void {
  const roots = collectPostFxOverlayRoots(scene);
  if (roots.length === 0) return;
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false; // never wipe the lit scene already in the target
  for (const root of roots) {
    const prevVisible = root.visible;
    root.visible = true;
    renderer.render(root, camera);
    root.visible = prevVisible; // restore (false) → main render keeps skipping it
  }
  renderer.autoClear = prevAutoClear;
}

/**
 * EffectComposer pass that draws the post-FX overlays into the composer readBuffer AFTER SSAO but
 * before the final CopyPass. `needsSwap = false` keeps it on the same buffer the SSAO multiply
 * wrote (and whose depth attachment still holds the RenderPass scene depth), so the overlays are
 * depth-correct yet untouched by the AO composite.
 */
export class PostFxOverlayPass extends Pass {
  private readonly scene: THREE.Object3D;
  private readonly getCamera: () => THREE.Camera;

  constructor(scene: THREE.Object3D, getCamera: () => THREE.Camera) {
    super();
    this.scene = scene;
    this.getCamera = getCamera;
    this.needsSwap = false;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderPostFxOverlays(renderer, this.scene, this.getCamera());
  }
}
