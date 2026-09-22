'use client';
/* eslint-disable design-system/enforce-semantic-colors */

/**
 * @module components/sales/payments/EditInstallmentFields
 * @enterprise ADR-234 (SPEC-234D) · ADR-598 «(θ)»
 *
 * Τα πεδία του διαλόγου δόσης. Κάθε ετικέτα ονομάζει το πεδίο της μέσω `FormField` (πριν:
 * δύο `Select` χωρίς όνομα, και το πεδίο «περιγραφή» είχε την ετικέτα «Ημ. Λήξης»).
 */

import React from 'react';
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
import { FormField } from '@/components/ui/form/FormComponents';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { InstallmentType } from '@/types/payment-plan';
import type { InstallmentFields } from './edit-installment-model';

const INSTALLMENT_TYPES: InstallmentType[] = [
  'reservation',
  'down_payment',
  'stage_payment',
  'final_payment',
  'custom',
];

export interface EditInstallmentFieldsProps {
  fields: InstallmentFields;
  update: (patch: Partial<InstallmentFields>) => void;
  t: Translate;
  notesOnly: boolean;
  /** Θέση εισαγωγής — μόνο σε προσθήκη, και μόνο όταν υπάρχουν ήδη δόσεις. */
  insertChoices: number;
  maxAmount?: number;
}

function DescriptionFields({ fields, update, t }: EditInstallmentFieldsProps) {
  return (
    <>
      <FormField label={t('installments.labelField')}>
        {(id) => (
          <Input id={id} value={fields.label} onChange={(e) => update({ label: e.target.value })} placeholder={t('installments.labelPlaceholder')} />
        )}
      </FormField>
      <FormField label={t('installments.typeLabel')}>
        {(id) => (
          <Select value={fields.type} onValueChange={(v) => update({ type: v as InstallmentType })}>
            <SelectTrigger id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTALLMENT_TYPES.map((iType) => (
                <SelectItem key={iType} value={iType}>{t(`installmentType.${iType}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
    </>
  );
}

function AmountFields({ fields, update, t, maxAmount }: EditInstallmentFieldsProps) {
  const colors = useSemanticColors();
  return (
    <section className="space-y-2">
      <fieldset className="grid grid-cols-2 gap-3">
        <FormField label={`${t('labels.amount')} (€)`}>
          {(id) => (
            <NumericField id={id} min={0.01} step={0.01} value={fields.amount} onValueChange={(amount) => update({ amount })} blankValue={0} />
          )}
        </FormField>
        <FormField label="%">
          {(id) => (
            <NumericField id={id} min={0} max={100} step={0.01} value={fields.percentage} onValueChange={(percentage) => update({ percentage })} blankValue={0} />
          )}
        </FormField>
      </fieldset>
      {maxAmount !== undefined && maxAmount > 0 && (
        <p className={cn('text-xs', colors.text.muted)}>
          {t('installments.maxAmountHint', { max: formatCurrencyWhole(maxAmount) })}
        </p>
      )}
      {maxAmount !== undefined && fields.amount > maxAmount && (
        <p className="text-xs text-destructive font-medium">{t('installments.amountExceedsMax')}</p>
      )}
    </section>
  );
}

function InsertPositionField({ fields, update, t, insertChoices }: EditInstallmentFieldsProps) {
  return (
    <FormField label={t('installments.insertPosition')}>
      {(id) => (
        <Select value={fields.insertAtIndex} onValueChange={(insertAtIndex) => update({ insertAtIndex })}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="end">{t('installments.atEnd')}</SelectItem>
            {Array.from({ length: insertChoices }, (_, i) => (
              <SelectItem key={i} value={i.toString()}>
                {t('installments.beforeInstallment', { index: (i + 1).toString() })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

export function EditInstallmentFields(props: EditInstallmentFieldsProps) {
  const { fields, update, t, notesOnly, insertChoices } = props;
  return (
    <>
      {!notesOnly && <DescriptionFields {...props} />}
      {!notesOnly && <AmountFields {...props} />}
      {!notesOnly && (
        <FormField label={t('labels.dueDate')}>
          {(id) => <Input id={id} type="date" value={fields.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />}
        </FormField>
      )}
      {insertChoices > 0 && <InsertPositionField {...props} />}
      <FormField label={t('labels.notes')}>
        {(id) => <Textarea id={id} value={fields.notes} onChange={(e) => update({ notes: e.target.value })} rows={2} />}
      </FormField>
    </>
  );
}
