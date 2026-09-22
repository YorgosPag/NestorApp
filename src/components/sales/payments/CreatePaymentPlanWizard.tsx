'use client';

/**
 * CreatePaymentPlanWizard — Template → Configure → Review → Create
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 * @enterprise ADR-598 «(θ)» — ΕΝΑ `<form>` για όλον τον οδηγό (Material Stepper / GOV.UK «one
 *   thing per page»): το Enter = η κύρια ενέργεια του ΤΡΕΧΟΝΤΟΣ βήματος (Επόμενο ή, στο τελευταίο,
 *   Δημιουργία μέσω SSoT `useFormSubmission`). Πριν: το `handleCreate` δεν είχε `try` ⇒ ένα
 *   `onCreate` που πετούσε άφηνε το κουμπί μόνιμα σε «υποβάλλεται», και το «Πίσω» έγραφε «Ακύρωση».
 *   Μοντέλο: `payment-plan-wizard-model.ts` · βήματα: `PaymentPlanWizardSteps.tsx`.
 */

import React, { useCallback, useState, type FormEvent } from 'react';
import { FormDialog } from '@/components/ui/form/FormDialog';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { unwrapActionResult, type ActionResult } from '@/lib/mutations/gateway-action';
import { PAYMENT_PLAN_TEMPLATES } from '@/config/payment-plan-templates';
import type {
  CreatePaymentPlanInput,
  CreateInstallmentInput,
  SaleTaxRegime,
} from '@/types/payment-plan';
import type { PropertyOwnerEntry } from '@/types/ownership-table';
import { formatOwnerNames } from '@/lib/ownership/owner-utils';
import '@/lib/design-system';
import {
  computeInstallments,
  installmentsMatchTotal,
  taxRateOf,
  wizardSteps,
} from './payment-plan-wizard-model';
import { InstallmentsStep, PlanTypeStep, TemplateStep, type PlanMode } from './PaymentPlanWizardSteps';

// ============================================================================
// TYPES
// ============================================================================

interface CreatePaymentPlanWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  buildingId: string;
  projectId: string;
  ownerContactId: string;
  ownerName: string;
  suggestedAmount: number;
  onCreate: (input: Omit<CreatePaymentPlanInput, 'propertyId'>) => Promise<ActionResult>;
  /** ADR-244: Multi-owner support — if >1, shows joint/individual step */
  owners?: PropertyOwnerEntry[];
  /** ADR-244: Create split plans (individual mode) */
  onCreateSplit?: (
    owners: PropertyOwnerEntry[],
    baseInput: Omit<CreatePaymentPlanInput, 'propertyId' | 'ownerContactId' | 'ownerName' | 'totalAmount' | 'installments'>,
    totalPrice: number,
    baseInstallments: CreateInstallmentInput[],
  ) => Promise<ActionResult>;
}

interface PlanDraft {
  planMode: PlanMode;
  templateId: string;
  /** ADR-706: number model — ο οδηγός ανοίγει στην προτεινόμενη τιμή πώλησης. */
  totalAmount: number;
  taxRegime: SaleTaxRegime;
  installments: CreateInstallmentInput[];
}

// ============================================================================
// PURE: η εγγραφή (κοινό πλάνο ή ένα ανά ιδιοκτήτη — ADR-244)
// ============================================================================

function createPlan(props: CreatePaymentPlanWizardProps, draft: PlanDraft): Promise<ActionResult> {
  const { owners, onCreateSplit, buildingId, projectId, ownerContactId, ownerName } = props;
  const hasMultipleOwners = (owners?.length ?? 0) > 1;
  const taxRate = taxRateOf(draft.taxRegime);
  if (draft.planMode === 'individual' && hasMultipleOwners && onCreateSplit && owners) {
    return onCreateSplit(owners, { buildingId, projectId, taxRegime: draft.taxRegime, taxRate }, draft.totalAmount, draft.installments);
  }
  return props.onCreate({
    buildingId,
    projectId,
    ownerContactId,
    ownerName: hasMultipleOwners && owners ? (formatOwnerNames(owners) ?? ownerName) : ownerName,
    totalAmount: draft.totalAmount,
    taxRegime: draft.taxRegime,
    taxRate,
    installments: draft.installments,
    planType: hasMultipleOwners ? 'joint' : undefined,
  });
}

// ============================================================================
// STATE: βήμα + πρόχειρο
// ============================================================================

