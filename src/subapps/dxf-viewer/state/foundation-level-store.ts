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

/** True για foundation entities (πέδιλα) — minimal type-tag check (zero deps). */
function isFootingEntity(entity: Entity): boolean {
  return (entity as { type?: string }).type === 'foundation';
}

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
   * ADR-459 Φ7 — model-SSoT publish: συνθέτει τα entities του ορόφου Θεμελίωσης από
   * `baseEntities` (snapshot non-footings) + `modelFootings` (authoritative από το
   * `floorplan_foundations`) + τυχόν **pending** optimistic footings (footings ήδη
   * στον store που δεν εμφανίστηκαν ακόμη στο model — π.χ. ένα fresh cross-level
   * create του writer που δεν επιβεβαιώθηκε ακόμη από Firestore). Anti-race με τον
   * `foundation-cross-level-writer` (optimistic `upsertEntity`).
   */
  publishFoundationLevel(
    target: FoundationLevelTarget | null,
    baseEntities: readonly Entity[],
    modelFootings: readonly Entity[],
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
  publishFoundationLevel(target, baseEntities, modelFootings, activeFloorElevationMm) {
    set((s) => {
      const modelIds = new Set(modelFootings.map((f) => f.id));
      // Pending = optimistic footings (writer.upsert) που δεν είναι ακόμη στο model.
      const pending = s.entities.filter(
        (e) => isFootingEntity(e) && !modelIds.has(e.id),
      );
      return {
        target,
        entities: [...baseEntities, ...modelFootings, ...pending],
        activeFloorElevationMm,
      };
    });
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
