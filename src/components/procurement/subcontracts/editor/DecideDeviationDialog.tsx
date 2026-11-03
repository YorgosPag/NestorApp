'use client';

/**
 * Απόφαση πάνω σε απόκλιση (ADR-928 §5.2.1 τρόπος 3 · Φ3γ απόφαση 6): έγκριση ή απόρριψη, από **άλλον** από τον αιτούντα.
 *
 * 🔑 CAS με ό,τι βλέπει ο άνθρωπος (`expectedRevision` = η αναθεώρηση του εγγράφου που κοιτάζει). Αν άλλαξε στο μεταξύ,
 *    ο γραφέας απαντά 409 και η ζωντανή ανάγνωση έχει ήδη τη νέα εκδοχή — προειδοποίηση, ποτέ απόφαση στα τυφλά.
 * 🔑 Η απόρριψη θέλει αιτιολογία (Ironclad: «add an explanation»): ο αιτών πρέπει να μάθει **τι** να αλλάξει.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { decideSubcontractAgreementDeviation } from '@/services/procurement/subcontracts/subcontract-agreements-api.client';
import { subcontractFailureOf } from '@/services/procurement/subcontracts/subcontract-failure';
import type { DeviationRow } from '@/subapps/procurement/subcontracts/agreements/deviation-decisions';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
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
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const needsReason = decision === 'rejected' && reason.trim().length === 0;

  const send = async () => {
    setSending(true);
    try {
      await decideSubcontractAgreementDeviation(agreement.id, {
        expectedRevision: agreement.revision, clauseKey: row.clauseKey, parameterKey: row.parameterKey, decision, reason: reason.trim() || null,
      });
      success(t(`subcontracts.editor.deviations.done.${decision}`));
      onClose();
    } catch (cause) {
      notifyFailure(subcontractFailureOf(cause));
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`subcontracts.editor.deviations.dialog.${decision}`)}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <Label htmlFor="deviation-decision-reason">{t('subcontracts.editor.deviations.dialog.reason')}</Label>
        <Textarea id="deviation-decision-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        {needsReason && <p className="text-xs text-muted-foreground">{t('subcontracts.editor.deviations.dialog.reasonRequired')}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={onClose}>{t('subcontracts.editor.deviations.dialog.cancel')}</Button>
          <Button type="button" variant={decision === 'rejected' ? 'destructive' : 'default'} disabled={sending || needsReason} onClick={() => void send()}>
            {t(`subcontracts.editor.deviations.${decision === 'approved' ? 'approve' : 'reject'}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
