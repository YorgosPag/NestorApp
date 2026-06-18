'use client';

/**
 * useEntityAnalysisDiagnostics — ADR-482 (T3-UI, per-entity diagnostics ανάλυσης).
 *
 * Λεπτό reactive selector (mirror του `useEntityStructuralDiagnostics`): επιστρέφει
 * τα diagnostics ευστάθειας της στατικής ανάλυσης (μηχανισμός / παραλειπόμενο μέλος,
 * ADR-481) που εμπλέκουν ένα entity, από το low-freq `AnalysisDiagnosticsStore`
 * → ADR-040 safe. Ο reader (`EntityWarningsSection`) ενώνει αυτά με τα organism
 * diagnostics, χωρίς να σπάει τον single-writer invariant κανενός store.
 *
 * @see ../../bim/structural/analytical/analysis-diagnostics-store.ts
 * @see ../../bim/structural/organism/useEntityStructuralDiagnostics.ts — το πρότυπο
 */

import { useSyncExternalStore } from 'react';
import {
  AnalysisDiagnosticsStore,
  EMPTY_ANALYSIS_DIAGNOSTICS,
} from '../../bim/structural/analytical/analysis-diagnostics-store';
import type { StructuralDiagnostic } from '../../bim/structural/organism/structural-organism-types';

export function useEntityAnalysisDiagnostics(
  entityId: string,
): readonly StructuralDiagnostic[] {
  return useSyncExternalStore(
    AnalysisDiagnosticsStore.subscribe,
    () => AnalysisDiagnosticsStore.getForEntity(entityId),
    () => EMPTY_ANALYSIS_DIAGNOSTICS,
  );
}
