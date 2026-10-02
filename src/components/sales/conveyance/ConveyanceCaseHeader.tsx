'use client';

/**
 * ADR-901 Φ1 — η κεφαλίδα της υπόθεσης: κατάσταση, πρόοδος («14 από 19 · 2 λήγουν»),
 * ημέρα υπογραφής (βάση του «θα ισχύει τότε;») και ακύρωση. Οι αριθμοί έρχονται από τη
 * ΜΙΑ σύνοψη του πυρήνα (`summarizeChecklist`) — καμία δεύτερη καταμέτρηση εδώ.
 *
 * @module components/sales/conveyance/ConveyanceCaseHeader
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { calendarDateOfDateKey } from '@/lib/calendar/date-key';
import { localDateOf } from '@/lib/date-local';
import { cn } from '@/lib/utils';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import type { ChecklistSummary, ConveyanceCaseView } from '@/types/conveyance-case';
import { ReasonField } from './ConveyanceRowDialog';

interface ConveyanceCaseHeaderProps {
  readonly view: ConveyanceCaseView;
  readonly canEdit: boolean;
  readonly onCommand: (command: ConveyanceCommand) => void;
}

const SUMMARY_COUNTERS = ['awaitingReview', 'missing', 'rejected', 'expiring', 'expired'] as const;

function SummaryLine({ summary }: { readonly summary: ChecklistSummary }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" aria-live="polite">
      <li className="font-medium">{t('summary.progress', { complete: summary.complete, applicable: summary.applicable })}</li>
      {SUMMARY_COUNTERS.filter((key) => summary[key] > 0).map((key) => (
        <li key={key} className={colors.text.secondary}>{t(`summary.${key}`, { count: summary[key] })}</li>
      ))}
      {summary.openQuestions.length > 0 && (
        <li className={colors.text.secondary}>{t('summary.questions', { count: summary.openQuestions.length })}</li>
      )}
    </ul>
  );
}

function SigningDate({ value, canEdit, onCommand }: { readonly value: string | null; readonly canEdit: boolean; readonly onCommand: ConveyanceCaseHeaderProps['onCommand'] }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <fieldset className="space-y-1">
      <Label htmlFor="conveyance-signing-date">{t('signing.label')}</Label>
      <span className="flex items-center gap-2">
        <DatePickerField
          id="conveyance-signing-date"
          value={value ? calendarDateOfDateKey(value) ?? undefined : undefined}
          onSelect={(date) => onCommand({ type: 'set_target_signing_date', date: date ? localDateOf(date) : null })}
          placeholder={t('signing.notSet')}
          disabled={!canEdit}
        />
        {value && canEdit && (
          <Button variant="ghost" size="sm" onClick={() => onCommand({ type: 'set_target_signing_date', date: null })}>
            {t('signing.clear')}
          </Button>
        )}
      </span>
      <p className={cn('text-xs', colors.text.muted)}>{t('signing.hint')}</p>
    </fieldset>
  );
}

function CancelCase({ onCommand }: { readonly onCommand: ConveyanceCaseHeaderProps['onCommand'] }) {
  const { t } = useTranslation(['conveyance']);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const close = () => { setOpen(false); setReason(''); };
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{t('cancel.action')}</Button>
      <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancel.title')}</DialogTitle>
            <DialogDescription>{t('cancel.description')}</DialogDescription>
          </DialogHeader>
          <ReasonField value={reason} onChange={setReason} />
          <DialogActionFooter
            cancelLabel={t('actions.cancel')}
            confirmLabel={t('cancel.confirm')}
            busyLabel={t('cancel.confirm')}
            onCancel={close}
            onConfirm={() => { onCommand({ type: 'cancel', reason: reason.trim() }); close(); }}
            isSubmitting={false}
            canSubmit={reason.trim().length > 0}
            confirmVariant="destructive"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ConveyanceCaseHeader({ view, canEdit, onCommand }: ConveyanceCaseHeaderProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const record = view.conveyanceCase;
  const editable = canEdit && view.state === 'open';
  const unverified = view.checklist.rows.some((row) => row.item.verifiedAt === null);
  return (
    <header className="space-y-3 rounded-lg border bg-card p-3">
      <section className="flex flex-wrap items-start justify-between gap-2">
        <hgroup className="space-y-0.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {t('tab.title')}
            <Badge variant={view.state === 'open' ? 'info' : 'muted'}>{t(`state.${view.state}`)}</Badge>
          </h2>
          <p className={cn('text-xs', colors.text.muted)}>{t('tab.subtitle')}</p>
        </hgroup>
        {editable && <CancelCase onCommand={onCommand} />}
      </section>
      <SummaryLine summary={view.checklist.summary} />
      {view.state !== 'open' && <p className={cn('text-xs', colors.text.muted)}>{t('tab.readOnly', { state: t(`state.${view.state}`) })}</p>}
      <SigningDate value={record.targetSigningDate} canEdit={editable} onCommand={onCommand} />
      {unverified && <p className={cn('text-xs', colors.text.muted)}>{t('tab.catalogUnverified', { version: record.catalogVersion })}</p>}
    </header>
  );
}
