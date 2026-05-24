/**
 * auto-submit-store — ADR-366 §C.7.Q4
 *
 * Zustand store holding the auto-submit FSM observable state plus
 * LocalStorage-persisted cooldown timestamp and permanent opt-out flag.
 *
 * Single source of truth for:
 *   - dialog visibility (phase: 'idle' | 'prompted')
 *   - last user decline (drives 30-min cooldown in FSM)
 *   - permanent opt-out (terminal — never prompts again)
 *
 * Consumed by AutoSubmitConsentDialog (UI) and auto-submit-fps-threshold (FSM).
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

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

export type AutoSubmitPhase = 'idle' | 'prompted';

interface AutoSubmitState {
  phase: AutoSubmitPhase;
  triggerFps: number | null;
  triggerAt: number | null;
  lastDeclinedAt: number | null;
  permanentOptOut: boolean;
}

interface AutoSubmitActions {
  openPrompt(fps: number, now: number): void;
  recordAccepted(): void;
  recordDeclined(now?: number): void;
  setPermanentOptOut(v: boolean): void;
}

type AutoSubmitStoreType = AutoSubmitState & AutoSubmitActions;

export const autoSubmitStore = create<AutoSubmitStoreType>()(
  subscribeWithSelector((set) => ({
    phase:            'idle',
    triggerFps:       null,
    triggerAt:        null,
    lastDeclinedAt:   readNumber(LS_LAST_DECLINED),
    permanentOptOut:  readBool(LS_PERMANENT_OPT_OUT, false),

    openPrompt: (fps, now) => set({ phase: 'prompted', triggerFps: fps, triggerAt: now }),

    recordAccepted: () => set({ phase: 'idle', triggerFps: null, triggerAt: null }),

    recordDeclined: (now = Date.now()) => {
      try { localStorage.setItem(LS_LAST_DECLINED, String(now)); } catch { /* SSR / private */ }
      set({ phase: 'idle', triggerFps: null, triggerAt: null, lastDeclinedAt: now });
    },

    setPermanentOptOut: (v) => {
      try { localStorage.setItem(LS_PERMANENT_OPT_OUT, String(v)); } catch { /* ignore */ }
      set((state) => ({
        permanentOptOut: v,
        // Closing the dialog when user chose permanent opt-out.
        phase: v ? 'idle' : state.phase,
        triggerFps: v ? null : state.triggerFps,
        triggerAt: v ? null : state.triggerAt,
      }));
    },
  })),
);
