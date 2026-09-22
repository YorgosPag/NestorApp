'use client';

/**
 * AddChequeDialog — Form to register a new cheque
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 * @enterprise ADR-598 «(θ)» — το `<form>` υπήρχε, αλλά το κουμπί ζούσε ΕΞΩ του με `onClick` ⇒ η
 *   φόρμα δεν είχε κουμπί υποβολής και το Enter δεν έκανε τίποτα· ένα `onAdd` που πετούσε έμενε
 *   χωρίς χειρισμό. Τώρα: SSoT `useFormSubmission` + `FormActions` (`form=`), και κάθε ετικέτα
 *   ονομάζει το πεδίο της (`FormField`) — πριν, 8 πεδία ήταν χωρίς όνομα.
 */

import React, { useCallback, useId, useState } from 'react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { unwrapActionResult, type ActionResult } from '@/lib/mutations/gateway-action';
import { BankSelector, bankSelection } from '@/components/banking/BankSelector';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import type { CreateChequeInput, ChequeType } from '@/types/cheque-registry';
import '@/lib/design-system';

interface AddChequeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: CreateChequeInput) => Promise<ActionResult>;
  projectId: string;
  paymentPlanId?: string;
  contactId?: string;
}

interface ChequeFields {
  chequeType: ChequeType;
  chequeNumber: string;
  /** ADR-706: number model, 0 = "not entered" (rendered blank). */
  amount: number;
  bankCode: string;
  bankName: string;
  bankBranch: string;
  drawerName: string;
  issueDate: string;
  maturityDate: string;
  crossedCheque: boolean;
  notes: string;
}

const EMPTY_CHEQUE: ChequeFields = {
  chequeType: 'bank_cheque',
  chequeNumber: '',
  amount: 0,
  bankCode: '',
  bankName: '',
  bankBranch: '',
  drawerName: '',
  issueDate: '',
  maturityDate: '',
  crossedCheque: false,
  notes: '',
};

// ============================================================================
// PURE HELPERS
// ============================================================================

function isChequeComplete(f: ChequeFields): boolean {
  return Boolean(
    f.chequeNumber.trim() && f.amount > 0 && f.bankName.trim() && f.drawerName.trim() && f.issueDate && f.maturityDate,
  );
}

function toChequeInput(f: ChequeFields, scope: Pick<AddChequeDialogProps, 'projectId' | 'paymentPlanId' | 'contactId'>): CreateChequeInput {
  return {
    chequeType: f.chequeType,
    chequeNumber: f.chequeNumber.trim(),
    amount: f.amount,
    bankName: f.bankName.trim(),
    ...(f.bankBranch.trim() ? { bankBranch: f.bankBranch.trim() } : {}),
    drawerName: f.drawerName.trim(),
    issueDate: f.issueDate,
    maturityDate: f.maturityDate,
    crossedCheque: f.crossedCheque,
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
    projectId: scope.projectId,
    ...(scope.paymentPlanId ? { paymentPlanId: scope.paymentPlanId } : {}),
    ...(scope.contactId ? { contactId: scope.contactId } : {}),
  };
}

// ============================================================================
// FORM STATE + SUBMISSION
// ============================================================================

function useAddChequeForm(props: AddChequeDialogProps, t: Translate) {
  const { onAdd, onOpenChange } = props;
  const { success } = useNotifications();
  const [fields, setFields] = useState<ChequeFields>(EMPTY_CHEQUE);
  const update = useCallback((patch: Partial<ChequeFields>) => setFields((prev) => ({ ...prev, ...patch })), []);
  const canSubmit = isChequeComplete(fields);

  const submission = useFormSubmission({
    canSubmit,
    submit: async () => unwrapActionResult(await onAdd(toChequeInput(fields, props))),
    onSuccess: () => {
      success(t('chequeRegistry.actions.chequeCreated'));
      setFields(EMPTY_CHEQUE);
      onOpenChange(false);
    },
    errorFallback: t('errors.createFailed'),
  });

  return { fields, update, canSubmit, submission };
}

// ============================================================================
// FIELDS
// ============================================================================

