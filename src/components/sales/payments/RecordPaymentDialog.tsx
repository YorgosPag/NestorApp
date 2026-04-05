'use client';

/**
 * RecordPaymentDialog — Dialog for recording a payment against an installment
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { BankSelector } from '@/components/banking/BankSelector';
import type { BankInfo } from '@/constants/greek-banks';
import type {
  Installment,
  PaymentMethod,
  CreatePaymentInput,
  PaymentMethodDetails,
} from '@/types/payment-plan';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installment: Installment;
  paymentPlanId: string;
  onRecord: (input: CreatePaymentInput) => Promise<{ success: boolean; error?: string }>;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'bank_cheque',
  'personal_cheque',
  'bank_loan',
  'cash',
  'offset',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function RecordPaymentDialog({
  open,
  onOpenChange,
  installment,
  paymentPlanId,
  onRecord,
}: RecordPaymentDialogProps) {
  const { t } = useTranslation('payments');
  const { success, error: notifyError } = useNotifications();

  const remaining = installment.amount - installment.paidAmount;
  const [amount, setAmount] = useState(remaining.toString());
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const buildMethodDetails = useCallback((): PaymentMethodDetails => {
    switch (method) {
      case 'bank_transfer':
        return { method: 'bank_transfer', bankName, iban: null, referenceNumber: referenceNumber || null };
      case 'bank_cheque':
      case 'personal_cheque':
        return {
          method,
          chequeNumber: referenceNumber || '',
          bankName,
          issueDate: paymentDate,
          maturityDate: null,
          drawerName: null,
        };
      case 'bank_loan':
        return { method: 'bank_loan', bankName, loanReferenceNumber: referenceNumber || null, disbursementDate: paymentDate };
      case 'cash':
        return { method: 'cash', receiptNumber: referenceNumber || null };
      case 'offset':
        return { method: 'offset', offsetReason: notes || '', relatedDocumentId: null };
      case 'promissory_note':
        return {
          method: 'promissory_note',
          noteNumber: referenceNumber || '',
          issueDate: paymentDate,
          maturityDate: paymentDate,
          drawerName: '',
        };
      default:
        return { method: 'bank_transfer', bankName: '', iban: null, referenceNumber: null };
    }
  }, [method, bankName, referenceNumber, paymentDate, notes]);

  const handleSubmit = useCallback(async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      notifyError(t('errors.invalidAmount'));
      return;
    }

    setSubmitting(true);
    const result = await onRecord({
      paymentPlanId,
      installmentIndex: installment.index,
      amount: numAmount,
      method,
      paymentDate: new Date(paymentDate).toISOString(),
      methodDetails: buildMethodDetails(),
      notes: notes || undefined,
    });
    setSubmitting(false);

    if (result.success) {
      success(`${t('dialog.paymentRecorded')} €${numAmount.toLocaleString('el-GR')}`);
      onOpenChange(false);
    } else {
      notifyError(result.error ?? t('errors.paymentFailed'));
    }
  }, [amount, method, paymentDate, notes, installment.index, paymentPlanId, onRecord, onOpenChange, buildMethodDetails, t, success, notifyError]);

  const showBankFields = method === 'bank_transfer' || method === 'bank_cheque' || method === 'personal_cheque' || method === 'bank_loan';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {installment.label} — {t('labels.remainingAmount')}: €{remaining.toLocaleString('el-GR')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-1">
            <Label htmlFor="pay-amount">{t('labels.amount')} (€)</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-1">
            <Label>{t('labels.method')}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
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
          </div>

          {/* Payment Date */}
          <div className="space-y-1">
            <Label htmlFor="pay-date">{t('labels.paymentDate')}</Label>
            <Input
              id="pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          {/* Bank fields */}
          {showBankFields && (
            <>
              <BankSelector
                value={bankCode}
                onChange={(code: string, bank: BankInfo | undefined) => {
                  setBankCode(code);
                  setBankName(bank?.name ?? '');
                }}
                label={t('dialog.bankName')}
                allowOther
              />
              <div className="space-y-1">
                <Label htmlFor="pay-ref">{t('dialog.referenceNumber')}</Label>
                <Input
                  id="pay-ref"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="pay-notes">{t('labels.notes')}</Label>
            <Textarea
              id="pay-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('dialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('dialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
