/**
 * @fileoverview **Επικύρωση σχεδίου πληρωμών** — τρεις άξονες + κράτηση (ADR-928 §5.4.1).
 * @module subapps/procurement/subcontracts/terms/validate-payment-plan
 *
 * Ό,τι ο τύπος δεν λέει: μερίδια πληρωμής και δόσεις κράτησης = ακριβώς 100% · επιταγή **μόνο** με ημέρες λήξης ·
 * επανάληψη ≥ 1 · ημέρες μήνα 1..31 · ορόσημα με κλειδί. Το νόμιμο ή όχι των μετρητών **δεν** κρίνεται εδώ (§4: η
 * εφαρμογή προειδοποιεί, δεν αποφασίζει νομικά) — το όριο είναι παράμετρος της εταιρείας.
 */

import { ISO_WEEKDAYS } from '@/lib/calendar/weekly-hours';
import { isMinorAmount } from '@/lib/money/money';
import { isBasisPoints } from '@/lib/pricing/discount-rule';
import { joinPath, type SubcontractIssue } from '../clauses/clause-issues';
import { validateShares } from '../shares/validate-shares';
import {
  HOLIDAY_SHIFTS,
  PAYMENT_BASES,
  RECURRENCE_UNITS,
  SETTLEMENT_INSTRUMENTS,
  type PaymentPlan,
  type PaymentSchedule,
  type RetentionTerms,
  type SettlementShare,
} from '../types/payment-plan';

const MILESTONE_KEY = /^[a-z][a-z0-9_.]{0,63}$/;
const isPositiveInt = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) > 0;
const issueAt = (path: string): SubcontractIssue[] => [{ code: 'scheduleInvalid', path }];

export function validateRetention(retention: RetentionTerms, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!isBasisPoints(retention.rate)) issues.push({ code: 'shareInvalid', path: joinPath(path, 'rate') });
  issues.push(...validateShares(retention.release.map((installment) => installment.share), joinPath(path, 'release'), { allowEmpty: false }));
  retention.release.forEach((installment, index) => {
    if (installment.trigger.kind === 'months_after' && !isPositiveInt(installment.trigger.months)) {
      issues.push(...issueAt(joinPath(path, 'release', index, 'trigger')));
    }
  });
  return issues;
}

function scheduleIssues(schedule: PaymentSchedule, path: string): SubcontractIssue[] {
  if (schedule.kind !== 'recurring') return [];
  const issues: SubcontractIssue[] = [];
  if (!isPositiveInt(schedule.every) || !RECURRENCE_UNITS.includes(schedule.unit)) issues.push(...issueAt(joinPath(path, 'every')));
  if (!HOLIDAY_SHIFTS.includes(schedule.holidayShift)) issues.push(...issueAt(joinPath(path, 'holidayShift')));
  const anchor = schedule.anchor;
  const anchorOk = anchor.kind === 'start_date'
    || (anchor.kind === 'weekday' && ISO_WEEKDAYS.includes(anchor.weekday))
    || (anchor.kind === 'month_days' && anchor.days.length > 0 && anchor.days.every((day) => Number.isInteger(day) && day >= 1 && day <= 31));
  if (!anchorOk) issues.push(...issueAt(joinPath(path, 'anchor')));
  return issues;
}

function settlementIssues(shares: readonly SettlementShare[], path: string): SubcontractIssue[] {
  const issues = validateShares(shares.map((share) => share.share), path, { allowEmpty: false });
  shares.forEach((share, index) => {
    const isCheque = share.instrument === 'cheque';
    const maturityOk = isCheque ? isPositiveInt(share.chequeMaturityDays) : share.chequeMaturityDays === undefined;
    if (!SETTLEMENT_INSTRUMENTS.includes(share.instrument) || !maturityOk) issues.push(...issueAt(joinPath(path, index)));
  });
  return issues;
}

function milestoneAndAdvanceIssues(plan: PaymentPlan, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  plan.milestones.forEach((payment, index) => {
    const amountOk = payment.amount.kind === 'fixed' ? isMinorAmount(payment.amount.value) : isBasisPoints(payment.amount.value);
    if (!MILESTONE_KEY.test(payment.milestone) || !amountOk) issues.push(...issueAt(joinPath(path, 'milestones', index)));
  });
  const final = plan.finalSettlement;
  const finalOk = final.kind === 'final_acceptance'
    || (final.kind === 'milestone' && MILESTONE_KEY.test(final.milestone))
    || (final.kind === 'days_after_completion' && isPositiveInt(final.days));
  if (!finalOk) issues.push(...issueAt(joinPath(path, 'finalSettlement')));
  const advance = plan.advance;
  if (advance && (!isMinorAmount(advance.amount) || (advance.recovery.kind === 'per_payment' && !isBasisPoints(advance.recovery.rate)))) {
    issues.push(...issueAt(joinPath(path, 'advance')));
  }
  return issues;
}

export function validatePaymentPlan(plan: PaymentPlan, path: string): SubcontractIssue[] {
  const issues: SubcontractIssue[] = [];
  if (!PAYMENT_BASES.includes(plan.basis)) issues.push(...issueAt(joinPath(path, 'basis')));
  issues.push(...scheduleIssues(plan.schedule, joinPath(path, 'schedule')));
  issues.push(...settlementIssues(plan.settlement.regular, joinPath(path, 'settlement', 'regular')));
  if (plan.settlement.final) issues.push(...settlementIssues(plan.settlement.final, joinPath(path, 'settlement', 'final')));
  issues.push(...milestoneAndAdvanceIssues(plan, path));
  if (plan.retention) issues.push(...validateRetention(plan.retention, joinPath(path, 'retention')));
  return issues;
}
