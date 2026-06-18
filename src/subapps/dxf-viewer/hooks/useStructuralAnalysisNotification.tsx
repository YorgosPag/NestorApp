'use client';

/**
 * useStructuralAnalysisNotification — ADR-482 (T3-UI, στατική ανάλυση toast).
 *
 * Μικρό read-only hook: ακούει το `bim:analysis-solved` (που εκπέμπει ο
 * `structural-analysis-core` μόλις τρέξει ο FEM solver) και δείχνει info/warning
 * toast με το πλήθος συνδυασμών — feedback ότι η «Ανάλυση» ολοκληρώθηκε (μηχανισμός
 * → warning). Mirror του toast pattern του `useStructuralOrganismNotification`
 * (sonner + i18n). Zero state, zero store write → ADR-040 safe.
 *
 * @see hooks/structural-analysis-core.ts — ο emitter του `bim:analysis-solved`
 * @see hooks/useStructuralOrganismNotification.tsx — το toast πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-482-static-analysis-ui-surface.md
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EventBus } from '../systems/events/EventBus';

export function useStructuralAnalysisNotification(): void {
  const { t } = useTranslation('dxf-viewer-shell');

  useEffect(() => {
    const onSolved = ({ combinationCount, unstable }: { combinationCount: number; unstable: boolean }): void => {
      if (unstable) {
        toast.warning(t('staticAnalysis.solvedUnstable'));
        return;
      }
      toast.success(t('staticAnalysis.solved', { count: combinationCount }));
    };
    return EventBus.on('bim:analysis-solved', onSolved);
  }, [t]);
}