interface ChequeFieldsProps {
  fields: ChequeFields;
  update: (patch: Partial<ChequeFields>) => void;
  t: Translate;
}

const INPUT_CLASS = 'h-8 text-xs';

function TextField({ label, value, onChange, type, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: 'date'; placeholder?: string;
}) {
  return (
    <FormField label={label}>
      {(id) => (
        <Input id={id} className={INPUT_CLASS} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </FormField>
  );
}

function ChequeIdentityFields({ fields, update, t }: ChequeFieldsProps) {
  return (
    <>
      <FormField label={t('chequeRegistry.fields.chequeType')}>
        {(id) => (
          <Select value={fields.chequeType} onValueChange={(v) => update({ chequeType: v as ChequeType })}>
            <SelectTrigger id={id} className={INPUT_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_cheque">{t('paymentMethod.bank_cheque')}</SelectItem>
              <SelectItem value="personal_cheque">{t('paymentMethod.personal_cheque')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </FormField>
      <fieldset className="grid grid-cols-2 gap-2">
        <TextField label={t('chequeRegistry.fields.chequeNumber')} value={fields.chequeNumber} onChange={(chequeNumber) => update({ chequeNumber })} placeholder="123456789" />
        <NumericField
          label={t('chequeRegistry.fields.amount')}
          labelClassName="text-xs"
          className={INPUT_CLASS}
          min={0.01}
          step={0.01}
          value={fields.amount}
          onValueChange={(amount) => update({ amount })}
          blankValue={0}
          placeholder="10000.00"
        />
      </fieldset>
    </>
  );
}

function ChequeIssuerFields({ fields, update, t }: ChequeFieldsProps) {
  return (
    <>
      <fieldset className="grid grid-cols-2 gap-2">
        <BankSelector
          value={fields.bankCode}
          onChange={(code, bank) => update(bankSelection(code, bank))}
          label={t('chequeRegistry.fields.bankName')}
          allowOther
        />
        <TextField label={t('chequeRegistry.fields.bankBranch')} value={fields.bankBranch} onChange={(bankBranch) => update({ bankBranch })} />
      </fieldset>
      <TextField label={t('chequeRegistry.fields.drawerName')} value={fields.drawerName} onChange={(drawerName) => update({ drawerName })} />
      <fieldset className="grid grid-cols-2 gap-2">
        <TextField label={t('chequeRegistry.fields.issueDate')} type="date" value={fields.issueDate} onChange={(issueDate) => update({ issueDate })} />
        <TextField label={t('chequeRegistry.fields.maturityDate')} type="date" value={fields.maturityDate} onChange={(maturityDate) => update({ maturityDate })} />
      </fieldset>
    </>
  );
}

function ChequeExtraFields({ fields, update, t }: ChequeFieldsProps) {
  const crossedId = useId();
  return (
    <>
      <p className="flex items-center gap-2">
        <Checkbox id={crossedId} checked={fields.crossedCheque} onCheckedChange={(v) => update({ crossedCheque: v === true })} />
        <Label htmlFor={crossedId} className="text-xs cursor-pointer">{t('chequeRegistry.fields.crossedCheque')}</Label>
      </p>
      <FormField label={t('labels.notes')}>
        {(id) => (
          <Textarea id={id} className="text-xs min-h-[60px]" value={fields.notes} onChange={(e) => update({ notes: e.target.value })} />
        )}
      </FormField>
    </>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddChequeDialog(props: AddChequeDialogProps) {
  const { open, onOpenChange } = props;
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);
  const { fields, update, canSubmit, submission } = useAddChequeForm(props, t);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('chequeRegistry.actions.addCheque')}
      contentClassName="max-w-md"
      titleClassName="text-sm"
      formClassName="space-y-3"
      submission={submission}
      submitLabel={t('chequeRegistry.actions.addCheque')}
      pendingLabel={t('dialog.saving')}
      cancelLabel={t('dialog.cancel')}
      submitDisabled={!canSubmit}
    >
      <ChequeIdentityFields fields={fields} update={update} t={t} />
      <ChequeIssuerFields fields={fields} update={update} t={t} />
      <ChequeExtraFields fields={fields} update={update} t={t} />
    </FormDialog>
  );
}
