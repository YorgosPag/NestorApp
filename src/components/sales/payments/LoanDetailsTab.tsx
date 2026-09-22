'use client';

/**
 * @module components/sales/payments/LoanDetailsTab
 * @enterprise ADR-234 Phase 2 (SPEC-234C) · ADR-706 · ADR-598 «(θ)»
 *
 * Καρτέλα «Στοιχεία» του δανείου: μεταβάσεις κατάστασης (ενέργειες χωρίς πεδία ⇒ SSoT
 * `useInFlightAction`) και επεξεργασία στοιχείων (φόρμα ⇒ SSoT `useFormSubmission`). Οι δύο
 * γράφουν στο ΙΔΙΟ έγγραφο, άρα όσο τρέχει η μία η άλλη είναι απενεργοποιημένη.
 */

import React, { useCallback, useId, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { Textarea } from '@/components/ui/textarea';
import { FormActions } from '@/components/ui/form/FormActions';
import { FormField } from '@/components/ui/form/FormComponents';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useInFlightAction } from '@/hooks/useInFlightAction';
import { getErrorMessage } from '@/lib/error-utils';
import { unwrapActionResult, type ActionResult } from '@/lib/mutations/gateway-action';
import { useNotifications } from '@/providers/NotificationProvider';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { getValidNextStatuses } from '@/types/loan-tracking';
import type { LoanTracking, LoanTransitionInput, UpdateLoanInput } from '@/types/loan-tracking';

/** The loan fields the details grid edits as numbers (ADR-706). */
type NumericLoanField =
  | 'requestedAmount'
  | 'approvedAmount'
  | 'interestRate'
  | 'termYears'
  | 'appraisalValue'
  | 'monthlyPayment';

export interface LoanDetailsTabProps {
  loan: LoanTracking;
  onUpdate: (input: UpdateLoanInput) => Promise<ActionResult>;
  onTransition: (input: LoanTransitionInput) => Promise<ActionResult>;
  /** Επιτυχία: μήνυμα + κλείσιμο του διαλόγου (ανήκει στον γονέα). */
  onDone: (message: string) => void;
  t: Translate;
}

// ============================================================================
// STATUS TRANSITIONS (ενέργειες χωρίς πεδία)
// ============================================================================

function useLoanTransition({ onTransition, onDone, t }: LoanDetailsTabProps) {
  const { error: notifyError } = useNotifications();
  const { isRunning, run } = useInFlightAction();

  const transition = useCallback(async (targetStatus: LoanTransitionInput['targetStatus']) => {
    try {
      await run(async () => unwrapActionResult(await onTransition({ targetStatus })));
      onDone(t('loanTracking.actions.updateStatus'));
    } catch (caught) {
      notifyError(getErrorMessage(caught, t('loanTracking.errors.transitionFailed')));
    }
  }, [run, onTransition, onDone, notifyError, t]);

  return { transitioning: isRunning, transition };
}

function StatusTransitions({ loan, t, disabled, onTransition }: {
  loan: LoanTracking; t: Translate; disabled: boolean; onTransition: (s: LoanTransitionInput['targetStatus']) => void;
}) {
  const colors = useSemanticColors();
  const nextStatuses = getValidNextStatuses(loan.status);
  if (nextStatuses.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className={cn('text-xs font-semibold', colors.text.muted)}>{t('loanTracking.actions.updateStatus')}</legend>
      <nav className="flex flex-wrap gap-1">
        {nextStatuses.map((ns) => (
          <Button key={ns} size="sm" variant="outline" className="text-[10px] h-6 gap-1" disabled={disabled} onClick={() => onTransition(ns)}>
            <ArrowRight className="h-2.5 w-2.5" aria-hidden />
            {t(`loanTracking.status.${ns}`)}
          </Button>
        ))}
      </nav>
    </fieldset>
  );
}

// ============================================================================
// DETAILS FORM
// ============================================================================

