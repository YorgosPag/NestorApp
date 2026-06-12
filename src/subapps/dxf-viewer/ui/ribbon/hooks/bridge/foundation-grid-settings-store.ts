/**
 * ADR-441 — Foundation grid generation settings (SSoT του «Έδραση εσχάρας»).
 *
 * Module-level mutable cell για τον τρόπο έδρασης των ΠΕΡΙΜΕΤΡΙΚΩΝ λωρίδων στη
 * γένεση «Εσχάρα από κάναβο» (center/inner/outer — ερώτημα Giorgio 2026-06-12).
 * Είναι ΕΝΑ SSoT ώστε να το διαβάζουν ΚΑΙ το ρητό κουμπί (split-button variants)
 * ΚΑΙ το auto-reconcile στο follow-move (`bim:grid-guides-settled`, Slice 7) —
 * αλλιώς η μετακίνηση άξονα θα επανέφερε σιωπηλά την εσχάρα στο default mode.
 *
 * Pattern mirror του `foundation-tool-bridge-store.ts`. Single writer (το ribbon
 * variant) → multi reader (handleFromGrid + settle listener + live ghost).
 *
 * @see ../../../../bim/foundations/foundation-grid-justification.ts — GridPerimeterMode
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import { useSyncExternalStore } from 'react';
import {
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from '../../../../bim/foundations/foundation-grid-justification';

type Listener = () => void;

let mode: GridPerimeterMode = DEFAULT_GRID_PERIMETER_MODE;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): GridPerimeterMode {
  return mode;
}

export const foundationGridSettingsStore = {
  set(next: GridPerimeterMode): void {
    if (next === mode) return;
    mode = next;
    emit();
  },
  get(): GridPerimeterMode {
    return mode;
  },
  use(): GridPerimeterMode {
    return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_GRID_PERIMETER_MODE);
  },
};
