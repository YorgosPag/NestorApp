import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import type { FinalRenderConfig } from '../stores/ViewMode3DStore';

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
  private _isFinalMode = false;
  private _finalMaxSamples = 256;
  private _onFinalProgress: ((pct: number) => void) | null = null;
  private _onFinalComplete: (() => void) | null = null;
  private sceneNeedsUpdate = true;

  get isActive(): boolean { return this._isActive; }
  get isFinalMode(): boolean { return this._isFinalMode; }

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
    // Note: callers (ThreeJsSceneManager.onIdle) guard for BIM mesh existence before
    // calling start(). scene.traverse() here would give false-positives from SectionBox
    // sphere handles (always in scene, visible=false). Guard is in the caller.
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
      this._isFinalMode = false;
      return;
    }
    this.pathTracer.renderSample();
    const samples = this.pathTracer.samples;

    if (this._isFinalMode) {
      const pct = Math.min(100, Math.round((samples / this._finalMaxSamples) * 100));
      this._onFinalProgress?.(pct);
      if (samples >= this._finalMaxSamples) {
        this._isActive = false;
        this._isFinalMode = false;
        const cb = this._onFinalComplete;
        this._onFinalProgress = null;
        this._onFinalComplete = null;
        cb?.();
      }
    } else if (samples >= PREVIEW_MAX_SAMPLES) {
      this._isActive = false;
    }
  }

  startFinal(
    config: FinalRenderConfig,
    onProgress: (pct: number) => void,
    onComplete: () => void,
  ): void {
    const camera = this.getCamera();
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    try {
      this.pathTracer.setScene(this.scene, camera);
      this.sceneNeedsUpdate = false;
    } catch {
      return;
    }
    this._finalMaxSamples = config.presetSPP;
    this._onFinalProgress = onProgress;
    this._onFinalComplete = onComplete;
    this._isFinalMode = true;
    this._isActive = true;
  }

  cancelFinal(): void {
    this._isFinalMode = false;
    this._isActive = false;
    this._onFinalProgress = null;
    this._onFinalComplete = null;
  }

  dispose(): void {
    this._isActive = false;
    try { this.pathTracer.dispose(); } catch { /* ignore dispose errors */ }
  }
}
