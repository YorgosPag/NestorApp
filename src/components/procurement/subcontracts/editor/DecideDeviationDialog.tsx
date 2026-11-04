'use client';

/**
 * Απόφαση πάνω σε απόκλιση (ADR-928 §5.2.1 τρόπος 3 · Φ3γ απόφαση 6): έγκριση ή απόρριψη, από **άλλον** από τον αιτούντα.
 *
 * 🔑 CAS με ό,τι βλέπει ο άνθρωπος (`expectedRevision` = η αναθεώρηση του εγγράφου που κοιτάζει). Αν άλλαξε στο μεταξύ,
 *    ο γραφέας απαντά 409 και η ζωντανή ανάγνωση έχει ήδη τη νέα εκδοχή — προειδοποίηση, ποτέ απόφαση στα τυφλά.
 * 🔑 Η απόρριψη θέλει αιτιολογία (Ironclad: «add an explanation»): ο αιτών πρέπει να μάθει **τι** να αλλάξει.
 * 🔑 Ο διάλογος είναι ο κοινός `ReasonDialog` (ADR-928 Φ3γ-0)· εδώ ζει μόνο η πράξη.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { decideSubcontractAgreementDeviation } from '@/services/procurement/subcontracts/subcontract-agreements-api.client';
import { subcontractFailureOf } from '@/services/procurement/subcontracts/subcontract-failure';
import type { DeviationRow } from '@/subapps/procurement/subcontracts/agreements/deviation-decisions';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { ReasonDialog } from '../ReasonDialog';
import { useSubcontractFailureNotice } from '../subcontract-messages';

export type DeviationDecision = 'approved' | 'rejected';

interface DecideDeviationDialogProps {
  readonly agreement: SubcontractAgreement;
  readonly row: DeviationRow;
  readonly decision: DeviationDecision;
  /** Η απόκλιση όπως διαβάζεται (ρήτρα · παράμετρος · τιμή). */
  readonly summary: string;
  readonly onClose: () => void;
}

export function DecideDeviationDialog({ agreement, row, decision, summary, onClose }: DecideDeviationDialogProps) {
  const { t } = useTranslation('procurement');
  const { success } = useNotifications();
  const notifyFailure = useSubcontractFailureNotice();

  const send = async (reason: string | null): Promise<boolean> => {
    try {
      await decideSubcontractAgreementDeviation(agreement.id, {
        expectedRevision: agreement.revision, clauseKey: row.clauseKey, parameterKey: row.parameterKey, decision, reason,
      });
      success(t(`subcontracts.editor.deviations.done.${decision}`));
      return true;
    } catch (cause) {
      notifyFailure(subcontractFailureOf(cause));
      return false;
    }
  };

  return (
    <ReasonDialog
      title={t(`subcontracts.editor.deviations.dialog.${decision}`)}
      description={summary}
      confirmLabel={t(`subcontracts.editor.deviations.${decision === 'approved' ? 'approve' : 'reject'}`)}
      destructive={decision === 'rejected'}
      reasonRequired={decision === 'rejected'}
      onSend={send}
      onClose={onClose}
    />
  );
}
