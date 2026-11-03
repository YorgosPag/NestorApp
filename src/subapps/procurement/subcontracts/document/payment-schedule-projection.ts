/**
 * @fileoverview **Προβολή του ημερολογίου πληρωμών** — ημερομηνίες και αναμενόμενα ποσά από το σχέδιο πληρωμών
 *   (ADR-928 §5.4.1 «προεπισκόπηση ημερολογίου πληρωμών» · §5.17). Καθαρό· αργότερα τροφοδοτεί τις ταμειακές ροές.
 * @module subapps/procurement/subcontracts/document/payment-schedule-projection
 *
 * 🔑 Ακέραια λεπτά παντού· κάθε κατανομή κλείνει **ακριβώς** (το υπόλοιπο πάει στο τελευταίο μέρος).
 * 🔑 Ο κανόνας αργιών είναι ο **ένας** του ημερολογίου (`shiftToBusinessDay`). Συμβάν χωρίς ημερομηνία (οριστική
 *    παραλαβή, ορόσημο) ⇒ `date: null` — «με το συμβάν», ποτέ επινοημένη ημερομηνία.
 * ⚠️ Εκτίμηση: γραμμική κατανομή της εκτιμώμενης αξίας ανάμεσα σε έναρξη και πέρας (το χρονοδιάγραμμα έργου δεν
 *    συνδέεται ακόμη). Η είσοδος `startDate`/`endDate` είναι ρητή.
 */

import { shiftToBusinessDay } from '@/lib/calendar/business-days';
import { addDaysToDateKey, addMonthsToDateKey, daysBetweenDateKeys, isoWeekdayOfDateKey } from '@/lib/calendar/date-key';
import type { MinorAmount } from '@/lib/money/money';
import { BP_PER_WHOLE, type BasisPoints } from '@/lib/pricing/discount-rule';
import type { CommercialTerms } from '../types/commercial-terms';
import type { PaymentPlan, PaymentSchedule, SettlementShare } from '../types/payment-plan';

export interface PaymentProjectionInput {
  readonly plan: PaymentPlan;
  readonly terms: Pick<CommercialTerms, 'withholding' | 'cashLimitPerPayment'>;
  readonly value: MinorAmount;
  readonly startDate: string;
  readonly endDate: string;
}

export type ProjectedPaymentKind = 'advance' | 'periodic' | 'final' | 'retention_release';

export interface ProjectedPayment {
  readonly kind: ProjectedPaymentKind;
  readonly sequence: number;
  /** `null` ⇒ πληρώνεται με συμβάν που δεν έχει ημερομηνία. */
  readonly date: string | null;
  readonly gross: MinorAmount;
  readonly retention: MinorAmount;
  readonly withholding: MinorAmount;
  readonly advanceRecovery: MinorAmount;
  readonly net: MinorAmount;
  /** Το μερίδιο του σχεδίου (μέσο · ποσοστό · λήξη επιταγής) **και** το ποσό του σε αυτή την πληρωμή. */
  readonly shares: readonly (SettlementShare & { readonly amount: MinorAmount })[];
  readonly cash: MinorAmount;
  readonly cashOverLimit: boolean;
}

const MAX_PERIODS = 520;
const portion = (amount: MinorAmount, rate: BasisPoints): MinorAmount => Math.round((amount * rate) / BP_PER_WHOLE);

/** Χωρίζει ποσό σε μερίδια που αθροίζουν ακριβώς το ποσό (υπόλοιπο στο τελευταίο). */
function splitByShares(amount: MinorAmount, shares: readonly SettlementShare[]): ProjectedPayment['shares'] {
  let allocated = 0;
  return shares.map((share, index) => {
    const part = index === shares.length - 1 ? amount - allocated : portion(amount, share.share);
    allocated += part;
    return { ...share, amount: part };
  });
}

function firstWeekdayOnOrAfter(start: string, weekday: number): string | null {
  const current = isoWeekdayOfDateKey(start);
  return current === null ? null : addDaysToDateKey(start, (weekday - current + 7) % 7);
}

function stepped(origin: string, every: number, unit: 'day' | 'week' | 'month', index: number): string | null {
  if (unit === 'month') return addMonthsToDateKey(origin, every * index);
  return addDaysToDateKey(origin, every * index * (unit === 'week' ? 7 : 1));
}

function monthDayDates(schedule: Extract<PaymentSchedule, { kind: 'recurring' }>, start: string, end: string): string[] {
  if (schedule.anchor.kind !== 'month_days') return [];
  const monthStart = `${start.slice(0, 8)}01`;
  const dates: string[] = [];
  for (let index = 0; index < MAX_PERIODS; index += 1) {
    const month = addMonthsToDateKey(monthStart, (schedule.unit === 'month' ? schedule.every : 1) * index);
    if (month === null || month > end) break;
    for (const day of schedule.anchor.days) dates.push(`${month.slice(0, 8)}${String(day).padStart(2, '0')}`);
  }
  return dates.filter((date) => date > start && date <= end && daysBetweenDateKeys(start, date) !== null);
}

/** Οι ονομαστικές ημερομηνίες των περιοδικών λογαριασμών (πριν τον κανόνα αργιών), εντός (έναρξη, πέρας]. */
function nominalDates(schedule: PaymentSchedule, start: string, end: string): string[] {
  if (schedule.kind !== 'recurring' || schedule.every < 1) return [];
  if (schedule.anchor.kind === 'month_days') return monthDayDates(schedule, start, end);
  const origin = schedule.anchor.kind === 'weekday' ? firstWeekdayOnOrAfter(start, schedule.anchor.weekday) : start;
  if (origin === null) return [];
  const dates: string[] = [];
  const firstIndex = schedule.anchor.kind === 'start_date' ? 1 : 0;
  for (let index = firstIndex; index < MAX_PERIODS; index += 1) {
    const date = stepped(origin, schedule.every, schedule.unit, index);
    if (date === null || date > end) break;
    if (date > start) dates.push(date);
  }
  return dates;
}

