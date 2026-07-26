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
  /**
   * ADR-712 — **πατούν οι κολώνες του ενεργού ορόφου κατευθείαν στα πέδιλα;** (κριτήριο
   * ADR-489 §7.1 σε επίπεδο ορόφων). Μόνο ο owner ξέρει τη λίστα ορόφων του κτιρίου, άρα
   * το ερώτημα απαντιέται εκεί μία φορά και ταξιδεύει εδώ. Οι επιμετρητικοί καταναλωτές
   * (`column-continuity-boq-source`) βλέπουν έναν όροφο τη φορά και **δεν** μπορούν να
   * αποκλείσουν μόνοι τους μια υπερκείμενη κολώνα. **Fail-closed default `false`** —
   * χωρίς owner, καμία χρέωση κοντόστυλου.
   */
  readonly activeLevelBearsOnFoundation: boolean;
  /** Θέτει το ADR-712 flag (owner only· χωριστός setter → μηδέν ripple σε υπάρχοντα callsites). */
  setActiveLevelBearsOnFoundation(bears: boolean): void;
  /**
   * ADR-713 — mm — η **σταθερά κτιρίου** «πόσο κάτω από το FFL είναι το τελειωμένο έδαφος»
   * (tier 2 του cascade στάθμης). Ίδιος λόγος με το `activeLevelBearsOnFoundation`: μόνο ο
   * owner (`useFoundationLevelSync`) διαβάζει το building doc, ενώ ο επιμετρητικός
   * καταναλωτής (`column-grade-boq-source`) είναι non-React και βλέπει έναν όροφο τη φορά.
   *
   * ⚠️ Δεν παραβιάζει το ADR-489 §7 (καμία global δημοσίευση cross-floor **derived** τιμών):
   * αυτό είναι σκέτη **ρύθμιση** του κτιρίου — δεδομένο, όχι παράγωγο — ακριβώς όπως τα
   * entities της Θεμελίωσης που ήδη ζουν εδώ. Default `0` = έδαφος στο FFL (fail-safe:
   * η θαμμένη ζώνη ταυτίζεται με το κοντόστυλο του ADR-712).
   */
  readonly buildingGradeDropBelowBaseMm: number;
  /** Θέτει τη σταθερά στάθμης εδάφους του κτιρίου (owner only). */
  setBuildingGradeDropBelowBaseMm(mm: number): void;
  /**
   * ADR-459 Φ7 — tombstones: footing ids που ο writer διέγραψε optimistically αλλά
   * το Firestore delete δεν έχει διαδοθεί ακόμη στο realtime model. Κρατά το πέδιλο
   * **έξω** από τα entities ώστε ένα stale model echo (που ακόμη το περιέχει) να μην
   * το «ανασταίνει» ως ghost. Καθαρίζεται μόλις ο id λείψει από το model (delete διαδόθηκε).
   */
  readonly pendingRemovedIds: ReadonlySet<string>;
  /** Δημοσίευση του τρέχοντος foundation-level snapshot (owner only). */
  setFoundationLevel(
    target: FoundationLevelTarget | null,
    entities: readonly Entity[],
    activeFloorElevationMm: number,
  ): void;
  /**
   * ADR-459 Φ7 — model-SSoT publish: συνθέτει τα entities του ορόφου Θεμελίωσης από
   * `baseEntities` (snapshot non-footings) + `modelFootings` (authoritative από το
   * `floorplan_foundations`) + τυχόν **pending** optimistic creates (footings ήδη
   * στον store που δεν εμφανίστηκαν ακόμη στο model). **Tombstone-aware**: footings
   * που έχουν διαγραφεί optimistically (`pendingRemovedIds`) εξαιρούνται από το model
   * ΚΑΙ από το pending → ένα stale echo δεν τα ανασταίνει· το tombstone καθαρίζεται
   * μόλις ο id λείψει από το model (delete διαδόθηκε).
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
  /** ADR-459 Phase 7 — optimistic remove (ο writer το καλεί μετά το delete) + tombstone. */
  removeEntity(entityId: string): void;
  /** Καθαρισμός (single-level / unmount). */
  clear(): void;
}

const EMPTY_REMOVED: ReadonlySet<string> = new Set();

export const useFoundationLevelStore = create<FoundationLevelState>((set, get) => ({
  target: null,
  entities: [],
  activeFloorElevationMm: 0,
  activeLevelBearsOnFoundation: false,
  buildingGradeDropBelowBaseMm: 0,
  pendingRemovedIds: EMPTY_REMOVED,
  setActiveLevelBearsOnFoundation(activeLevelBearsOnFoundation) {
    set({ activeLevelBearsOnFoundation });
  },
  setBuildingGradeDropBelowBaseMm(mm) {
    // Fail-safe: μη-πεπερασμένο / αρνητικό → 0 (έδαφος στο FFL), ποτέ NaN στην επιμέτρηση.
    const buildingGradeDropBelowBaseMm = Number.isFinite(mm) ? Math.max(0, mm) : 0;
    if (buildingGradeDropBelowBaseMm === get().buildingGradeDropBelowBaseMm) return; // idempotent
    set({ buildingGradeDropBelowBaseMm });
  },
  setFoundationLevel(target, entities, activeFloorElevationMm) {
    // Owner re-seed (αλλαγή ορόφου/κτιρίου) → καθαρές tombstones.
    set({ target, entities, activeFloorElevationMm, pendingRemovedIds: EMPTY_REMOVED });
  },
  publishFoundationLevel(target, baseEntities, modelFootings, activeFloorElevationMm) {
    set((s) => {
      const incomingIds = new Set(modelFootings.map((f) => f.id));
      // Καθάρισε όσα tombstones έχουν διαδοθεί (id απών από το fresh model).
      const removed = new Set<string>();
      for (const id of s.pendingRemovedIds) if (incomingIds.has(id)) removed.add(id);
      // Authoritative model footings, μείον όσα είναι ακόμη tombstoned (stale echo).
      const model = modelFootings.filter((f) => !removed.has(f.id));
      const keptModelIds = new Set(model.map((f) => f.id));
      // Pending = optimistic creates (στον store, εκτός model, μη-tombstoned).
      const pending = s.entities.filter(
        (e) => isFootingEntity(e) && !keptModelIds.has(e.id) && !removed.has(e.id),
      );
      return {
        target,
        entities: [...baseEntities, ...model, ...pending],
        activeFloorElevationMm,
        pendingRemovedIds: removed.size === s.pendingRemovedIds.size ? s.pendingRemovedIds : removed,
      };
    });
  },
  upsertEntity(entity) {
    set((s) => {
      // Re-create → άρε το τυχόν tombstone.
      const removed = s.pendingRemovedIds.has(entity.id)
        ? new Set([...s.pendingRemovedIds].filter((id) => id !== entity.id))
        : s.pendingRemovedIds;
      const exists = s.entities.some((e) => e.id === entity.id);
      return {
        entities: exists
          ? s.entities.map((e) => (e.id === entity.id ? entity : e))
          : [...s.entities, entity],
        pendingRemovedIds: removed,
      };
    });
  },
  removeEntity(entityId) {
    set((s) => ({
      entities: s.entities.filter((e) => e.id !== entityId),
      pendingRemovedIds: new Set([...s.pendingRemovedIds, entityId]),
    }));
  },
  clear() {
    set({
      target: null,
      entities: [],
      activeFloorElevationMm: 0,
      activeLevelBearsOnFoundation: false,
      pendingRemovedIds: EMPTY_REMOVED,
    });
  },
}));
