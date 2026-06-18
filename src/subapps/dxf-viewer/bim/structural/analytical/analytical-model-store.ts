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

type Listener = () => void;

let current: AnalyticalModel = EMPTY_ANALYTICAL_MODEL;
const listeners = new Set<Listener>();

export const AnalyticalModelStore = {
  /** Αντικατάστησε το τρέχον μοντέλο + ειδοποίησε subscribers. */
  set(next: AnalyticalModel): void {
    current = next;
    listeners.forEach((l) => l());
  },
  /** Το τρέχον DERIVED μοντέλο (stable reference μέχρι το επόμενο set). */
  get(): AnalyticalModel {
    return current;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
} as const;
