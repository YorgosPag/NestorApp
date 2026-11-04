/**
 * @fileoverview **Πράξεις πάνω στο σχέδιο πληρωμών** — αλλαγή είδους χωρίς υπολείμματα, και προεπιλογές (ADR-928 §5.4.1 ·
 *   Φ3γ-2 απόφαση 7).
 * @module subapps/procurement/subcontracts/terms/plan-edits
 *
 * 🔑 Αλλαγή είδους = **νέο σχήμα**, όχι παλιό αντικείμενο με άλλο `kind`: μια επιταγή που έγινε τραπεζική μεταφορά
 *    **δεν** κρατά `chequeMaturityDays` (ο επικυρωτής θα το έλεγε άκυρο), και ένα «με το πέρας» δεν κρατά άγκυρα.
 * 🔑 Οι προεπιλογές είναι οι πρακτικές του §5.4.1 (κάθε 15 ημέρες · κράτηση 5% με 50/50 στην προσωρινή παραλαβή και 12
 *    μήνες μετά · επιταγή 4 μηνών). Περνούν τον επικυρωτή όπως είναι.
 */

import { BP_PER_WHOLE } from '@/lib/pricing/discount-rule';
import type {
  AdvancePaymentTerms,
  FinalSettlementTrigger,
  MilestonePayment,
  PaymentSchedule,
  RecurrenceAnchor,
  RetentionReleaseInstallment,
  RetentionTerms,
  SettlementInstrument,
  SettlementShare,
} from '../types/payment-plan';

const HALF = BP_PER_WHOLE / 2;
/** «Επιταγή 4 μηνών» (2009) — η αφετηρία όταν διαλέγεται επιταγή. */
const DEFAULT_CHEQUE_DAYS = 120;
const DEFAULT_RETENTION_RATE = 500;
const DEFAULT_RELEASE_MONTHS = 12;

export const SCHEDULE_KINDS = ['on_completion', 'on_milestones', 'on_request', 'recurring'] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export function scheduleOfKind(kind: ScheduleKind, current: PaymentSchedule): PaymentSchedule {
  if (kind === current.kind) return current;
  if (kind !== 'recurring') return { kind };
  return { kind, every: 15, unit: 'day', anchor: { kind: 'start_date' }, holidayShift: 'next_business_day' };
}

export const ANCHOR_KINDS = ['start_date', 'weekday', 'month_days'] as const;

export function anchorOfKind(kind: RecurrenceAnchor['kind'], current: RecurrenceAnchor): RecurrenceAnchor {
  if (kind === current.kind) return current;
  if (kind === 'weekday') return { kind, weekday: 5 };
  if (kind === 'month_days') return { kind, days: [5, 20] };
  return { kind };
}

/**
 * «5, 20» → `[5, 20]`. Ό,τι δεν είναι αριθμός γίνεται `NaN` και **μένει**, ώστε ο επικυρωτής να πει άκυρη άγκυρα. Δεν
 * πετιέται σιωπηλά.
 */
export function parseDayList(text: string): number[] {
  return text.split(/[\s,;]+/).filter((token) => token.length > 0).map(Number);
}

export const FINAL_SETTLEMENT_KINDS = ['final_acceptance', 'milestone', 'days_after_completion'] as const;

export function finalSettlementOfKind(kind: FinalSettlementTrigger['kind'], current: FinalSettlementTrigger, milestone: string): FinalSettlementTrigger {
  if (kind === current.kind) return current;
  if (kind === 'milestone') return { kind, milestone };
  if (kind === 'days_after_completion') return { kind, days: 30 };
  return { kind };
}

/** Αλλαγή μέσου: μόνο η επιταγή κρατά ημέρες λήξης. */
export function withInstrument(share: SettlementShare, instrument: SettlementInstrument): SettlementShare {
  return instrument === 'cheque'
    ? { instrument, share: share.share, chequeMaturityDays: share.chequeMaturityDays ?? DEFAULT_CHEQUE_DAYS }
    : { instrument, share: share.share };
}

export const NEW_SETTLEMENT_SHARE: SettlementShare = { instrument: 'bank_transfer', share: 0 };

export const NEW_ADVANCE: AdvancePaymentTerms = { amount: 0, recovery: { kind: 'on_final' } };

export const NEW_RETENTION: RetentionTerms = {
  rate: DEFAULT_RETENTION_RATE,
  release: [
    { share: HALF, trigger: { kind: 'provisional_acceptance' } },
    { share: HALF, trigger: { kind: 'months_after', event: 'provisional_acceptance', months: DEFAULT_RELEASE_MONTHS } },
  ],
};

/** Οι τέσσερις επιλογές συμβάντος απόδοσης κράτησης, ως μία λίστα για την οθόνη. */
export const RELEASE_CHOICES = ['provisional_acceptance', 'final_acceptance', 'months_after_provisional', 'months_after_final'] as const;
export type ReleaseChoice = (typeof RELEASE_CHOICES)[number];

export function releaseChoiceOf(trigger: RetentionReleaseInstallment['trigger']): ReleaseChoice {
  if (trigger.kind !== 'months_after') return trigger.kind;
  return trigger.event === 'provisional_acceptance' ? 'months_after_provisional' : 'months_after_final';
}

export function triggerOfChoice(choice: ReleaseChoice, current: RetentionReleaseInstallment['trigger']): RetentionReleaseInstallment['trigger'] {
  const months = current.kind === 'months_after' ? current.months : DEFAULT_RELEASE_MONTHS;
  if (choice === 'months_after_provisional') return { kind: 'months_after', event: 'provisional_acceptance', months };
  if (choice === 'months_after_final') return { kind: 'months_after', event: 'final_acceptance', months };
  return { kind: choice };
}

export const NEW_RELEASE_INSTALLMENT: RetentionReleaseInstallment = { share: 0, trigger: { kind: 'final_acceptance' } };

export function newMilestonePayment(milestone: string): MilestonePayment {
  return { milestone, amount: { kind: 'percent', value: 0 } };
}
