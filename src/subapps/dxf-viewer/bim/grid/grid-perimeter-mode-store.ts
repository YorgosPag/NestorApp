/**
 * ADR-441 — Factory module-level store για το περιμετρικό mode «Εσχάρας από κάναβο».
 *
 * Generalization του foundation-only `foundation-grid-settings-store` ώστε ΚΑΘΕ δομική
 * οντότητα (foundation/beam/wall/column) να έχει το ΔΙΚΟ της SSoT cell για το
 * center/inner/outer — single writer (το ribbon split-button) → multi reader
 * (handle*FromGrid + future settle listener + live ghost). Κάθε `createGridPerimeterModeStore()`
 * επιστρέφει ανεξάρτητο store· μηδέν shared state μεταξύ οντοτήτων.
 *
 * Pattern mirror του παλιού store· εξάγεται εδώ (neutral `bim/grid/`) ώστε να μην
 * αναπαράγεται 4 φορές το ίδιο useSyncExternalStore boilerplate.
 *
 * @see ../grid-justification.ts — GridPerimeterMode
 * @see ../../../ui/ribbon/hooks/bridge/foundation-grid-settings-store.ts — consumer (foundation)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import { useSyncExternalStore } from 'react';
import { DEFAULT_GRID_PERIMETER_MODE, type GridPerimeterMode } from './grid-justification';

export interface GridPerimeterModeStore {
  /** Θέσε το mode (single writer = ribbon variant). No-op αν ίδιο. */
  set(next: GridPerimeterMode): void;
  /** Imperative read (handle*FromGrid + settle listener). */
  get(): GridPerimeterMode;
  /** Reactive read (React component, useSyncExternalStore). */
  use(): GridPerimeterMode;
}

/** Φτιάξε ανεξάρτητο περιμετρικό-mode store (default `inner`). */
export function createGridPerimeterModeStore(): GridPerimeterModeStore {
  let mode: GridPerimeterMode = DEFAULT_GRID_PERIMETER_MODE;
  const listeners = new Set<() => void>();

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getSnapshot = (): GridPerimeterMode => mode;

  return {
    set(next: GridPerimeterMode): void {
      if (next === mode) return;
      mode = next;
      for (const l of listeners) l();
    },
    get(): GridPerimeterMode {
      return mode;
    },
    use(): GridPerimeterMode {
      return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_GRID_PERIMETER_MODE);
    },
  };
}
