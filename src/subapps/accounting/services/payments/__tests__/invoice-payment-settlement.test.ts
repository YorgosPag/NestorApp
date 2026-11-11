/**
 * ADR-ACC-030 — η ΜΙΑ καθαρή συνάρτηση εξόφλησης: `totalPaid` / `balanceDue` / `paymentStatus` από τις κινήσεις.
 */

import type { InvoicePayment } from '../../../types/invoice';
import {
  hasInvoicePayment,
  initialInvoicePaymentState,
  settleInvoicePayments,
} from '../invoice-payment-settlement';

function movement(amount: number, overrides: Partial<InvoicePayment> = {}): InvoicePayment {
  return { paymentId: `ipay_${amount}`, date: '2026-11-11', amount, method: 'card', notes: null, ...overrides };
}

describe('settleInvoicePayments', () => {
  it('νέο παραστατικό: ανεξόφλητο, οφείλεται όλο το ποσό', () => {
    expect(initialInvoicePaymentState(124)).toEqual({ payments: [], totalPaid: 0, balanceDue: 124, paymentStatus: 'unpaid' });
  });

  it('μερική πληρωμή ⇒ partial με σωστό υπόλοιπο', () => {
    const state = settleInvoicePayments(124, [movement(24)]);
    expect(state).toMatchObject({ totalPaid: 24, balanceDue: 100, paymentStatus: 'partial' });
  });

  it('δύο πληρωμές που καλύπτουν το σύνολο ⇒ paid, υπόλοιπο 0 (χωρίς σφάλμα δεκαδικών)', () => {
    const state = settleInvoicePayments(0.3, [movement(0.1, { paymentId: 'a' }), movement(0.2, { paymentId: 'b' })]);
    expect(state).toMatchObject({ totalPaid: 0.3, balanceDue: 0, paymentStatus: 'paid' });
  });

  it('υπερπληρωμή ⇒ paid, το υπόλοιπο δεν γίνεται αρνητικό', () => {
    expect(settleInvoicePayments(100, [movement(120)])).toMatchObject({ totalPaid: 120, balanceDue: 0, paymentStatus: 'paid' });
  });

  it('επιστροφή αφαιρεί από το εισπραγμένο — η πληρωμή μένει στο ιστορικό', () => {
    const state = settleInvoicePayments(100, [movement(100), movement(40, { paymentId: 'r', kind: 'refund' })]);
    expect(state).toMatchObject({ totalPaid: 60, balanceDue: 40, paymentStatus: 'partial' });
    expect(state.payments).toHaveLength(2);
  });

  it('πλήρης επιστροφή ⇒ ξανά ανεξόφλητο', () => {
    const state = settleInvoicePayments(100, [movement(100), movement(100, { paymentId: 'r', kind: 'refund' })]);
    expect(state).toMatchObject({ totalPaid: 0, balanceDue: 100, paymentStatus: 'unpaid' });
  });

  it('κινήσεις πριν το ADR-ACC-030 (χωρίς `kind`) μετρούν ως πληρωμές', () => {
    const legacy: InvoicePayment = { paymentId: 'old', date: '2026-01-01', amount: 50, method: 'bank_transfer', notes: null };
    expect(settleInvoicePayments(100, [legacy]).totalPaid).toBe(50);
  });

  it('δεν μεταλλάσσει τον πίνακα εισόδου', () => {
    const input = [movement(10)];
    const state = settleInvoicePayments(100, input);
    expect(state.payments).not.toBe(input);
  });
});

describe('hasInvoicePayment', () => {
  it('βρίσκει ήδη καταγεγραμμένη κίνηση με το ίδιο paymentId', () => {
    expect(hasInvoicePayment({ payments: [movement(10, { paymentId: 'ipay_x' })] }, 'ipay_x')).toBe(true);
    expect(hasInvoicePayment({ payments: [] }, 'ipay_x')).toBe(false);
  });
});
