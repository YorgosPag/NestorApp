/**
 * Analysis diagnostics store — external store (ADR-482, T3-UI).
 *
 * Κρατά τα DERIVED diagnostics ευστάθειας της στατικής ανάλυσης (μηχανισμός /
 * παραλειπόμενο μέλος, ADR-481) + index ανά entityId, ώστε το `EntityWarningsSection`
 * να τα εμφανίζει στα property panels δίπλα στα cross-entity ευρήματα του οργανισμού.
 *
 * **Γιατί ξεχωριστός store (όχι ο organism):** ο `StructuralDiagnosticsStore` έχει
 * single-writer invariant = `useStructuralOrganism` (ADR-040/459). Η στατική ανάλυση
 * είναι explicit/on-demand → ΔΕΝ ανήκει σε εκείνο το pass. Single-writer εδώ =
 * `useProactiveStructuralAnalysis`. Ο reader ενώνει τα δύο sets (ADR-482 approach A).
 *
 * Low-freq (γράφεται μόνο όταν τρέξει η «Ανάλυση») → ADR-040 safe. Zero React.
 *
 * @see ./solver/analysis-diagnostics.ts — ο παραγωγός των StructuralDiagnostic[]
 * @see ../organism/structural-diagnostics-store.ts — το αδελφό πρότυπο
 * @see ../organism/diagnostics-index.ts — ο κοινός indexer (N.0.2)
 */

import type { StructuralDiagnostic } from '../organism/structural-organism-types';
import { indexDiagnosticsByEntity } from '../organism/diagnostics-index';
import { createExternalStore } from '../../../stores/createExternalStore';

const EMPTY: readonly StructuralDiagnostic[] = Object.freeze([]);

type Listener = () => void;

interface AnalysisDiagnosticsSnapshot {
  readonly all: readonly StructuralDiagnostic[];
  readonly byEntity: ReadonlyMap<string, readonly StructuralDiagnostic[]>;
}

const INITIAL_SNAPSHOT: AnalysisDiagnosticsSnapshot = { all: EMPTY, byEntity: new Map() };

// SSoT pub/sub via createExternalStore (WAVE 2.6). `all` + `byEntity` are the
// same derived pair rebuilt together on every `set`, so they now live in ONE
// snapshot object. No `equals` — the hand-rolled store notified unconditionally.
const store = createExternalStore<AnalysisDiagnosticsSnapshot>(INITIAL_SNAPSHOT);

export const AnalysisDiagnosticsStore = {
  /** Αντικατάστησε τα diagnostics ανάλυσης + ειδοποίησε subscribers. */
  set(next: readonly StructuralDiagnostic[]): void {
    const all = next.length === 0 ? EMPTY : next;
    store.set({ all, byEntity: indexDiagnosticsByEntity(all) });
  },
  /** Όλα τα τρέχοντα diagnostics ανάλυσης (stable reference μέχρι το επόμενο set). */
  getAll(): readonly StructuralDiagnostic[] {
    return store.get().all;
  },
  /** Diagnostics που εμπλέκουν το συγκεκριμένο entity (stable reference). */
  getForEntity(entityId: string): readonly StructuralDiagnostic[] {
    return store.get().byEntity.get(entityId) ?? EMPTY;
  },
  subscribe(listener: Listener): () => void {
    return store.subscribe(listener);
  },
} as const;

/** Σταθερή κενή λίστα (server snapshot / no-diagnostics). */
export const EMPTY_ANALYSIS_DIAGNOSTICS = EMPTY;
