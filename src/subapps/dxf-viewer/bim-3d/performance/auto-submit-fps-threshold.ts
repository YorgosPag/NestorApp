/**
 * auto-submit-fps-threshold — ADR-366 §C.7.Q4
 *
 * Stateful threshold detector. Continuous FPS < 10 for >5s triggers the
 * consent dialog (NOT silent — GDPR + UX trust). 30-min cooldown between
 * prompts, permanent opt-out terminal, and auto-skip when telemetry opt-in
 * is on (Q3 covers continuous low-FPS samples via batched anonymized stream).
 *
 * Pure-ish: no React, no DOM. Persists state in auto-submit-store (Zustand
 * + LocalStorage). Telemetry opt-in flag is queried via callback so this
 * module stays decoupled from Q3 (Session 3a → 3b).
 */

import { autoSubmitStore } from './auto-submit-store';

export const LOW_FPS_THRESHOLD = 10;
export const SUSTAINED_LOW_MS = 5_000;
export const PROMPT_COOLDOWN_MS = 30 * 60 * 1000;

type TelemetryOptInProbe = () => boolean;

let lowSince: number | null = null;
let telemetryOptInProbe: TelemetryOptInProbe = () => false;

/**
 * Inject the telemetry opt-in probe. Session 3b wires this to telemetry-store.
 * Until then, default probe returns false → FSM operates as if telemetry is off.
 */
export function setTelemetryOptInProbe(probe: TelemetryOptInProbe): void {
  telemetryOptInProbe = probe;
}

export const autoSubmitFpsThreshold = {
  /**
   * Observe one FPS sample. Called from PerformanceCollector tick.
   * Returns true iff the consent prompt was just opened (for tests).
   */
  observe(fps: number, now: number = Date.now()): boolean {
    const state = autoSubmitStore.getState();

    if (state.permanentOptOut) return false;
    if (telemetryOptInProbe()) return false;
    if (state.phase === 'prompted') return false;

    if (fps >= LOW_FPS_THRESHOLD) {
      lowSince = null;
      return false;
    }

    if (lowSince === null) {
      lowSince = now;
      return false;
    }

    if (now - lowSince < SUSTAINED_LOW_MS) return false;

    if (state.lastDeclinedAt !== null && now - state.lastDeclinedAt < PROMPT_COOLDOWN_MS) {
      return false;
    }

    lowSince = null;
    state.openPrompt(fps, now);
    return true;
  },

  reset(): void {
    lowSince = null;
  },
};
