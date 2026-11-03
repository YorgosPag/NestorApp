/**
 * auto-submit-store — ADR-366 §C.7.Q4
 *
 * Zustand store holding the auto-submit FSM observable state plus
 * LocalStorage-persisted cooldown timestamp and permanent opt-out flag.
 *
 * Single source of truth for:
 *   - prompt lifecycle (phase: 'idle' → 'prompted' → 'reviewing' → 'idle')
 *       idle      — nothing shown
 *       prompted  — non-modal warning toast is visible (PerformanceAlertsLeaf)
 *       reviewing — the user chose «Αναφορά…»; the review dialog is open
 *   - the metrics FROZEN at detection time (`triggerSnapshot`) — the report
 *     describes the slow moment, not the moment the user clicked
 *   - last user decline (drives 30-min cooldown in FSM)
 *   - permanent opt-out (terminal — never prompts again on this device)
 *
 * Every transition is GUARDED by the current phase, so each is idempotent:
 * a toast library that fires `onDismiss` after an action click, or a dialog
 * that fires `onOpenChange(false)` after a successful send, cannot record a
 * false decline (see `recordDeclined(from)`).
 *
 * Consumed by PerformanceAlertsLeaf (UI) and auto-submit-fps-threshold (FSM).
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PerformanceMetricsSnapshot } from './PerformanceHUDStore';

const LS_LAST_DECLINED = 'bim3d.autoSubmit.lastDeclinedAt';
const LS_PERMANENT_OPT_OUT = 'bim3d.autoSubmit.permanentOptOut';

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* SSR / private mode */ }
}

export type AutoSubmitPhase = 'idle' | 'prompted' | 'reviewing';

interface AutoSubmitState {
  phase: AutoSubmitPhase;
  triggerFps: number | null;
  triggerAt: number | null;
  /** Full metrics captured at detection time — what the report will contain. */
  triggerSnapshot: PerformanceMetricsSnapshot | null;
  lastDeclinedAt: number | null;
  permanentOptOut: boolean;
}

interface AutoSubmitActions {
  /** idle → prompted. No-op from any other phase. */
  openPrompt(fps: number, now: number, snapshot: PerformanceMetricsSnapshot): void;
  /** prompted → reviewing. No-op from any other phase. */
  beginReview(): void;
  /** reviewing → idle after a successful send. No cooldown. */
  recordSubmitted(): void;
  /**
   * `from` → idle + 30-min cooldown, ONLY if the current phase is `from`.
   * The toast declines `from: 'prompted'`, the dialog `from: 'reviewing'` — so
   * the toast's own dismissal after «Αναφορά…» (phase already 'reviewing')
   * can never cancel the review it just started.
   */
  recordDeclined(from: Exclude<AutoSubmitPhase, 'idle'>, now?: number): void;
  setPermanentOptOut(v: boolean): void;
}

type AutoSubmitStoreType = AutoSubmitState & AutoSubmitActions;

const CLEARED_PROMPT = { phase: 'idle', triggerFps: null, triggerAt: null, triggerSnapshot: null } as const;

export const autoSubmitStore = create<AutoSubmitStoreType>()(
  subscribeWithSelector((set, get) => ({
    ...CLEARED_PROMPT,
    lastDeclinedAt:  readNumber(LS_LAST_DECLINED),
    permanentOptOut: readBool(LS_PERMANENT_OPT_OUT, false),

    openPrompt: (fps, now, snapshot) => {
      if (get().phase !== 'idle') return;
      set({ phase: 'prompted', triggerFps: fps, triggerAt: now, triggerSnapshot: snapshot });
    },

    beginReview: () => {
      if (get().phase !== 'prompted') return;
      set({ phase: 'reviewing' });
    },

    recordSubmitted: () => {
      if (get().phase !== 'reviewing') return;
      set(CLEARED_PROMPT);
    },

    recordDeclined: (from, now = Date.now()) => {
      if (get().phase !== from) return;
      writeLocal(LS_LAST_DECLINED, String(now));
      set({ ...CLEARED_PROMPT, lastDeclinedAt: now });
    },

    setPermanentOptOut: (v) => {
      writeLocal(LS_PERMANENT_OPT_OUT, String(v));
      set(v ? { ...CLEARED_PROMPT, permanentOptOut: true } : { permanentOptOut: false });
    },
  })),
);
