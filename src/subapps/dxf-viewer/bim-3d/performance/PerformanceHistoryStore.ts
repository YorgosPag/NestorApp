/**
 * PerformanceHistoryStore — ADR-366 §C.7.Q1
 *
 * Per-metric circular buffer (240 samples @ 4Hz = 60s rolling window) feeding
 * the inline sparklines in PerformanceHUDExpanded.
 *
 * Memory: 8 metrics × 240 × Float32 = 7.5KB. Buffers allocated lazily on first
 * sample to avoid SSR-time work.
 *
 * Single producer (PerformanceCollector.tick), many consumers
 * (PerformanceHUDSparklines micro-leaves).
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { usePerformanceHUDStore } from './PerformanceHUDStore';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

export const SPARKLINE_METRICS = [
  'fps',
  'frameTimeMs',
  'triangles',
  'vertices',
  'drawCalls',
  'objectsVisible',
  'gpuMemoryMb',
  'cpuMemoryMb',
] as const;

export type SparklineMetric = (typeof SPARKLINE_METRICS)[number];

export const SAMPLE_BUFFER_SIZE = 240;

const LS_HISTORY_ENABLED = 'bim3d.performanceHud.historyEnabled';

function defaultHistoryEnabled(): boolean {
  try {
    const stored = localStorage.getItem(LS_HISTORY_ENABLED);
    if (stored !== null) return stored === 'true';
  } catch { /* SSR / private browsing */ }

  // Heuristic opt-out for low-end devices (research C.7.Q1).
  try {
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === 'number' && cores < 4) return false;
  } catch { /* SSR */ }

  return true;
}

function makeBuffers(): Record<SparklineMetric, Float32Array> {
  const out = {} as Record<SparklineMetric, Float32Array>;
  for (const m of SPARKLINE_METRICS) {
    out[m] = new Float32Array(SAMPLE_BUFFER_SIZE);
  }
  return out;
}

interface PerformanceHistoryState {
  enabled: boolean;
  buffers: Record<SparklineMetric, Float32Array>;
  writeIndex: number;
  samplesWritten: number;
  /** Bumped on every push/clear so consumers via useSyncExternalStore re-render. */
  revision: number;
}

interface PerformanceHistoryActions {
  setEnabled(v: boolean): void;
  pushSample(snapshot: PerformanceMetricsSnapshot): void;
  clearHistory(): void;
  getSeries(metric: SparklineMetric): readonly number[];
}

type PerformanceHistoryStoreType = PerformanceHistoryState & PerformanceHistoryActions;

export const usePerformanceHistoryStore = create<PerformanceHistoryStoreType>()(
  subscribeWithSelector((set, get) => ({
    enabled: defaultHistoryEnabled(),
    buffers: makeBuffers(),
    writeIndex: 0,
    samplesWritten: 0,
    revision: 0,

    setEnabled(v) {
      try { localStorage.setItem(LS_HISTORY_ENABLED, String(v)); } catch { /* ignore */ }
      set({ enabled: v });
    },

    pushSample(snapshot) {
      if (!get().enabled) return;
      if (!usePerformanceHUDStore.getState().enabled) return;

      const { buffers, writeIndex, samplesWritten } = get();
      const i = writeIndex;

      // WebGL-only metrics are null in 2D Canvas2D mode → store 0 in the sparkline buffer.
      buffers.fps[i]            = snapshot.fps;
      buffers.frameTimeMs[i]    = snapshot.frameTimeMs;
      buffers.triangles[i]      = snapshot.triangles ?? 0;
      buffers.vertices[i]       = snapshot.vertices ?? 0;
      buffers.drawCalls[i]      = snapshot.drawCalls ?? 0;
      buffers.objectsVisible[i] = snapshot.objectsVisible ?? 0;
      buffers.gpuMemoryMb[i]    = snapshot.gpuMemoryMb ?? 0;
      buffers.cpuMemoryMb[i]    = snapshot.cpuMemoryMb ?? 0;

      set({
        writeIndex: (i + 1) % SAMPLE_BUFFER_SIZE,
        samplesWritten: Math.min(samplesWritten + 1, SAMPLE_BUFFER_SIZE),
        revision: get().revision + 1,
      });
    },

    clearHistory() {
      set({
        buffers: makeBuffers(),
        writeIndex: 0,
        samplesWritten: 0,
        revision: get().revision + 1,
      });
    },

    getSeries(metric) {
      const { buffers, writeIndex, samplesWritten } = get();
      const buf = buffers[metric];
      if (samplesWritten === 0) return [];

      if (samplesWritten < SAMPLE_BUFFER_SIZE) {
        return Array.from(buf.subarray(0, samplesWritten));
      }
      // Full buffer — chronological order = [writeIndex .. end] + [0 .. writeIndex].
      const out = new Array<number>(SAMPLE_BUFFER_SIZE);
      for (let k = 0; k < SAMPLE_BUFFER_SIZE; k++) {
        out[k] = buf[(writeIndex + k) % SAMPLE_BUFFER_SIZE];
      }
      return out;
    },
  })),
);
