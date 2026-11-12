/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.5 — συμφιλίωση επιστροφών: επιστροφή με χαμένο webhook σε ήδη `paid` συνεδρία ανακτάται από τη
 * λίστα κινήσεων του παρόχου, μέσα από τον ΙΔΙΟ συγχρονισμό με το webhook.
 */

const findMock = jest.fn();
jest.mock('@/server/payments/payment-checkout-store', () => ({
  findPaymentCheckoutBy: (...args: unknown[]) => findMock(...args),
}));

const syncMock = jest.fn();
jest.mock('../invoice-payment-settlement-sync', () => ({
  syncCheckoutSettlement: (...args: unknown[]) => syncMock(...args),
}));

const listMock = jest.fn();
const provider = { id: 'everypay', listRecentlyRefundedPayments: (...args: unknown[]) => listMock(...args) };
let configured = true;
jest.mock('@/server/payments/payment-provider-registry', () => ({
  paymentProviderById: () => (configured ? provider : null),
}));

import { REFUND_LOOKBACK_MS, REFUND_RECONCILE_BATCH, reconcileRecentRefunds } from '../payment-refund-reconcile.service';

const db = {} as never;
const NOW = Date.parse('2026-11-13T12:00:00.000Z');

beforeEach(() => {
  configured = true;
  findMock.mockReset().mockImplementation(async (_db: unknown, _p: unknown, _f: unknown, ref: string) => (
    ref === 'pmt_foreign' ? null : { checkoutId: `pchk_${ref}`, paymentReference: ref }
  ));
  syncMock.mockReset().mockResolvedValue('unchanged');
  listMock.mockReset().mockResolvedValue([]);
});

describe('reconcileRecentRefunds', () => {
  it('ρωτά τον πάροχο από τώρα − παράθυρο, και συγχρονίζει κάθε δική μας πληρωμή', async () => {
    listMock.mockResolvedValue(['pmt_1', 'pmt_2', 'pmt_foreign']);
    syncMock.mockResolvedValueOnce('recorded').mockResolvedValueOnce('unchanged');
    const report = await reconcileRecentRefunds(db, NOW);
    expect(listMock).toHaveBeenCalledWith(new Date(NOW - REFUND_LOOKBACK_MS).toISOString());
    expect(findMock).toHaveBeenCalledWith(db, 'everypay', 'paymentReference', 'pmt_1');
    expect(syncMock).toHaveBeenCalledTimes(2);
    expect(report).toEqual({ checked: 3, recorded: 1, unmatched: 1, failed: 0, truncated: false });
  });

  it('ξένη πληρωμή (καμία δική μας συνεδρία) ⇒ unmatched, κανένας συγχρονισμός', async () => {
    listMock.mockResolvedValue(['pmt_foreign']);
    const report = await reconcileRecentRefunds(db, NOW);
    expect(syncMock).not.toHaveBeenCalled();
    expect(report.unmatched).toBe(1);
  });

  it('σφάλμα συγχρονισμού μιας πληρωμής ⇒ failed, οι υπόλοιπες συνεχίζουν', async () => {
    listMock.mockResolvedValue(['pmt_1', 'pmt_2']);
    syncMock.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce('recorded');
    await expect(reconcileRecentRefunds(db, NOW)).resolves.toEqual({
      checked: 2, recorded: 1, unmatched: 0, failed: 1, truncated: false,
    });
  });

  it('τιμολόγιο που λείπει ⇒ failed (θέλει άνθρωπο), όχι «ενημερωμένο»', async () => {
    listMock.mockResolvedValue(['pmt_1']);
    syncMock.mockResolvedValue('invoice-absent');
    await expect(reconcileRecentRefunds(db, NOW)).resolves.toMatchObject({ failed: 1, recorded: 0 });
  });

  it('σφάλμα της λίστας ⇒ failed, κανένα checked, καμία εξαίρεση προς το cron', async () => {
    listMock.mockRejectedValue(new Error('502'));
    await expect(reconcileRecentRefunds(db, NOW)).resolves.toEqual({
      checked: 0, recorded: 0, unmatched: 0, failed: 1, truncated: false,
    });
  });

  it('πάνω από το όριο ⇒ μόνο το όριο, με σημαία truncated', async () => {
    listMock.mockResolvedValue(Array.from({ length: REFUND_RECONCILE_BATCH + 5 }, (_, i) => `pmt_${i}`));
    const report = await reconcileRecentRefunds(db, NOW);
    expect(syncMock).toHaveBeenCalledTimes(REFUND_RECONCILE_BATCH);
    expect(report).toMatchObject({ checked: REFUND_RECONCILE_BATCH, truncated: true });
  });

  it('μη ρυθμισμένος πάροχος ⇒ τίποτα', async () => {
    configured = false;
    await expect(reconcileRecentRefunds(db, NOW)).resolves.toEqual({
      checked: 0, recorded: 0, unmatched: 0, failed: 0, truncated: false,
    });
    expect(listMock).not.toHaveBeenCalled();
  });
});
