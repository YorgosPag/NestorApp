'use client';

/**
 * **Απόφαση με λόγο** — ο ένας διάλογος της υπεργολαβίας για ό,τι αποφασίζει άνθρωπος και πρέπει να το εξηγήσει
 * (ADR-928 §5.2.1 · Φ3γ-1 απόφαση 6 · Φ3γ-0): απόκλιση συμφωνητικού, έγκριση/απόρριψη/απόσυρση έκδοσης ρήτρας.
 *
 * 🔑 Εξήχθη από το `DecideDeviationDialog`: η βιβλιοθήκη χρειάζεται **τον ίδιο** διάλογο (λόγος, υποχρεωτικός στην
 *    απόρριψη — Ironclad «add an explanation»), και δεύτερο αντίγραφο θα απέκλινε στο πρώτο νέο πεδίο.
 * 🔑 Ο διάλογος **δεν** ξέρει τι στέλνει: το `onSend` είναι της πράξης. Αν αποτύχει, ο διάλογος μένει ανοιχτός με το
 *    κείμενο του ανθρώπου — ποτέ χαμένος λόγος. Η ειδοποίηση αποτυχίας είναι του καλούντος (`useSubcontractFailureNotice`).
 * 🔑 `extra`: πεδία της συγκεκριμένης απόφασης (π.χ. «σε ισχύ από» στην έγκριση) — τοποθετούνται πριν τον λόγο.
 */

import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface ReasonDialogProps {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  /** Χωρίς λόγο το κουμπί μένει ανενεργό, με ορατή αιτία. */
  readonly reasonRequired: boolean;
  readonly extra?: ReactNode;
  /** `true` ⇒ έγινε (ο διάλογος κλείνει)· `false` ⇒ απέτυχε (μένει ανοιχτός). */
  readonly onSend: (reason: string | null) => Promise<boolean>;
  readonly onClose: () => void;
}

export function ReasonDialog({ title, description, confirmLabel, destructive = false, reasonRequired, extra, onSend, onClose }: ReasonDialogProps) {
  const { t } = useTranslation('procurement');
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const missingReason = reasonRequired && reason.trim().length === 0;

  const send = async () => {
    setSending(true);
    const done = await onSend(reason.trim() || null);
    if (done) onClose();
    else setSending(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {extra}
        <Label htmlFor={reasonId}>{t('subcontracts.editor.deviations.dialog.reason')}</Label>
        <Textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        {missingReason && <p className="text-xs text-muted-foreground">{t('subcontracts.editor.deviations.dialog.reasonRequired')}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={onClose}>{t('subcontracts.editor.deviations.dialog.cancel')}</Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} disabled={sending || missingReason} onClick={() => void send()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
