/**
 * SelectionCyclingStore — ADR-357 Phase 15 (G13 Selection Cycling).
 * Zero-React singleton. Same pattern as HoverStore / CommandLineStore.
 *
 * State: active flag + candidate list + current highlight index + popover anchor.
 * Consumed by: use-selection-cycling.ts (keyboard) + SelectionCyclingPopover.tsx (render).
 */

import { createExternalStore } from '../../stores/createExternalStore';

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

// Reducer-over-single-object on the SSoT primitive (`equals: Object.is` = identity
// guard· κάθε mutation παράγει νέο object → πραγματικές αλλαγές notify-άρουν πάντα).
const store = createExternalStore<CyclingState>(DEFAULT_STATE, { equals: Object.is });

// ─── Public API ───────────────────────────────────────────────────────────────

export const SelectionCyclingStore = {
  // ── React subscription (useSyncExternalStore-compatible) ──

  subscribe(cb: () => void): () => void {
    return store.subscribe(cb);
  },

  getSnapshot(): CyclingState {
    return store.get();
  },

  // ── Mutations ──

  /** Begin cycling at the given screen anchor with N≥2 candidates. */
  startCycling(candidates: CyclingCandidate[], clientX: number, clientY: number): void {
    store.set({ active: true, candidates, currentIndex: 0, clientX, clientY });
  },

  /** Advance the highlighted candidate by one (wraps around). */
  cycleNext(): void {
    const state = store.get();
    if (!state.active || state.candidates.length === 0) return;
    const next = (state.currentIndex + 1) % state.candidates.length;
    store.set({ ...state, currentIndex: next });
  },

  /** Return the ID of the currently highlighted candidate, or null. */
  getCurrentId(): string | null {
    const state = store.get();
    if (!state.active || state.candidates.length === 0) return null;
    return state.candidates[state.currentIndex]?.id ?? null;
  },

  /** Dismiss cycling without selecting. */
  cancel(): void {
    if (!store.get().active) return;
    store.set(DEFAULT_STATE);
  },

  /** Lightweight synchronous check — avoids snapshot allocation in hot paths. */
  isActive(): boolean {
    return store.get().active;
  },
} as const;
