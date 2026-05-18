/**
 * XLineModeStore — singleton micro-leaf SSoT for XLine construction mode.
 *
 * Three surfaces (keyboard / status bar / context menu) all read/write here.
 * Pattern: ADR-040 micro-leaf + ADR-359 Phase 2.
 *
 * Persistence: localStorage key `dxf:xlineMode.lastUsed` (cross-session).
 * Reset: call reset() on tool switch out of 'xline'.
 */

import type { Point2D } from '../../rendering/types/Types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type XLineMode = 'through' | 'horizontal' | 'vertical' | 'angle' | 'bisect' | 'offset';

export interface XLineModeState {
  readonly mode: XLineMode;
  readonly angleValue: number | null;
  readonly offsetDistance: number | null;
  readonly sourceEntityId: string | null;
  readonly bisectVertex: Point2D | null;
  readonly bisectStart: Point2D | null;
}

export interface XLineModeParams {
  angleValue?: number | null;
  offsetDistance?: number | null;
  sourceEntityId?: string | null;
  bisectVertex?: Point2D | null;
  bisectStart?: Point2D | null;
}

type Listener = () => void;

// ─── Persistence key ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'dxf:xlineMode.lastUsed';

function loadPersistedMode(): XLineMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'through' || raw === 'horizontal' || raw === 'vertical' ||
        raw === 'angle'   || raw === 'bisect'     || raw === 'offset') {
      return raw;
    }
  } catch {
    // localStorage unavailable (SSR / private browsing)
  }
  return 'through';
}

function persistMode(mode: XLineMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

// ─── Internal mutable state ───────────────────────────────────────────────────

const DEFAULT_STATE: XLineModeState = {
  mode: loadPersistedMode(),
  angleValue: null,
  offsetDistance: null,
  sourceEntityId: null,
  bisectVertex: null,
  bisectStart: null,
};

let state: XLineModeState = { ...DEFAULT_STATE };
const subscribers = new Set<Listener>();

// ─── Notify ──────────────────────────────────────────────────────────────────

function notify(): void {
  subscribers.forEach((cb) => cb());
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Get current mode label. */
export function getMode(): XLineMode {
  return state.mode;
}

/** Get full state snapshot (for useSyncExternalStore). */
export function getXLineModeState(): XLineModeState {
  return state;
}

/**
 * Set mode + optional sub-params.
 * Persists new mode to localStorage.
 */
export function setMode(mode: XLineMode, params: XLineModeParams = {}): void {
  const next: XLineModeState = {
    mode,
    angleValue: params.angleValue ?? null,
    offsetDistance: params.offsetDistance ?? null,
    sourceEntityId: params.sourceEntityId ?? null,
    bisectVertex: params.bisectVertex ?? null,
    bisectStart: params.bisectStart ?? null,
  };
  if (
    state.mode === next.mode &&
    state.angleValue === next.angleValue &&
    state.offsetDistance === next.offsetDistance &&
    state.sourceEntityId === next.sourceEntityId
  ) {
    return;
  }
  state = next;
  persistMode(mode);
  notify();
}

/**
 * Reset to default state (call on tool switch out of 'xline').
 * Preserves the persisted mode for next session.
 */
export function reset(): void {
  state = { ...DEFAULT_STATE, mode: state.mode };
  notify();
}

/** Subscribe to state changes. Returns unsubscribe fn (useSyncExternalStore compatible). */
export function subscribe(cb: Listener): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}
