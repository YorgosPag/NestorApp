'use client';

/**
 * foundation-level-store — SSoT για τον όροφο Θεμελίωσης του ενεργού κτιρίου
 * (ADR-459 Phase 0 — cross-level structural organism).
 *
 * Ένας low-freq Zustand store που τροφοδοτείται από ΕΝΑΝ owner hook
 * (`useFoundationLevelSync`, mounted στο viewer shell) και καταναλώνεται από:
 *   · `useStructuralOrganism` — merge foundation πεδίλων στον cross-level graph.
 *   · `useColumnFootingNotification` — detection «λείπει πέδιλο» + cross-level write target.
 *
 * Γράφεται ΜΟΝΟ σε αλλαγή ορόφου/κτιρίου ή σε δομική μεταβολή της Θεμελίωσης →
 * ADR-040 safe (μηδέν 60fps writes). Non-React consumers διαβάζουν με
 * `useFoundationLevelStore.getState()`· React consumers με selector.
 *
 * @see ../hooks/useFoundationLevelSync.ts — ο owner
 * @see ../systems/levels/building-foundation-level.ts — FoundationLevelTarget
 */

import { create } from 'zustand';
import type { Entity } from '../types/entities';
import type { FoundationLevelTarget } from '../systems/levels/building-foundation-level';

export interface FoundationLevelState {
  /** Στόχος ορόφου Θεμελίωσης (null = κανένας / ίδιος με τον ενεργό → single-level). */
  readonly target: FoundationLevelTarget | null;
  /** Entities του ορόφου Θεμελίωσης (live ή loaded snapshot). */
  readonly entities: readonly Entity[];
  /** Datum-relative απόλυτο FFL του ενεργού ορόφου (mm) — για cross-level Z offset. */
  readonly activeFloorElevationMm: number;
  /** Δημοσίευση του τρέχοντος foundation-level snapshot (owner only). */
  setFoundationLevel(
    target: FoundationLevelTarget | null,
    entities: readonly Entity[],
    activeFloorElevationMm: number,
  ): void;
  /** Καθαρισμός (single-level / unmount). */
  clear(): void;
}

export const useFoundationLevelStore = create<FoundationLevelState>((set) => ({
  target: null,
  entities: [],
  activeFloorElevationMm: 0,
  setFoundationLevel(target, entities, activeFloorElevationMm) {
    set({ target, entities, activeFloorElevationMm });
  },
  clear() {
    set({ target: null, entities: [], activeFloorElevationMm: 0 });
  },
}));
