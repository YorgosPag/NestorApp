import { projectPaymentSchedule, type PaymentProjectionInput } from '../payment-schedule-projection';
import type { PaymentPlan } from '../../types/payment-plan';
import { ADR_EXAMPLE_PLAN } from './document-fixtures';

const terms = { withholding: { applies: true, rate: 300 }, cashLimitPerPayment: 50_000 };

function input(plan: Partial<PaymentPlan>, patch: Partial<PaymentProjectionInput> = {}): PaymentProjectionInput {
  return { plan: { ...ADR_EXAMPLE_PLAN, advance: null, ...plan }, terms, value: 1_000_000, startDate: '2027-03-01', endDate: '2027-05-31', ...patch };
}

const work = (rows: ReturnType<typeof projectPaymentSchedule>) => rows.filter((row) => row.kind === 'periodic' || row.kind === 'final');

describe('projectPaymentSchedule', () => {
  it('λογαριασμοί ανά δύο εβδομάδες την Παρασκευή, και η εξόφληση κλείνει ακριβώς την αξία', () => {
    const rows = projectPaymentSchedule(input({}));
    const periodic = rows.filter((row) => row.kind === 'periodic');
    expect(periodic.map((row) => row.date)).toEqual(['2027-03-05', '2027-03-19', '2027-04-02', '2027-04-16', '2027-04-29', '2027-05-14', '2027-05-28']);
    expect(work(rows).reduce((sum, row) => sum + row.gross, 0)).toBe(1_000_000);
    expect(rows.find((row) => row.kind === 'final')?.date).toBeNull(); // ορόσημο ⇒ «με το συμβάν»
  });

  it('η αργία μετατοπίζεται στην προηγούμενη εργάσιμη (Μ. Παρασκευή 30/4/2027 → 29/4)', () => {
    const dates = projectPaymentSchedule(input({})).map((row) => row.date);
    expect(dates).toContain('2027-04-29');
    expect(dates).not.toContain('2027-04-30');
  });

  it('χωρίς κανόνα αργιών η ημερομηνία μένει', () => {
    const plan = input({ schedule: { kind: 'recurring', every: 2, unit: 'week', anchor: { kind: 'weekday', weekday: 5 }, holidayShift: 'none' } });
    expect(projectPaymentSchedule(plan).map((row) => row.date)).toContain('2027-04-30');
  });

  it('κράτηση και παρακράτηση αφαιρούνται, και η κράτηση επιστρέφει ολόκληρη στις δόσεις', () => {
    const rows = projectPaymentSchedule(input({}));
    const first = rows[0];
    expect(first.retention).toBe(Math.round((first.gross * 500) / 10_000));
    expect(first.withholding).toBe(Math.round((first.gross * 300) / 10_000));
    expect(first.net).toBe(first.gross - first.retention - first.withholding);
    const retained = work(rows).reduce((sum, row) => sum + row.retention, 0);
    const released = rows.filter((row) => row.kind === 'retention_release').reduce((sum, row) => sum + row.gross, 0);
    expect(released).toBe(retained);
  });

  it('μετρητά πάνω από το όριο ⇒ σημαία', () => {
    const rows = projectPaymentSchedule(input({ settlement: { regular: [{ instrument: 'cash', share: 10_000 }], final: null } }));
    expect(rows.some((row) => row.cashOverLimit)).toBe(true);
    expect(rows.filter((row) => row.cash > 0 && row.cash <= 50_000).every((row) => !row.cashOverLimit)).toBe(true);
  });

  it('τα μερίδια κάθε πληρωμής αθροίζουν ακριβώς το πληρωτέο', () => {
    for (const row of projectPaymentSchedule(input({}))) {
      expect(row.shares.reduce((sum, share) => sum + share.amount, 0)).toBe(row.net);
    }
  });

  it('προκαταβολή: πληρώνεται στην έναρξη και συμψηφίζεται ολόκληρη', () => {
    const rows = projectPaymentSchedule(input({ advance: { amount: 100_000, recovery: { kind: 'per_payment', rate: 2_000 } } }));
    expect(rows[0]).toMatchObject({ kind: 'advance', date: '2027-03-01', gross: 100_000, withholding: 0 });
    expect(rows.reduce((sum, row) => sum + row.advanceRecovery, 0)).toBe(100_000);
  });

  it('χωρίς επανάληψη: μία εξόφληση με όλη την αξία', () => {
    const rows = work(projectPaymentSchedule(input({ schedule: { kind: 'on_completion' } })));
    expect(rows).toHaveLength(1);
    expect(rows[0].gross).toBe(1_000_000);
  });

  it('ημέρες μήνα: στις 5 και στις 20, με εξόφληση 30 ημέρες μετά το πέρας', () => {
    const rows = projectPaymentSchedule(input({
      schedule: { kind: 'recurring', every: 1, unit: 'month', anchor: { kind: 'month_days', days: [5, 20] }, holidayShift: 'next_business_day' },
      finalSettlement: { kind: 'days_after_completion', days: 30 },
    }));
    expect(rows.filter((row) => row.kind === 'periodic').map((row) => row.date)).toEqual(['2027-03-05', '2027-03-22', '2027-04-05', '2027-04-20', '2027-05-05', '2027-05-20']);
    expect(rows.find((row) => row.kind === 'final')?.date).toBe('2027-06-30');
  });
});
