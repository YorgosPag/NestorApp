/**
 * telemetry-store — ADR-366 §C.7.Q3
 *
 * Zustand store + LocalStorage persistence for the anonymous performance
 * telemetry opt-in flag.
 *
 *   - `optIn`         : boolean — explicit GDPR Article 6(1)(a) consent
 *   - `lastErasedAt`  : number|null — timestamp of last right-to-erasure
 *                       request (Article 17). Surfaced in the UI to
 *                       confirm the deletion to the user.
 *
 * Lives client-side only. Anonymous sessionId derivation happens at flush
 * time via [[session-id-generator]] — this store never stores the userId.
 *
 * Default: opt-in OFF (GDPR-compliant). The user must explicitly enable.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { setTelemetryOptInProbe } from '../performance/auto-submit-fps-threshold';

const LS_OPT_IN = 'bim3d.telemetry.optIn';
const LS_LAST_ERASED_AT = 'bim3d.telemetry.lastErasedAt';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return v === 'true';
  } catch {
    return fallback;
  }
}

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

interface TelemetryState {
  optIn: boolean;
  lastErasedAt: number | null;
  /** Auth identifier of the currently signed-in user, used at flush time to
   *  derive the anonymous session id. Set by the UI when opt-in turns on
   *  via [[setTelemetryUserContext]]; never persisted. */
  userIdContext: string | null;
}

interface TelemetryActions {
  setOptIn(v: boolean): void;
  setUserContext(userId: string | null): void;
  recordErasure(now?: number): void;
}

type TelemetryStoreType = TelemetryState & TelemetryActions;

export const telemetryStore = create<TelemetryStoreType>()(
  subscribeWithSelector((set) => ({
    optIn:           readBool(LS_OPT_IN, false),
    lastErasedAt:    readNumber(LS_LAST_ERASED_AT),
    userIdContext:   null,

    setOptIn: (v) => {
      try { localStorage.setItem(LS_OPT_IN, String(v)); } catch { /* SSR / private */ }
      set({ optIn: v });
    },

    setUserContext: (userId) => set({ userIdContext: userId }),

    recordErasure: (now = Date.now()) => {
      try { localStorage.setItem(LS_LAST_ERASED_AT, String(now)); } catch { /* ignore */ }
      set({ lastErasedAt: now });
    },
  })),
);

// Wire the Q4 auto-submit FSM's "skip when telemetry already covers us" probe
// at module load. Done here rather than in Q4 to keep the auto-submit module
// dependency-free.
setTelemetryOptInProbe(() => telemetryStore.getState().optIn);
