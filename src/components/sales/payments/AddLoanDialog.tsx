'use client';

/**
 * AddLoanDialog — Create a new loan tracking entry
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { CreateLoanInput, DisbursementType } from '@/types/loan-tracking';

// ============================================================================
// TYPES
// ============================================================================

interface ActionResult {
  success: boolean;
  error?: string;
}

interface AddLoanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: CreateLoanInput) => Promise<ActionResult>;
  existingCount: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddLoanDialog({ open, onOpenChange, onAdd, existingCount }: AddLoanDialogProps) {
  const { t } = useTranslation('payments');
  const [bankName, setBankName] = useState('');
  const [isPrimary, setIsPrimary] = useState(existingCount === 0);
  const [requestedAmount, setRequestedAmount] = useState('');
  const [disbursementType, setDisbursementType] = useState<DisbursementType>('lump_sum');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!bankName.trim()) return;

    setIsSubmitting(true);
    try {
      const input: CreateLoanInput = {
        bankName: bankName.trim(),
        isPrimary,
        disbursementType,
        ...(requestedAmount ? { requestedAmount: parseFloat(requestedAmount) } : {}),
      };

      const result = await onAdd(input);

      if (result.success) {
        toast.success(t('loanTracking.addLoan', { defaultValue: 'Δάνειο προστέθηκε' }));
        // Reset form
        setBankName('');
        setRequestedAmount('');
        setDisbursementType('lump_sum');
        onOpenChange(false);
      } else {
        toast.error(result.error ?? 'Error');
      }
    } catch {
      toast.error('Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  }, [bankName, isPrimary, requestedAmount, disbursementType, onAdd, onOpenChange, toast, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t('loanTracking.addLoan', { defaultValue: 'Νέο Δάνειο' })}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('loanTracking.addLoanDesc', {
              defaultValue: 'Καταγράψτε ένα νέο τραπεζικό δάνειο για αυτό το payment plan.',
            })}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3">
          {/* Bank Name */}
          <span className="space-y-1">
            <Label className="text-xs">
              {t('loanTracking.fields.bankName', { defaultValue: 'Τράπεζα' })} *
            </Label>
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="h-8 text-xs"
              placeholder="π.χ. Εθνική Τράπεζα"
              autoFocus
            />
          </span>

          {/* Requested Amount */}
          <span className="space-y-1">
            <Label className="text-xs">
              {t('loanTracking.fields.requestedAmount', { defaultValue: 'Αιτηθέν Ποσό (€)' })}
            </Label>
            <Input
              type="number"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              className="h-8 text-xs"
              placeholder="€"
            />
          </span>

          {/* Disbursement Type */}
          <span className="space-y-1">
            <Label className="text-xs">
              {t('loanTracking.disbursementType.title', { defaultValue: 'Τύπος Εκταμίευσης' })}
            </Label>
            <Select
              value={disbursementType}
              onValueChange={(v) => setDisbursementType(v as DisbursementType)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lump_sum" className="text-xs">
                  {t('loanTracking.disbursementType.lump_sum', { defaultValue: 'Εφάπαξ' })}
                </SelectItem>
                <SelectItem value="phased" className="text-xs">
                  {t('loanTracking.disbursementType.phased', { defaultValue: 'Σταδιακή (Milestones)' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </span>

          {/* Is Primary */}
          <span className="flex items-center gap-2">
            <Checkbox
              id="isPrimary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked === true)}
            />
            <Label htmlFor="isPrimary" className="text-xs cursor-pointer">
              {t('loanTracking.primaryLoan', { defaultValue: 'Κύριο Δάνειο' })}
            </Label>
          </span>
        </fieldset>

        <DialogFooter className="gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('dialog.cancel', { defaultValue: 'Ακύρωση' })}
          </Button>
          <Button
            size="sm"
            disabled={isSubmitting || !bankName.trim()}
            onClick={handleSubmit}
          >
            {isSubmitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {t('loanTracking.addLoan', { defaultValue: 'Προσθήκη' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
