import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

const SSAO_TRANSITION_MS = 300;
const IS_LOW_PERF = typeof navigator !== 'undefined' && navigator.hardwareConcurrency < 4;

export class SSAOModulator {
  readonly composer: EffectComposer;
  private readonly ssaoPass: SSAOPass;
  private readonly renderPass: RenderPass;
  private readonly getCamera: () => THREE.Camera;
  private animFrame: number | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    getCamera: () => THREE.Camera,
    width: number,
    height: number,
  ) {
    this.getCamera = getCamera;
    const camera = getCamera();

    this.renderPass = new RenderPass(scene, camera);
    this.ssaoPass = new SSAOPass(scene, camera as THREE.PerspectiveCamera, width, height);
    this.ssaoPass.kernelRadius = 8;
    this.ssaoPass.minDistance = 0.001;
    this.ssaoPass.maxDistance = 0.1;
    this.ssaoPass.output = SSAOPass.OUTPUT.Default;
    this.ssaoPass.enabled = false;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.ssaoPass);
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

    const animate = () => {
      const t = Math.min((performance.now() - start) / SSAO_TRANSITION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      this.ssaoPass.kernelRadius = 8 * eased;
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
    } catch { /* ignore fallback failures */ }
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
  }

  private cancelAnim(): void {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }
}
