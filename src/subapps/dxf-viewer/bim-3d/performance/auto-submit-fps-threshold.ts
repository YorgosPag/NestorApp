/**
 * auto-submit-fps-threshold — ADR-366 §C.7.Q4
 *
 * Stateful threshold detector. Continuous FPS < 10 for >5s asks the user —
 * through a NON-modal warning, never silently (GDPR + UX trust) — whether to
 * send a diagnostic report. 30-min cooldown between prompts, permanent opt-out
 * terminal, and auto-skip when telemetry opt-in is on (Q3 already covers
 * continuous low-FPS samples via the batched anonymized stream).
 *
 * A hidden tab produces no frames, so there is nothing to measure: the
 * sustained-low window is reset while the page is not visible (no false alarm
 * from a backgrounded tab, no stale reading carried across the gap).
 *
 * Pure-ish: no React. The telemetry opt-in flag and page visibility are
 * queried via injectable probes, so this module stays decoupled from Q3 and
 * testable without a DOM. State lives in auto-submit-store.
 */

import { autoSubmitStore } from './auto-submit-store';
import { DXF_TIMING } from '../../config/dxf-timing';

export const LOW_FPS_THRESHOLD = 10;
// Timing SSoT: DXF_TIMING.lifecycle (ADR-516). Local aliases keep the call sites readable.
export const SUSTAINED_LOW_MS = DXF_TIMING.lifecycle.LOW_FPS_SUSTAINED;
export const PROMPT_COOLDOWN_MS = DXF_TIMING.lifecycle.LOW_FPS_PROMPT_COOLDOWN;
/**
 * «Sustained» means CONTINUOUSLY observed. Samples arrive every 250ms; a gap
 * longer than this (2D view, throttled/hidden tab, collector paused) breaks the
 * window — otherwise a low reading from minutes ago would count as 5s of
 * evidence and prompt on the very first sample after the gap.
 */
export const MAX_SAMPLE_GAP_MS = DXF_TIMING.lifecycle.LOW_FPS_MAX_SAMPLE_GAP;

type BooleanProbe = () => boolean;

const defaultVisibilityProbe: BooleanProbe = () =>
  typeof document === 'undefined' || document.visibilityState === 'visible';

let lowSince: number | null = null;
let lastSampleAt: number | null = null;
let telemetryOptInProbe: BooleanProbe = () => false;
let pageVisibleProbe: BooleanProbe = defaultVisibilityProbe;

/** Telemetry opt-in probe — wired by telemetry-store at module load. */
export function setTelemetryOptInProbe(probe: BooleanProbe): void {
  telemetryOptInProbe = probe;
}

/** Page-visibility probe — injectable for tests; defaults to `document.visibilityState`. */
export function setPageVisibleProbe(probe: BooleanProbe | null): void {
  pageVisibleProbe = probe ?? defaultVisibilityProbe;
}

function isSuppressed(): boolean {
  const state = autoSubmitStore.getState();
  return state.permanentOptOut || state.phase !== 'idle' || telemetryOptInProbe();
}

function isCoolingDown(now: number): boolean {
  const { lastDeclinedAt } = autoSubmitStore.getState();
  return lastDeclinedAt !== null && now - lastDeclinedAt < PROMPT_COOLDOWN_MS;
}

export const autoSubmitFpsThreshold = {
  /**
   * Observe one FPS sample (PerformanceCollector tick).
   * Returns true iff the threshold was just crossed — the caller then captures
   * the full metrics snapshot and opens the prompt via `autoSubmitStore.openPrompt`.
   */
  observe(fps: number, now: number = Date.now()): boolean {
    const continuous = lastSampleAt !== null && now - lastSampleAt <= MAX_SAMPLE_GAP_MS;
    lastSampleAt = now;
    if (!continuous) lowSince = null;
    if (isSuppressed() || !pageVisibleProbe()) {
      lowSince = null;
      return false;
    }
    if (fps >= LOW_FPS_THRESHOLD) {
      lowSince = null;
      return false;
    }
    if (lowSince === null) {
      lowSince = now;
      return false;
    }
    if (now - lowSince < SUSTAINED_LOW_MS || isCoolingDown(now)) return false;

    lowSince = null;
    return true;
  },

  reset(): void {
    lowSince = null;
    lastSampleAt = null;
  },
};
