/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.5 — οι κινήσεις του παρόχου (νεότερες πρώτες) γράφονται ΧΡΟΝΟΛΟΓΙΚΑ, ώστε το ίχνος
 * (`PAYMENT_RECORDED` → `PAYMENT_REFUNDED`) να διαβάζεται όπως έγιναν.
 */

jest.mock('@/subapps/accounting/services/repository/accounting-repo-invoice-payments', () => ({ recordInvoicePayment: jest.fn() }));
jest.mock('@/server/payments/payment-checkout-store', () => ({ checkoutSubjectOf: jest.fn(), updatePaymentCheckout: jest.fn() }));

import type { ProviderMovement } from '@/server/payments/payment-provider';

import { chronologicalMovements } from '../invoice-payment-settlement-sync';

const movement = (kind: ProviderMovement['kind'], reference: string, occurredAt: string): ProviderMovement => ({
  kind, reference, amountMinor: 100, currency: 'EUR', occurredAt,
});

describe('chronologicalMovements', () => {
  it('νεότερα πρώτα από τον πάροχο ⇒ πληρωμή, μετά οι επιστροφές με τη σειρά τους', () => {
    const ordered = chronologicalMovements([
      movement('refund', 'ref_2', '2026-11-12T12:00:00Z'),
      movement('refund', 'ref_1', '2026-11-12T10:00:00Z'),
      movement('payment', 'pmt_1', '2026-11-11T10:00:00Z'),
    ]);
    expect(ordered.map((m) => m.reference)).toEqual(['pmt_1', 'ref_1', 'ref_2']);
  });

  it('ίδια στιγμή ⇒ η πληρωμή πριν από την επιστροφή', () => {
    const ordered = chronologicalMovements([
      movement('refund', 'ref_1', '2026-11-11T10:00:00Z'),
      movement('payment', 'pmt_1', '2026-11-11T10:00:00Z'),
    ]);
    expect(ordered.map((m) => m.kind)).toEqual(['payment', 'refund']);
  });

  it('στιγμή που δεν διαβάζεται ⇒ στο τέλος· η είσοδος δεν αλλάζει', () => {
    const input = [movement('refund', 'ref_x', 'χθες'), movement('payment', 'pmt_1', '2026-11-11T10:00:00Z')];
    expect(chronologicalMovements(input).map((m) => m.reference)).toEqual(['pmt_1', 'ref_x']);
    expect(input[0].reference).toBe('ref_x');
  });
});
