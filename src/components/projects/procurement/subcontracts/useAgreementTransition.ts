'use client';

/**
 * Η εκτέλεση μιας μετάβασης κύκλου ζωής από τη λίστα (ADR-928 §5.5 · Φ3α-2).
 *
 * 🔑 **CAS με ό,τι βλέπει ο άνθρωπος**: `expectedRevision` = η αναθεώρηση της γραμμής. Αν άλλος άλλαξε το έγγραφο στο
 *    μεταξύ, ο γραφέας απαντά 409 και η ζωντανή λίστα έχει ήδη τη νέα εκδοχή — προειδοποίηση, ποτέ σιωπηλή εφαρμογή
 *    πάνω σε κάτι που δεν είδε.
 * 🔑 Όσες μεταβάσεις δεν αναιρούνται (`CONFIRMED_TRANSITIONS`: οι καταστρεπτικές **και** έκδοση · αποδοχή) θέλουν ρητή
 *    επιβεβαίωση με τον αριθμό του εγγράφου και τις **συνέπειές** τους (ADR-928 §5.24.5)· κόκκινη μόνο η καταστρεπτική.
 * 🔑 Ένα αίτημα ανά έγγραφο τη φορά (`pendingIds`)· το `Idempotency-Key` του `apiClient` καλύπτει την επανάληψη δικτύου.
 * 🔑 Καμία αισιόδοξη αλλαγή κατάστασης: η κατάσταση είναι απόφαση του γραφέα (φύλακες, πάγωμα αναθεώρησης)· η γραμμή
 *    δείχνει «σε εξέλιξη» και η ζωντανή ανάγνωση φέρνει το αποτέλεσμα σε ένα στιγμιότυπο.
 */

import { useCallback, useState } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useSubcontractFailureNotice } from '@/components/procurement/subcontracts/subcontract-messages';
import { transitionSubcontractAgreement } from '@/services/procurement/subcontracts/subcontract-agreements-api.client';
import { subcontractFailureOf } from '@/services/procurement/subcontracts/subcontract-failure';
import { spawnsAgreementOnAccept } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import type { RowAction } from './subcontract-row-actions';

/** Το κλειδί του κειμένου επιβεβαίωσης: η αποδοχή προσφοράς Τρόπου Β **γεννά** συμφωνητικό — και το λέει. */
function confirmKeyOf(agreement: SubcontractAgreement, action: RowAction): string {
  return action.transition === 'accept' && spawnsAgreementOnAccept(agreement) ? 'acceptOffer' : action.transition;
}

function usePendingIds() {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const mark = useCallback((id: string, pending: boolean) => {
    setPendingIds((previous) => {
      const next = new Set(previous);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  return { pendingIds, mark };
}

export function useAgreementTransition() {
  const { t } = useTranslation('procurement');
  const { confirm, dialogProps } = useConfirmDialog();
  const { success } = useNotifications();
  const notifyFailure = useSubcontractFailureNotice();
  const { pendingIds, mark } = usePendingIds();

  const confirmed = useCallback(
    (agreement: SubcontractAgreement, action: RowAction): Promise<boolean> => {
      if (!action.confirm) return Promise.resolve(true);
      const values = { number: agreement.documentNumber };
      const key = confirmKeyOf(agreement, action);
      return confirm({
        title: t(`subcontracts.actions.confirm.${key}.title`, values),
        description: t(`subcontracts.actions.confirm.${key}.description`, values),
        confirmText: t(`subcontracts.actions.transition.${action.transition}`),
        variant: action.destructive ? 'destructive' : 'default',
      });
    },
    [confirm, t],
  );

  const run = useCallback(
    async (agreement: SubcontractAgreement, action: RowAction): Promise<void> => {
      if (action.block !== null || pendingIds.has(agreement.id)) return;
      if (!(await confirmed(agreement, action))) return;
      mark(agreement.id, true);
      try {
        await transitionSubcontractAgreement(agreement.id, action.transition, { expectedRevision: agreement.revision, mobilizedOn: null });
        success(t(`subcontracts.actions.done.${action.transition}`, { number: agreement.documentNumber }));
      } catch (cause) {
        notifyFailure(subcontractFailureOf(cause));
      } finally {
        mark(agreement.id, false);
      }
    },
    [confirmed, mark, notifyFailure, pendingIds, success, t],
  );

  return { run, pendingIds, dialogProps };
}
