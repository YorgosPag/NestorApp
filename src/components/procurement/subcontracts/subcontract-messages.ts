'use client';

/**
 * @fileoverview **Τα μηνύματα της υπεργολαβίας**: ευρήματα επικύρωσης και αρνήσεις του γραφέα, στη γλώσσα του χρήστη
 *   (ADR-928 Φ3α-2 · ADR-744 §34).
 * @module components/procurement/subcontracts/subcontract-messages
 *
 * 🔑 Οι πίνακες ζουν πίσω από `import()` (`subcontract-message-keys.ts`) — ο **ίδιος** μηχανισμός με τα ευρήματα του
 *    καταλόγου (`defineDeferredMessageTable` + `useDeferredMessage`), κανένας δεύτερος. Μέχρι να φτάσουν, η μία λέξη
 *    `subcontracts.messages.pending` του slice· ποτέ ωμό κλειδί.
 * 🔑 Μία λέξη ανά είδος άρνησης, σε κάθε οθόνη: η ειδοποίηση αποτυχίας, το «γιατί είναι ανενεργό» ενός κουμπιού και το
 *    μήνυμα δίπλα στο πεδίο διαβάζουν τους **ίδιους** πίνακες.
 */

import { useCallback } from 'react';

import { defineDeferredMessageTable } from '@/i18n/deferred-message-table';
import { useDeferredMessage } from '@/i18n/hooks/useDeferredMessageTable';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import type { SubcontractFailure, SubcontractFailureKind } from '@/services/procurement/subcontracts/subcontract-failure';
import type { SubcontractIssue, SubcontractIssueCode } from '@/subapps/procurement/subcontracts/clauses/clause-issues';

const NAMESPACES = ['procurement'] as const;

const ISSUE_TABLE = defineDeferredMessageTable('subcontract-issues', NAMESPACES, () =>
  import('./subcontract-message-keys').then((module) => module.SUBCONTRACT_ISSUE_KEYS),
);

const FAILURE_TABLE = defineDeferredMessageTable('subcontract-failures', NAMESPACES, () =>
  import('./subcontract-message-keys').then((module) => module.SUBCONTRACT_FAILURE_KEYS),
);

function useMessageContext() {
  const { t, i18n } = useTranslation('procurement');
  return { t, language: i18n.language, pending: t('subcontracts.messages.pending') };
}

/**
 * Η μετάφραση ενός ευρήματος (κωδικός + διαδρομή, ίδια στην οθόνη και στον γραφέα).
 * @param needed υπάρχει **τώρα** εύρημα να δειχτεί ⇒ φόρτωση αμέσως, αντί για προφόρτωση σε αδράνεια.
 */
export function useSubcontractIssueMessage(needed = false): (issue: SubcontractIssue | SubcontractIssueCode) => string {
  const translate = useDeferredMessage(ISSUE_TABLE, { ...useMessageContext(), needed });
  return useCallback(
    (issue: SubcontractIssue | SubcontractIssueCode) => translate(typeof issue === 'string' ? issue : issue.code),
    [translate],
  );
}

/** Η λέξη ενός είδους άρνησης — και για το «γιατί είναι ανενεργό» ενός κουμπιού (ίδιος πίνακας με τον γραφέα). */
export function useSubcontractFailureMessage(needed = false): (kind: SubcontractFailureKind) => string {
  return useDeferredMessage(FAILURE_TABLE, { ...useMessageContext(), needed });
}

/**
 * Η μία ειδοποίηση αποτυχίας εγγραφής. Το «άλλαξε από άλλον» (CAS) δεν είναι βλάβη: η λίστα είναι ζωντανή και έχει ήδη
 * τη νέα εκδοχή ⇒ προειδοποίηση, όχι σφάλμα. Με ευρήματα ⇒ το πρώτο, συγκεκριμένο (όχι γενικό «άκυρο»).
 */
export function useSubcontractFailureNotice(): (failure: SubcontractFailure) => void {
  const failureMessage = useSubcontractFailureMessage();
  const issueMessage = useSubcontractIssueMessage();
  const { error, warning } = useNotifications();
  return useCallback(
    (failure: SubcontractFailure) => {
      const [first] = failure.issues;
      const message = first ? issueMessage(first) : failureMessage(failure.kind);
      if (failure.kind === 'revisionMismatch') warning(message);
      else error(message);
    },
    [failureMessage, issueMessage, error, warning],
  );
}
