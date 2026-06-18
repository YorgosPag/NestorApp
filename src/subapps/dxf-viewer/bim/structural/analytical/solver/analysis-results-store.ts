/**
 * Analysis results store — external store (ADR-481, T3 / S7).
 *
 * Κρατά το τελευταίο DERIVED `AnalysisResult` (εντατικά μεγέθη M/V/N + διαγράμματα +
 * envelope) του ενεργού κτιρίου. Mirror του `AnalyticalModelStore` (ADR-480):
 * low-frequency, γράφεται ΜΟΝΟ όταν τρέξει η ανάλυση (explicit trigger ή coalesced
 * recompute) — όχι σε pan/zoom/hover → ADR-040 safe. Zero React.
 *
 * **Γιατί store:** οι μελλοντικοί καταναλωτές των M/V/N (διαστασιολόγηση ADR-472/475,
 * έλεγχοι EC8 T5, render διαγραμμάτων) διαβάζουν το έτοιμο αποτέλεσμα χωρίς να
 * ξανατρέξουν τον solver.
 *
 * @see ./solver-types.ts
 * @see ../../../../hooks/structural-analysis-core.ts — ο writer
 * @see ../analytical-model-store.ts — το αδελφό πρότυπο
 */

import { EMPTY_ANALYSIS_RESULT, type AnalysisResult } from './solver-types';

type Listener = () => void;

let current: AnalysisResult = EMPTY_ANALYSIS_RESULT;
const listeners = new Set<Listener>();

export const AnalysisResultsStore = {
  /** Αντικατάστησε το τρέχον αποτέλεσμα + ειδοποίησε subscribers. */
  set(next: AnalysisResult): void {
    current = next;
    listeners.forEach((l) => l());
  },
  /** Το τρέχον DERIVED αποτέλεσμα (stable reference μέχρι το επόμενο set). */
  get(): AnalysisResult {
    return current;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
} as const;
