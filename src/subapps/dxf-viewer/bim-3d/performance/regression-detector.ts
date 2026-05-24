/**
 * regression-detector — ADR-366 §C.7.Q5
 *
 * Stateful FPS-drop detector. Compares each sample against per-mode baseline
 * (median - 2*MAD). Triggers callback after >30s continuous low FPS,
 * with 24h cooldown per mode.
 *
 * Pure-ish: no React, no DOM. Persists last-alert timestamps in LocalStorage.
 */

import type { Bim3dRenderMode } from './per-mode-promotion';
import { baselineTracker, type BaselineStats } from './baseline-tracker';

const SUSTAINED_LOW_MS = 30_000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAD_OUTLIER_K = 2;
const LS_LAST_ALERT_PREFIX = 'bim3d.regressionAlert.';

export interface RegressionAlertPayload {
  mode: Bim3dRenderMode;
  fps: number;
  baseline: BaselineStats;
  threshold: number;
}

type AlertHandler = (payload: RegressionAlertPayload) => void;

function readLastAlert(mode: Bim3dRenderMode): number {
  try {
    const raw = localStorage.getItem(LS_LAST_ALERT_PREFIX + mode);
    return raw ? Number(raw) : 0;
  } catch { return 0; }
}

function writeLastAlert(mode: Bim3dRenderMode, ts: number): void {
  try { localStorage.setItem(LS_LAST_ALERT_PREFIX + mode, String(ts)); } catch { /* ignore */ }
}

export function createRegressionDetector(onAlert: AlertHandler) {
  let lowSince: number | null = null;
  let lastMode: Bim3dRenderMode | null = null;

  return {
    /**
     * Evaluate one sample. Should be called at the Collector's tick rate.
     * Returns true iff an alert was just fired (for telemetry / tests).
     */
    evaluate(mode: Bim3dRenderMode, fps: number, now: number = Date.now()): boolean {
      // Mode change resets the sustained-low window.
      if (lastMode !== mode) {
        lowSince = null;
        lastMode = mode;
      }

      const baseline = baselineTracker.getBaseline(mode, now);
      if (!baseline) {
        lowSince = null;
        return false;
      }

      const threshold = baseline.median - MAD_OUTLIER_K * baseline.mad;
      const isLow = fps < threshold;

      if (!isLow) {
        lowSince = null;
        return false;
      }

      if (lowSince === null) {
        lowSince = now;
        return false;
      }

      if (now - lowSince < SUSTAINED_LOW_MS) return false;

      // Sustained low FPS detected. Check 24h cooldown per mode.
      const lastAlert = readLastAlert(mode);
      if (now - lastAlert < COOLDOWN_MS) return false;

      writeLastAlert(mode, now);
      lowSince = null;
      onAlert({ mode, fps, baseline, threshold });
      return true;
    },

    reset(): void {
      lowSince = null;
      lastMode = null;
    },
  };
}
