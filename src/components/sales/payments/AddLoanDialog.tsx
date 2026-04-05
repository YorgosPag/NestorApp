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
import { useNotifications } from '@/providers/NotificationProvider';
import { BankSelector } from '@/components/banking/BankSelector';
import type { BankInfo } from '@/constants/greek-banks';
import type { CreateLoanInput, DisbursementType } from '@/types/loan-tracking';
import '@/lib/design-system';

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
  const { success, error: notifyError } = useNotifications();
  const [bankCode, setBankCode] = useState('');
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
        success(t('loanTracking.addLoan'));
        // Reset form
        setBankCode('');
        setBankName('');
        setRequestedAmount('');
        setDisbursementType('lump_sum');
        onOpenChange(false);
      } else {
        notifyError(result.error ?? 'Error');
      }
    } catch {
      notifyError('Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  }, [bankName, isPrimary, requestedAmount, disbursementType, onAdd, onOpenChange, t, success, notifyError]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t('loanTracking.addLoan')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('loanTracking.addLoanDesc')}
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3">
          {/* Bank Name */}
          <BankSelector
            value={bankCode}
            onChange={(code: string, bank: BankInfo | undefined) => {
              setBankCode(code);
              setBankName(bank?.name ?? '');
            }}
            label={`${t('loanTracking.fields.bankName')} *`}
            required
            allowOther
          />

          {/* Requested Amount */}
          <span className="space-y-1">
            <Label className="text-xs">
              {t('loanTracking.fields.requestedAmount')}
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
              {t('loanTracking.disbursementType.title')}
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
                  {t('loanTracking.disbursementType.lump_sum')}
                </SelectItem>
                <SelectItem value="phased" className="text-xs">
                  {t('loanTracking.disbursementType.phased')}
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
              {t('loanTracking.primaryLoan')}
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
            {t('dialog.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={isSubmitting || !bankName.trim()}
            onClick={handleSubmit}
          >
            {isSubmitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {t('loanTracking.addLoan')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
