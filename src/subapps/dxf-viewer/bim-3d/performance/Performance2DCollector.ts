/**
 * Performance2DCollector — ADR-366 §B.5.U (unified 2D + 3D Performance HUD)
 *
 * 2D Canvas2D counterpart of PerformanceCollector. Pure class (no React).
 * Subscribes to UnifiedFrameScheduler frame metrics for REAL fps and polls
 * performance.memory for CPU heap. The WebGL-only metrics (triangles, vertices,
 * drawCalls, objectsVisible/Total, GPU memory, samplesPerSec) are reported as
 * null — they do not exist for a Canvas2D viewport.
 *
 * Writes the SAME PerformanceHUDStore + PerformanceHistoryStore as the 3D
 * collector, so ONE HUD serves both viewports. Owned by usePerformanceModeBridge.
 *
 * Single-writer invariant — each tick is double-gated on:
 *   (1) HUD enabled, and
 *   (2) ViewMode3DStore.mode === '2d'
 * so it never writes the shared store while the 3D collector is the active source.
 *
 * Zero-cost when the HUD is disabled: the tick checks the store flag first.
 *
 * Usage:
 *   const c = new Performance2DCollector();
 *   c.start();   // subscribe + 250ms interval
 *   c.dispose(); // unsubscribe + stop
 */

import { usePerformanceHUDStore } from './PerformanceHUDStore';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { UnifiedFrameScheduler } from '../../rendering/core/UnifiedFrameScheduler';
import { DXF_TIMING } from '../../config/dxf-timing';
import { readCpuMemoryMb, commitPerformanceSnapshot } from './performance-collector-shared';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

/** Match the 3D collector tick so the 60s history window (240 × 4Hz) is identical
 *  across modes. Single source: DXF_TIMING.lifecycle.PERFORMANCE_HUD_POLL (ADR-516). */
const TICK_MS = DXF_TIMING.lifecycle.PERFORMANCE_HUD_POLL;

export class Performance2DCollector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private unsubscribeFrame: (() => void) | null = null;
  private latestAverageFps = 0;

  start(): void {
    if (this.intervalId !== null) return;
    // Reuse the exact frame-metrics source the 2D viewport already drives
    // (same pattern as DxfPerformanceOptimizer).
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
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  // Arrow function preserves `this` inside setInterval callback.
  private readonly tick = (): void => {
    if (!usePerformanceHUDStore.getState().enabled) return;
    if (useViewMode3DStore.getState().mode !== '2d') return;

    const fps = Math.max(0, Math.round(this.latestAverageFps));

    const snapshot: PerformanceMetricsSnapshot = {
      fps,
      frameTimeMs: parseFloat((1000 / Math.max(1, fps)).toFixed(1)),
      // WebGL-only — N/A for Canvas2D.
      triangles: null,
      vertices: null,
      drawCalls: null,
      objectsVisible: null,
      objectsTotal: null,
      gpuMemoryMb: null,
      cpuMemoryMb: readCpuMemoryMb(),
      samplesPerSec: null,
    };

    commitPerformanceSnapshot(snapshot);
  };
}
