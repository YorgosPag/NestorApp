'use client';

/**
 * AddLoanDialog — Create a new loan tracking entry
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 * @enterprise ADR-598 «(θ)» — `<form>` + SSoT `useFormSubmission`/`FormActions`: το Enter
 *   υποβάλλει, ο φραγμός κρατά ΜΙΑ εγγραφή, το σφάλμα μένει στον διάλογο (πριν: ωμά
 *   `'Error'`/`'Unexpected error'` σε toast).
 */

import React, { useCallback, useId, useState } from 'react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { NumericField } from '@/components/ui/numeric-field';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormDialog } from '@/components/ui/form/FormDialog';
import { FormField } from '@/components/ui/form/FormComponents';
import { useNotifications } from '@/providers/NotificationProvider';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { unwrapActionResult, type ActionResult } from '@/lib/mutations/gateway-action';
import { BankSelector, bankSelection } from '@/components/banking/BankSelector';
import type { CreateLoanInput, DisbursementType } from '@/types/loan-tracking';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface AddLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: CreateLoanInput) => Promise<ActionResult>;
  existingCount: number;
}

interface LoanFields {
  bankCode: string;
  bankName: string;
  isPrimary: boolean;
  /** ADR-706: number model, 0 = "not entered" (rendered blank). */
  requestedAmount: number;
  disbursementType: DisbursementType;
}

function initialFields(existingCount: number): LoanFields {
  return { bankCode: '', bankName: '', isPrimary: existingCount === 0, requestedAmount: 0, disbursementType: 'lump_sum' };
}

// ============================================================================
// FORM STATE + SUBMISSION
// ============================================================================

function useAddLoanForm({ onOpenChange, onAdd, existingCount }: AddLoanDialogProps, t: Translate) {
  const { success } = useNotifications();
  const [fields, setFields] = useState<LoanFields>(() => initialFields(existingCount));
  const update = useCallback((patch: Partial<LoanFields>) => setFields((prev) => ({ ...prev, ...patch })), []);
  const bankName = fields.bankName.trim();

  const submission = useFormSubmission({
    canSubmit: bankName !== '',
    submit: async () => {
      unwrapActionResult(await onAdd({
        bankName,
        isPrimary: fields.isPrimary,
        disbursementType: fields.disbursementType,
        ...(fields.requestedAmount > 0 ? { requestedAmount: fields.requestedAmount } : {}),
      }));
    },
    onSuccess: () => {
      success(t('loanTracking.addLoan'));
      setFields(initialFields(existingCount + 1));
      onOpenChange(false);
    },
    errorFallback: t('loanTracking.errors.addFailed'),
  });

  return { fields, update, canSubmit: bankName !== '', submission };
}

// ============================================================================
// FIELDS
// ============================================================================

interface LoanFieldsProps {
  fields: LoanFields;
  update: (patch: Partial<LoanFields>) => void;
  t: Translate;
}

function LoanFormFields({ fields, update, t }: LoanFieldsProps) {
  return (
    <>
      <BankSelector
        value={fields.bankCode}
        onChange={(code, bank) => update(bankSelection(code, bank))}
        label={`${t('loanTracking.fields.bankName')} *`}
        required
        allowOther
      />
      <NumericField
        label={t('loanTracking.fields.requestedAmount')}
        labelClassName="text-xs"
        min={0}
        step={0.01}
        value={fields.requestedAmount}
        onValueChange={(requestedAmount) => update({ requestedAmount })}
        blankValue={0}
        className="h-8 text-xs"
        placeholder="€"
      />
      <FormField label={t('loanTracking.disbursementType.title')}>
        {(id) => (
          <Select value={fields.disbursementType} onValueChange={(v) => update({ disbursementType: v as DisbursementType })}>
            <SelectTrigger id={id} className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lump_sum" className="text-xs">{t('loanTracking.disbursementType.lump_sum')}</SelectItem>
              <SelectItem value="phased" className="text-xs">{t('loanTracking.disbursementType.phased')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </FormField>
      <PrimaryLoanCheckbox fields={fields} update={update} t={t} />
    </>
  );
}

function PrimaryLoanCheckbox({ fields, update, t }: LoanFieldsProps) {
  const id = useId();
  return (
    <p className="flex items-center gap-2">
      <Checkbox id={id} checked={fields.isPrimary} onCheckedChange={(checked) => update({ isPrimary: checked === true })} />
      <Label htmlFor={id} className="text-xs cursor-pointer">{t('loanTracking.primaryLoan')}</Label>
    </p>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddLoanDialog(props: AddLoanDialogProps) {
  const { open, onOpenChange } = props;
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);
  const { fields, update, canSubmit, submission } = useAddLoanForm(props, t);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('loanTracking.addLoan')}
      description={t('loanTracking.addLoanDesc')}
      contentClassName="max-w-sm"
      titleClassName="text-sm"
      descriptionClassName="text-xs"
      formClassName="space-y-3"
      submission={submission}
      submitLabel={t('loanTracking.addLoan')}
      pendingLabel={t('dialog.saving')}
      cancelLabel={t('dialog.cancel')}
      submitDisabled={!canSubmit}
    >
      <LoanFormFields fields={fields} update={update} t={t} />
    </FormDialog>
  );
}
