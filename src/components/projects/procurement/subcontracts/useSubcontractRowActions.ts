'use client';

/**
 * Οι μεταβάσεις που προσφέρονται για ένα έγγραφο και γιατί μια είναι ανενεργή — ΕΝΑ σημείο για τη λίστα (Φ3α-2) και τη
 * σελίδα λεπτομέρειας (Φ3γ) του ADR-928.
 *
 * 🔑 Μόνο όπου ο θεατής έχει δικαίωμα (`useSubcontractAuthority`, ο ίδιος κανόνας πόρου με τον διακομιστή), κρινόμενες με
 *    τη βιβλιοθήκη όπως είναι τώρα (`rowActionsOf`). Fail-closed όσο φορτώνει η βιβλιοθήκη.
 * 🔑 Η αιτία της ανενεργής με τη λέξη του γραφέα (ίδιοι πίνακες μηνυμάτων).
 */

import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubcontractAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useSubcontractClauseLibrary } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { todayLocalDate } from '@/lib/date-local';
import { useSubcontractFailureMessage, useSubcontractIssueMessage } from '@/components/procurement/subcontracts/subcontract-messages';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { rowActionsOf, type RowAction, type RowActionBlock } from './subcontract-row-actions';

export function useSubcontractRowActions(projectId: string | null): (agreement: SubcontractAgreement) => readonly RowAction[] {
  const { user } = useAuth();
  const authority = useSubcontractAuthority(projectId);
  const { library, loading } = useSubcontractClauseLibrary();
  return useCallback(
    (agreement: SubcontractAgreement) => {
      if (!user || !authority.canManage(agreement)) return [];
      return rowActionsOf(agreement, { today: todayLocalDate(), library: loading ? null : library, actorUid: user.uid });
    },
    [authority, library, loading, user],
  );
}

/** `needed`: φορτώνει τους πίνακες μηνυμάτων μόνο όταν υπάρχει ανενεργή ενέργεια να εξηγηθεί (ADR-744 §34). */
export function useRowActionBlockReason(needed: boolean): (block: RowActionBlock) => string {
  const { t } = useTranslation('procurement');
  const failure = useSubcontractFailureMessage(needed);
  const issue = useSubcontractIssueMessage(needed);
  return (block) => {
    switch (block.kind) {
      case 'checking': return t('subcontracts.actions.checking');
      case 'unsaved': return t('subcontracts.editor.saveFirst');
      case 'refusal': return failure(block.refusal);
      case 'issue': return issue(block.issue);
    }
  };
}
