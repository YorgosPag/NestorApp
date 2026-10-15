'use client';

/**
 * @fileoverview Αποσβέσεις χρήσης — οθόνη τέλους χρήσης (ADR-ACC-007 §10)
 * @description Χρήση → προεπισκόπηση (σωστό / καταχωρημένο / διαφορά) → επιβεβαίωση → καταχώριση στο Βιβλίο Ε-Ε· και
 *   αναίρεση (αντιλογισμός). SAP AFAB test run → update run · Xero «Run depreciation» / «Rollback».
 *   Καμία αριθμητική εδώ: ό,τι βλέπει ο άνθρωπος το υπολόγισε ο διακομιστής, ο ίδιος που θα το γράψει.
 * @see ADR-ACC-010 §2.1.1 Φάση 5
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DepreciationPreview, DepreciationRunResult } from '@/subapps/accounting/types';
import { formatAccountingCurrency } from '../../utils/format';
import { accountingToday } from '../../utils/accounting-day';
import { useDepreciationRun } from '../../hooks/useDepreciationRun';
import { DepreciationPreviewTable } from './DepreciationPreviewTable';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

/** Πόσες χρήσεις προς τα πίσω προσφέρει η επιλογή. */
const SELECTABLE_YEARS = 6;

type PendingAction = 'book' | 'reverse' | null;

interface DepreciationRunDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Μετά από κάθε εγγραφή — ανανέωση του μητρώου (η προβολή του παγίου άλλαξε). */
  readonly onPosted: () => void;
}

/** Η τελευταία χρήση που έχει λήξει (Αθήνα) και οι προηγούμενες. */
function selectableYears(): number[] {
  const lastEnded = Number(accountingToday().substring(0, 4)) - 1;
  return Array.from({ length: SELECTABLE_YEARS }, (_, i) => lastEnded - i);
}

/** Μήνυμα κατάστασης: σφάλμα · αποτέλεσμα της πράξης · εμπόδιο · «όλα συμφωνούν». */
function RunStatus({ preview, errorCode, lastResult }: {
  readonly preview: DepreciationPreview | null;
  readonly errorCode: string | null;
  readonly lastResult: DepreciationRunResult | null;
}) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  if (errorCode !== null) {
    return <p role="alert" className={colors.text.error}>{t(`assets.depreciationRun.errors.${errorCode}`)}</p>;
  }
  const lines: string[] = [];
  if (lastResult !== null) {
    lines.push(t('assets.depreciationRun.result.booked', {
      count: lastResult.posted.length + lastResult.adjusted.length,
      amount: formatAccountingCurrency(lastResult.bookedDelta),
    }));
    if (lastResult.refused.length > 0) lines.push(t('assets.depreciationRun.result.refused', { count: lastResult.refused.length }));
  }
  if (preview?.blocker) lines.push(t(`assets.depreciationRun.errors.${preview.blocker}`));
  else if (preview && preview.lines.length > 0 && preview.totalDelta === 0) lines.push(t('assets.depreciationRun.upToDate'));
  if (lines.length === 0) return null;
  return <p role="status" className={colors.text.muted}>{lines.join(' · ')}</p>;
}

/** Επιβεβαίωση πριν από πράξη που αλλάζει νούμερα φόρου. */
function ConfirmAction({ action, amount, onCancel, onConfirm }: {
  readonly action: PendingAction;
  readonly amount: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const key = action === 'reverse' ? 'confirmReverse' : 'confirmBook';
  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`assets.depreciationRun.${key}.title`)}</AlertDialogTitle>
          <AlertDialogDescription>{t(`assets.depreciationRun.${key}.body`, { amount })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('assets.depreciationRun.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t(`assets.depreciationRun.${key}.action`)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function YearSelect({ year, onChange }: { readonly year: number; readonly onChange: (year: number) => void }) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const years = useMemo(selectableYears, []);
  return (
    <section className="flex items-center gap-3">
      <Label htmlFor="depreciation-run-year">{t('assets.depreciationRun.fiscalYear')}</Label>
      <Select value={String(year)} onValueChange={(value) => onChange(Number(value))}>
        <SelectTrigger id="depreciation-run-year" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}
        </SelectContent>
      </Select>
    </section>
  );
}

/** Φόρτωση · «κανένα πάγιο» · πίνακας προεπισκόπησης. */
function PreviewBody({ preview, loading }: { readonly preview: DepreciationPreview | null; readonly loading: boolean }) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const colors = useSemanticColors();
  const notice = (key: string) => <p className={cn('p-6 text-center', colors.text.muted)}>{t(key)}</p>;
  return (
    <section className="max-h-[50vh] overflow-auto rounded-md border border-border" aria-busy={loading}>
      {loading && notice('assets.depreciationRun.loading')}
      {!loading && preview !== null && preview.lines.length === 0 && notice('assets.depreciationRun.empty')}
      {!loading && preview !== null && preview.lines.length > 0 && <DepreciationPreviewTable preview={preview} />}
    </section>
  );
}

export function DepreciationRunDialog({ open, onOpenChange, onPosted }: DepreciationRunDialogProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const [year, setYear] = useState(() => selectableYears()[0]);
  const [pending, setPending] = useState<PendingAction>(null);
  const run = useDepreciationRun(open ? year : null, onPosted);
  const { preview, loading, running } = run;

  const canBook = preview !== null && preview.blocker === null && preview.totalDelta !== 0 && !running;
  const canReverse = preview !== null && preview.hasBooked && preview.blocker !== 'PERIOD_NOT_OPEN'
    && preview.blocker !== 'PERIOD_NOT_FOUND' && !running;
  const confirmAmount = formatAccountingCurrency(pending === 'reverse' ? preview?.totalBooked ?? 0 : preview?.totalDelta ?? 0);
  const confirm = () => {
    const action = pending;
    setPending(null);
    void (action === 'reverse' ? run.reverse() : run.book());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('assets.depreciationRun.title')}</DialogTitle>
          <DialogDescription>{t('assets.depreciationRun.description')}</DialogDescription>
        </DialogHeader>
        <YearSelect year={year} onChange={setYear} />
        <RunStatus preview={preview} errorCode={run.errorCode} lastResult={run.lastResult} />
        <PreviewBody preview={preview} loading={loading} />
        <DialogFooter>
          <Button variant="outline" disabled={!canReverse} onClick={() => setPending('reverse')}>
            {t('assets.depreciationRun.reverse')}
          </Button>
          <Button disabled={!canBook} onClick={() => setPending('book')}>{t('assets.depreciationRun.book')}</Button>
        </DialogFooter>
        <ConfirmAction action={pending} amount={confirmAmount} onCancel={() => setPending(null)} onConfirm={confirm} />
      </DialogContent>
    </Dialog>
  );
}
