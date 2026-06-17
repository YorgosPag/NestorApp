'use client';

/**
 * foundation-level-store — SSoT για τον όροφο Θεμελίωσης του ενεργού κτιρίου
 * (ADR-459 Phase 0 — cross-level structural organism).
 *
 * Ένας low-freq Zustand store που τροφοδοτείται από ΕΝΑΝ owner hook
 * (`useFoundationLevelSync`, mounted στο viewer shell) και καταναλώνεται από:
 *   · `useStructuralOrganism` — merge foundation πεδίλων στον cross-level graph.
 *   · `useAutoFoundationDesign` — level-wide auto-design + cross-level write target.
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
  /**
   * ADR-459 Phase 7 — optimistic upsert ενός foundation entity (ο cross-level writer
   * το καλεί αμέσως μετά το create/update ώστε ο reconciler να βλέπει την τρέχουσα
   * κατάσταση χωρίς να περιμένει τον async event-driven refresh του sync hook).
   */
  upsertEntity(entity: Entity): void;
  /** ADR-459 Phase 7 — optimistic remove (ο writer το καλεί μετά το delete). */
  removeEntity(entityId: string): void;
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
  upsertEntity(entity) {
    set((s) => {
      const exists = s.entities.some((e) => e.id === entity.id);
      return {
        entities: exists
          ? s.entities.map((e) => (e.id === entity.id ? entity : e))
          : [...s.entities, entity],
      };
    });
  },
  removeEntity(entityId) {
    set((s) => ({ entities: s.entities.filter((e) => e.id !== entityId) }));
  },
  clear() {
    set({ target: null, entities: [], activeFloorElevationMm: 0 });
  },
}));
