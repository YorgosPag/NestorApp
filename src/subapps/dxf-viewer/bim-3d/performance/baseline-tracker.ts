/**
 * baseline-tracker — ADR-366 §C.7.Q5
 *
 * Per-user, per-render-mode FPS baseline maintained in LocalStorage.
 * Rolling 7-day sample window. Robust statistics (median + MAD) used
 * for outlier detection by regression-detector.
 *
 * Pure module: LocalStorage I/O wrapped in try/catch for SSR / private
 * browsing; absent storage degrades gracefully to no-baseline.
 */

import type { Bim3dRenderMode } from './per-mode-promotion';

export const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MIN_SAMPLES_FOR_BASELINE = 30;
const MAX_SAMPLES_PER_MODE = 2000;

export interface BaselineStats {
  median: number;
  mad: number;
  sampleCount: number;
  lastUpdated: number;
}

interface StoredSamples {
  samples: { t: number; fps: number }[];
}

function lsKey(mode: Bim3dRenderMode): string {
  return `bim3d.performanceBaseline.${mode}`;
}

function readStored(mode: Bim3dRenderMode): StoredSamples {
  try {
    const raw = localStorage.getItem(lsKey(mode));
    if (!raw) return { samples: [] };
    const parsed = JSON.parse(raw) as Partial<StoredSamples>;
    if (!Array.isArray(parsed.samples)) return { samples: [] };
    return { samples: parsed.samples };
  } catch {
    return { samples: [] };
  }
}

function writeStored(mode: Bim3dRenderMode, data: StoredSamples): void {
  try {
    localStorage.setItem(lsKey(mode), JSON.stringify(data));
  } catch { /* quota / SSR */ }
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Tukey 1977 median absolute deviation — robust outlier-resistant spread. */
function mad(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = median(sorted);
  const deviations = values.map((v) => Math.abs(v - m)).sort((a, b) => a - b);
  return median(deviations);
}

function pruneOld(samples: { t: number; fps: number }[], now: number): { t: number; fps: number }[] {
  const cutoff = now - ROLLING_WINDOW_MS;
  const pruned = samples.filter((s) => s.t >= cutoff);
  if (pruned.length > MAX_SAMPLES_PER_MODE) {
    return pruned.slice(pruned.length - MAX_SAMPLES_PER_MODE);
  }
  return pruned;
}

export const baselineTracker = {
  recordSample(mode: Bim3dRenderMode, fps: number, now: number = Date.now()): void {
    const data = readStored(mode);
    data.samples.push({ t: now, fps });
    const pruned = pruneOld(data.samples, now);
    writeStored(mode, { samples: pruned });
  },

  getBaseline(mode: Bim3dRenderMode, now: number = Date.now()): BaselineStats | null {
    const data = readStored(mode);
    const pruned = pruneOld(data.samples, now);
    if (pruned.length < MIN_SAMPLES_FOR_BASELINE) return null;
    const values = pruned.map((s) => s.fps);
    const sorted = [...values].sort((a, b) => a - b);
    const med = median(sorted);
    return {
      median: med,
      mad: mad(values),
      sampleCount: pruned.length,
      lastUpdated: pruned[pruned.length - 1].t,
    };
  },

  clear(mode: Bim3dRenderMode): void {
    try { localStorage.removeItem(lsKey(mode)); } catch { /* ignore */ }
  },
};
