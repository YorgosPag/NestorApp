/**
 * @fileoverview **Το σχέδιο πληρωμών σε ανθρώπινη γλώσσα** — από τα ίδια δεδομένα που υπολογίζουν τις πληρωμές
 *   (ADR-928 §5.4.1: «ώστε κείμενο και υπολογισμός να μη διαφωνούν ποτέ») · §5.17.
 * @module subapps/procurement/subcontracts/document/describe-payment-plan
 *
 * 🔑 Μία πρόταση ανά άξονα (τι · πότε · εξόφληση · με τι), μετά κράτηση, προκαταβολή, ορόσημα, όριο παραχθέντος.
 *    Οι λίστες ενώνονται με το `Intl.ListFormat` της γλώσσας («50% με τραπεζική μεταφορά και 50% με επιταγή 4 μηνών»).
 */

import type {
  FinalSettlementTrigger,
  PaymentPlan,
  PaymentSchedule,
  RetentionReleaseInstallment,
  SettlementShare,
} from '../types/payment-plan';
import type { DocumentLocale } from './document-locale';
import { milestoneLabel } from './render-parameter-value';

const WHOLE_SHARE = 10_000;
const DAYS_PER_MONTH = 30;

const sentence = (parts: readonly string[]): string => `${parts.join(', ')}.`;

function anchorText(schedule: Extract<PaymentSchedule, { kind: 'recurring' }>, locale: DocumentLocale): string {
  const { anchor } = schedule;
  if (anchor.kind === 'weekday') return locale.phrase(`parameter.onWeekday.${anchor.weekday}`);
  if (anchor.kind === 'start_date') return locale.phrase('plan.schedule.anchor.start_date');
  return locale.phrase('plan.schedule.anchor.month_days', { days: locale.list(anchor.days.map((day) => locale.number(day))) });
}

function scheduleSentence(schedule: PaymentSchedule, locale: DocumentLocale): string {
  if (schedule.kind !== 'recurring') return sentence([locale.phrase(`plan.schedule.${schedule.kind}`)]);
  const parts = [locale.phrase(`plan.schedule.every.${schedule.unit}`, { count: schedule.every }), anchorText(schedule, locale)];
  if (schedule.holidayShift !== 'none') parts.push(locale.phrase(`plan.schedule.holidayShift.${schedule.holidayShift}`));
  return sentence(parts);
}

function finalSentence(trigger: FinalSettlementTrigger, locale: DocumentLocale): string {
  if (trigger.kind === 'milestone') return sentence([locale.phrase('plan.final.milestone', { milestone: milestoneLabel(trigger.milestone, locale) })]);
  if (trigger.kind === 'days_after_completion') return sentence([locale.phrase('plan.final.days_after_completion', { days: trigger.days })]);
  return sentence([locale.phrase('plan.final.final_acceptance')]);
}

/** «με επιταγή 4 μηνών» από 120 ημέρες· μη πολλαπλάσιο του μήνα ⇒ σε ημέρες· χωρίς λήξη ⇒ όψεως. */
function chequeText(maturityDays: number | undefined, locale: DocumentLocale): string {
  if (!maturityDays) return locale.phrase('plan.settlement.chequeSight');
  if (maturityDays % DAYS_PER_MONTH === 0) return locale.phrase('plan.settlement.chequeMonths', { months: maturityDays / DAYS_PER_MONTH });
  return locale.phrase('plan.settlement.chequeDays', { days: maturityDays });
}

function instrumentText(share: SettlementShare, locale: DocumentLocale): string {
  return share.instrument === 'cheque' ? chequeText(share.chequeMaturityDays, locale) : locale.phrase(`plan.settlement.instrument.${share.instrument}`);
}

/** Τα μερίδια ως φράση· ένα μερίδιο 100% χωρίς ποσοστό («με τραπεζική μεταφορά»). */
export function describeShares(shares: readonly SettlementShare[], locale: DocumentLocale): string {
  if (shares.length === 1 && shares[0].share === WHOLE_SHARE) return locale.phrase('plan.settlement.whole', { instrument: instrumentText(shares[0], locale) });
  return locale.list(shares.map((share) => locale.phrase('plan.settlement.part', { share: locale.percent(share.share), instrument: instrumentText(share, locale) })));
}

function releaseText(installment: RetentionReleaseInstallment, locale: DocumentLocale): string {
  const share = locale.percent(installment.share);
  const { trigger } = installment;
  if (trigger.kind !== 'months_after') return locale.phrase(`plan.release.${trigger.kind}`, { share });
  const key = trigger.event === 'provisional_acceptance' ? 'months_after_provisional' : 'months_after_final';
  return locale.phrase(`plan.release.${key}`, { share, months: trigger.months });
}

function optionalSentences(plan: PaymentPlan, locale: DocumentLocale): string[] {
  const sentences: string[] = [];
  if (plan.retention) {
    const releases = locale.list(plan.retention.release.map((installment) => releaseText(installment, locale)));
    sentences.push(locale.phrase('plan.retention', { rate: locale.percent(plan.retention.rate), releases }));
  }
  if (plan.advance) {
    const { recovery } = plan.advance;
    const rate = recovery.kind === 'per_payment' ? locale.percent(recovery.rate) : '';
    sentences.push(locale.phrase(`plan.advance.${recovery.kind}`, { amount: locale.money(plan.advance.amount), rate }));
  }
  for (const milestone of plan.milestones) {
    const amount = milestone.amount.kind === 'fixed' ? locale.money(milestone.amount.value) : locale.percent(milestone.amount.value);
    sentences.push(locale.phrase('plan.milestone', { amount, milestone: milestoneLabel(milestone.milestone, locale) }));
  }
  if (plan.capAtEarnedValue) sentences.push(locale.phrase('plan.capAtEarnedValue'));
  return sentences;
}

/** Οι προτάσεις του σχεδίου πληρωμών, με σειρά ανάγνωσης. */
export function describePaymentPlan(plan: PaymentPlan, locale: DocumentLocale): string[] {
  const sentences = [
    locale.phrase(`plan.basis.${plan.basis}`),
    scheduleSentence(plan.schedule, locale),
    finalSentence(plan.finalSettlement, locale),
    locale.phrase('plan.settlement.regular', { shares: describeShares(plan.settlement.regular, locale) }),
  ];
  if (plan.settlement.final) sentences.push(locale.phrase('plan.settlement.final', { shares: describeShares(plan.settlement.final, locale) }));
  return [...sentences, ...optionalSentences(plan, locale)];
}
