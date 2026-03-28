'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

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
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
  /** Maximum amount allowed for new/edited installment (95% of unpaid balance) */
  maxAmount?: number;
  /** Total plan amount (sale price) for reference display */
  planTotalAmount?: number;
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
  maxAmount,
  planTotalAmount: _planTotalAmount,
  onAdd,
  onUpdate,
  onDelete,
}: EditInstallmentDialogProps) {
  const colors = useSemanticColors();
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
          toast.success(t('installments.updateSuccess'));
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
        toast.error(t('errors.invalidAmount'));
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
        toast.success(t('installments.updateSuccess'));
        onOpenChange(false);
      } else {
        toast.error(result.error ?? 'Error');
      }
    } else {
      // Add mode
      const numAmount = parseFloat(amount);
      const numPercentage = parseFloat(percentage);
      if (!label.trim()) {
        toast.error(t('errors.invalidLabel'));
        return;
      }
      if (isNaN(numAmount) || numAmount <= 0) {
        toast.error(t('errors.invalidAmount'));
        return;
      }
      if (!dueDate) {
        toast.error(t('errors.invalidDueDate'));
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
        toast.success(t('installments.addSuccess'));
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
      toast.success(t('installments.deleteSuccess'));
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
    ? t('installments.addInstallment')
    : t('installments.editInstallment');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            {isNotesOnly && mode === 'edit' && (
              <DialogDescription>
                {t('installments.notesOnlyWarning')}
              </DialogDescription>
            )}
          </DialogHeader>

          <fieldset className="space-y-4" disabled={submitting}>
            {/* Label */}
            {!isNotesOnly && (
              <div className="space-y-1">
                <Label htmlFor="inst-label">
                  {t('labels.dueDate')}
                </Label>
                <Input
                  id="inst-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t('installments.labelPlaceholder')}
                />
              </div>
            )}

            {/* Type */}
            {!isNotesOnly && (
              <div className="space-y-1">
                <Label>{t('installments.typeLabel')}</Label>
                <Select value={type} onValueChange={(v) => setType(v as InstallmentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_TYPES.map((iType) => (
                      <SelectItem key={iType} value={iType}>
                        {t(`installmentType.${iType}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Amount + Percentage */}
            {!isNotesOnly && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="inst-amount">
                      {t('labels.amount')} (€)
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
                {/* Max amount hint + validation warning */}
                {maxAmount !== undefined && maxAmount > 0 && (
                  <p className={cn("text-xs", colors.text.muted)}>
                    {t('installments.maxAmountHint', {
                      max: new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(maxAmount),
                    })}
                  </p>
                )}
                {maxAmount !== undefined && parseFloat(amount) > maxAmount && (
                  <p className="text-xs text-destructive font-medium">
                    {t('installments.amountExceedsMax')}
                  </p>
                )}
              </div>
            )}

            {/* Due Date */}
            {!isNotesOnly && (
              <div className="space-y-1">
                <Label htmlFor="inst-due">
                  {t('labels.dueDate')}
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
                  {t('installments.insertPosition')}
                </Label>
                <Select value={insertAtIndex} onValueChange={setInsertAtIndex}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="end">
                      {t('installments.atEnd')}
                    </SelectItem>
                    {Array.from({ length: totalInstallments }, (_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {t('installments.beforeInstallment', {
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
                {t('labels.notes')}
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
                {t('installments.deleteInstallment')}
              </Button>
            ) : (
              <span />
            )}
            <span className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('dialog.cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'add'
                  ? t('installments.addInstallment')
                  : t('dialog.confirm')}
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
              {t('installments.deleteInstallment')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('installments.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('installments.deleteInstallment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
