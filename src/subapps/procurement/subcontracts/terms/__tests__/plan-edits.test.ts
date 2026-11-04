import { plasteringTerms } from '../../agreements/__tests__/agreement-fixtures';
import type { PaymentPlan } from '../../types/payment-plan';
import {
  anchorOfKind,
  finalSettlementOfKind,
  NEW_ADVANCE,
  NEW_RETENTION,
  parseDayList,
  releaseChoiceOf,
  RELEASE_CHOICES,
  scheduleOfKind,
  SCHEDULE_KINDS,
  triggerOfChoice,
  withInstrument,
} from '../plan-edits';
import { validatePaymentPlan } from '../validate-payment-plan';

const plan: PaymentPlan = plasteringTerms.paymentPlan;
const issuesOf = (next: PaymentPlan) => validatePaymentPlan(next, 'plan').map((issue) => `${issue.code}@${issue.path}`);

describe('plan-edits — κάθε αλλαγή είδους δίνει σχήμα που περνά τον επικυρωτή (ADR-928 Φ3γ-2)', () => {
  it('το σχέδιο-βάση περνά (αλλιώς τα παρακάτω δεν αποδεικνύουν τίποτα)', () => {
    expect(issuesOf(plan)).toEqual([]);
  });

  it.each(SCHEDULE_KINDS)('πρόγραμμα «%s»', (kind) => {
    const schedule = scheduleOfKind(kind, plan.schedule);
    expect(schedule.kind).toBe(kind);
    expect(issuesOf({ ...plan, schedule })).toEqual([]);
  });

  it.each(['start_date', 'weekday', 'month_days'] as const)('άγκυρα «%s»', (kind) => {
    const recurring = scheduleOfKind('recurring', { kind: 'on_request' });
    if (recurring.kind !== 'recurring') throw new Error('fixture');
    expect(issuesOf({ ...plan, schedule: { ...recurring, anchor: anchorOfKind(kind, recurring.anchor) } })).toEqual([]);
  });

  it.each(['final_acceptance', 'milestone', 'days_after_completion'] as const)('εξόφληση «%s»', (kind) => {
    expect(issuesOf({ ...plan, finalSettlement: finalSettlementOfKind(kind, plan.finalSettlement, 'structure') })).toEqual([]);
  });

  it('επιταγή ⇒ ημέρες λήξης· πίσω σε τράπεζα ⇒ το κλειδί ΦΕΥΓΕΙ (όχι undefined που μένει)', () => {
    const cheque = withInstrument({ instrument: 'bank_transfer', share: 10_000 }, 'cheque');
    expect(cheque).toEqual({ instrument: 'cheque', share: 10_000, chequeMaturityDays: 120 });
    const bank = withInstrument(cheque, 'bank_transfer');
    expect(Object.keys(bank)).toEqual(['instrument', 'share']);
    expect(issuesOf({ ...plan, settlement: { regular: [cheque], final: [bank] } })).toEqual([]);
  });

  it('νέα κράτηση και προκαταβολή: έγκυρες', () => {
    expect(issuesOf({ ...plan, retention: NEW_RETENTION, advance: NEW_ADVANCE })).toEqual([]);
  });

  it.each(RELEASE_CHOICES)('συμβάν απόδοσης «%s»: στρογγυλή διαδρομή, οι μήνες κρατιούνται', (choice) => {
    const trigger = triggerOfChoice(choice, { kind: 'months_after', event: 'final_acceptance', months: 6 });
    expect(releaseChoiceOf(trigger)).toBe(choice);
    if (trigger.kind === 'months_after') expect(trigger.months).toBe(6);
  });

  it('parseDayList: ό,τι δεν είναι αριθμός ΜΕΝΕΙ ως NaN και ο επικυρωτής το λέει', () => {
    expect(parseDayList('5, 20')).toEqual([5, 20]);
    expect(parseDayList(' 5 ;20 ')).toEqual([5, 20]);
    const days = parseDayList('5, x');
    expect(days[1]).toBeNaN();
    const recurring = scheduleOfKind('recurring', { kind: 'on_request' });
    if (recurring.kind !== 'recurring') throw new Error('fixture');
    expect(issuesOf({ ...plan, schedule: { ...recurring, anchor: { kind: 'month_days', days } } })).toEqual(['scheduleInvalid@plan.schedule.anchor']);
  });
});
