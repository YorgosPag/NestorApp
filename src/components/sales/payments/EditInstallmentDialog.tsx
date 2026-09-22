'use client';

/**
 * EditInstallmentDialog — Add/Edit installment in a payment plan
 * Supports two modes: 'add' (create new) and 'edit' (update existing).
 *
 * @enterprise ADR-234 - Payment Plan & Installment Tracking (SPEC-234D)
 * @enterprise ADR-598 «(θ)» — υποβολή: `<form>` + SSoT `useFormSubmission`/`FormActions`
 *   (πριν: τρεις κλάδοι χωρίς `try` ⇒ ένα `onUpdate` που πετούσε άφηνε το κουμπί νεκρό· ωμό
 *   `'Error'` σε toast). Διαγραφή: SSoT `DeleteConfirmDialog` + `useInFlightAction`.
 *   Μοντέλο: `edit-installment-model.ts` · πεδία: `EditInstallmentFields.tsx`.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormDialog } from '@/components/ui/form/FormDialog';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useInFlightAction } from '@/hooks/useInFlightAction';
import { getErrorMessage } from '@/lib/error-utils';
import { unwrapActionResult, type ActionResult } from '@/lib/mutations/gateway-action';
import type { Installment, PaymentPlanStatus } from '@/types/payment-plan';
import '@/lib/design-system';
import { EditInstallmentFields } from './EditInstallmentFields';
import {
  applyInstallmentChange,
  buildInstallmentChange,
  initialInstallmentFields,
  installmentSuccessKey,
  validateInstallment,
  type InstallmentDialogMode,
  type InstallmentFields,
  type InstallmentWriters,
} from './edit-installment-model';

// ============================================================================
// TYPES
// ============================================================================

interface EditInstallmentDialogProps extends InstallmentWriters {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InstallmentDialogMode;
  planStatus: PaymentPlanStatus;
  /** Existing installment (required for edit mode) */
  installment?: Installment;
  /** Total installments count (for insert position select in add mode) */
  totalInstallments: number;
  /** Maximum amount allowed for new/edited installment (95% of unpaid balance) */
  maxAmount?: number;
  /** Total plan amount (sale price) for reference display */
  planTotalAmount?: number;
  onDelete: (index: number) => Promise<ActionResult>;
}

// ============================================================================
// FORM STATE + SUBMISSION
// ============================================================================

function useEditInstallmentForm(props: EditInstallmentDialogProps, t: Translate) {
  const { open, mode, planStatus, onAdd, onUpdate, onOpenChange } = props;
  const editing = mode === 'edit' ? props.installment : undefined;
  const notesOnly = planStatus === 'active';
  const { success } = useNotifications();
  const [fields, setFields] = useState<InstallmentFields>(() => initialInstallmentFields(mode, editing));
  const update = useCallback((patch: Partial<InstallmentFields>) => setFields((prev) => ({ ...prev, ...patch })), []);

  // Κάθε άνοιγμα ξεκινά από την αποθηκευμένη δόση (ή κενό σε προσθήκη).
  useEffect(() => {
    if (open) setFields(initialInstallmentFields(mode, editing));
  }, [open, mode, editing]);

  const submission = useFormSubmission({
    canSubmit: true,
    validate: () => validateInstallment(fields, editing !== undefined, notesOnly, t),
    submit: async () => {
      const change = buildInstallmentChange(fields, editing, notesOnly);
      unwrapActionResult(await applyInstallmentChange(change, { onAdd, onUpdate }));
      return change;
    },
    onSuccess: (change) => {
      success(t(installmentSuccessKey(change)));
      onOpenChange(false);
    },
    errorFallback: t('errors.installmentSaveFailed'),
  });

  return { fields, update, notesOnly, submission };
}

function useDeleteInstallment({ installment, onDelete, onOpenChange }: EditInstallmentDialogProps, t: Translate) {
  const { success, error: notifyError } = useNotifications();
  const { isRunning: deleting, run } = useInFlightAction();

  // Μη-φόρμα ενέργεια: ο διάλογος επιβεβαίωσης κλείνει με το κλικ (Radix), άρα το σφάλμα πάει σε toast.
  const confirmDelete = useCallback(async () => {
    if (!installment) return;
    try {
      await run(async () => unwrapActionResult(await onDelete(installment.index)));
      success(t('installments.deleteSuccess'));
      onOpenChange(false);
    } catch (caught) {
      notifyError(getErrorMessage(caught, t('errors.installmentDeleteFailed')));
    }
  }, [installment, onDelete, onOpenChange, run, success, notifyError, t]);

  return { deleting, confirmDelete };
}

/** Διαγράφεται μόνο δόση πλάνου σε πρόχειρο/διαπραγμάτευση που δεν έχει εξοφληθεί καθόλου. */
function isDeletable(planStatus: PaymentPlanStatus, installment: Installment): boolean {
  return (planStatus === 'negotiation' || planStatus === 'draft') && installment.paidAmount === 0;
}

// ============================================================================
// COMPONENT
// ============================================================================

function DeleteInstallmentButton({ busy, onClick, t }: { busy: boolean; onClick: () => void; t: Translate }) {
  return (
    <Button variant="destructive" size="sm" onClick={onClick} disabled={busy}>
      <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
      {t('installments.deleteInstallment')}
    </Button>
  );
}

function ConfirmInstallmentDelete({ open, onOpenChange, onConfirm, loading, t }: {
  open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => Promise<void>; loading: boolean; t: Translate;
}) {
  return (
    <DeleteConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('installments.deleteInstallment')}
      description={t('installments.confirmDelete')}
      confirmText={t('installments.deleteInstallment')}
      cancelText={t('dialog.cancel')}
      onConfirm={onConfirm}
      loading={loading}
    />
  );
}

export function EditInstallmentDialog(props: EditInstallmentDialogProps) {
  const { open, onOpenChange, mode, planStatus, installment, totalInstallments, maxAmount } = props;
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);
  const { fields, update, notesOnly, submission } = useEditInstallmentForm(props, t);
  const { deleting, confirmDelete } = useDeleteInstallment(props, t);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const busy = submission.submitting || deleting;
  const canDelete = mode === 'edit' && installment !== undefined && isDeletable(planStatus, installment);

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={mode === 'add' ? t('installments.addInstallment') : t('installments.editInstallment')}
        description={notesOnly && mode === 'edit' ? t('installments.notesOnlyWarning') : undefined}
        contentClassName="sm:max-w-md"
        submission={submission}
        submitLabel={mode === 'add' ? t('installments.addInstallment') : t('dialog.confirm')}
        pendingLabel={t('dialog.saving')}
        cancelLabel={t('dialog.cancel')}
        submitDisabled={deleting}
        secondaryAction={canDelete ? <DeleteInstallmentButton busy={busy} onClick={() => setDeleteConfirmOpen(true)} t={t} /> : undefined}
      >
        <fieldset className="space-y-4" disabled={busy}>
          <EditInstallmentFields fields={fields} update={update} t={t} notesOnly={notesOnly} insertChoices={mode === 'add' ? totalInstallments : 0} maxAmount={maxAmount} />
        </fieldset>
      </FormDialog>

      <ConfirmInstallmentDelete open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen} onConfirm={confirmDelete} loading={deleting} t={t} />
    </>
  );
}
