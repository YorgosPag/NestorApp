'use client';

/**
 * EditInstallmentDialog — Add/Edit installment in a payment plan
 * Supports two modes: 'add' (create new) and 'edit' (update existing).
 *
 * @enterprise ADR-234 - Payment Plan & Installment Tracking (SPEC-234D)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { toast } from 'sonner';
import type {
  Installment,
  InstallmentType,
  CreateInstallmentInput,
  UpdateInstallmentInput,
  PaymentPlanStatus,
} from '@/types/payment-plan';

// ============================================================================
// TYPES
// ============================================================================

interface EditInstallmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'add' | 'edit';
  planStatus: PaymentPlanStatus;
  /** Existing installment (required for edit mode) */
  installment?: Installment;
  /** Total installments count (for insert position select in add mode) */
  totalInstallments: number;
  onAdd: (input: CreateInstallmentInput, insertAtIndex?: number) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (index: number, updates: UpdateInstallmentInput) => Promise<{ success: boolean; error?: string }>;
  onDelete: (index: number) => Promise<{ success: boolean; error?: string }>;
}

const INSTALLMENT_TYPES: InstallmentType[] = [
  'reservation',
  'down_payment',
  'stage_payment',
  'final_payment',
  'custom',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function EditInstallmentDialog({
  open,
  onOpenChange,
  mode,
  planStatus,
  installment,
  totalInstallments,
  onAdd,
  onUpdate,
  onDelete,
}: EditInstallmentDialogProps) {
  const { t } = useTranslation('payments');

  const isNotesOnly = planStatus === 'active';
  const isDraftOrNeg = planStatus === 'negotiation' || planStatus === 'draft';

  // Form state
  const [label, setLabel] = useState('');
  const [type, setType] = useState<InstallmentType>('custom');
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [insertAtIndex, setInsertAtIndex] = useState<string>('end');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && installment) {
      setLabel(installment.label);
      setType(installment.type);
      setAmount(installment.amount.toString());
      setPercentage(installment.percentage.toString());
      setDueDate(installment.dueDate.split('T')[0]);
      setNotes(installment.notes ?? '');
    } else {
      setLabel('');
      setType('custom');
      setAmount('');
      setPercentage('');
      setDueDate('');
      setNotes('');
      setInsertAtIndex('end');
    }
  }, [open, mode, installment]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (mode === 'edit' && installment) {
      // Edit mode
      if (isNotesOnly) {
        // Active plan: only notes
        setSubmitting(true);
        const result = await onUpdate(installment.index, { notes: notes || undefined });
        setSubmitting(false);

        if (result.success) {
          toast.success(t('installments.updateSuccess', { defaultValue: 'Η δόση ενημερώθηκε' }));
          onOpenChange(false);
        } else {
          toast.error(result.error ?? 'Error');
        }
        return;
      }

      // Draft/negotiation: full edit
      const numAmount = parseFloat(amount);
      const numPercentage = parseFloat(percentage);
      if (isNaN(numAmount) || numAmount <= 0) {
        toast.error('Εισάγετε έγκυρο ποσό');
        return;
      }

      const updates: UpdateInstallmentInput = {
        label: label || undefined,
        amount: numAmount,
        percentage: isNaN(numPercentage) ? undefined : numPercentage,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes || undefined,
      };

      setSubmitting(true);
      const result = await onUpdate(installment.index, updates);
      setSubmitting(false);

      if (result.success) {
        toast.success(t('installments.updateSuccess', { defaultValue: 'Η δόση ενημερώθηκε' }));
        onOpenChange(false);
      } else {
        toast.error(result.error ?? 'Error');
      }
    } else {
      // Add mode
      const numAmount = parseFloat(amount);
      const numPercentage = parseFloat(percentage);
      if (!label.trim()) {
        toast.error('Εισάγετε ετικέτα');
        return;
      }
      if (isNaN(numAmount) || numAmount <= 0) {
        toast.error('Εισάγετε έγκυρο ποσό');
        return;
      }
      if (!dueDate) {
        toast.error('Εισάγετε ημερομηνία λήξης');
        return;
      }

      const input: CreateInstallmentInput = {
        label: label.trim(),
        type,
        amount: numAmount,
        percentage: isNaN(numPercentage) ? 0 : numPercentage,
        dueDate: new Date(dueDate).toISOString(),
        notes: notes || undefined,
      };

      const idx = insertAtIndex === 'end' ? undefined : parseInt(insertAtIndex, 10);

      setSubmitting(true);
      const result = await onAdd(input, idx);
      setSubmitting(false);

      if (result.success) {
        toast.success(t('installments.addSuccess', { defaultValue: 'Η δόση προστέθηκε' }));
        onOpenChange(false);
      } else {
        toast.error(result.error ?? 'Error');
      }
    }
  }, [mode, installment, isNotesOnly, label, type, amount, percentage, dueDate, notes, insertAtIndex, onAdd, onUpdate, onOpenChange, t]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!installment) return;

    setSubmitting(true);
    const result = await onDelete(installment.index);
    setSubmitting(false);
    setDeleteConfirmOpen(false);

    if (result.success) {
      toast.success(t('installments.deleteSuccess', { defaultValue: 'Η δόση διαγράφηκε' }));
      onOpenChange(false);
    } else {
      toast.error(result.error ?? 'Error');
    }
  }, [installment, onDelete, onOpenChange, t]);

  const canDelete =
    mode === 'edit' &&
    installment &&
    isDraftOrNeg &&
    installment.paidAmount === 0;

  const dialogTitle = mode === 'add'
    ? t('installments.addInstallment', { defaultValue: 'Προσθήκη Δόσης' })
    : t('installments.editInstallment', { defaultValue: 'Επεξεργασία Δόσης' });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {isNotesOnly && mode === 'edit' && (
              <DialogDescription>
                {t('installments.notesOnlyWarning', { defaultValue: 'Σε ενεργό plan μπορείτε να αλλάξετε μόνο σημειώσεις' })}
              </DialogDescription>
            )}
          </DialogHeader>

          <fieldset className="space-y-4" disabled={submitting}>
            {/* Label */}
            {!isNotesOnly && (
              <div className="space-y-1">
                <Label htmlFor="inst-label">
                  {t('labels.dueDate', { defaultValue: 'Ετικέτα' })}
                </Label>
                <Input
                  id="inst-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="π.χ. Προκαταβολή 30%"
                />
              </div>
            )}

            {/* Type */}
            {!isNotesOnly && (
              <div className="space-y-1">
                <Label>{t('installments.typeLabel', { defaultValue: 'Τύπος δόσης' })}</Label>
                <Select value={type} onValueChange={(v) => setType(v as InstallmentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_TYPES.map((iType) => (
                      <SelectItem key={iType} value={iType}>
                        {t(`installmentType.${iType}`, { defaultValue: iType })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Amount + Percentage */}
            {!isNotesOnly && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="inst-amount">
                    {t('labels.amount', { defaultValue: 'Ποσό' })} (€)
                  </Label>
                  <Input
                    id="inst-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="inst-pct">%</Label>
                  <Input
                    id="inst-pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={percentage}
                    onChange={(e) => setPercentage(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Due Date */}
            {!isNotesOnly && (
              <div className="space-y-1">
                <Label htmlFor="inst-due">
                  {t('labels.dueDate', { defaultValue: 'Ημ. Λήξης' })}
                </Label>
                <Input
                  id="inst-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}

            {/* Insert position (add mode only) */}
            {mode === 'add' && totalInstallments > 0 && (
              <div className="space-y-1">
                <Label>
                  {t('installments.insertPosition', { defaultValue: 'Θέση εισαγωγής' })}
                </Label>
                <Select value={insertAtIndex} onValueChange={setInsertAtIndex}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="end">
                      {t('installments.atEnd', { defaultValue: 'Στο τέλος' })}
                    </SelectItem>
                    {Array.from({ length: totalInstallments }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {t('installments.beforeInstallment', {
                          defaultValue: `Πριν τη δόση #${i + 1}`,
                          index: (i + 1).toString(),
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="inst-notes">
                {t('labels.notes', { defaultValue: 'Σημειώσεις' })}
              </Label>
              <Textarea
                id="inst-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </fieldset>

          <DialogFooter className="flex justify-between sm:justify-between">
            {canDelete ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={submitting}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {t('installments.deleteInstallment', { defaultValue: 'Διαγραφή' })}
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('dialog.cancel', { defaultValue: 'Ακύρωση' })}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'add'
                  ? t('installments.addInstallment', { defaultValue: 'Προσθήκη' })
                  : t('dialog.confirm', { defaultValue: 'Αποθήκευση' })}
              </Button>
            </span>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('installments.deleteInstallment', { defaultValue: 'Διαγραφή Δόσης' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('installments.confirmDelete', { defaultValue: 'Σίγουρα θέλετε να διαγράψετε αυτήν τη δόση;' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel', { defaultValue: 'Ακύρωση' })}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('installments.deleteInstallment', { defaultValue: 'Διαγραφή' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
