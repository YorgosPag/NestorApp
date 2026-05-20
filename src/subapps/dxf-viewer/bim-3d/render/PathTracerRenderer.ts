import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

const PREVIEW_MAX_SAMPLES = 256;

/**
 * Wraps three-gpu-pathtracer for idle-triggered preview path tracing.
 * Phase 5C: preview only (silent, no UI). Phase 6 adds the final-render dialog.
 *
 * Lifecycle:
 *   idle ≥800ms → start() → renderSample() per RAF frame until maxSamples
 *   camera moves → cancel() → RAF falls back to ssaoModulator.render()
 */
export class PathTracerRenderer {
  private readonly pathTracer: WebGLPathTracer;
  private readonly scene: THREE.Scene;
  private readonly getCamera: () => THREE.Camera;
  private _isActive = false;
  private sceneNeedsUpdate = true;

  get isActive(): boolean { return this._isActive; }

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    getCamera: () => THREE.Camera,
  ) {
    this.scene = scene;
    this.getCamera = getCamera;
    this.pathTracer = new WebGLPathTracer(renderer);
    this.pathTracer.renderScale = 1;
    this.pathTracer.minSamples = 1;
  }

  /** Call after scene geometry changes so BVH rebuilds on next start(). */
  invalidateScene(): void {
    this.sceneNeedsUpdate = true;
  }

  start(): void {
    const camera = this.getCamera();
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    try {
      if (this.sceneNeedsUpdate) {
        this.pathTracer.setScene(this.scene, camera);
        this.sceneNeedsUpdate = false;
      } else {
        // setCamera also resets samples so accumulation restarts at new view
        this.pathTracer.setCamera(camera);
      }
    } catch {
      // Scene not ready (empty BVH or no geometry) — skip silently
      return;
    }
    this._isActive = true;
  }

  cancel(): void {
    this._isActive = false;
  }

  renderSample(): void {
    if (!this._isActive) return;
    // Abort if user switched to ortho while path tracer was active
    if (!(this.getCamera() instanceof THREE.PerspectiveCamera)) {
      this._isActive = false;
      return;
    }
    this.pathTracer.renderSample();
    if (this.pathTracer.samples >= PREVIEW_MAX_SAMPLES) {
      this._isActive = false;
    }
  }

  dispose(): void {
    this._isActive = false;
    try { this.pathTracer.dispose(); } catch { /* ignore dispose errors */ }
  }
}
