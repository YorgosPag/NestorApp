'use client';

/**
 * useEntityAnalysisForces — ADR-482 (T3-UI, per-entity εντατικά μεγέθη).
 *
 * Λεπτό reactive selector: επιστρέφει το envelope (max-abs over combinations)
 * των εντατικών μεγεθών ενός μέλους από το `AnalysisResultsStore` (ADR-481),
 * για read-only readout στα property panels. memberId === entityId (1:1, ADR-480).
 *
 * Low-freq store (γράφεται μόνο όταν τρέξει η «Ανάλυση») → ADR-040 safe. Το
 * `envelopeByMember.get(id)` δίνει σταθερή αναφορά μέχρι το επόμενο solve →
 * συμβατό με `useSyncExternalStore` (μηδέν re-render loop).
 *
 * @see ../../bim/structural/analytical/solver/analysis-results-store.ts
 * @see ./AnalysisForcesSection.tsx — ο consumer
 */

import { useSyncExternalStore } from 'react';
import { AnalysisResultsStore } from '../../bim/structural/analytical/solver/analysis-results-store';
import type { MemberForceExtrema } from '../../bim/structural/analytical/solver/solver-types';

export function useEntityAnalysisForces(entityId: string): MemberForceExtrema | null {
  return useSyncExternalStore(
    AnalysisResultsStore.subscribe,
    () => AnalysisResultsStore.get().envelopeByMember.get(entityId) ?? null,
    () => null,
  );
}
