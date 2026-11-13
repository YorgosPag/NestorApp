/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.6 — η έκβαση απόπειρας για τη δημόσια σελίδα: μόνο για απόπειρα του ΙΔΙΟΥ συνδέσμου, και η
 * κατάσταση νικά πάντα την προηγούμενη άρνηση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { attemptExpiresInMs, paymentAttemptOutcomeOf, readInvoicePaymentAttempt } from '../invoice-payment-attempt';

const FAILURE = { code: 'authorization-failed', providerCode: null, at: '2026-11-12T20:00:00.000Z' } as const;

function checkoutDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyId: 'comp_1', invoiceId: 'inv_1', shareId: 'share_1', provider: 'everypay', method: 'iris',
    amountMinor: 1240, currency: 'EUR', status: 'pending', createdAt: '2026-11-12T19:50:00.000Z',
    expiresAt: '2026-11-12T20:20:00.000Z', ...overrides,
  };
}

function fakeDb(docs: Record<string, Record<string, unknown>>): Firestore {
  const db = {
    collection: () => ({
      doc: (id: string) => ({ get: async () => ({ id, exists: id in docs, data: () => docs[id] }) }),
    }),
  };
  return db as unknown as Firestore;
}

describe('paymentAttemptOutcomeOf', () => {
  it('ανοιχτή χωρίς άρνηση ⇒ pending· ανοιχτή με άρνηση ⇒ failed', () => {
    expect(paymentAttemptOutcomeOf({ status: 'pending', lastFailure: null })).toBe('pending');
    expect(paymentAttemptOutcomeOf({ status: 'pending', lastFailure: FAILURE })).toBe('failed');
  });

  it('πληρωμένη ⇒ paid ΑΚΟΜΗ κι αν προηγήθηκε άρνηση (η κατάσταση νικά)', () => {
    expect(paymentAttemptOutcomeOf({ status: 'paid', lastFailure: FAILURE })).toBe('paid');
  });

  it.each(['failed', 'expired', 'canceled'] as const)('%s ⇒ closed', (status) => {
    expect(paymentAttemptOutcomeOf({ status, lastFailure: null })).toBe('closed');
  });
});

describe('attemptExpiresInMs — η αναμονή της σελίδας ακολουθεί τη λήξη του παρόχου (§5.6)', () => {
  const expiresAt = '2026-11-12T20:20:00.000Z';
  it('πριν από τη λήξη ⇒ ό,τι μένει· μετά ⇒ 0· άκυρη λήξη ⇒ 0', () => {
    expect(attemptExpiresInMs({ expiresAt }, Date.parse(expiresAt) - 35 * 60_000)).toBe(35 * 60_000);
    expect(attemptExpiresInMs({ expiresAt }, Date.parse(expiresAt) + 1_000)).toBe(0);
    expect(attemptExpiresInMs({ expiresAt: 'not-a-date' }, 0)).toBe(0);
  });
});

describe('readInvoicePaymentAttempt', () => {
  const db = fakeDb({ pchk_1: checkoutDoc({ lastFailure: FAILURE }) });
  const nowMs = Date.parse('2026-11-12T20:10:00.000Z');

  it('απόπειρα του ίδιου συνδέσμου ⇒ η έκβαση και ό,τι μένει ως τη λήξη (τίποτα άλλο)', async () => {
    await expect(readInvoicePaymentAttempt(db, { shareId: 'share_1', checkoutId: 'pchk_1', nowMs }))
      .resolves.toEqual({ status: 'ok', attempt: 'failed', expiresInMs: 10 * 60_000 });
  });

  it('απόπειρα ΑΛΛΟΥ συνδέσμου ⇒ ίδια άρνηση με την ανύπαρκτη (κανένα μαντείο ύπαρξης)', async () => {
    const foreign = await readInvoicePaymentAttempt(db, { shareId: 'share_2', checkoutId: 'pchk_1', nowMs });
    const absent = await readInvoicePaymentAttempt(db, { shareId: 'share_1', checkoutId: 'pchk_404', nowMs });
    expect(foreign).toEqual({ status: 'refused', reason: 'unknown-attempt' });
    expect(absent).toEqual(foreign);
  });
});