function useLoanDetailsForm({ onUpdate, onDone, t }: LoanDetailsTabProps) {
  const [edits, setEdits] = useState<UpdateLoanInput>({});
  const updateField = useCallback((field: keyof UpdateLoanInput, value: string | number | null) => {
    setEdits((prev) => ({ ...prev, [field]: value }));
  }, []);
  const hasEdits = Object.keys(edits).length > 0;

  const submission = useFormSubmission({
    canSubmit: hasEdits,
    submit: async () => unwrapActionResult(await onUpdate(edits)),
    onSuccess: () => onDone(t('loanTracking.actions.updateStatus')),
    errorFallback: t('loanTracking.errors.saveFailed'),
  });

  return { edits, updateField, hasEdits, submission };
}

function numericRows(t: Translate): readonly { field: NumericLoanField; label: string; step: number }[] {
  // Every `t()` key spelled out literally so the i18n gates can still see them (N.18: one call site).
  return [
    { field: 'requestedAmount', label: t('loanTracking.fields.requestedAmount'), step: 0.01 },
    { field: 'approvedAmount', label: t('loanTracking.fields.approvedAmount'), step: 0.01 },
    { field: 'interestRate', label: t('loanTracking.fields.interestRate'), step: 0.01 },
    // Whole years in practice; a step of 1 keeps the nudge sane while the field behaves like its siblings.
    { field: 'termYears', label: t('loanTracking.fields.termYears'), step: 1 },
    { field: 'appraisalValue', label: t('loanTracking.fields.appraisalValue'), step: 0.01 },
    { field: 'monthlyPayment', label: t('loanTracking.fields.monthlyPayment'), step: 0.01 },
  ];
}

function LoanDetailsFields({ loan, t, edits, updateField }: {
  loan: LoanTracking; t: Translate; edits: UpdateLoanInput; updateField: (f: keyof UpdateLoanInput, v: string | number | null) => void;
}) {
  /**
   * ADR-706 — `field in edits` (not `??`) distinguishes "no pending edit" from "the user deliberately
   * cleared it": with `??` a cleared field would snap back to the stored loan value on the next render.
   */
  const numericValue = (field: NumericLoanField): number => (field in edits ? edits[field] : loan[field]) ?? 0;
  return (
    <>
      <fieldset className="grid grid-cols-2 gap-3">
        <FormField label={t('loanTracking.fields.bankName')}>
          {(id) => <Input id={id} defaultValue={loan.bankName} className="h-8 text-xs" onChange={(e) => updateField('bankName', e.target.value)} />}
        </FormField>
        <FormField label={t('loanTracking.fields.bankBranch')}>
          {(id) => <Input id={id} defaultValue={loan.bankBranch ?? ''} className="h-8 text-xs" onChange={(e) => updateField('bankBranch', e.target.value || null)} />}
        </FormField>
        {numericRows(t).map(({ field, label, step }) => (
          <NumericField
            key={field}
            label={label}
            labelClassName="text-xs"
            className="h-8 text-xs"
            min={0}
            step={step}
            value={numericValue(field)}
            blankValue={0}
            onValueChange={(next) => updateField(field, next || null)}
          />
        ))}
      </fieldset>
      <FormField label={t('labels.notes')}>
        {(id) => <Textarea id={id} defaultValue={loan.notes ?? ''} className="text-xs min-h-[60px]" onChange={(e) => updateField('notes', e.target.value || null)} />}
      </FormField>
    </>
  );
}

export function LoanDetailsTab(props: LoanDetailsTabProps) {
  const { loan, t } = props;
  const { transitioning, transition } = useLoanTransition(props);
  const form = useLoanDetailsForm(props);
  const formId = `${useId()}-form`;

  return (
    <section className="space-y-3">
      <StatusTransitions loan={loan} t={t} disabled={transitioning || form.submission.submitting} onTransition={transition} />
      <form id={formId} onSubmit={form.submission.handleSubmit} className="space-y-3">
        <LoanDetailsFields loan={loan} t={t} edits={form.edits} updateField={form.updateField} />
      </form>
      <FormActions
        formId={formId}
        submitLabel={t('dialog.confirm')}
        pendingLabel={t('dialog.saving')}
        cancelLabel={t('dialog.cancel')}
        submitting={form.submission.submitting}
        submitDisabled={!form.hasEdits || transitioning}
        error={form.submission.error}
      />
    </section>
  );
}
