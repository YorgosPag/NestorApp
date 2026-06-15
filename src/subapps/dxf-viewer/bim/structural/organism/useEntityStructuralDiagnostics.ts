'use client';

/**
 * Structural Organism — per-entity diagnostics selector (ADR-459, Phase 1).
 *
 * Λεπτό reactive hook: επιστρέφει τα DERIVED cross-entity ευρήματα που εμπλέκουν
 * ένα entity, για surfacing σε property panels (μέσω `EntityWarningsSection`).
 * Διαβάζει το low-freq `StructuralDiagnosticsStore` → ADR-040 safe.
 *
 * @see structural-diagnostics-store.ts
 */

import { useSyncExternalStore } from 'react';
import {
  StructuralDiagnosticsStore,
  EMPTY_DIAGNOSTICS,
} from './structural-diagnostics-store';
import type { StructuralDiagnostic } from './structural-organism-types';

export function useEntityStructuralDiagnostics(
  entityId: string,
): readonly StructuralDiagnostic[] {
  return useSyncExternalStore(
    StructuralDiagnosticsStore.subscribe,
    () => StructuralDiagnosticsStore.getForEntity(entityId),
    () => EMPTY_DIAGNOSTICS,
  );
}
