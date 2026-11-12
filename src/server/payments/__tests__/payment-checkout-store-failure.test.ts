/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.3 — `lastFailure`: αρνημένη απόπειρα σημειώνεται **μόνο** σε ανοιχτή συνεδρία του ίδιου παρόχου,
 * χωρίς να αλλάξει κατάσταση (η συνεδρία μένει `pending` ώστε συμφιλίωση/κλείσιμο να μη χάσουν πληρωμή), ιδεμποτικά.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { checkoutRecordOf, recordCheckoutFailure } from '../payment-checkout-store';

const NOW = '2026-11-12T20:00:00.000Z';

function checkoutDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyId: 'comp_1', invoiceId: 'inv_1', shareId: 'share_1', provider: 'everypay', method: 'iris',
    amountMinor: 1240, currency: 'EUR', status: 'pending', providerReference: null, paymentReference: null,
    lastFailure: null, createdAt: '2026-11-12T19:50:00.000Z', expiresAt: '2026-11-12T20:20:00.000Z', ...overrides,
  };
}

/** Ελάχιστο Firestore μίας συλλογής: `doc().get()` + `runTransaction(tx.get / tx.update)`. */
function fakeDb(docs: Record<string, Record<string, unknown>>) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const refOf = (id: string) => ({
    id,
    get: async () => ({ id, exists: id in docs, data: () => docs[id] }),
  });
  const db = {
    collection: () => ({ doc: refOf }),
    runTransaction: async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work({
      get: (ref: ReturnType<typeof refOf>) => ref.get(),
      update: (ref: ReturnType<typeof refOf>, patch: Record<string, unknown>) => {
        updates.push({ id: ref.id, patch });
        docs[ref.id] = { ...docs[ref.id], ...patch };
      },
    }),
  };
  return { db: db as unknown as Firestore, updates };
}

const FAILURE = { code: 'authorization-failed', providerCode: '41001' } as const;

describe('recordCheckoutFailure', () => {
  it('ανοιχτή συνεδρία ⇒ γράφει lastFailure, ΔΕΝ αγγίζει status', async () => {
    const { db, updates } = fakeDb({ pchk_1: checkoutDoc() });
    await expect(recordCheckoutFailure(db, 'everypay', 'pchk_1', FAILURE, NOW)).resolves.toBe('failure-noted');
    expect(updates).toEqual([{ id: 'pchk_1', patch: { lastFailure: { ...FAILURE, at: NOW }, updatedAt: NOW } }]);
    expect(updates[0].patch).not.toHaveProperty('status');
  });

  it('η ίδια αποτυχία ξανά ⇒ unchanged, καμία εγγραφή (ιδεμποτία)', async () => {
    const { db, updates } = fakeDb({ pchk_1: checkoutDoc({ lastFailure: { ...FAILURE, at: NOW } }) });
    await expect(recordCheckoutFailure(db, 'everypay', 'pchk_1', FAILURE, NOW)).resolves.toBe('unchanged');
    expect(updates).toEqual([]);
  });

  it.each(['paid', 'expired', 'canceled', 'failed'])('συνεδρία %s ⇒ unchanged (η αλήθεια έχει προχωρήσει)', async (status) => {
    const { db, updates } = fakeDb({ pchk_1: checkoutDoc({ status }) });
    await expect(recordCheckoutFailure(db, 'everypay', 'pchk_1', FAILURE, NOW)).resolves.toBe('unchanged');
    expect(updates).toEqual([]);
  });

  it('ανύπαρκτη συνεδρία ⇒ unknown', async () => {
    const { db, updates } = fakeDb({});
    await expect(recordCheckoutFailure(db, 'everypay', 'pchk_x', FAILURE, NOW)).resolves.toBe('unknown');
    expect(updates).toEqual([]);
  });
});

describe('checkoutRecordOf — lastFailure', () => {
  it('έγκυρη ⇒ διαβάζεται· άκυρη μορφή ⇒ null (ποτέ «περίπου σωστή»)', () => {
    expect(checkoutRecordOf('pchk_1', checkoutDoc({ lastFailure: { ...FAILURE, at: NOW } }))?.lastFailure)
      .toEqual({ ...FAILURE, at: NOW });
    expect(checkoutRecordOf('pchk_1', checkoutDoc({ lastFailure: { code: 'other', at: NOW } }))?.lastFailure).toBeNull();
    expect(checkoutRecordOf('pchk_1', checkoutDoc({ lastFailure: { ...FAILURE, providerCode: 7, at: NOW } }))?.lastFailure)
      .toBeNull();
    expect(checkoutRecordOf('pchk_1', checkoutDoc({ lastFailure: undefined }))?.lastFailure).toBeNull();
  });
});
