/**
 * baseline-tracker — ADR-366 §C.7.Q5
 *
 * Per-user, per-render-mode FPS baseline maintained in LocalStorage.
 * Rolling 7-day sample window. Robust statistics (median + MAD) used
 * for outlier detection by regression-detector.
 *
 * Pure module: LocalStorage I/O via the storage-utils SSoT (ADR-092) —
 * SSR-safe / quota-guarded; absent storage degrades gracefully to no-baseline.
 */

import type { HudRenderMode } from './hud-render-mode';
import { median } from '../../utils/statistics';
import { storageGet, storageSet, storageRemove } from '../../utils/storage-utils';

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

function lsKey(mode: HudRenderMode): string {
  return `bim3d.performanceBaseline.${mode}`;
}

function readStored(mode: HudRenderMode): StoredSamples {
  const parsed = storageGet<Partial<StoredSamples>>(lsKey(mode), { samples: [] });
  if (!Array.isArray(parsed.samples)) return { samples: [] };
  return { samples: parsed.samples };
}

function writeStored(mode: HudRenderMode, data: StoredSamples): void {
  storageSet(lsKey(mode), data);
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
  recordSample(mode: HudRenderMode, fps: number, now: number = Date.now()): void {
    const data = readStored(mode);
    data.samples.push({ t: now, fps });
    const pruned = pruneOld(data.samples, now);
    writeStored(mode, { samples: pruned });
  },

  getBaseline(mode: HudRenderMode, now: number = Date.now()): BaselineStats | null {
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

  clear(mode: HudRenderMode): void {
    storageRemove(lsKey(mode));
  },
};
