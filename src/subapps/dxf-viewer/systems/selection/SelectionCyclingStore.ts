/**
 * SelectionCyclingStore — ADR-357 Phase 15 (G13 Selection Cycling).
 * Zero-React singleton. Same pattern as HoverStore / CommandLineStore.
 *
 * State: active flag + candidate list + current highlight index + popover anchor.
 * Consumed by: use-selection-cycling.ts (keyboard) + SelectionCyclingPopover.tsx (render).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CyclingCandidate {
  readonly id: string;
  readonly entityType: string;
  readonly layer: string;
}

export interface CyclingState {
  readonly active: boolean;
  readonly candidates: readonly CyclingCandidate[];
  readonly currentIndex: number;
  /** Page-level client X for popover anchor (from mousemove). */
  readonly clientX: number;
  /** Page-level client Y for popover anchor (from mousemove). */
  readonly clientY: number;
}

// ─── Internal state ───────────────────────────────────────────────────────────

const DEFAULT_STATE: CyclingState = {
  active: false,
  candidates: [],
  currentIndex: 0,
  clientX: 0,
  clientY: 0,
};

let _state: CyclingState = DEFAULT_STATE;
const _listeners = new Set<() => void>();

function notify(): void {
  _listeners.forEach((cb) => cb());
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const SelectionCyclingStore = {
  // ── React subscription (useSyncExternalStore-compatible) ──

  subscribe(cb: () => void): () => void {
    _listeners.add(cb);
    return () => { _listeners.delete(cb); };
  },

  getSnapshot(): CyclingState {
    return _state;
  },

  // ── Mutations ──

  /** Begin cycling at the given screen anchor with N≥2 candidates. */
  startCycling(candidates: CyclingCandidate[], clientX: number, clientY: number): void {
    _state = { active: true, candidates, currentIndex: 0, clientX, clientY };
    notify();
  },

  /** Advance the highlighted candidate by one (wraps around). */
  cycleNext(): void {
    if (!_state.active || _state.candidates.length === 0) return;
    const next = (_state.currentIndex + 1) % _state.candidates.length;
    _state = { ..._state, currentIndex: next };
    notify();
  },

  /** Return the ID of the currently highlighted candidate, or null. */
  getCurrentId(): string | null {
    if (!_state.active || _state.candidates.length === 0) return null;
    return _state.candidates[_state.currentIndex]?.id ?? null;
  },

  /** Dismiss cycling without selecting. */
  cancel(): void {
    if (!_state.active) return;
    _state = DEFAULT_STATE;
    notify();
  },

  /** Lightweight synchronous check — avoids snapshot allocation in hot paths. */
  isActive(): boolean {
    return _state.active;
  },
} as const;
