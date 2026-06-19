'use client';

/**
 * useAutoFoundationDesign — ADR-459 Phase 7 (Αυτόματος Σχεδιασμός Θεμελίωσης).
 *
 * Thin reactive shell hook: σε κάθε στατική μεταβολή (νέα/μετακινημένη/διαγραμμένη
 * κολώνα, αλλαγή φορτίων) ξανα-τρέχει — coalesced ανά microtask — τον SSoT πυρήνα
 * `runAutoFoundationDesign` (ADR-500 extraction) και κάνει info toast με τα counts.
 *
 * Ο ΙΔΙΟΣ πυρήνας τροφοδοτεί και τον σύγχρονο convergence loop (`runAutoStudy`,
 * ADR-500) → μηδέν διπλότυπο.
 *
 * **Atomic undo:** geometry-edit triggers (έχουν δικό τους command στο stack) → το
 * παράγωγο footing re-derive ομαδοποιείται στο **ίδιο** undo step (`executeGrouped`)·
 * τα υπόλοιπα (π.χ. αυτόματα φορτία) → standalone.
 *
 * ADR-040 safe: low-freq, coalesced ανά microtask (mirror `useStructuralOrganism`).
 *
 * @see hooks/auto-foundation-design-core.ts — runAutoFoundationDesign (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/auth/hooks/useAuth';
import { type DrawingEventType } from '../systems/events/EventBus';
import {
  runAutoFoundationDesign,
  foundationChangeCount,
  type FoundationDesignLevelManager,
} from './auto-foundation-design-core';
import { useGroupedStructuralReaction } from './useGroupedStructuralReaction';

/** Στατικές μεταβολές που επανα-διαστασιολογούν τη θεμελίωση. */
const AUTO_DESIGN_EVENTS: readonly DrawingEventType[] = [
  'drawing:entity-created',
  'bim:column-params-updated', // grip-resize / ribbon edit / γεωμετρική αλλαγή
  'bim:entities-moved', // drag-move κολόνας (MoveEntityCommand) → re-derive layout
  'bim:column-delete-requested',
  'bim:structural-loads-computed',
];

export function useAutoFoundationDesign(props: { levelManager: FoundationDesignLevelManager }): void {
  const { levelManager } = props;
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();

  // SSoT wiring (coalescing + atomic-undo grouping) → `useGroupedStructuralReaction`·
  // εδώ μένει ΜΟΝΟ η μοναδική λογική footing re-derive + toast.
  useGroupedStructuralReaction(AUTO_DESIGN_EVENTS, (exec) => {
    const result = runAutoFoundationDesign(levelManager, { user, exec });
    if (foundationChangeCount(result) === 0) return; // idempotent no-op → μηδέν toast
    toast.success(
      t('autoFoundation.applied', {
        created: result.created,
        combined: result.combined,
        updated: result.updated,
        removed: result.removed,
      }),
    );
  });
}
