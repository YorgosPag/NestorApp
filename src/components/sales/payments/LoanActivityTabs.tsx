'use client';

/**
 * @module components/sales/payments/LoanActivityTabs
 * @enterprise ADR-234 Phase 2 (SPEC-234C) · ADR-598 «(θ)»
 *
 * Καρτέλες «Εκταμιεύσεις» και «Επικοινωνία» του δανείου: ιστορικό + φόρμα νέας εγγραφής, η
 * καθεμία δικό της `<form>` πάνω στο SSoT `useFormSubmission` (πριν: κοινό χειρόγραφο
 * `handleAction` με ωμά `'Error'`/`'Unexpected error'`, και το Enter δεν υπέβαλλε τίποτα).
 */

import React, { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormActions } from '@/components/ui/form/FormActions';
import { FormField } from '@/components/ui/form/FormComponents';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { unwrapActionResult, type ActionResult } from '@/lib/mutations/gateway-action';
import { formatCurrency, formatDate } from '@/lib/intl-utils';
import { nowISO } from '@/lib/date-local';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type {
  AddCommunicationLogInput,
  CommunicationEntryType,
  LoanTracking,
  RecordDisbursementInput,
} from '@/types/loan-tracking';

interface ActivityTabProps {
  loan: LoanTracking;
  /** Επιτυχία: μήνυμα + κλείσιμο του διαλόγου (ανήκει στον γονέα). */
  onDone: (message: string) => void;
  t: Translate;
}

const COMM_TYPES: readonly CommunicationEntryType[] = ['phone', 'email', 'meeting', 'document', 'note'];

function NewEntryActions({ formId, label, submitting, disabled, error, t }: {
  formId: string; label: string; submitting: boolean; disabled: boolean; error: string | null; t: Translate;
}) {
  return (
    <FormActions
      formId={formId}
      submitLabel={label}
      pendingLabel={t('dialog.saving')}
      cancelLabel={t('dialog.cancel')}
      submitIcon={Plus}
      submitVariant="outline"
      submitting={submitting}
      submitDisabled={disabled}
      error={error}
    />
  );
}

// ============================================================================
// DISBURSEMENTS
// ============================================================================