function useWizardState(props: CreatePaymentPlanWizardProps, t: Translate) {
  const steps = wizardSteps((props.owners?.length ?? 0) > 1);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(() => ({
    planMode: 'joint',
    templateId: PAYMENT_PLAN_TEMPLATES[0].id,
    totalAmount: props.suggestedAmount,
    taxRegime: 'vat_24',
    installments: [],
  }));
  const update = useCallback((patch: Partial<PlanDraft>) => setDraft((prev) => ({ ...prev, ...patch })), []);
  const goTo = useCallback((index: number) => { setStepError(null); setStepIndex(index); }, []);

  /** Η κύρια ενέργεια ενός ενδιάμεσου βήματος («Επόμενο»). */
  const advance = useCallback(() => {
    if (steps[stepIndex] === 'template') {
      const template = PAYMENT_PLAN_TEMPLATES.find((tp) => tp.id === draft.templateId);
      if (!template) return;
      if (draft.totalAmount <= 0) { setStepError(t('errors.invalidAmount')); return; }
      update({ installments: computeInstallments(template, draft.totalAmount) });
    }
    goTo(stepIndex + 1);
  }, [steps, stepIndex, draft.templateId, draft.totalAmount, update, goTo, t]);

  return { steps, stepIndex, stepError, draft, update, goTo, advance };
}

function useWizardForm(props: CreatePaymentPlanWizardProps, t: Translate) {
  const state = useWizardState(props, t);
  const { success } = useNotifications();
  const isLast = state.stepIndex === state.steps.length - 1;
  const canCreate = installmentsMatchTotal(state.draft.installments, state.draft.totalAmount);

  const submission = useFormSubmission({
    canSubmit: canCreate,
    submit: async () => unwrapActionResult(await createPlan(props, state.draft)),
    onSuccess: () => {
      success(t('paymentPlan.createPlan'));
      props.onOpenChange(false);
      state.goTo(0);
    },
    errorFallback: t('errors.createFailed'),
  });

  const handleSubmit = useCallback((event: FormEvent) => {
    if (isLast) return submission.handleSubmit(event);
    event.preventDefault();
    state.advance();
  }, [isLast, submission, state]);

  const back = useCallback(() => {
    submission.clearError();
    state.goTo(state.stepIndex - 1);
  }, [submission, state]);

  return { ...state, isLast, canCreate, submission, handleSubmit, back };
}

// ============================================================================
// COMPONENT
// ============================================================================

function CurrentStep({ props, form, t }: { props: CreatePaymentPlanWizardProps; form: ReturnType<typeof useWizardForm>; t: Translate }) {
  const { draft, update } = form;
  switch (form.steps[form.stepIndex]) {
    case 'planType':
      return (
        <PlanTypeStep owners={props.owners ?? []} suggestedAmount={props.suggestedAmount} planMode={draft.planMode} onPlanModeChange={(planMode) => update({ planMode })} t={t} />
      );
    case 'template':
      return (
        <TemplateStep
          templateId={draft.templateId}
          onTemplateChange={(templateId) => update({ templateId })}
          totalAmount={draft.totalAmount}
          onTotalAmountChange={(totalAmount) => update({ totalAmount })}
          taxRegime={draft.taxRegime}
          onTaxRegimeChange={(taxRegime) => update({ taxRegime })}
          t={t}
        />
      );
    default:
      return (
        <InstallmentsStep
          installments={draft.installments}
          totalAmount={draft.totalAmount}
          onAmountChange={(idx, amount) => update({ installments: draft.installments.map((inst, i) => (i === idx ? { ...inst, amount } : inst)) })}
          t={t}
        />
      );
  }
}

export function CreatePaymentPlanWizard(props: CreatePaymentPlanWizardProps) {
  const { open, onOpenChange } = props;
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);
  const form = useWizardForm(props, t);
  const atStart = form.stepIndex === 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('wizard.title')}
      contentClassName="sm:max-w-lg"
      submission={form.submission}
      onSubmit={form.handleSubmit}
      error={form.stepError}
      submitLabel={form.isLast ? t('wizard.reviewAndCreate') : t('wizard.nextStep')}
      pendingLabel={t('wizard.creating')}
      cancelLabel={atStart ? t('dialog.cancel') : t('wizard.previousStep')}
      onCancel={atStart ? undefined : form.back}
      submitDisabled={form.isLast && !form.canCreate}
    >
      <CurrentStep props={props} form={form} t={t} />
    </FormDialog>
  );
}
