/**
 * @module components/sales/payments/payment-plan-wizard-model
 * @enterprise ADR-234 · ADR-244 (multi-owner) · ADR-598 «(θ)»
 *
 * Καθαρό μοντέλο του οδηγού πλάνου αποπληρωμής: υπολογισμός δόσεων από πρότυπο, φορολογικά
 * καθεστώτα, και η διάταξη των βημάτων. Χωρίς React — ελέγχεται με unit tests.
 */

import type {
  CreateInstallmentInput,
  PaymentPlanTemplate,
  SaleTaxRegime,
  TemplateSlot,
} from '@/types/payment-plan';

export const TAX_REGIMES: ReadonlyArray<{ readonly value: SaleTaxRegime; readonly rate: number }> = [
  { value: 'vat_24', rate: 24 },
  { value: 'vat_suspension_3', rate: 3 },
  { value: 'transfer_tax_3', rate: 3 },
  { value: 'custom', rate: 0 },
];

export function taxRateOf(regime: SaleTaxRegime): number {
  return TAX_REGIMES.find((r) => r.value === regime)?.rate ?? 0;
}

/** Ανοχή σύγκρισης αθροίσματος δόσεων με το σύνολο (στρογγυλοποίηση λεπτών). */
const SUM_TOLERANCE = 0.02;

export function installmentsMatchTotal(installments: readonly CreateInstallmentInput[], total: number): boolean {
  const sum = installments.reduce((s, i) => s + i.amount, 0);
  return Math.abs(sum - total) < SUM_TOLERANCE;
}

// ============================================================================
// STEP LAYOUT (ADR-244: το βήμα «τύπος πλάνου» υπάρχει μόνο με >1 ιδιοκτήτες)
// ============================================================================

export type WizardStepKind = 'planType' | 'template' | 'installments';

export function wizardSteps(hasMultipleOwners: boolean): readonly WizardStepKind[] {
  return hasMultipleOwners ? ['planType', 'template', 'installments'] : ['template', 'installments'];
}

// ============================================================================
// INSTALLMENTS FROM TEMPLATE
// ============================================================================

function isFixed(slot: TemplateSlot): slot is TemplateSlot & { fixedAmount: number } {
  return slot.amountType === 'fixed' && slot.fixedAmount !== null;
}

function percentOf(amount: number, total: number): number {
  return total > 0 ? Math.round((amount / total) * 10000) / 100 : 0;
}

/** Ποσό + ποσοστό μίας θέσης, με δεδομένο ό,τι έμεινε αδιάθετο ως εδώ. */
function slotShare(
  slots: readonly TemplateSlot[],
  idx: number,
  total: number,
  percentageBase: number,
  remaining: number,
): { amount: number; percentage: number } {
  const slot = slots[idx];
  if (isFixed(slot)) {
    const amount = Math.min(slot.fixedAmount, Math.max(0, remaining));
    return { amount, percentage: percentOf(amount, total) };
  }
  // Η τελευταία θέση ποσοστού παίρνει το υπόλοιπο (κανένα λεπτό δεν χάνεται στη στρογγυλοποίηση).
  const isLastPercentageSlot = !slots.slice(idx + 1).some((s) => s.amountType !== 'fixed');
  if (isLastPercentageSlot) {
    const amount = Math.max(0, remaining);
    return { amount, percentage: percentOf(amount, total) };
  }
  return { amount: Math.round((percentageBase * slot.percentage) / 100), percentage: slot.percentage };
}

/**
 * Δόσεις από πρότυπο: πρώτα τα σταθερά ποσά, και οι θέσεις ποσοστού μοιράζουν ό,τι ΜΕΝΕΙ.
 * Λήξεις: μία ανά μήνα από το `today`.
 */
export function computeInstallments(
  template: PaymentPlanTemplate,
  total: number,
  today: Date = new Date(),
): CreateInstallmentInput[] {
  const fixedSum = template.slots.reduce((sum, slot) => sum + (isFixed(slot) ? slot.fixedAmount : 0), 0);
  const percentageBase = Math.max(0, total - fixedSum);
  let remaining = total;

  return template.slots.map((slot, idx) => {
    const { amount, percentage } = slotShare(template.slots, idx, total, percentageBase, remaining);
    remaining -= amount;
    const dueDate = new Date(today);
    dueDate.setMonth(dueDate.getMonth() + idx);
    return { label: slot.defaultLabel, type: slot.type, amount: Math.max(0, amount), percentage, dueDate: dueDate.toISOString() };
  });
}
