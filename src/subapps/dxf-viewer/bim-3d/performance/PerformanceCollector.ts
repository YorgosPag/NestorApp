/**
 * PerformanceCollector — ADR-366 §B.5
 *
 * Pure class (no React). Owned by ThreeJsSceneManager.
 * Polls renderer.info every 250ms, applies EMA smoothing to FPS,
 * and pushes a PerformanceMetricsSnapshot into PerformanceHUDStore.
 *
 * Zero-cost when HUD is disabled: the tick checks the store flag first.
 *
 * Usage:
 *   const collector = new PerformanceCollector(renderer, scene);
 *   collector.start();   // begin 250ms interval
 *   collector.dispose(); // stop and clean up
 */

import * as THREE from 'three';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { usePerformanceHistoryStore } from './PerformanceHistoryStore';
import { baselineTracker } from './baseline-tracker';
import { createRegressionDetector } from './regression-detector';
import { regressionAlertBus } from './regression-alert-bus';
import { autoSubmitFpsThreshold } from './auto-submit-fps-threshold';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

// Chrome-only Performance API extension
type ChromePerformance = Performance & { memory?: { usedJSHeapSize: number } };

// Three.js render info may include vertices in older builds
type ExtendedRenderInfo = THREE.WebGLRenderer['info']['render'] & { vertices?: number };

const TICK_MS = 250;
/** EMA smoothing factor: 0.1 = heavily smoothed (reacts slowly to spikes). */
const EMA_ALPHA = 0.1;

export class PerformanceCollector {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = performance.now();
  private smoothFps: number = 60;
  private readonly regressionDetector = createRegressionDetector((payload) =>
    regressionAlertBus.emit(payload),
  );

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.lastTickTime = performance.now();
    this.intervalId = setInterval(this.tick, TICK_MS);
  }

  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  dispose(): void {
    this.stop();
  }

  // Arrow function preserves `this` inside setInterval callback.
  private readonly tick = (): void => {
    if (!usePerformanceHUDStore.getState().enabled) return;

    const now = performance.now();
    const elapsed = now - this.lastTickTime;
    this.lastTickTime = now;

    // EMA-smoothed FPS. elapsed is in ms, so fps = 1000/elapsed.
    const rawFps = elapsed > 0 ? 1000 / elapsed : this.smoothFps;
    this.smoothFps = this.smoothFps * (1 - EMA_ALPHA) + rawFps * EMA_ALPHA;
    const fps = Math.max(0, Math.round(this.smoothFps));

    const info = this.renderer.info;
    const render = info.render as ExtendedRenderInfo;

    // Vertices: use native field if available (older Three.js), otherwise estimate.
    const vertices = render.vertices ?? render.triangles * 3;

    // GPU memory rough estimate from geometry + texture counts.
    // Each geometry ≈ 50 KB avg, each texture ≈ 4 MB avg.
    const gpuMemoryMb = parseFloat(
      ((info.memory.geometries * 50_000 + info.memory.textures * 4_194_304) / 1_048_576).toFixed(1),
    );

    // CPU heap — Chrome-only (performance.memory API).
    const chromePerf = performance as ChromePerformance;
    const cpuMemoryMb = chromePerf.memory
      ? parseFloat((chromePerf.memory.usedJSHeapSize / 1_048_576).toFixed(1))
      : null;

    const snapshot: PerformanceMetricsSnapshot = {
      fps,
      frameTimeMs: parseFloat((1000 / Math.max(1, fps)).toFixed(1)),
      triangles:     render.triangles,
      vertices,
      drawCalls:     render.calls,
      objectsVisible: this.scene.children.length,
      // info.programs is the array of compiled shader programs — proxy for distinct materials.
      objectsTotal:  info.programs?.length ?? 0,
      gpuMemoryMb,
      cpuMemoryMb,
      samplesPerSec: null, // Path-tracer Phase 4 — not yet implemented
    };

    const hudState = usePerformanceHUDStore.getState();
    hudState.updateMetrics(snapshot);
    usePerformanceHistoryStore.getState().pushSample(snapshot);

    // Baseline + regression detection feed the same sample stream. Baseline
    // records always when HUD is on; alerts are gated by the user toggle.
    baselineTracker.recordSample(hudState.renderMode, snapshot.fps, now);
    if (hudState.regressionAlertsEnabled) {
      this.regressionDetector.evaluate(hudState.renderMode, snapshot.fps, now);
    } else {
      this.regressionDetector.reset();
    }

    // C.7.Q4 — sustained FPS<10 auto-submit consent FSM. Store-gated:
    // permanent opt-out and Q3 telemetry opt-in both short-circuit inside.
    autoSubmitFpsThreshold.observe(snapshot.fps, now);
  };
}
