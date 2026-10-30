/**
 * ADR-234 — η μετάπτωση «λήξη δόσης ως ημέρα»: ίδιος κανόνας με τους αναγνώστες (`installmentDueDay`), ιδεμποτική,
 * αγγίζει μόνο το `dueDate`, και μη αναγνώσιμη λήξη ⇒ αναφορά, ποτέ εικασία.
 */

import { planInstallmentDueDays } from '../migrations/backfill-installment-due-day';

const base = { label: 'Κράτηση', amount: 1000, paidAmount: 250, status: 'partial', paymentIds: ['pay_1'] };

describe('planInstallmentDueDays', () => {
  it('παλιές στιγμές ⇒ η ημέρα τους στην Αθήνα (wizard 01:30 τοπικά · φόρμα μεσάνυχτα UTC)', () => {
    const plan = planInstallmentDueDays({
      installments: [
        { ...base, dueDate: '2026-11-04T23:30:00.000Z' },
        { ...base, dueDate: '2026-12-05T00:00:00.000Z' },
      ],
    });
    expect(plan).toEqual({
      kind: 'write',
      converted: 2,
      installments: [
        { ...base, dueDate: '2026-11-05' },
        { ...base, dueDate: '2026-12-05' },
      ],
    });
  });

  it('αλλάζει ΜΟΝΟ το dueDate — ποσά, κατάσταση, πληρωμές αυτούσια', () => {
    const plan = planInstallmentDueDays({ installments: [{ ...base, dueDate: '2026-11-04T23:30:00.000Z' }] });
    expect(plan.kind === 'write' && plan.installments[0]).toEqual({ ...base, dueDate: '2026-11-05' });
  });

  it('ανάμεικτο πλάνο: μετρά μόνο όσες μετατρέπονται, οι ημέρες μένουν ως έχουν', () => {
    const plan = planInstallmentDueDays({
      installments: [{ ...base, dueDate: '2026-10-01' }, { ...base, dueDate: '2026-11-04T23:30:00.000Z' }],
    });
    expect(plan.kind === 'write' && plan.converted).toBe(1);
  });

  it('ιδεμποτική: όλες ήδη ημέρες ⇒ καμία εγγραφή', () => {
    expect(planInstallmentDueDays({ installments: [{ ...base, dueDate: '2026-11-05' }] })).toEqual({ kind: 'noop' });
  });

  it('χωρίς δόσεις / χωρίς πίνακα ⇒ καμία εγγραφή', () => {
    expect(planInstallmentDueDays({ installments: [] })).toEqual({ kind: 'noop' });
    expect(planInstallmentDueDays({})).toEqual({ kind: 'noop' });
  });

  it('μη αναγνώσιμη λήξη ⇒ ΑΝΑΦΟΡΑ με τους δείκτες, το πλάνο δεν αγγίζεται (ούτε οι αναγνώσιμες)', () => {
    const plan = planInstallmentDueDays({
      installments: [
        { ...base, dueDate: '2026-11-04T23:30:00.000Z' },
        { ...base, dueDate: '2027-02-30' },
        { ...base },
      ],
    });
    expect(plan).toEqual({ kind: 'unresolved', indexes: [1, 2] });
  });
});
