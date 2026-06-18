'use client';

/**
 * useStructuralSettingsRecompute — ADR-479 Slice 2b (συμμετρία: ΚΑΘΕ αλλαγή
 * building-level structural setting → άμεσος επανυπολογισμός).
 *
 * Στο Revit, αλλάζοντας κανονισμό / υλικά / φορτία / σεισμικά / κατηγορία χρήσης σε
 * επίπεδο κτιρίου, η μελέτη ενημερώνεται. Εδώ το πετυχαίνουμε με **ΕΝΑΝ** κεντρικό
 * subscriber στο `useStructuralSettingsStore`: σε κάθε **user-initiated** μεταβολή
 * εκπέμπει `bim:compute-loads-requested` — **το ίδιο** event με το ρητό ribbon
 * «Υπολογισμός Φορτίων» (`useDxfViewerCallbacks`) → αλυσίδα φορτία → οπλισμός → πέδιλα →
 * σχέδια/αναφορές. SSoT: ένα σημείο εκπομπής καλύπτει preset selector, τους ribbon
 * structural setters (codeId/occupancy/soil/seismic) ΚΑΙ μελλοντικό programmatic apply
 * (Slice 3) — χωρίς σκόρπια emits στα bridges, χωρίς να σπάσει το pure-store invariant.
 *
 * **Διάκριση user vs server-sync (κρίσιμη):** οι user setters ορίζουν
 * `lastLocalMutationAt = Date.now()` (>0)· ο `loadForBuilding` (building switch / server
 * echo) ορίζει `lastLocalMutationAt = 0`. Έτσι το {@link shouldRecomputeOnSettingsChange}
 * εκπέμπει μόνο σε πραγματικές επεξεργασίες — ΟΧΙ σε κάθε φόρτωση/sync (αλλιώς recompute
 * storm σε κάθε building load).
 *
 * **Loop-safe:** η αλυσίδα recompute γράφει φορτία/οπλισμό σε **entities** (ΟΧΙ structural
 * settings) → ο subscriber δεν re-fire-άρει. Coalesced ανά microtask (batched set → ΕΝΑ
 * emit). ADR-040 safe: zero React subscription εδώ (store.subscribe + useEffect — μηδέν
 * re-render του DxfViewerContent), low-freq.
 *
 * @see useStructuralLoadTakedown — ο consumer του `bim:compute-loads-requested`
 * @see ui/components/StructuralPresetSelector — preset apply (ίδια αλυσίδα μέσω αυτού)
 * @see docs/centralized-systems/reference/adrs/ADR-479-structural-project-presets.md
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import {
  useStructuralSettingsStore,
  type StructuralSettingsState,
} from '../state/structural-settings-store';

/**
 * True όταν μια μετάβαση settings είναι **user-initiated** (άρα χρειάζεται recompute).
 * `lastLocalMutationAt > 0` ⇒ από setter· `=== prev` ⇒ no-op (ίδιο tick / άσχετο field)·
 * `0` ⇒ `loadForBuilding` server-sync (skip). Pure → unit-testable.
 */
export function shouldRecomputeOnSettingsChange(
  state: Pick<StructuralSettingsState, 'lastLocalMutationAt'>,
  prev: Pick<StructuralSettingsState, 'lastLocalMutationAt'>,
): boolean {
  return state.lastLocalMutationAt > 0 && state.lastLocalMutationAt !== prev.lastLocalMutationAt;
}

export function useStructuralSettingsRecompute(): void {
  useEffect(() => {
    let scheduled = false;
    const emit = (): void => {
      scheduled = false;
      EventBus.emit('bim:compute-loads-requested', {});
    };
    const unsub = useStructuralSettingsStore.subscribe((state, prev) => {
      if (!shouldRecomputeOnSettingsChange(state, prev)) return;
      if (scheduled) return; // coalesce: batched set → ΕΝΑ recompute
      scheduled = true;
      queueMicrotask(emit);
    });
    return unsub;
  }, []);
}
