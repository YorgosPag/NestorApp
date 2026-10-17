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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { calendarDateOfDateKey } from '@/lib/calendar/date-key';
import { localDateOf } from '@/lib/date-local';
import { cn } from '@/lib/utils';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';
import { reviewIssuedOnOf, type ReviewIssuedOn } from '@/lib/conveyance/review-attestation';
import { ruleExpires } from '@/lib/document-validity/document-expiry';
import type { DocumentTextFacts } from '@/lib/document-validity/document-text-facts';
import type { ChecklistRow } from '@/types/conveyance-case';
import { useChecklistRowLabel } from '@/components/conveyance/shared/CasePartyLabels';
import type { RowDialogMode } from './ConveyanceChecklistRow';
import { ConveyanceDocumentTextAction } from './ConveyanceDocumentTextAction';
import { ConveyanceIssuedOnField } from './ConveyanceIssuedOnField';
import { ConveyanceValidUntilField } from './ConveyanceValidUntilField';

const NOTHING_KNOWN: ReviewIssuedOn = { issuedOn: null, printedValidUntil: null, origin: null, discrepancy: null };

/** Οι ημερομηνίες που δηλώνει ο ελεγκτής στην αποδοχή. */
interface DeclaredDates {
  readonly issuedOn: Date | undefined;
  /** ADR-915 §14 — η τυπωμένη λήξη (μόνο είδη με κανόνα `printed`). */
  readonly validUntil: Date | undefined;
}

const NO_DATES: DeclaredDates = { issuedOn: undefined, validUntil: undefined };

interface ConveyanceRowDialogProps {
  /** ADR-915 §20 — η υπόθεση, για την «Ανάγνωση από το έγγραφο». */
  readonly caseId: string;
  readonly target: { readonly row: ChecklistRow; readonly mode: RowDialogMode } | null;
  readonly onClose: () => void;
  readonly onSubmit: (command: ConveyanceCommand) => void;
}

const TITLE_KEY: Readonly<Record<RowDialogMode, string>> = {
  accept: 'dialogs.acceptTitle',
  reject: 'dialogs.rejectTitle',
  not_applicable: 'dialogs.notApplicableTitle',
};

/** ADR-915 Φ1 — ζητά ημερομηνία έκδοσης κάθε κανόνας περιορισμένης ισχύος (και ο `months` του ΠΕΑ — όχι μόνο `days`). */
function hasValidity(row: ChecklistRow): boolean {
  return ruleExpires(row.item.validity);
}

/** ADR-915 §14 — ζητά τυπωμένη λήξη μόνο ο κανόνας `printed`: εκεί η διάρκεια εξαρτάται από ό,τι ξέρει μόνο το έγγραφο. */
function hasPrintedValidity(row: ChecklistRow): boolean {
  return row.item.validity.kind === 'printed';
}

const dateKeyOrNull = (accepting: boolean, date: Date | undefined): string | null =>
  accepting && date ? localDateOf(date) : null;

function buildCommand(row: ChecklistRow, mode: RowDialogMode, reason: string, dates: DeclaredDates): ConveyanceCommand {
  if (mode === 'not_applicable') return { type: 'mark_not_applicable', itemId: row.itemId, reason };
  const accepting = mode === 'accept';
  return {
    type: 'review',
    itemId: row.itemId,
    verdict: accepting ? 'accepted' : 'rejected',
    fileId: row.files[0]?.fileId ?? null,
    issuedOn: dateKeyOrNull(accepting, dates.issuedOn),
    validUntil: dateKeyOrNull(accepting && hasPrintedValidity(row), dates.validUntil),
    reason: mode === 'reject' ? reason : null,
  };
}

const dateOfKey = (key: string | null): Date | undefined => (key === null ? undefined : calendarDateOfDateKey(key) ?? undefined);

