'use client';

/**
 * @module components/sales/payments/PaymentPlanWizardSteps
 * @enterprise ADR-234 · ADR-244 · ADR-598 «(θ)»
 *
 * Τα τρία βήματα του οδηγού πλάνου αποπληρωμής, ως καθαρά components παρουσίασης. Η κατάσταση
 * και η υποβολή ζουν στο `CreatePaymentPlanWizard`. Κάθε ετικέτα ονομάζει το πεδίο της
 * (`FormField`)· πριν, η ετικέτα του φορολογικού καθεστώτος έγραφε «Νεόδμητο — ΦΠΑ 24%».
 */

import React from 'react';
import { NumericField } from '@/components/ui/numeric-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FormField } from '@/components/ui/form/FormComponents';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { PAYMENT_PLAN_TEMPLATES } from '@/config/payment-plan-templates';
import { formatOwnerNames } from '@/lib/ownership/owner-utils';
import { formatCurrency } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { CreateInstallmentInput, SaleTaxRegime } from '@/types/payment-plan';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { TAX_REGIMES, installmentsMatchTotal } from './payment-plan-wizard-model';

export type PlanMode = 'joint' | 'individual';

// ============================================================================
// STEP: PLAN TYPE (ADR-244, μόνο με >1 ιδιοκτήτες)
// ============================================================================

interface PlanTypeStepProps {
  owners: PropertyOwnerEntry[];
  suggestedAmount: number;
  planMode: PlanMode;
  onPlanModeChange: (mode: PlanMode) => void;
  t: Translate;
}

export function PlanTypeStep({ owners, suggestedAmount, planMode, onPlanModeChange, t }: PlanTypeStepProps) {
  const colors = useSemanticColors();
  const optionClass = 'flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50';
  return (
    <section className="space-y-4">
      <p className={cn('text-sm', colors.text.muted)}>{t('wizard.planTypeDescription')}</p>
      <RadioGroup value={planMode} onValueChange={(v) => onPlanModeChange(v as PlanMode)}>
        <label className={optionClass}>
          <RadioGroupItem value="joint" className="mt-0.5" />
          <article>
            <p className="text-sm font-medium">{t('wizard.jointPlan')}</p>
            <p className={cn('text-xs', colors.text.muted)}>
              {formatOwnerNames(owners)} — {formatCurrency(suggestedAmount)}
            </p>
          </article>
        </label>
        <label className={optionClass}>
          <RadioGroupItem value="individual" className="mt-0.5" />
          <article>
            <p className="text-sm font-medium">{t('wizard.individualPlans')}</p>
            <ul className="mt-1 space-y-0.5">
              {owners.map((owner) => (
                <li key={owner.contactId} className={cn('text-xs', colors.text.muted)}>
                  {owner.name} ({owner.ownershipPct}%) = {formatCurrency(Math.round(suggestedAmount * owner.ownershipPct / 100))}
                </li>
              ))}
            </ul>
          </article>
        </label>
      </RadioGroup>
    </section>
  );
}

// ============================================================================
// STEP: TEMPLATE + AMOUNT + TAX
// ============================================================================

interface TemplateStepProps {
  templateId: string;
  onTemplateChange: (id: string) => void;
  totalAmount: number;
  onTotalAmountChange: (amount: number) => void;
  taxRegime: SaleTaxRegime;
  onTaxRegimeChange: (regime: SaleTaxRegime) => void;
  t: Translate;
}

export function TemplateStep(props: TemplateStepProps) {
  const { templateId, onTemplateChange, totalAmount, onTotalAmountChange, t } = props;
  const template = PAYMENT_PLAN_TEMPLATES.find((tp) => tp.id === templateId);
  return (
    <section className="space-y-4">
      <FormField label={t('wizard.selectTemplate')} helpText={template?.defaultDescription}>
        {(id) => (
          <Select value={templateId} onValueChange={onTemplateChange}>
            <SelectTrigger id={id}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_PLAN_TEMPLATES.map((tp) => (
                <SelectItem key={tp.id} value={tp.id}>{tp.defaultName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label={t('wizard.totalAmount')}>
        {(id) => <NumericField id={id} min={1} step={0.01} value={totalAmount} onValueChange={onTotalAmountChange} blankValue={0} />}
      </FormField>
      <TaxRegimeField {...props} />
    </section>
  );
}

function TaxRegimeField({ taxRegime, onTaxRegimeChange, t }: TemplateStepProps) {
  return (
    <FormField label={t('wizard.taxRegime')}>
      {(id) => (
        <Select value={taxRegime} onValueChange={(v) => onTaxRegimeChange(v as SaleTaxRegime)}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAX_REGIMES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{t(`taxRegime.${r.value}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
}

// ============================================================================
// STEP: INSTALLMENTS
// ============================================================================

interface InstallmentsStepProps {
  installments: CreateInstallmentInput[];
  totalAmount: number;
  onAmountChange: (idx: number, amount: number) => void;
  t: Translate;
}

export function InstallmentsStep({ installments, totalAmount, onAmountChange, t }: InstallmentsStepProps) {
  const colors = useSemanticColors();
  const sum = installments.reduce((s, i) => s + i.amount, 0);
  const matches = installmentsMatchTotal(installments, totalAmount);
  return (
    <section className="space-y-3 max-h-80 overflow-y-auto">
      {installments.map((inst, idx) => (
        <fieldset key={idx} className="flex items-center gap-2">
          <span className={cn('text-xs w-6', colors.text.muted)}>{idx + 1}.</span>
          <span className="text-sm flex-1 truncate">{inst.label}</span>
          <NumericField
            min={0}
            step={0.01}
            value={inst.amount}
            onValueChange={(amount) => onAmountChange(idx, amount)}
            className="w-28 text-right"
            aria-label={inst.label}
          />
          <span className={cn('text-xs', colors.text.muted)} aria-hidden>€</span>
        </fieldset>
      ))}
      <footer className="flex items-center justify-between pt-2 border-t text-sm">
        <span className="font-medium">{t('wizard.totalInstallments')}</span>
        <output className={matches ? 'text-[hsl(var(--text-success))] font-semibold' : 'text-destructive font-semibold'}>
          {formatCurrency(sum)}
          {!matches && ` (≠ ${formatCurrency(totalAmount)})`}
        </output>
      </footer>
    </section>
  );
}