function DisbursementList({ loan, t }: Omit<ActivityTabProps, 'onDone'>) {
  const colors = useSemanticColors();
  if (loan.disbursements.length === 0) {
    return <p className={cn('text-xs text-center py-2', colors.text.muted)}>{t('loanTracking.noDisbursements')}</p>;
  }
  return (
    <ul className="space-y-1">
      {loan.disbursements.map((d, i) => (
        <li key={i} className="flex items-center justify-between text-xs border-b pb-1">
          <span><span className="font-medium">#{d.order}</span> {d.milestone}</span>
          <span className="flex items-center gap-2">
            <span className="font-medium">{formatCurrency(d.amount)}</span>
            <Badge variant={d.status === 'disbursed' ? 'default' : 'secondary'} className="text-[10px]">{d.status}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}

function useDisbursementForm(onDisburse: (input: RecordDisbursementInput) => Promise<ActionResult>, { onDone, t }: ActivityTabProps) {
  // ADR-706: number model, 0 = "not entered" (rendered blank).
  const [amount, setAmount] = useState(0);
  const [milestone, setMilestone] = useState('');
  const [date, setDate] = useState(() => nowISO().split('T')[0]);
  const canSubmit = amount > 0 && milestone.trim() !== '';

  const submission = useFormSubmission({
    canSubmit,
    submit: async () => unwrapActionResult(await onDisburse({
      amount,
      milestone: milestone.trim(),
      disbursementDate: new Date(date).toISOString(),
    })),
    onSuccess: () => onDone(t('loanTracking.actions.recordDisbursement')),
    errorFallback: t('loanTracking.errors.saveFailed'),
  });

  return { amount, setAmount, milestone, setMilestone, date, setDate, canSubmit, submission };
}

export function LoanDisbursementsTab(props: ActivityTabProps & { onDisburse: (input: RecordDisbursementInput) => Promise<ActionResult> }) {
  const { loan, t } = props;
  const f = useDisbursementForm(props.onDisburse, props);
  const formId = `${useId()}-form`;
  return (
    <section className="space-y-3">
      <DisbursementList loan={loan} t={t} />
      <form id={formId} onSubmit={f.submission.handleSubmit}>
        <fieldset className="space-y-2 border-t pt-2">
          <legend className="text-xs font-semibold">{t('loanTracking.actions.recordDisbursement')}</legend>
          <section className="grid grid-cols-2 gap-2">
            <NumericField label={t('labels.amount')} labelClassName="text-xs" min={0} step={0.01} value={f.amount} onValueChange={f.setAmount} blankValue={0} className="h-8 text-xs" placeholder="€" />
            <FormField label={t('loanTracking.milestone')}>
              {(id) => <Input id={id} value={f.milestone} onChange={(e) => f.setMilestone(e.target.value)} className="h-8 text-xs" placeholder={t('loanTracking.milestonePlaceholder')} />}
            </FormField>
          </section>
          <FormField label={t('labels.paymentDate')}>
            {(id) => <Input id={id} type="date" value={f.date} onChange={(e) => f.setDate(e.target.value)} className="h-8 text-xs" />}
          </FormField>
        </fieldset>
      </form>
      <NewEntryActions formId={formId} label={t('loanTracking.actions.recordDisbursement')} submitting={f.submission.submitting} disabled={!f.canSubmit} error={f.submission.error} t={t} />
    </section>
  );
}

// ============================================================================
// COMMUNICATION LOG
// ============================================================================

function CommLogList({ loan, t }: Omit<ActivityTabProps, 'onDone'>) {
  const colors = useSemanticColors();
  if (loan.communicationLog.length === 0) {
    return <p className={cn('text-xs text-center py-2', colors.text.muted)}>{t('loanTracking.noCommLog')}</p>;
  }
  return (
    <ul className="space-y-2 max-h-48 overflow-y-auto">
      {[...loan.communicationLog].reverse().map((entry, i) => (
        <li key={i} className="text-xs border-b pb-1.5 space-y-0.5">
          <span className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">{t(`loanTracking.commLog.type.${entry.type}`)}</Badge>
            <time dateTime={entry.date} className={colors.text.muted}>{formatDate(entry.date)}</time>
          </span>
          <p>{entry.summary}</p>
          {entry.nextAction && <p className={colors.text.muted}>→ {entry.nextAction}</p>}
        </li>
      ))}
    </ul>
  );
}

function useCommLogForm(onAddCommLog: (input: AddCommunicationLogInput) => Promise<ActionResult>, { onDone, t }: ActivityTabProps) {
  const [type, setType] = useState<CommunicationEntryType>('phone');
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState('');

  const submission = useFormSubmission({
    canSubmit: summary.trim() !== '',
    submit: async () => unwrapActionResult(await onAddCommLog({
      type,
      summary: summary.trim(),
      nextAction: nextAction.trim() || undefined,
    })),
    onSuccess: () => onDone(t('loanTracking.commLog.title')),
    errorFallback: t('loanTracking.errors.saveFailed'),
  });

  return { type, setType, summary, setSummary, nextAction, setNextAction, submission };
}

function CommLogFields({ f, t }: { f: ReturnType<typeof useCommLogForm>; t: Translate }) {
  return (
    <>
      <FormField label={t('loanTracking.commLog.typeLabel')}>
        {(id) => (
          <Select value={f.type} onValueChange={(v) => f.setType(v as CommunicationEntryType)}>
            <SelectTrigger id={id} className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMM_TYPES.map((ct) => (
                <SelectItem key={ct} value={ct} className="text-xs">{t(`loanTracking.commLog.type.${ct}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label={t('loanTracking.commLog.description')}>
        {(id) => <Textarea id={id} value={f.summary} onChange={(e) => f.setSummary(e.target.value)} className="text-xs min-h-[50px]" placeholder={t('loanTracking.commLog.descriptionPlaceholder')} />}
      </FormField>
      <FormField label={t('loanTracking.commLog.nextAction')}>
        {(id) => <Input id={id} value={f.nextAction} onChange={(e) => f.setNextAction(e.target.value)} className="h-8 text-xs" placeholder={t('loanTracking.commLog.nextActionPlaceholder')} />}
      </FormField>
    </>
  );
}

export function LoanCommLogTab(props: ActivityTabProps & { onAddCommLog: (input: AddCommunicationLogInput) => Promise<ActionResult> }) {
  const { loan, t } = props;
  const f = useCommLogForm(props.onAddCommLog, props);
  const formId = `${useId()}-form`;
  return (
    <section className="space-y-3">
      <CommLogList loan={loan} t={t} />
      <form id={formId} onSubmit={f.submission.handleSubmit}>
        <fieldset className="space-y-2 border-t pt-2">
          <legend className="text-xs font-semibold">{t('loanTracking.actions.addCommLog')}</legend>
          <CommLogFields f={f} t={t} />
        </fieldset>
      </form>
      <NewEntryActions formId={formId} label={t('loanTracking.actions.addCommLog')} submitting={f.submission.submitting} disabled={f.summary.trim() === ''} error={f.submission.error} t={t} />
    </section>
  );
}