function periodicDates(plan: PaymentPlan, start: string, end: string): string[] {
  const shift = plan.schedule.kind === 'recurring' ? plan.schedule.holidayShift : 'none';
  const shifted = nominalDates(plan.schedule, start, end).map((date) => shiftToBusinessDay(date, shift) ?? date);
  return [...new Set(shifted)].filter((date) => date < end);
}

function finalDate(plan: PaymentPlan, end: string): string | null {
  if (plan.finalSettlement.kind !== 'days_after_completion') return null;
  const nominal = addDaysToDateKey(end, plan.finalSettlement.days);
  const shift = plan.schedule.kind === 'recurring' ? plan.schedule.holidayShift : 'none';
  return nominal === null ? null : shiftToBusinessDay(nominal, shift);
}

/** Αθροιστικό παραχθέν σε κάθε ημερομηνία (γραμμικά) → παραχθέν ανά λογαριασμό· το υπόλοιπο στην εξόφληση. */
function grossPerPeriod(input: PaymentProjectionInput, dates: readonly string[]): MinorAmount[] {
  const total = daysBetweenDateKeys(input.startDate, input.endDate) ?? 0;
  if (total <= 0) return [];
  let previous = 0;
  return dates.map((date) => {
    const elapsed = daysBetweenDateKeys(input.startDate, date) ?? 0;
    const cumulative = Math.round((input.value * Math.min(elapsed, total)) / total);
    const gross = cumulative - previous;
    previous = cumulative;
    return gross;
  });
}

interface PaymentDraft {
  readonly kind: ProjectedPaymentKind;
  readonly sequence: number;
  readonly date: string | null;
  readonly gross: MinorAmount;
  readonly retention: MinorAmount;
  readonly advanceRecovery: MinorAmount;
  readonly shares: readonly SettlementShare[];
}

function finish(draft: PaymentDraft, input: PaymentProjectionInput): ProjectedPayment {
  const { withholding: terms } = input.terms;
  const withholding = terms.applies && draft.kind !== 'retention_release' && draft.kind !== 'advance' ? portion(draft.gross, terms.rate) : 0;
  const net = draft.gross - draft.retention - withholding - draft.advanceRecovery;
  const shares = splitByShares(net, draft.shares);
  const cash = shares.filter((share) => share.instrument === 'cash').reduce((sum, share) => sum + share.amount, 0);
  return { ...draft, withholding, net, shares, cash, cashOverLimit: cash > input.terms.cashLimitPerPayment };
}

function advanceRecoveryOf(plan: PaymentPlan, gross: MinorAmount, outstanding: MinorAmount, isFinal: boolean): MinorAmount {
  if (!plan.advance || outstanding <= 0) return 0;
  if (isFinal) return outstanding;
  return plan.advance.recovery.kind === 'per_payment' ? Math.min(outstanding, portion(gross, plan.advance.recovery.rate)) : 0;
}

function workPayments(input: PaymentProjectionInput): PaymentDraft[] {
  const { plan } = input;
  const dates = periodicDates(plan, input.startDate, input.endDate);
  const grosses = grossPerPeriod(input, dates);
  const finalGross = input.value - grosses.reduce((sum, gross) => sum + gross, 0);
  const rate = plan.retention?.rate ?? 0;
  let outstanding = plan.advance?.amount ?? 0;
  const rows = [...grosses.map((gross, index) => ({ gross, date: dates[index], isFinal: false })), { gross: finalGross, date: finalDate(plan, input.endDate), isFinal: true }];
  return rows.map((row, index) => {
    const advanceRecovery = advanceRecoveryOf(plan, row.gross, outstanding, row.isFinal);
    outstanding -= advanceRecovery;
    const shares = row.isFinal ? plan.settlement.final ?? plan.settlement.regular : plan.settlement.regular;
    return { kind: row.isFinal ? 'final' : 'periodic', sequence: index + 1, date: row.date, gross: row.gross, retention: portion(row.gross, rate), advanceRecovery, shares };
  });
}

function retentionReleases(plan: PaymentPlan, retained: MinorAmount): PaymentDraft[] {
  if (!plan.retention || retained <= 0) return [];
  const release = plan.retention.release;
  let allocated = 0;
  return release.map((installment, index) => {
    const gross = index === release.length - 1 ? retained - allocated : portion(retained, installment.share);
    allocated += gross;
    return { kind: 'retention_release', sequence: index + 1, date: null, gross, retention: 0, advanceRecovery: 0, shares: plan.settlement.final ?? plan.settlement.regular };
  });
}

/** Το ημερολόγιο: προκαταβολή · λογαριασμοί · εξόφληση · αποδόσεις κράτησης. Άκυρο διάστημα ⇒ μόνο εξόφληση. */
export function projectPaymentSchedule(input: PaymentProjectionInput): ProjectedPayment[] {
  const { plan } = input;
  const advance: PaymentDraft[] = plan.advance
    ? [{ kind: 'advance', sequence: 1, date: input.startDate, gross: plan.advance.amount, retention: 0, advanceRecovery: 0, shares: plan.settlement.regular }]
    : [];
  const work = workPayments(input);
  const retained = work.reduce((sum, payment) => sum + payment.retention, 0);
  return [...advance, ...work, ...retentionReleases(plan, retained)].map((draft) => finish(draft, input));
}
