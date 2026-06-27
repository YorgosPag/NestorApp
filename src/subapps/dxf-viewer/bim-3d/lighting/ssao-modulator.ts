import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { DXF_TIMING } from '../../config/dxf-timing';
import type { SelectionOutlinePass } from '../systems/selection/SelectionOutlinePass';
import { PostFxOverlayPass, renderPostFxOverlays } from '../scene/post-fx-overlay-pass';

const SSAO_TRANSITION_MS = DXF_TIMING.animation.DEFAULT; // ADR-516
const IS_LOW_PERF = typeof navigator !== 'undefined' && navigator.hardwareConcurrency < 4;

/**
 * SSAOPass subclass that hides LineSegments before the normal-buffer render.
 *
 * SSAOPass.overrideVisibility() already handles isLine objects, so this is a
 * defensive belt-and-suspenders guard. Kept because BimSSAOPass is the right
 * place to enforce this invariant regardless of upstream Three.js changes.
 */
class BimSSAOPass extends SSAOPass {
  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean,
  ): void {
    const hidden: THREE.LineSegments[] = [];
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.LineSegments && obj.visible) {
        obj.visible = false;
        hidden.push(obj);
      }
    });
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    for (const obj of hidden) obj.visible = true;
  }
}

export class SSAOModulator {
  readonly composer: EffectComposer;
  private readonly ssaoPass: BimSSAOPass;
  private readonly renderPass: RenderPass;
  /** ADR-537 — draws the registered post-FX overlays (DXF underlay + gizmo) AFTER SSAO, AO-immune. */
  private readonly overlayPass: PostFxOverlayPass;
  private readonly getCamera: () => THREE.Camera;
  private readonly onNeedsRender: () => void;
  /** ADR-536 — silhouette selection outline, composited inside this composer. */
  private readonly outlinePass: SelectionOutlinePass | undefined;
  private animFrame: number | null = null;
  private warmedUp = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    getCamera: () => THREE.Camera,
    width: number,
    height: number,
    onNeedsRender: () => void = () => {},
    outlinePass?: SelectionOutlinePass,
  ) {
    this.getCamera = getCamera;
    this.onNeedsRender = onNeedsRender;
    this.outlinePass = outlinePass;
    const camera = getCamera();

    this.renderPass = new RenderPass(scene, camera);
    this.ssaoPass = new BimSSAOPass(scene, camera as THREE.PerspectiveCamera, width, height);
    this.ssaoPass.kernelRadius = 8;
    this.ssaoPass.minDistance = 0.001;
    this.ssaoPass.maxDistance = 0.1;
    this.ssaoPass.output = SSAOPass.OUTPUT.Default;
    this.ssaoPass.enabled = false;

    // CopyPass must be the last pass so SSAOPass is never renderToScreen=true.
    // SSAOPass.Output.Default uses multiply blending (DstColorFactor) onto its
    // render target. When renderToScreen=true it targets the screen (null),
    // and each frame compounds: SSAO × (SSAO × scene) → SSAO^N → black.
    // As a middle pass (renderToScreen=false) it correctly does SSAO × readBuffer
    // (= current frame's scene colors) once per frame.
    const copyPass = new ShaderPass(CopyShader);
    copyPass.material.blending = THREE.NoBlending;

    // ADR-537 — the registered post-FX overlays (DXF underlay + edit gizmo) are drawn here, AFTER
    // the SSAO multiply but BEFORE the final CopyPass, into the composer readBuffer (which still
    // holds the RenderPass scene depth). So they are depth-tested against the model (walls occlude
    // the underlay; the gizmo is `depthTest:false` always-on-top) yet never AO-shaded — identical
    // to the raster path. Like Revit/Cinema-4D CAD linework + manipulators.
    this.overlayPass = new PostFxOverlayPass(scene, getCamera);

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.ssaoPass);
    this.composer.addPass(this.overlayPass);
    this.composer.addPass(copyPass);
    // ADR-536 — the outline is NOT a composer pass: it is composited after the scene
    // render on every path (incl. the section-cut path that bypasses this composer),
    // via renderOutlineOverlayToScreen(). Kept here only to drive size/camera/dispose.
  }

  onCameraActive(): void {
    this.cancelAnim();
    this.ssaoPass.enabled = false;
  }

  onCameraIdle(): void {
    if (IS_LOW_PERF) return;
    if (this.animFrame !== null) return;
    const camera = this.getCamera();
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const start = performance.now();
    this.ssaoPass.enabled = true;
    this.ssaoPass.kernelRadius = 0;
    // Mark the scene dirty so the master scheduler renders the SSAO composer
    // path (isSsaoActive() is now true). Without this the ramp would mutate
    // kernelRadius invisibly — the scene would never redraw at idle.
    this.onNeedsRender();

    const animate = () => {
      const t = Math.min((performance.now() - start) / SSAO_TRANSITION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.ssaoPass.kernelRadius = 8 * eased;
      this.onNeedsRender();
      if (t < 1) {
        this.animFrame = requestAnimationFrame(animate);
      } else {
        this.animFrame = null;
      }
    };
    this.animFrame = requestAnimationFrame(animate);
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.ssaoPass.setSize(width, height);
    // ADR-536 — the outline mask RT auto-sizes per frame from the drawing buffer.
  }

  /** Emergency SSAO disable — called from scene-render-frame when composer throws. */
  disableSSAO(): void {
    this.cancelAnim();
    this.ssaoPass.enabled = false;
    // Fallback: direct render without post-processing.
    const camera = this.getCamera();
    try {
      this.composer.renderer.setRenderTarget(null);
      this.composer.renderer.render(this.renderPass.scene, camera);
      // ADR-537 — keep the post-FX overlays visible on the emergency fallback path too.
      renderPostFxOverlays(this.composer.renderer, this.renderPass.scene, camera);
    } catch { /* ignore fallback failures */ }
  }

  /** True when SSAO is on and the composer path must run this frame. */
  isSsaoActive(): boolean {
    return this.ssaoPass.enabled;
  }

  /**
   * ADR-536 — composite the selection silhouette onto the screen, ON TOP of whatever
   * the current frame rendered (raster / SSAO / section caps). Caller invokes it AFTER
   * the scene render. Syncs the outline camera to the live camera first. No-op without
   * a selection.
   */
  renderOutlineOverlayToScreen(): void {
    if (!this.outlinePass) return;
    this.outlinePass.setCamera(this.getCamera());
    this.outlinePass.renderOverlayToScreen(this.composer.renderer);
  }

  /**
   * Direct single-pass render, bypassing EffectComposer/SSAO entirely.
   * Used on every interaction frame (orbit/zoom) — the industry "adaptive
   * degradation" path (Revit Ambient Shadows, Forge/APS Viewer): expensive
   * post-FX is skipped while the camera moves, then `render()` (SSAO) takes
   * over once the camera settles. Avoids the per-frame FBO+CopyPass round-trip
   * and the program churn that the composer path incurs during navigation.
   */
  renderRaster(): void {
    const camera = this.getCamera();
    const renderer = this.composer.renderer;
    renderer.setRenderTarget(null);
    // The EffectComposer leaves `renderer.autoClear = false` after it runs (it clears per-pass,
    // not globally) — incl. the one-shot `warmUp()` on init. Without forcing it back on here, this
    // direct raster pass NEVER clears the colour/depth buffer, so SEMI-TRANSPARENT overlays (the DXF
    // floor-plan LineSegments, opacity 0.65) blend over their own previous frame every tick and
    // accumulate to WHITE — while opaque geometry overwrites and stays correct. The section-cut
    // path stayed correct because it sets `autoClear = true` itself. (Only bites weak GPUs, where
    // SSAO never enables so EVERY settled frame also goes through here.)
    renderer.autoClear = true;
    renderer.render(this.renderPass.scene, camera);
    this.renderPass.scene.overrideMaterial = null;
    // ADR-537 — draw the post-FX overlays on top of the just-rendered scene (screen depth intact),
    // so the navigation/raster path matches the idle/SSAO composer path exactly.
    renderPostFxOverlays(renderer, this.renderPass.scene, camera);
  }

  /**
   * Pre-compile the SSAO/composer shader programs once, so the first idle frame
   * after navigation does not stall on shader link (the `getUniforms` pause).
   * Renders one composer frame to the internal targets with SSAO forced on, then
   * restores the prior enabled state. Idempotent — owns its own once-guard so
   * callers can invoke it freely (Three.js also caches linked programs).
   */
  warmUp(): void {
    if (this.warmedUp) return;
    const camera = this.getCamera();
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    this.warmedUp = true;
    const prevEnabled = this.ssaoPass.enabled;
    try {
      this.renderPass.camera = camera;
      this.ssaoPass.camera = camera;
      this.ssaoPass.enabled = true;
      this.composer.render();
    } catch {
      /* warm-up best-effort; lazy compile on first idle is the fallback */
    } finally {
      this.ssaoPass.enabled = prevEnabled;
      this.renderPass.scene.overrideMaterial = null;
    }
  }

  render(): void {
    const camera = this.getCamera();
    const isPerspective = camera instanceof THREE.PerspectiveCamera;
    this.renderPass.camera = camera;
    this.ssaoPass.camera = camera as THREE.PerspectiveCamera;
    if (!isPerspective) this.ssaoPass.enabled = false;
    this.composer.render();
    // Safety: SSAOPass sets scene.overrideMaterial = MeshNormalMaterial during
    // its normal-buffer pass. If it fails to restore the override (exception or
    // early return), every subsequent frame renders grey normals instead of
    // actual materials. Force-reset after every frame to prevent corruption.
    this.renderPass.scene.overrideMaterial = null;
  }

  dispose(): void {
    this.cancelAnim();
    this.composer.dispose();
    this.ssaoPass.dispose();
    this.outlinePass?.dispose(); // ADR-536 — owned here (composited after the scene render).
  }

  private cancelAnim(): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }
}
