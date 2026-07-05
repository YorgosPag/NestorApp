/**
 * Beam-Between-Members Store — ADR-569 (anchor member for the live ghost).
 *
 * Module-level pub/sub store για το **άγκυρα-μέλος** (το τελευταίο διαλεγμένο μέλος της αλυσίδας)
 * της εντολής «Δοκάρι ανάμεσα σε μέλη». Zero React state — mirrors `WallSplitStore` (ADR-040:
 * high-frequency preview data ΔΕΝ ρέει μέσα από React state).
 *
 * Ροή: κάθε κλικ σε μέλος θέτει εδώ το `anchor` (footprint + id)· το live rubber-band ghost
 * (`BeamBetweenMembersPreviewMount`) το διαβάζει και ζωγραφίζει το δοκάρι-φάντασμα από την παρειά
 * του anchor προς τον κέρσορα (ή προς το μέλος κάτω από τον κέρσορα). Το επόμενο κλικ commit-άρει
 * το δοκάρι και προωθεί το anchor στο νέο μέλος.
 *
 * Single-writer: `useBeamBetweenMembersTool` (click / activate / escape / deactivate).
 * Multi-reader:  `BeamBetweenMembersPreviewMount` leaf (subscribes στο `anchor`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-569-beam-between-members.md
 * @see systems/wall-split/WallSplitStore.ts — το πρότυπο (store-driven preview mount)
 */

import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

/** Το άγκυρα-μέλος: id (για αποκλεισμό από hover) + 2D footprint (world coords). */
export interface BeamBetweenAnchor {
  readonly id: string;
  readonly footprint: readonly Point2D[];
}

export interface BeamBetweenMembersState {
  /** Το τελευταίο διαλεγμένο μέλος, ή `null` όσο περιμένουμε το πρώτο κλικ. */
  readonly anchor: BeamBetweenAnchor | null;
}

const EMPTY: BeamBetweenMembersState = Object.freeze({ anchor: null });

// ── Module state ──────────────────────────────────────────────────────────────
// SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — `setAnchor`
// keeps its own manual `.id` pre-check (narrower than a whole-object identity
// compare), matching the hand-rolled store's unconditional notify after each
// accepted mutation.

const store = createExternalStore<BeamBetweenMembersState>(EMPTY);

function getServerSnapshot(): BeamBetweenMembersState {
  return EMPTY;
}

// ── Public store API ──────────────────────────────────────────────────────────

export const BeamBetweenMembersStore = {
  /** Set the anchor member. No-op when the id is unchanged (footprint is stable per id). */
  setAnchor(anchor: BeamBetweenAnchor): void {
    if (store.get().anchor?.id === anchor.id) return;
    store.set({ anchor });
  },

  /** Clear the anchor (chain reset / tool deactivated / Escape). */
  reset(): void {
    if (store.get() === EMPTY) return;
    store.set(EMPTY);
  },

  /** Non-React reader (tests + imperative code). */
  get(): BeamBetweenMembersState {
    return store.get();
  },

  subscribe: store.subscribe,
  getSnapshot: store.get,
  getServerSnapshot,
};

// ── React hook ────────────────────────────────────────────────────────────────

/** Returns the current anchor member for the preview leaf consumer. */
export function useBeamBetweenAnchor(): BeamBetweenAnchor | null {
  return useSyncExternalStore(store.subscribe, store.get, getServerSnapshot).anchor;
}
