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
import { indexDiagnosticsByEntity } from './diagnostics-index';
import { createExternalStore } from '../../../stores/createExternalStore';

const EMPTY: readonly StructuralDiagnostic[] = Object.freeze([]);

type Listener = () => void;

interface StructuralDiagnosticsSnapshot {
  readonly all: readonly StructuralDiagnostic[];
  readonly byEntity: ReadonlyMap<string, readonly StructuralDiagnostic[]>;
}

const INITIAL_SNAPSHOT: StructuralDiagnosticsSnapshot = { all: EMPTY, byEntity: new Map() };

// SSoT pub/sub via createExternalStore (WAVE 2.6). `all` + `byEntity` are the
// same derived pair rebuilt together on every `set`, so they now live in ONE
// snapshot object. No `equals` — the hand-rolled store notified unconditionally.
const store = createExternalStore<StructuralDiagnosticsSnapshot>(INITIAL_SNAPSHOT);

export const StructuralDiagnosticsStore = {
  /** Αντικατάστησε τα ευρήματα + ειδοποίησε subscribers. */
  set(next: readonly StructuralDiagnostic[]): void {
    const all = next.length === 0 ? EMPTY : next;
    store.set({ all, byEntity: indexDiagnosticsByEntity(all) });
  },
  /** Όλα τα τρέχοντα ευρήματα (stable reference μέχρι το επόμενο set). */
  getAll(): readonly StructuralDiagnostic[] {
    return store.get().all;
  },
  /** Ευρήματα που εμπλέκουν το συγκεκριμένο entity (stable reference). */
  getForEntity(entityId: string): readonly StructuralDiagnostic[] {
    return store.get().byEntity.get(entityId) ?? EMPTY;
  },
  subscribe(listener: Listener): () => void {
    return store.subscribe(listener);
  },
} as const;

/** Σταθερή κενή λίστα (server snapshot / no-diagnostics). */
export const EMPTY_DIAGNOSTICS = EMPTY;
