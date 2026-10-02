'use client';

/**
 * ADR-901 Φ1 — ο διάλογος ελέγχου γραμμής: αποδοχή (με ημερομηνία έκδοσης όταν η γραμμή
 * έχει ισχύ), επιστροφή με λόγο, ή «δεν εφαρμόζεται» με λόγο. Παράγει **εντολή** — δεν
 * γράφει τίποτα μόνος του· την εφαρμόζει ο καλών (optimistic, `useConveyanceCase`).
 *
 * Η αποδοχή δένεται στο **νεότερο** αρχείο της γραμμής: νέο ανέβασμα ⇒ `stale` (ADR-901 Σ-2/§5.5).
 *
 * @module components/sales/conveyance/ConveyanceRowDialog
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { localDateOf } from '@/lib/date-local';
import { cn } from '@/lib/utils';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import type { ChecklistRow } from '@/types/conveyance-case';
import type { RowDialogMode } from './ConveyanceChecklistRow';

interface ConveyanceRowDialogProps {
  readonly target: { readonly row: ChecklistRow; readonly mode: RowDialogMode } | null;
  readonly onClose: () => void;
  readonly onSubmit: (command: ConveyanceCommand) => void;
}

const TITLE_KEY: Readonly<Record<RowDialogMode, string>> = {
  accept: 'dialogs.acceptTitle',
  reject: 'dialogs.rejectTitle',
  not_applicable: 'dialogs.notApplicableTitle',
};

function hasValidity(row: ChecklistRow): boolean {
  const kind = row.item.validity.kind;
  return kind === 'days' || kind === 'unverified';
}

function buildCommand(row: ChecklistRow, mode: RowDialogMode, reason: string, issuedOn: Date | undefined): ConveyanceCommand {
  if (mode === 'not_applicable') return { type: 'mark_not_applicable', itemId: row.itemId, reason };
  return {
    type: 'review',
    itemId: row.itemId,
    verdict: mode === 'accept' ? 'accepted' : 'rejected',
    fileId: row.files[0]?.fileId ?? null,
    issuedOn: mode === 'accept' && issuedOn ? localDateOf(issuedOn) : null,
    reason: mode === 'reject' ? reason : null,
  };
}

function IssuedOnField({ value, onChange }: { readonly value: Date | undefined; readonly onChange: (date: Date | undefined) => void }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <fieldset className="space-y-1">
      <Label htmlFor="conveyance-issued-on">{t('dialogs.issuedOnLabel')}</Label>
      <DatePickerField
        id="conveyance-issued-on"
        value={value}
        onSelect={onChange}
        placeholder={t('signing.notSet')}
        disabledDates={{ after: new Date() }}
      />
      <p className={cn('text-xs', colors.text.muted)}>{t('dialogs.issuedOnHint')}</p>
    </fieldset>
  );
}

export function ReasonField({ value, onChange }: { readonly value: string; readonly onChange: (next: string) => void }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <fieldset className="space-y-1">
      <Label htmlFor="conveyance-reason">{t('dialogs.reasonLabel')}</Label>
      <Textarea id="conveyance-reason" value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
      {value.trim().length === 0 && <p className={cn('text-xs', colors.text.muted)}>{t('dialogs.reasonRequired')}</p>}
    </fieldset>
  );
}

const MODE_HINT_KEY: Readonly<Partial<Record<RowDialogMode, string>>> = {
  accept: 'dialogs.acceptDescription',
  not_applicable: 'dialogs.notApplicableDescription',
};

function RowDialogHeader({ row, mode }: { readonly row: ChecklistRow; readonly mode: RowDialogMode }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const hintKey = MODE_HINT_KEY[mode];
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(TITLE_KEY[mode])}</DialogTitle>
        <DialogDescription>
          {t(row.item.labelKey)}
          {mode === 'accept' && row.files[0] ? ` — ${row.files[0].displayName}` : ''}
        </DialogDescription>
      </DialogHeader>
      {hintKey && <p className={cn('text-xs', colors.text.muted)}>{t(hintKey)}</p>}
    </>
  );
}

export function ConveyanceRowDialog({ target, onClose, onSubmit }: ConveyanceRowDialogProps) {
  const { t } = useTranslation(['conveyance']);
  const [reason, setReason] = useState('');
  const [issuedOn, setIssuedOn] = useState<Date | undefined>(undefined);

  useEffect(() => {
    setReason('');
    setIssuedOn(undefined);
  }, [target]);

  if (!target) return null;
  const { row, mode } = target;
  const needsReason = mode !== 'accept';
  const trimmed = reason.trim();
  const submit = () => {
    onSubmit(buildCommand(row, mode, trimmed, issuedOn));
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <RowDialogHeader row={row} mode={mode} />
        {mode === 'accept' && hasValidity(row) && <IssuedOnField value={issuedOn} onChange={setIssuedOn} />}
        {needsReason && <ReasonField value={reason} onChange={setReason} />}
        <DialogActionFooter
          cancelLabel={t('actions.cancel')}
          confirmLabel={t('actions.save')}
          busyLabel={t('actions.save')}
          onCancel={onClose}
          onConfirm={submit}
          isSubmitting={false}
          canSubmit={!needsReason || trimmed.length > 0}
          confirmVariant={mode === 'reject' ? 'destructive' : 'default'}
        />
      </DialogContent>
    </Dialog>
  );
}
