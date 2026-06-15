/**
 * Structural Organism — diagnostics store (ADR-459, Phase 1).
 *
 * Μικρό external store (useSyncExternalStore-compatible) που κρατά τα τελευταία
 * DERIVED cross-entity ευρήματα του οργανισμού + index ανά entityId, ώστε τα
 * property panels να τα διαβάζουν χωρίς πρόσβαση στη σκηνή.
 *
 * Low-frequency: γράφεται ΜΟΝΟ σε structural αλλαγή (create/update/delete/grid),
 * όχι σε pan/zoom/hover → ADR-040 safe (μηδέν high-freq subscriptions). Zero React.
 *
 * SSoT writer = `useStructuralOrganism` shell hook. Readers = `EntityWarningsSection`.
 *
 * @see structural-organism-types.ts
 * @see ../../../hooks/useStructuralOrganism.ts — ο writer
 */

import type { StructuralDiagnostic } from './structural-organism-types';

const EMPTY: readonly StructuralDiagnostic[] = Object.freeze([]);

type Listener = () => void;

let all: readonly StructuralDiagnostic[] = EMPTY;
let byEntity: ReadonlyMap<string, readonly StructuralDiagnostic[]> = new Map();
const listeners = new Set<Listener>();

/** Index ανά εμπλεκόμενο entityId (ένα εύρημα φαίνεται σε ΟΛΑ τα entityIds του). */
function indexByEntity(
  diagnostics: readonly StructuralDiagnostic[],
): ReadonlyMap<string, readonly StructuralDiagnostic[]> {
  const map = new Map<string, StructuralDiagnostic[]>();
  for (const d of diagnostics) {
    for (const id of d.entityIds) {
      const bucket = map.get(id);
      if (bucket) bucket.push(d);
      else map.set(id, [d]);
    }
  }
  return map;
}

export const StructuralDiagnosticsStore = {
  /** Αντικατάστησε τα ευρήματα + ειδοποίησε subscribers. */
  set(next: readonly StructuralDiagnostic[]): void {
    all = next.length === 0 ? EMPTY : next;
    byEntity = indexByEntity(all);
    listeners.forEach((l) => l());
  },
  /** Όλα τα τρέχοντα ευρήματα (stable reference μέχρι το επόμενο set). */
  getAll(): readonly StructuralDiagnostic[] {
    return all;
  },
  /** Ευρήματα που εμπλέκουν το συγκεκριμένο entity (stable reference). */
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
export const EMPTY_DIAGNOSTICS = EMPTY;
