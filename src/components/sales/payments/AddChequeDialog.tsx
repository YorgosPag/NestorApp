'use client';

/**
 * AddChequeDialog — Form to register a new cheque
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { BankSelector } from '@/components/banking/BankSelector';
import type { BankInfo } from '@/constants/greek-banks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { CreateChequeInput, ChequeType } from '@/types/cheque-registry';
import '@/lib/design-system';

interface AddChequeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: CreateChequeInput) => Promise<{ success: boolean; error?: string }>;
  projectId: string;
  paymentPlanId?: string;
  contactId?: string;
}

export function AddChequeDialog({
  open,
  onOpenChange,
  onAdd,
  projectId,
  paymentPlanId,
  contactId,
}: AddChequeDialogProps) {
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);
  const { success, error: notifyError } = useNotifications();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [chequeType, setChequeType] = useState<ChequeType>('bank_cheque');
  const [chequeNumber, setChequeNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [drawerName, setDrawerName] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [crossedCheque, setCrossedCheque] = useState(false);
  const [notes, setNotes] = useState('');

  const resetForm = useCallback(() => {
    setChequeType('bank_cheque');
    setChequeNumber('');
    setAmount('');
    setBankCode('');
    setBankName('');
    setBankBranch('');
    setDrawerName('');
    setIssueDate('');
    setMaturityDate('');
    setCrossedCheque(false);
    setNotes('');
  }, []);

  const canSubmit =
    chequeNumber.trim() &&
    parseFloat(amount) > 0 &&
    bankName.trim() &&
    drawerName.trim() &&
    issueDate &&
    maturityDate;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const input: CreateChequeInput = {
        chequeType,
        chequeNumber: chequeNumber.trim(),
        amount: parseFloat(amount),
        bankName: bankName.trim(),
        ...(bankBranch.trim() ? { bankBranch: bankBranch.trim() } : {}),
        drawerName: drawerName.trim(),
        issueDate,
        maturityDate,
        crossedCheque,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        projectId,
        ...(paymentPlanId ? { paymentPlanId } : {}),
        ...(contactId ? { contactId } : {}),
      };

      const result = await onAdd(input);
      if (result.success) {
        success(t('chequeRegistry.actions.chequeCreated'));
        resetForm();
        onOpenChange(false);
      } else {
        notifyError(result.error ?? t('errors.createFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, chequeType, chequeNumber, amount, bankName, bankBranch, drawerName, issueDate, maturityDate, crossedCheque, notes, projectId, paymentPlanId, contactId, onAdd, resetForm, onOpenChange, t, success, notifyError]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {t('chequeRegistry.actions.addCheque')}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          {/* Cheque Type */}
          <fieldset className="space-y-1">
            <Label className="text-xs">
              {t('chequeRegistry.fields.chequeType')}
            </Label>
            <Select value={chequeType} onValueChange={(v) => setChequeType(v as ChequeType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_cheque">
                  {t('paymentMethod.bank_cheque')}
                </SelectItem>
                <SelectItem value="personal_cheque">
                  {t('paymentMethod.personal_cheque')}
                </SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Cheque Number + Amount */}
          <fieldset className="grid grid-cols-2 gap-2">
            <section className="space-y-1">
              <Label className="text-xs">
                {t('chequeRegistry.fields.chequeNumber')}
              </Label>
              <Input
                className="h-8 text-xs"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="123456789"
              />
            </section>
            <section className="space-y-1">
              <Label className="text-xs">
                {t('chequeRegistry.fields.amount')}
              </Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000.00"
              />
            </section>
          </fieldset>

          {/* Bank + Branch */}
          <fieldset className="grid grid-cols-2 gap-2">
            <BankSelector
              value={bankCode}
              onChange={(code: string, bank: BankInfo | undefined) => {
                setBankCode(code);
                setBankName(bank?.name ?? '');
              }}
              label={t('chequeRegistry.fields.bankName')}
              allowOther
            />
            <section className="space-y-1">
              <Label className="text-xs">
                {t('chequeRegistry.fields.bankBranch')}
              </Label>
              <Input
                className="h-8 text-xs"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
              />
            </section>
          </fieldset>

          {/* Drawer Name */}
          <fieldset className="space-y-1">
            <Label className="text-xs">
              {t('chequeRegistry.fields.drawerName')}
            </Label>
            <Input
              className="h-8 text-xs"
              value={drawerName}
              onChange={(e) => setDrawerName(e.target.value)}
            />
          </fieldset>

          {/* Dates */}
          <fieldset className="grid grid-cols-2 gap-2">
            <section className="space-y-1">
              <Label className="text-xs">
                {t('chequeRegistry.fields.issueDate')}
              </Label>
              <Input
                className="h-8 text-xs"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </section>
            <section className="space-y-1">
              <Label className="text-xs">
                {t('chequeRegistry.fields.maturityDate')}
              </Label>
              <Input
                className="h-8 text-xs"
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
              />
            </section>
          </fieldset>

          {/* Crossed Cheque */}
          <fieldset className="flex items-center gap-2">
            <Checkbox
              id="crossedCheque"
              checked={crossedCheque}
              onCheckedChange={(v) => setCrossedCheque(v === true)}
            />
            <Label htmlFor="crossedCheque" className="text-xs cursor-pointer">
              {t('chequeRegistry.fields.crossedCheque')}
            </Label>
          </fieldset>

          {/* Notes */}
          <fieldset className="space-y-1">
            <Label className="text-xs">
              {t('labels.notes')}
            </Label>
            <Textarea
              className="text-xs min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </fieldset>
        </form>

        <DialogFooter>
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
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {t('chequeRegistry.actions.addCheque')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
