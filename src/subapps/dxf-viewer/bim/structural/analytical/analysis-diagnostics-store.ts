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

const EMPTY: readonly StructuralDiagnostic[] = Object.freeze([]);

type Listener = () => void;

let all: readonly StructuralDiagnostic[] = EMPTY;
let byEntity: ReadonlyMap<string, readonly StructuralDiagnostic[]> = new Map();
const listeners = new Set<Listener>();

export const AnalysisDiagnosticsStore = {
  /** Αντικατάστησε τα diagnostics ανάλυσης + ειδοποίησε subscribers. */
  set(next: readonly StructuralDiagnostic[]): void {
    all = next.length === 0 ? EMPTY : next;
    byEntity = indexDiagnosticsByEntity(all);
    listeners.forEach((l) => l());
  },
  /** Όλα τα τρέχοντα diagnostics ανάλυσης (stable reference μέχρι το επόμενο set). */
  getAll(): readonly StructuralDiagnostic[] {
    return all;
  },
  /** Diagnostics που εμπλέκουν το συγκεκριμένο entity (stable reference). */
  getForEntity(entityId: string): readonly StructuralDiagnostic[] {
    return byEntity.get(entityId) ?? EMPTY;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
} as const;

/** Σταθερή κενή λίστα (server snapshot / no-diagnostics). */
export const EMPTY_ANALYSIS_DIAGNOSTICS = EMPTY;
