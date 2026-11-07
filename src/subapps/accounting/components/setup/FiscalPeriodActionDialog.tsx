'use client';

/**
 * @fileoverview Λογιστικές χρήσεις — διάλογος επιβεβαίωσης πράξης περιόδου (ADR-ACC-010 §2.1.1 Φ9-Β)
 * @description Κλείσιμο · κλείδωμα · επαναφορά ΜΟΝΟ μέσα από διάλογο της εφαρμογής (ποτέ `window.confirm`). Λέει ΤΙ
 *   αλλάζει πριν την επιβεβαίωση· το κλείδωμα δηλώνεται ρητά ΟΡΙΣΤΙΚΟ. Λόγος υποχρεωτικός μόνο στην επαναφορά — ίδιος
 *   κανόνας με το route (`reopenReason` είναι το μόνο πεδίο λόγου που αποθηκεύεται)· καμία κρίση εδώ.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FiscalPeriodAction } from '../../types/fiscal-period';

/** Η πράξη που περιμένει επιβεβαίωση — `null` = κλειστός διάλογος. */
export interface FiscalPeriodActionTarget {
  readonly periodId: string;
  readonly periodLabel: string;
  readonly action: FiscalPeriodAction;
}

interface FiscalPeriodActionDialogProps {
  readonly target: FiscalPeriodActionTarget | null;
  readonly running: boolean;
  /** Ήδη μεταφρασμένο μήνυμα αποτυχίας της πράξης. */
  readonly failureMessage: string | null;
  readonly onConfirm: (target: FiscalPeriodActionTarget, reason: string | null) => void;
  readonly onClose: () => void;
}

const REASON_MAX_LENGTH = 500;

export function FiscalPeriodActionDialog({ target, running, failureMessage, onConfirm, onClose }: FiscalPeriodActionDialogProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  const [reason, setReason] = useState('');

  // Νέα πράξη ⇒ καθαρό πεδίο (ποτέ ο λόγος μιας άλλης περιόδου).
  useEffect(() => { setReason(''); }, [target?.periodId, target?.action]);

  const reasonRequired = target?.action === 'reopen';
  const complete = !reasonRequired || reason.trim().length > 0;
  const action = target?.action ?? 'close';

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open && !running) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`fiscalPeriods.manage.dialog.${action}.title`, { period: target?.periodLabel ?? '' })}</DialogTitle>
          <DialogDescription>{t(`fiscalPeriods.manage.dialog.${action}.body`)}</DialogDescription>
        </DialogHeader>
        {reasonRequired && (
          <fieldset className="space-y-2">
            <Label htmlFor="fiscal-period-reason">{t('fiscalPeriods.manage.dialog.reason')}</Label>
            <Textarea id="fiscal-period-reason" value={reason} maxLength={REASON_MAX_LENGTH}
              placeholder={t('fiscalPeriods.manage.dialog.reasonPlaceholder')} onChange={(event) => setReason(event.target.value)} />
          </fieldset>
        )}
        {failureMessage !== null && <p role="alert" className={`text-sm ${colors.text.error}`}>{failureMessage}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={onClose}>{t('fiscalPeriods.manage.dialog.cancel')}</Button>
          <Button variant={action === 'lock' ? 'destructive' : 'default'} disabled={!complete || running}
            onClick={() => { if (target !== null) onConfirm(target, reasonRequired ? reason : null); }}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t(`fiscalPeriods.manage.actions.${action}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
