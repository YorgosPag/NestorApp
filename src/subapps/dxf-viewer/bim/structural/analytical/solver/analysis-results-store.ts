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
import { createExternalStore } from '../../../../stores/createExternalStore';

type Listener = () => void;

// SSoT pub/sub via createExternalStore (WAVE 2.6). No `equals` — the
// hand-rolled store notified unconditionally on every `set`.
const store = createExternalStore<AnalysisResult>(EMPTY_ANALYSIS_RESULT);

export const AnalysisResultsStore = {
  /** Αντικατάστησε το τρέχον αποτέλεσμα + ειδοποίησε subscribers. */
  set(next: AnalysisResult): void {
    store.set(next);
  },
  /** Το τρέχον DERIVED αποτέλεσμα (stable reference μέχρι το επόμενο set). */
  get(): AnalysisResult {
    return store.get();
  },
  subscribe(listener: Listener): () => void {
    return store.subscribe(listener);
  },
} as const;
