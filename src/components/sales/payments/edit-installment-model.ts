/**
 * @module components/sales/payments/edit-installment-model
 * @enterprise ADR-234 (SPEC-234D) · ADR-598 «(θ)»
 *
 * Καθαρό μοντέλο του διαλόγου δόσης: **τι** στέλνεται και **πότε** είναι έγκυρο. Πριν ζούσε μέσα
 * σε ένα `handleSubmit` 82 γραμμών με τρεις αντιγραμμένους κλάδους «σημαία υποβολής → await →
 * σημαία κάτω» χωρίς `try` — ένα `onUpdate` που πετούσε άφηνε το κουμπί μόνιμα νεκρό.
 * Εδώ οι τρεις κλάδοι γίνονται ΕΝΑ union (`InstallmentChange`) και η υποβολή ανήκει στο SSoT.
 */

import type { Translate } from '@/i18n/hooks/useTranslation';
import type { ActionResult } from '@/lib/mutations/gateway-action';
import type {
  CreateInstallmentInput,
  Installment,
  InstallmentType,
  UpdateInstallmentInput,
} from '@/types/payment-plan';

export type InstallmentDialogMode = 'add' | 'edit';

export interface InstallmentFields {
  label: string;
  type: InstallmentType;
  /** ADR-706: number models, 0 = "not entered" (rendered blank). */
  amount: number;
  percentage: number;
  dueDate: string;
  notes: string;
  /** `'end'` ή ο δείκτης (ως κείμενο — τιμή του Radix Select) της δόσης πριν την οποία μπαίνει. */
  insertAtIndex: string;
}

export type InstallmentChange =
  | { readonly kind: 'notes'; readonly index: number; readonly updates: UpdateInstallmentInput }
  | { readonly kind: 'update'; readonly index: number; readonly updates: UpdateInstallmentInput }
  | { readonly kind: 'add'; readonly input: CreateInstallmentInput; readonly insertAt?: number };

export interface InstallmentWriters {
  onAdd: (input: CreateInstallmentInput, insertAtIndex?: number) => Promise<ActionResult>;
  onUpdate: (index: number, updates: UpdateInstallmentInput) => Promise<ActionResult>;
}

export function initialInstallmentFields(mode: InstallmentDialogMode, installment?: Installment): InstallmentFields {
  if (mode === 'edit' && installment) {
    return {
      label: installment.label,
      type: installment.type,
      amount: installment.amount,
      percentage: installment.percentage,
      dueDate: installment.dueDate.split('T')[0],
      notes: installment.notes ?? '',
      insertAtIndex: 'end',
    };
  }
  return { label: '', type: 'custom', amount: 0, percentage: 0, dueDate: '', notes: '', insertAtIndex: 'end' };
}

/** Μήνυμα για τον άνθρωπο, ή `null` όταν η φόρμα είναι έγκυρη. Ίδιοι κανόνες με πριν, ανά κλάδο. */
export function validateInstallment(
  fields: InstallmentFields,
  editing: boolean,
  notesOnly: boolean,
  t: Translate,
): string | null {
  if (editing && notesOnly) return null;
  if (!editing && !fields.label.trim()) return t('errors.invalidLabel');
  if (fields.amount <= 0) return t('errors.invalidAmount');
  if (!editing && !fields.dueDate) return t('errors.invalidDueDate');
  return null;
}

/** Οι τρεις κλάδοι του παλιού `handleSubmit`, ως δεδομένα. */
export function buildInstallmentChange(
  fields: InstallmentFields,
  installment: Installment | undefined,
  notesOnly: boolean,
): InstallmentChange {
  const notes = fields.notes || undefined;
  if (installment && notesOnly) return { kind: 'notes', index: installment.index, updates: { notes } };
  if (installment) {
    return {
      kind: 'update',
      index: installment.index,
      updates: {
        label: fields.label || undefined,
        amount: fields.amount,
        // A blank percentage stays "unset" — 0 is not sent as a real 0%.
        percentage: fields.percentage || undefined,
        dueDate: fields.dueDate ? new Date(fields.dueDate).toISOString() : undefined,
        notes,
      },
    };
  }
  return {
    kind: 'add',
    input: {
      label: fields.label.trim(),
      type: fields.type,
      amount: fields.amount,
      percentage: fields.percentage,
      dueDate: new Date(fields.dueDate).toISOString(),
      notes,
    },
    insertAt: fields.insertAtIndex === 'end' ? undefined : parseInt(fields.insertAtIndex, 10),
  };
}

export function applyInstallmentChange(change: InstallmentChange, writers: InstallmentWriters): Promise<ActionResult> {
  return change.kind === 'add'
    ? writers.onAdd(change.input, change.insertAt)
    : writers.onUpdate(change.index, change.updates);
}

/** Κλειδί i18n του μηνύματος επιτυχίας. */
export function installmentSuccessKey(change: InstallmentChange): 'installments.addSuccess' | 'installments.updateSuccess' {
  return change.kind === 'add' ? 'installments.addSuccess' : 'installments.updateSuccess';
}
