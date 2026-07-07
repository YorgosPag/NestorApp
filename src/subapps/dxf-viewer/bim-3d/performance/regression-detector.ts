/**
 * regression-detector — ADR-366 §C.7.Q5
 *
 * Stateful FPS-drop detector. Compares each sample against per-mode baseline
 * (median - 2*MAD). Triggers callback after >30s continuous low FPS,
 * with 24h cooldown per mode.
 *
 * Pure-ish: no React, no DOM. Persists last-alert timestamps in LocalStorage.
 */

import type { HudRenderMode } from './hud-render-mode';
import { baselineTracker, type BaselineStats } from './baseline-tracker';
// 🏢 ADR-092 — persistence via the storage-utils SSoT (SSR-safe + quota-guarded + JSON),
// not hand-rolled getItem/Number/setItem. Non-reactive read-modify-write per call.
import { storageGet, storageSet } from '../../utils/storage-utils';

const SUSTAINED_LOW_MS = 30_000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAD_OUTLIER_K = 2;
const LS_LAST_ALERT_PREFIX = 'bim3d.regressionAlert.';

export interface RegressionAlertPayload {
  mode: HudRenderMode;
  fps: number;
  baseline: BaselineStats;
  threshold: number;
}

type AlertHandler = (payload: RegressionAlertPayload) => void;

function readLastAlert(mode: HudRenderMode): number {
  return storageGet<number>(LS_LAST_ALERT_PREFIX + mode, 0);
}

function writeLastAlert(mode: HudRenderMode, ts: number): void {
  storageSet(LS_LAST_ALERT_PREFIX + mode, ts);
}

export function createRegressionDetector(onAlert: AlertHandler) {
  let lowSince: number | null = null;
  let lastMode: HudRenderMode | null = null;

  return {
    /**
     * Evaluate one sample. Should be called at the Collector's tick rate.
     * Returns true iff an alert was just fired (for telemetry / tests).
     */
    evaluate(mode: HudRenderMode, fps: number, now: number = Date.now()): boolean {
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
