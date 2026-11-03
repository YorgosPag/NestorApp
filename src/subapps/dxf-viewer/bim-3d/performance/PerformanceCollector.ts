/**
 * PerformanceCollector — ADR-366 §B.5
 *
 * Pure class (no React). Owned by ThreeJsSceneManager.
 * Polls renderer.info every 250ms, applies EMA smoothing to FPS,
 * and pushes a PerformanceMetricsSnapshot into PerformanceHUDStore.
 *
 * Near-zero cost when HUD is disabled: the tick reads ONE fps number for the
 * always-on observers (baseline, regression, low-FPS prompt) and builds the
 * full snapshot (scene traversal) only when something consumes it.
 *
 * Usage:
 *   const collector = new PerformanceCollector(renderer, scene);
 *   collector.start();   // begin 250ms interval
 *   collector.dispose(); // stop and clean up
 */

import * as THREE from 'three';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { baselineTracker } from './baseline-tracker';
import { createRegressionDetector } from './regression-detector';
import { regressionAlertBus } from './regression-alert-bus';
import { autoSubmitFpsThreshold } from './auto-submit-fps-threshold';
import { autoSubmitStore } from './auto-submit-store';
import { telemetryBatcher } from '../telemetry/telemetry-batcher';
import { DXF_TIMING } from '../../config/dxf-timing';
import { UnifiedFrameScheduler } from '../../rendering/core/UnifiedFrameScheduler';
import { readCpuMemoryMb, commitPerformanceSnapshot } from './performance-collector-shared';
import { computeSceneRenderStats } from './scene-render-stats';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';
import type { HudRenderMode } from './hud-render-mode';

// Single source: DXF_TIMING.lifecycle.PERFORMANCE_HUD_POLL (ADR-516) — shared with Performance2DCollector.
const TICK_MS = DXF_TIMING.lifecycle.PERFORMANCE_HUD_POLL;

export class PerformanceCollector {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private unsubscribeFrame: (() => void) | null = null;
  /**
   * REAL fps from the master RAF loop (`UnifiedFrameScheduler.processFrame` →
   * `averageFps`), the SAME SSoT source the 2D collector consumes. The previous
   * `1000 / (setInterval elapsed)` formula measured the 250ms poll cadence, NOT
   * rendered frames — it pinned fps at ~4 (1000/250) regardless of real speed.
   */
  private latestAverageFps = 0;
  private readonly regressionDetector = createRegressionDetector((payload) =>
    regressionAlertBus.emit(payload),
  );

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
  }

  start(): void {
    if (this.intervalId !== null) return;
    // Reuse the exact frame-metrics SSoT the master scheduler already drives
    // (same pattern as Performance2DCollector / DxfPerformanceOptimizer).
    this.unsubscribeFrame = UnifiedFrameScheduler.onFrame((m) => {
      this.latestAverageFps = m.averageFps;
    });
    this.intervalId = setInterval(this.tick, TICK_MS);
  }

  stop(): void {
    if (this.unsubscribeFrame) {
      this.unsubscribeFrame();
      this.unsubscribeFrame = null;
    }
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  dispose(): void {
    this.stop();
  }

  /**
   * Arrow function preserves `this` inside setInterval callback.
   *
   * Tiers (ADR-366 §C.7.Q4):
   *   1. The low-FPS prompt detector runs on EVERY tick, HUD open or not — it
   *      reads one number, no scene traversal, no storage. Before, it lived
   *      behind the HUD gate, so only users with the HUD open could ever be asked.
   *   2. Baseline + regression (Q5) stay behind the HUD gate: the baseline
   *      tracker round-trips its LocalStorage sample list on every call, a cost
   *      not to impose on every viewer session (see ADR-366 changelog 2026-11-03).
   *   3. The full snapshot (scene traversal) is built only when consumed: the
   *      HUD, telemetry opt-in, or a prompt that just opened (frozen into it).
   */
  private readonly tick = (): void => {
    const hud = usePerformanceHUDStore.getState();
    // The 3D collector observes 3D only — a slow 2D plan must never produce a
    // report carrying a 3D screenshot.
    if (hud.renderMode === '2d') return;

    // WALL-CLOCK, not performance.now(): baseline samples, regression cooldown
    // and the decline cooldown are persisted in LocalStorage and compared with
    // Date.now() written by other code. A page-relative clock made them
    // incomparable (a declined prompt stayed «cooling down» indefinitely).
    const now = Date.now();
    const fps = Math.max(0, Math.round(this.latestAverageFps));
    const promptTriggered = autoSubmitFpsThreshold.observe(fps, now);

    if (!hud.enabled && !promptTriggered && !telemetryBatcher.isActive()) return;

    const snapshot = this.buildSnapshot(fps);
    if (promptTriggered) autoSubmitStore.getState().openPrompt(fps, now, snapshot);
    if (hud.enabled) {
      commitPerformanceSnapshot(snapshot);
      this.observeRegression(hud.renderMode, hud.regressionAlertsEnabled, fps, now);
    }

    // C.7.Q3 — anonymous telemetry batcher (no-op unless opted in).
    telemetryBatcher.observe(snapshot, hud.renderMode, now);
  };

  /** Q5 — baseline always records while the HUD is on; alerts follow the user toggle. */
  private observeRegression(
    renderMode: HudRenderMode,
    regressionAlertsEnabled: boolean,
    fps: number,
    now: number,
  ): void {
    baselineTracker.recordSample(renderMode, fps, now);
    if (regressionAlertsEnabled) {
      this.regressionDetector.evaluate(renderMode, fps, now);
    } else {
      this.regressionDetector.reset();
    }
  }

  private buildSnapshot(fps: number): PerformanceMetricsSnapshot {
    const info = this.renderer.info;

    // Triangles/vertices/object counts: derived from the scene graph, NOT renderer.info.
    // The scene renders via EffectComposer (SSAO + overlay passes), so info.render
    // reflects only the final pass (triangles=0, drawCalls=3 for the whole scene).
    // Scene traversal is composer-independent and stable. See scene-render-stats.ts.
    const stats = computeSceneRenderStats(this.scene);

    // GPU memory rough estimate from geometry + texture counts.
    // Each geometry ≈ 50 KB avg, each texture ≈ 4 MB avg.
    const gpuMemoryMb = parseFloat(
      ((info.memory.geometries * 50_000 + info.memory.textures * 4_194_304) / 1_048_576).toFixed(1),
    );

    // CPU heap — Chrome-only (performance.memory API). SSoT shared with the 2D collector.
    const cpuMemoryMb = readCpuMemoryMb();

    const snapshot: PerformanceMetricsSnapshot = {
      fps,
      frameTimeMs: parseFloat((1000 / Math.max(1, fps)).toFixed(1)),
      triangles:     stats.triangles,
      vertices:      stats.vertices,
      drawCalls:     info.render.calls,
      objectsVisible: stats.meshVisible,
      objectsTotal:  stats.meshTotal,
      gpuMemoryMb,
      cpuMemoryMb,
      samplesPerSec: null, // Path-tracer Phase 4 — not yet implemented
    };
    return snapshot;
  }
}
