/**
 * =============================================================================
 * Payment Plan Templates — ADR-234 §7
 * =============================================================================
 *
 * Predefined templates for common installment structures in Greek real estate.
 * Templates are starting points — users can freely modify amounts/dates in wizard.
 *
 * @module config/payment-plan-templates
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import { DEFAULT_PAYMENT_PLAN_CONFIG } from '@/types/payment-plan';
import type { PaymentPlanTemplate } from '@/types/payment-plan';

// =============================================================================
// CONSTRUCTION MILESTONES (Standard Set)
// =============================================================================

export const CONSTRUCTION_MILESTONES = [
  { id: 'foundation', labelKey: 'payments.milestones.foundation', defaultLabel: 'Θεμελίωση' },
  { id: 'frame', labelKey: 'payments.milestones.frame', defaultLabel: 'Σκελετός' },
  { id: 'masonry', labelKey: 'payments.milestones.masonry', defaultLabel: 'Τοιχοποιία' },
  { id: 'plastering', labelKey: 'payments.milestones.plastering', defaultLabel: 'Σοβάδες' },
  { id: 'flooring', labelKey: 'payments.milestones.flooring', defaultLabel: 'Δάπεδα' },
  { id: 'windows_doors', labelKey: 'payments.milestones.windowsDoors', defaultLabel: 'Κουφώματα' },
  { id: 'completion', labelKey: 'payments.milestones.completion', defaultLabel: 'Αποπεράτωση' },
] as const;

// =============================================================================
// TEMPLATES
// =============================================================================

/** Off-Plan Πλήρης — 9 δόσεις (reservation + down payment + 7 milestones) */
const OFF_PLAN_FULL: PaymentPlanTemplate = {
  id: 'off_plan_full',
  nameKey: 'payments.templates.offPlanFull',
  defaultName: 'Off-Plan Πλήρης (9 δόσεις)',
  descriptionKey: 'payments.templates.offPlanFullDesc',
  defaultDescription: 'Κράτηση → Προκαταβολή → 7 κατασκευαστικά milestones',
  slots: [
    { type: 'reservation', labelKey: 'payments.installmentType.reservation', defaultLabel: 'Κράτηση', percentage: 0, amountType: 'fixed', fixedAmount: 5000 },
    { type: 'down_payment', labelKey: 'payments.installmentType.down_payment', defaultLabel: 'Προκαταβολή', percentage: 15, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.foundation', defaultLabel: 'Θεμελίωση', percentage: 10, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.frame', defaultLabel: 'Σκελετός', percentage: 15, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.masonry', defaultLabel: 'Τοιχοποιία', percentage: 10, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.plastering', defaultLabel: 'Σοβάδες', percentage: 10, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.flooring', defaultLabel: 'Δάπεδα', percentage: 10, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.windowsDoors', defaultLabel: 'Κουφώματα', percentage: 10, amountType: 'percentage', fixedAmount: null },
    { type: 'final_payment', labelKey: 'payments.installmentType.final_payment', defaultLabel: 'Αποπεράτωση + Οριστικό', percentage: 20, amountType: 'percentage', fixedAmount: null },
  ],
  defaultConfig: { ...DEFAULT_PAYMENT_PLAN_CONFIG },
};

/** Off-Plan Συμπυκνωμένο — 5 δόσεις */
const OFF_PLAN_CONDENSED: PaymentPlanTemplate = {
  id: 'off_plan_condensed',
  nameKey: 'payments.templates.offPlanCondensed',
  defaultName: 'Off-Plan Συμπυκνωμένο (5 δόσεις)',
  descriptionKey: 'payments.templates.offPlanCondensedDesc',
  defaultDescription: 'Κράτηση → Προκαταβολή → Σκελετός → Αποπεράτωση → Οριστικό',
  slots: [
    { type: 'reservation', labelKey: 'payments.installmentType.reservation', defaultLabel: 'Κράτηση', percentage: 0, amountType: 'fixed', fixedAmount: 5000 },
    { type: 'down_payment', labelKey: 'payments.installmentType.down_payment', defaultLabel: 'Προκαταβολή', percentage: 20, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.frame', defaultLabel: 'Σκελετός', percentage: 25, amountType: 'percentage', fixedAmount: null },
    { type: 'stage_payment', labelKey: 'payments.milestones.completion', defaultLabel: 'Αποπεράτωση', percentage: 25, amountType: 'percentage', fixedAmount: null },
    { type: 'final_payment', labelKey: 'payments.installmentType.final_payment', defaultLabel: 'Οριστικό Συμβόλαιο', percentage: 30, amountType: 'percentage', fixedAmount: null },
  ],
  defaultConfig: { ...DEFAULT_PAYMENT_PLAN_CONFIG },
};

/** Έτοιμο Ακίνητο — 3 δόσεις */
const READY_PROPERTY: PaymentPlanTemplate = {
  id: 'ready_property',
  nameKey: 'payments.templates.readyProperty',
  defaultName: 'Έτοιμο Ακίνητο (3 δόσεις)',
  descriptionKey: 'payments.templates.readyPropertyDesc',
  defaultDescription: 'Κράτηση → Προκαταβολή → Οριστικό (+ δάνειο)',
  slots: [
    { type: 'reservation', labelKey: 'payments.installmentType.reservation', defaultLabel: 'Κράτηση', percentage: 0, amountType: 'fixed', fixedAmount: 5000 },
    { type: 'down_payment', labelKey: 'payments.installmentType.down_payment', defaultLabel: 'Προκαταβολή', percentage: 30, amountType: 'percentage', fixedAmount: null },
    { type: 'final_payment', labelKey: 'payments.installmentType.final_payment', defaultLabel: 'Οριστικό + Δάνειο', percentage: 70, amountType: 'percentage', fixedAmount: null },
  ],
  defaultConfig: { ...DEFAULT_PAYMENT_PLAN_CONFIG },
};

/** Εφάπαξ — 1 δόση */
const LUMP_SUM: PaymentPlanTemplate = {
  id: 'lump_sum',
  nameKey: 'payments.templates.lumpSum',
  defaultName: 'Εφάπαξ (1 δόση)',
  descriptionKey: 'payments.templates.lumpSumDesc',
  defaultDescription: 'Ολόκληρο το ποσό σε μία πληρωμή',
  slots: [
    { type: 'final_payment', labelKey: 'payments.installmentType.final_payment', defaultLabel: 'Ολόκληρο Ποσό', percentage: 100, amountType: 'percentage', fixedAmount: null },
  ],
  defaultConfig: { ...DEFAULT_PAYMENT_PLAN_CONFIG },
};

// =============================================================================
// EXPORTS
// =============================================================================

/** All available templates */
export const PAYMENT_PLAN_TEMPLATES: PaymentPlanTemplate[] = [
  OFF_PLAN_FULL,
  OFF_PLAN_CONDENSED,
  READY_PROPERTY,
  LUMP_SUM,
];

/** Get template by ID */
export function getPaymentPlanTemplate(id: string): PaymentPlanTemplate | undefined {
  return PAYMENT_PLAN_TEMPLATES.find((t) => t.id === id);
}
