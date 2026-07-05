/**
 * Analytical Model store — external store (ADR-480, T2).
 *
 * Μικρό useSyncExternalStore-compatible store που κρατά το τελευταίο DERIVED
 * `AnalyticalModel` του ενεργού κτιρίου. Low-frequency: γράφεται ΜΟΝΟ σε structural
 * αλλαγή (μέσω του `useStructuralOrganism` single-writer pass) — όχι σε pan/zoom/
 * hover → ADR-040 safe. Zero React.
 *
 * **Γιατί store (όχι μόνο return value):** ο μελλοντικός FEM solver (T3) και η
 * φασματική σεισμική ανάλυση (T4) θα διαβάζουν το έτοιμο μοντέλο χωρίς να το
 * ξαναχτίσουν — όπως το `StructuralDiagnosticsStore` τροφοδοτεί τα panels.
 *
 * SSoT writer = `structural-analytical-core` (μέσω `useStructuralOrganism`).
 *
 * @see ./analytical-model-types.ts
 * @see ../../../hooks/structural-analytical-core.ts — ο writer
 * @see ../organism/structural-diagnostics-store.ts — το αδελφό πρότυπο
 */

import { EMPTY_ANALYTICAL_MODEL, type AnalyticalModel } from './analytical-model-types';
import { createExternalStore } from '../../../stores/createExternalStore';

type Listener = () => void;

// SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — the
// hand-rolled store notified unconditionally on every `set`.
const store = createExternalStore<AnalyticalModel>(EMPTY_ANALYTICAL_MODEL);

export const AnalyticalModelStore = {
  /** Αντικατάστησε το τρέχον μοντέλο + ειδοποίησε subscribers. */
  set(next: AnalyticalModel): void {
    store.set(next);
  },
  /** Το τρέχον DERIVED μοντέλο (stable reference μέχρι το επόμενο set). */
  get(): AnalyticalModel {
    return store.get();
  },
  subscribe(listener: Listener): () => void {
    return store.subscribe(listener);
  },
} as const;
