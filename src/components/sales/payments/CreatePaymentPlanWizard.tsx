'use client';

/**
 * CreatePaymentPlanWizard — Template → Configure → Review → Create
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { toast } from 'sonner';
import { PAYMENT_PLAN_TEMPLATES } from '@/config/payment-plan-templates';
import type {
  PaymentPlanTemplate,
  CreatePaymentPlanInput,
  CreateInstallmentInput,
  SaleTaxRegime,
} from '@/types/payment-plan';

// ============================================================================
// TYPES
// ============================================================================

interface CreatePaymentPlanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  buildingId: string;
  projectId: string;
  buyerContactId: string;
  buyerName: string;
  suggestedAmount: number;
  onCreate: (input: Omit<CreatePaymentPlanInput, 'unitId'>) => Promise<{ success: boolean; error?: string }>;
}

const TAX_REGIMES: { value: SaleTaxRegime; rate: number }[] = [
  { value: 'vat_24', rate: 24 },
  { value: 'vat_suspension_3', rate: 3 },
  { value: 'transfer_tax_3', rate: 3 },
  { value: 'custom', rate: 0 },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function CreatePaymentPlanWizard({
  open,
  onOpenChange,
  buildingId,
  projectId,
  buyerContactId,
  buyerName,
  suggestedAmount,
  onCreate,
}: CreatePaymentPlanWizardProps) {
  const { t } = useTranslation('payments');

  const [step, setStep] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(PAYMENT_PLAN_TEMPLATES[0].id);
  const [totalAmount, setTotalAmount] = useState(suggestedAmount.toString());
  const [taxRegime, setTaxRegime] = useState<SaleTaxRegime>('vat_24');
  const [installments, setInstallments] = useState<CreateInstallmentInput[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedTemplate = useMemo(
    () => PAYMENT_PLAN_TEMPLATES.find((tp) => tp.id === selectedTemplateId),
    [selectedTemplateId]
  );

  // Compute installments from template + totalAmount
  const computeInstallments = useCallback(
    (template: PaymentPlanTemplate, total: number): CreateInstallmentInput[] => {
      // Step 1: Compute fixed amounts first to determine percentage base
      const fixedSum = template.slots.reduce((sum, slot) => {
        if (slot.amountType === 'fixed' && slot.fixedAmount !== null) {
          return sum + slot.fixedAmount;
        }
        return sum;
      }, 0);

      // Percentage-based slots distribute the REMAINING after fixed amounts
      const percentageBase = Math.max(0, total - fixedSum);
      let remainingAmount = total;

      return template.slots.map((slot, idx) => {
        let amount: number;
        let percentage: number;

        if (slot.amountType === 'fixed' && slot.fixedAmount !== null) {
          amount = Math.min(slot.fixedAmount, Math.max(0, remainingAmount));
          percentage = total > 0 ? Math.round((amount / total) * 10000) / 100 : 0;
        } else {
          // Last percentage-based slot gets remaining
          const isLastPercentageSlot = !template.slots.slice(idx + 1).some(
            (s) => s.amountType !== 'fixed'
          );

          if (isLastPercentageSlot) {
            amount = Math.max(0, remainingAmount);
            percentage = total > 0 ? Math.round((amount / total) * 10000) / 100 : 0;
          } else {
            percentage = slot.percentage;
            amount = Math.round((percentageBase * slot.percentage) / 100);
          }
        }

        remainingAmount -= amount;

        // Due date: spread over months from today
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + idx);

        return {
          label: slot.defaultLabel,
          type: slot.type,
          amount: Math.max(0, amount),
          percentage,
          dueDate: dueDate.toISOString(),
        };
      });
    },
    []
  );

  // When moving to step 2, compute installments
  const goToStep2 = useCallback(() => {
    if (!selectedTemplate) return;
    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0) {
      toast.error('Εισάγετε έγκυρο ποσό');
      return;
    }
    setInstallments(computeInstallments(selectedTemplate, total));
    setStep(1);
  }, [selectedTemplate, totalAmount, computeInstallments]);

  // Update individual installment amount
  const updateInstallmentAmount = useCallback((idx: number, newAmount: string) => {
    setInstallments((prev) => {
      const updated = [...prev];
      const parsed = parseFloat(newAmount);
      updated[idx] = {
        ...updated[idx],
        amount: isNaN(parsed) ? 0 : parsed,
      };
      return updated;
    });
  }, []);

  // Submit
  const handleCreate = useCallback(async () => {
    const total = parseFloat(totalAmount);
    const taxRate = TAX_REGIMES.find((r) => r.value === taxRegime)?.rate ?? 0;

    setSubmitting(true);
    const result = await onCreate({
      buildingId,
      projectId,
      buyerContactId,
      buyerName,
      totalAmount: total,
      taxRegime,
      taxRate,
      installments,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success(t('paymentPlan.createPlan', { defaultValue: 'Δημιουργήθηκε' }));
      onOpenChange(false);
      setStep(0);
    } else {
      toast.error(result.error ?? t('errors.createFailed', { defaultValue: 'Σφάλμα' }));
    }
  }, [totalAmount, taxRegime, installments, buildingId, projectId, buyerContactId, buyerName, onCreate, onOpenChange, t]);

  const installmentSum = installments.reduce((s, i) => s + i.amount, 0);
  const total = parseFloat(totalAmount) || 0;
  const sumMatch = Math.abs(installmentSum - total) < 0.02;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('wizard.title', { defaultValue: 'Δημιουργία Προγράμματος Αποπληρωμής' })}
          </DialogTitle>
        </DialogHeader>

        {/* Step 0: Template + Amount */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('wizard.selectTemplate', { defaultValue: 'Πρότυπο' })}</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_PLAN_TEMPLATES.map((tp) => (
                    <SelectItem key={tp.id} value={tp.id}>
                      {tp.defaultName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <p className="text-xs text-muted-foreground">{selectedTemplate.defaultDescription}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="wizard-total">
                {t('wizard.totalAmount', { defaultValue: 'Συνολικό Ποσό (€)' })}
              </Label>
              <Input
                id="wizard-total"
                type="number"
                min="1"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>{t('taxRegime.vat_24', { defaultValue: 'Φορολογικό Καθεστώς' })}</Label>
              <Select value={taxRegime} onValueChange={(v) => setTaxRegime(v as SaleTaxRegime)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_REGIMES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {t(`taxRegime.${r.value}`, { defaultValue: r.value })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 1: Configure Installments */}
        {step === 1 && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {installments.map((inst, idx) => (
              <fieldset key={idx} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                <span className="text-sm flex-1 truncate">{inst.label}</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inst.amount}
                  onChange={(e) => updateInstallmentAmount(idx, e.target.value)}
                  className="w-28 text-right"
                />
                <span className="text-xs text-muted-foreground">€</span>
              </fieldset>
            ))}

            <footer className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="font-medium">Σύνολο δόσεων</span>
              <span className={sumMatch ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                €{installmentSum.toLocaleString('el-GR')}
                {!sumMatch && ` (≠ €${total.toLocaleString('el-GR')})`}
              </span>
            </footer>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t('dialog.cancel', { defaultValue: 'Πίσω' })}
            </Button>
          )}

          {step === 0 && (
            <Button onClick={goToStep2}>
              {t('wizard.step2', { defaultValue: 'Ρύθμιση Δόσεων' })}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {step === 1 && (
            <Button onClick={handleCreate} disabled={submitting || !sumMatch}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('wizard.reviewAndCreate', { defaultValue: 'Δημιουργία' })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
