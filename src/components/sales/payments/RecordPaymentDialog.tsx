'use client';

/**
 * RecordPaymentDialog — Dialog for recording a payment against an installment
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 * @enterprise ADR-598 «(θ)» — υποβολή μέσω SSoT `useFormSubmission` + `FormActions`: ένας δρόμος
 *   (κλικ + Enter), φραγμός διπλής καταχώρισης, και το κουμπί ΔΕΝ κολλά πια σε «υποβάλλεται»
 *   όταν το `onRecord` πετάξει (πριν: σημαία υποβολής γύρω από `await` χωρίς `try`).
 */

import React, { useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormDialog } from '@/components/ui/form/FormDialog';
import { FormField } from '@/components/ui/form/FormComponents';
import { formatCurrency } from '@/lib/intl-utils';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { unwrapActionResult, type ActionResult } from '@/lib/mutations/gateway-action';
import { BankSelector, bankSelection } from '@/components/banking/BankSelector';
import type {
  Installment,
  PaymentMethod,
  CreatePaymentInput,
  PaymentMethodDetails,
} from '@/types/payment-plan';
import '@/lib/design-system';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// TYPES
// ============================================================================

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Installment;
  paymentPlanId: string;
  onRecord: (input: CreatePaymentInput) => Promise<ActionResult>;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'bank_cheque',
  'personal_cheque',
  'bank_loan',
  'cash',
  'offset',
];

const BANK_METHODS: ReadonlySet<PaymentMethod> = new Set(['bank_transfer', 'bank_cheque', 'personal_cheque', 'bank_loan']);

interface PaymentFields {
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  bankCode: string;
  bankName: string;
  referenceNumber: string;
  notes: string;
}

// ============================================================================
// PURE HELPERS
// ============================================================================

function buildMethodDetails(f: PaymentFields): PaymentMethodDetails {
  const ref = f.referenceNumber || null;
  switch (f.method) {
    case 'bank_transfer':
      return { method: 'bank_transfer', bankName: f.bankName, iban: null, referenceNumber: ref };
    case 'bank_cheque':
    case 'personal_cheque':
      return {
        method: f.method,
        chequeNumber: f.referenceNumber || '',
        bankName: f.bankName,
        issueDate: f.paymentDate,
        maturityDate: null,
        drawerName: null,
      };
    case 'bank_loan':
      return { method: 'bank_loan', bankName: f.bankName, loanReferenceNumber: ref, disbursementDate: f.paymentDate };
    case 'cash':
      return { method: 'cash', receiptNumber: ref };
    case 'offset':
      return { method: 'offset', offsetReason: f.notes || '', relatedDocumentId: null };
    case 'promissory_note':
      return {
        method: 'promissory_note',
        noteNumber: f.referenceNumber || '',
        issueDate: f.paymentDate,
        maturityDate: f.paymentDate,
        drawerName: '',
      };
    default:
      return { method: 'bank_transfer', bankName: '', iban: null, referenceNumber: null };
  }
}

function toPaymentInput(f: PaymentFields, installment: Installment, paymentPlanId: string): CreatePaymentInput {
  return {
    paymentPlanId,
    installmentIndex: installment.index,
    amount: f.amount,
    method: f.method,
    paymentDate: new Date(f.paymentDate).toISOString(),
    methodDetails: buildMethodDetails(f),
    notes: f.notes || undefined,
  };
}

// ============================================================================
// FORM STATE + SUBMISSION
// ============================================================================

function useRecordPaymentForm(
  { installment, paymentPlanId, onRecord, onOpenChange }: RecordPaymentDialogProps,
  t: Translate,
) {
  const { success } = useNotifications();
  // ADR-706: number model — the field opens on the remaining balance.
  const [fields, setFields] = useState<PaymentFields>(() => ({
    amount: installment.amount - installment.paidAmount,
    method: 'bank_transfer',
    paymentDate: nowISO().split('T')[0],
    bankCode: '',
    bankName: '',
    referenceNumber: '',
    notes: '',
  }));
  const update = useCallback(
    (patch: Partial<PaymentFields>) => setFields((prev) => ({ ...prev, ...patch })),
    [],
  );

  const submission = useFormSubmission({
    canSubmit: true,
    validate: () => (fields.amount > 0 ? null : t('errors.invalidAmount')),
    submit: async () => unwrapActionResult(await onRecord(toPaymentInput(fields, installment, paymentPlanId))),
    onSuccess: () => {
      // ADR-314: currency rendering belongs to the Intl SSoT, not a hardcoded el-GR literal.
      success(`${t('dialog.paymentRecorded')} ${formatCurrency(fields.amount)}`);
      onOpenChange(false);
    },
    errorFallback: t('errors.paymentFailed'),
  });

  return { fields, update, submission };
}

// ============================================================================
// FIELDS
// ============================================================================

interface PaymentFieldsProps {
  fields: PaymentFields;
  update: (patch: Partial<PaymentFields>) => void;
  t: Translate;
}

function PaymentMethodField({ fields, update, t }: PaymentFieldsProps) {
  return (
    <FormField label={t('labels.method')}>
      {(id) => (
        <Select value={fields.method} onValueChange={(v) => update({ method: v as PaymentMethod })}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {t(`paymentMethod.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

function BankFields({ fields, update, t }: PaymentFieldsProps) {
  return (
    <>
      <BankSelector
        value={fields.bankCode}
        onChange={(code, bank) => update(bankSelection(code, bank))}
        label={t('dialog.bankName')}
        allowOther
      />
      <FormField label={t('dialog.referenceNumber')}>
        {(id) => (
          <Input id={id} value={fields.referenceNumber} onChange={(e) => update({ referenceNumber: e.target.value })} />
        )}
      </FormField>
    </>
  );
}

function PaymentFormFields(props: PaymentFieldsProps) {
  const { fields, update, t } = props;
  return (
    <>
      <FormField label={`${t('labels.amount')} (€)`}>
        {(id) => (
          <NumericField id={id} min={0.01} step={0.01} value={fields.amount} onValueChange={(amount) => update({ amount })} blankValue={0} />
        )}
      </FormField>
      <PaymentMethodField {...props} />
      <FormField label={t('labels.paymentDate')}>
        {(id) => (
          <Input id={id} type="date" value={fields.paymentDate} onChange={(e) => update({ paymentDate: e.target.value })} />
        )}
      </FormField>
      {BANK_METHODS.has(fields.method) && <BankFields {...props} />}
      <FormField label={t('labels.notes')}>
        {(id) => (
          <Textarea id={id} value={fields.notes} onChange={(e) => update({ notes: e.target.value })} rows={2} />
        )}
      </FormField>
    </>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RecordPaymentDialog(props: RecordPaymentDialogProps) {
  const { open, onOpenChange, installment } = props;
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);
  const { fields, update, submission } = useRecordPaymentForm(props, t);
  const remaining = installment.amount - installment.paidAmount;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('dialog.title')}
      description={`${installment.label} — ${t('labels.remainingAmount')}: ${formatCurrency(remaining)}`}
      contentClassName="sm:max-w-md"
      formClassName="space-y-4"
      submission={submission}
      submitLabel={t('dialog.confirm')}
      pendingLabel={t('dialog.recording')}
      cancelLabel={t('dialog.cancel')}
    >
      <PaymentFormFields fields={fields} update={update} t={t} />
    </FormDialog>
  );
}
