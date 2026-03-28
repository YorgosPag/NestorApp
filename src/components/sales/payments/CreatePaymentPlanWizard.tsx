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
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { formatOwnerNames } from '@/lib/ownership/owner-utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatCurrency } from '@/lib/intl-utils';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
  /** ADR-244: Multi-owner support — if >1, shows joint/individual step */
  owners?: PropertyOwnerEntry[];
  /** ADR-244: Create split plans (individual mode) */
  onCreateSplit?: (
    owners: PropertyOwnerEntry[],
    baseInput: Omit<CreatePaymentPlanInput, 'unitId' | 'buyerContactId' | 'buyerName' | 'totalAmount' | 'installments'>,
    totalPrice: number,
    baseInstallments: CreateInstallmentInput[],
  ) => Promise<{ success: boolean; error?: string }>;
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
  owners,
  onCreateSplit,
}: CreatePaymentPlanWizardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');

  // ADR-244: Multi-owner step — only shown when >1 owner
  const hasMultipleOwners = (owners?.length ?? 0) > 1;
  const [planMode, setPlanMode] = useState<'joint' | 'individual'>('joint');

  // Step offset: if multi-owner, step 0 = plan type, step 1 = template, step 2 = installments
  // If single owner, step 0 = template, step 1 = installments (no plan type step)
  const STEP_PLAN_TYPE = 0;
  const STEP_TEMPLATE = hasMultipleOwners ? 1 : 0;
  const STEP_INSTALLMENTS = hasMultipleOwners ? 2 : 1;

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

  // When moving to installment config step, compute installments
  const goToInstallmentStep = useCallback(() => {
    if (!selectedTemplate) return;
    const total = parseFloat(totalAmount);
    if (isNaN(total) || total <= 0) {
      toast.error(t('errors.invalidAmount'));
      return;
    }
    setInstallments(computeInstallments(selectedTemplate, total));
    setStep(STEP_INSTALLMENTS);
  }, [selectedTemplate, totalAmount, computeInstallments, STEP_INSTALLMENTS]);

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

    let result: { success: boolean; error?: string };

    if (planMode === 'individual' && hasMultipleOwners && onCreateSplit && owners) {
      // ADR-244: Create split plans (1 per owner, proportional amounts)
      result = await onCreateSplit(
        owners,
        { buildingId, projectId, taxRegime, taxRate },
        total,
        installments,
      );
    } else {
      // Standard: joint plan or single buyer
      result = await onCreate({
        buildingId,
        projectId,
        buyerContactId,
        buyerName: hasMultipleOwners && owners ? (formatOwnerNames(owners) ?? buyerName) : buyerName,
        totalAmount: total,
        taxRegime,
        taxRate,
        installments,
        planType: hasMultipleOwners ? 'joint' : undefined,
      });
    }

    setSubmitting(false);

    if (result.success) {
      toast.success(t('paymentPlan.createPlan'));
      onOpenChange(false);
      setStep(0);
    } else {
      toast.error(result.error ?? t('errors.createFailed'));
    }
  }, [totalAmount, taxRegime, installments, buildingId, projectId, buyerContactId, buyerName, planMode, hasMultipleOwners, owners, onCreate, onCreateSplit, onOpenChange, t]);

  const installmentSum = installments.reduce((s, i) => s + i.amount, 0);
  const total = parseFloat(totalAmount) || 0;
  const sumMatch = Math.abs(installmentSum - total) < 0.02;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('wizard.title')}
          </DialogTitle>
        </DialogHeader>

        {/* ADR-244: Step 0 — Plan Type (only for multi-owner) */}
        {hasMultipleOwners && step === STEP_PLAN_TYPE && owners && (
          <section className="space-y-4">
            <p className={cn("text-sm", colors.text.muted)}>
              {t('wizard.planTypeDescription', { defaultValue: 'Επιλέξτε τον τύπο πλάνου αποπληρωμής' })}
            </p>
            <RadioGroup value={planMode} onValueChange={(v) => setPlanMode(v as 'joint' | 'individual')}>
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="joint" className="mt-0.5" />
                <article>
                  <p className="text-sm font-medium">
                    {t('wizard.jointPlan', { defaultValue: 'Κοινό πλάνο (ένα για όλους)' })}
                  </p>
                  <p className={cn("text-xs", colors.text.muted)}>
                    {formatOwnerNames(owners)} — {formatCurrency(suggestedAmount)}
                  </p>
                </article>
              </label>
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="individual" className="mt-0.5" />
                <article>
                  <p className="text-sm font-medium">
                    {t('wizard.individualPlans', { defaultValue: 'Ξεχωριστά πλάνα (ένα ανά ιδιοκτήτη)' })}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {owners.map((owner) => (
                      <li key={owner.contactId} className={cn("text-xs", colors.text.muted)}>
                        {owner.name} ({owner.ownershipPct}%) = {formatCurrency(Math.round(suggestedAmount * owner.ownershipPct / 100))}
                      </li>
                    ))}
                  </ul>
                </article>
              </label>
            </RadioGroup>
          </section>
        )}

        {/* Template + Amount step */}
        {step === STEP_TEMPLATE && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('wizard.selectTemplate')}</Label>
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
                <p className={cn("text-xs", colors.text.muted)}>{selectedTemplate.defaultDescription}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="wizard-total">
                {t('wizard.totalAmount')}
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
              <Label>{t('taxRegime.vat_24')}</Label>
              <Select value={taxRegime} onValueChange={(v) => setTaxRegime(v as SaleTaxRegime)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_REGIMES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {t(`taxRegime.${r.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Configure Installments step */}
        {step === STEP_INSTALLMENTS && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {installments.map((inst, idx) => (
              <fieldset key={idx} className="flex items-center gap-2">
                <span className={cn("text-xs w-6", colors.text.muted)}>{idx + 1}.</span>
                <span className="text-sm flex-1 truncate">{inst.label}</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inst.amount}
                  onChange={(e) => updateInstallmentAmount(idx, e.target.value)}
                  className="w-28 text-right"
                />
                <span className={cn("text-xs", colors.text.muted)}>€</span>
              </fieldset>
            ))}

            <footer className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="font-medium">{t('wizard.totalInstallments')}</span>
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
              {t('dialog.cancel')}
            </Button>
          )}

          {/* Plan type step → Template step */}
          {hasMultipleOwners && step === STEP_PLAN_TYPE && (
            <Button onClick={() => setStep(STEP_TEMPLATE)}>
              {t('wizard.step2', { defaultValue: 'Επόμενο' })}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {/* Template step → Installments step */}
          {step === STEP_TEMPLATE && (
            <Button onClick={goToInstallmentStep}>
              {t('wizard.step2', { defaultValue: 'Επόμενο' })}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {/* Installments step → Create */}
          {step === STEP_INSTALLMENTS && (
            <Button onClick={handleCreate} disabled={submitting || !sumMatch}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('wizard.reviewAndCreate')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