/** ADR-915 Φ3β · §14 — οι αρχικές τιμές: ό,τι ξέρει ήδη το αρχείο (`undefined` = κενό πεδίο, όπως πριν). */
function prefilledDates(known: ReviewIssuedOn): DeclaredDates {
  return { issuedOn: dateOfKey(known.issuedOn), validUntil: dateOfKey(known.printedValidUntil) };
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
  const rowLabel = useChecklistRowLabel();
  const hintKey = MODE_HINT_KEY[mode];
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(TITLE_KEY[mode])}</DialogTitle>
        <DialogDescription>
          {rowLabel(row)}
          {mode === 'accept' && row.files[0] ? ` — ${row.files[0].displayName}` : ''}
        </DialogDescription>
      </DialogHeader>
      {hintKey && <p className={cn('text-xs', colors.text.muted)}>{t(hintKey)}</p>}
    </>
  );
}

interface AcceptDateFieldsProps {
  readonly caseId: string;
  readonly row: ChecklistRow;
  readonly known: ReviewIssuedOn;
  readonly dates: DeclaredDates;
  readonly onChange: (update: (current: DeclaredDates) => DeclaredDates) => void;
  readonly onRead: (facts: DocumentTextFacts) => void;
}

/** Οι ημερομηνίες της αποδοχής: έκδοση (κάθε κανόνας που λήγει) + τυπωμένη λήξη (μόνο `printed`, ADR-915 §14). */
function AcceptDateFields({ caseId, row, known, dates, onChange, onRead }: AcceptDateFieldsProps) {
  return (
    <>
      {hasValidity(row) && <ConveyanceDocumentTextAction key={row.files[0]?.fingerprint ?? row.itemId} caseId={caseId} row={row} known={known} onRead={onRead} />}
      {hasValidity(row) && (
        <ConveyanceIssuedOnField value={dates.issuedOn} onChange={(issuedOn) => onChange((d) => ({ ...d, issuedOn }))} known={known} />
      )}
      {hasPrintedValidity(row) && (
        <ConveyanceValidUntilField
          rule={row.item.validity}
          issuedOn={dates.issuedOn}
          value={dates.validUntil}
          onChange={(validUntil) => onChange((d) => ({ ...d, validUntil }))}
          locked={known.origin === 'document-text' && known.printedValidUntil !== null}
        />
      )}
    </>
  );
}

/**
 * ADR-915 §20 — ό,τι ξέρει ο διάλογος για το αρχείο: τα γεγονότα της όψης, ή — μόλις ο άνθρωπος ζητήσει «Ανάγνωση από
 * το έγγραφο» — ό,τι διαβάστηκε **τώρα** (η όψη θα το φέρει κι αυτή μέσω CDC, αλλά ο άνθρωπος δεν περιμένει).
 */
function useReviewDates(target: ConveyanceRowDialogProps['target']) {
  const [dates, setDates] = useState<DeclaredDates>(NO_DATES);
  const [readFacts, setReadFacts] = useState<DocumentTextFacts | null>(null);
  const file = target?.row.files[0];
  const reviewed = file && readFacts ? { ...file, documentFacts: readFacts } : file;
  const known = target ? reviewIssuedOnOf(target.row.item, reviewed) : NOTHING_KNOWN;

  useEffect(() => {
    setReadFacts(null);
    setDates(target ? prefilledDates(reviewIssuedOnOf(target.row.item, target.row.files[0])) : NO_DATES);
  }, [target]);

  const onRead = (facts: DocumentTextFacts) => {
    setReadFacts(facts);
    if (target && file) setDates(prefilledDates(reviewIssuedOnOf(target.row.item, { ...file, documentFacts: facts })));
  };
  return { known, dates, setDates, onRead };
}

export function ConveyanceRowDialog({ caseId, target, onClose, onSubmit }: ConveyanceRowDialogProps) {
  const { t } = useTranslation(['conveyance']);
  const [reason, setReason] = useState('');
  const { known, dates, setDates, onRead } = useReviewDates(target);

  useEffect(() => {
    setReason('');
  }, [target]);

  if (!target) return null;
  const { row, mode } = target;
  const needsReason = mode !== 'accept';
  const trimmed = reason.trim();
  const submit = () => {
    onSubmit(buildCommand(row, mode, trimmed, dates));
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <RowDialogHeader row={row} mode={mode} />
        {mode === 'accept' && <AcceptDateFields caseId={caseId} row={row} known={known} dates={dates} onChange={setDates} onRead={onRead} />}
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
