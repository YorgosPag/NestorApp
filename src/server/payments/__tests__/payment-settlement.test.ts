/**
 * @jest-environment node
 *
 * ADR-943 Φ5 (Ζ-6 · Ζ-7) — ο ΕΝΑΣ εκτελεστής κρατημένων χρημάτων: η εντολή γράφεται πριν από τα χρήματα, ο τομέας
 * ξαναρωτιέται, η σειρά είναι αντιλογισμός → επιστροφή → αποδέσμευση, και η εντολή μένει όταν κάτι αποτύχει.
 */

import type { PayeeTransfer, MarketplaceCapability } from '../payment-marketplace';
import type { PaymentProvider } from '../payment-provider';
import { executeSettlement, scheduleSettlement, sweepDueSettlements } from '../payment-settlement';
import { advanceCheckoutDoc, EMPTY_MARKETPLACE, fakeCheckoutDb, type Doc } from './checkout-fake-firestore.fixture';

jest.mock('../payable-subject-registry', () => ({
  judgePayableSettlement: jest.fn(),
  recordPayableSettlement: jest.fn(async () => undefined),
}));

const registry = jest.requireMock('../payable-subject-registry') as { judgePayableSettlement: jest.Mock; recordPayableSettlement: jest.Mock };

const NOW_MS = Date.parse('2026-11-19T10:00:00.000Z');
const DUE = '2026-11-19T09:00:00.000Z';

const RELEASE_ALL = { refundMinor: 0, releaseMinor: 4000, basis: 'window-elapsed', dueAt: DUE } as const;
const HELD: Doc = { ...EMPTY_MARKETPLACE, transferReference: 'trn_1' };

function transferOf(overrides: Partial<PayeeTransfer> = {}): PayeeTransfer {
  return {
    reference: 'trn_1', paymentReference: 'pmt_1', payeeReference: 'sel_1', amountMinor: 4000, commissionMinor: 0,
    held: true, paidOut: false, reversedMinor: 0, ...overrides,
  };
}

function marketplaceMock(transfer: PayeeTransfer = transferOf()) {
  const calls: string[] = [];
  const capability = {
    readTransfer: jest.fn(async () => transfer),
    reconcileTransferReversal: jest.fn(async () => { calls.push('reversal'); return { applied: true, reference: 'rev_1', amountMinor: 1000 }; }),
    reconcilePaymentRefund: jest.fn(async () => { calls.push('refund'); return { applied: true, reference: 'ref_1', amountMinor: 1000 }; }),
    releaseTransfer: jest.fn(async () => { calls.push('release'); return { ...transfer, held: false }; }),
  };
  const provider = { id: 'everypay', marketplace: capability as unknown as MarketplaceCapability } as unknown as PaymentProvider;
  return { capability, provider, calls };
}

beforeEach(() => {
  registry.judgePayableSettlement.mockReset().mockResolvedValue('proceed');
  registry.recordPayableSettlement.mockClear();
});

describe('scheduleSettlement — η εντολή πριν από τα χρήματα', () => {
  it('γράφεται όταν τα ποσά καλύπτουν ακριβώς τη συνεδρία· η ίδια ξανά ⇒ unchanged', async () => {
    const { db, read } = fakeCheckoutDb(advanceCheckoutDoc(HELD));
    await expect(scheduleSettlement(db, 'pchk_1', RELEASE_ALL, NOW_MS)).resolves.toBe('scheduled');
    expect((read()?.marketplace as Doc).settlement).toEqual(RELEASE_ALL);
    await expect(scheduleSettlement(db, 'pchk_1', RELEASE_ALL, NOW_MS)).resolves.toBe('unchanged');
  });

  it('ποσά που δεν καλύπτουν τη συνεδρία ⇒ refused (κανένα χρήμα «στη μέση»)', async () => {
    const { db, read } = fakeCheckoutDb(advanceCheckoutDoc(HELD));
    await expect(scheduleSettlement(db, 'pchk_1', { ...RELEASE_ALL, releaseMinor: 3000 }, NOW_MS)).resolves.toBe('refused');
    expect((read()?.marketplace as Doc).settlement).toBeNull();
  });

  it('κίνηση σε εξέλιξη (ζωντανή μίσθωση) ⇒ busy', async () => {
    const lease = { holder: 'ptls_other', until: new Date(NOW_MS + 60_000).toISOString() };
    const { db } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, lease }));
    await expect(scheduleSettlement(db, 'pchk_1', RELEASE_ALL, NOW_MS)).resolves.toBe('busy');
  });
});

describe('executeSettlement — ο εκτελεστής', () => {
  it('αποδέσμευση: ο τομέας ρωτιέται, η μεταφορά ελευθερώνεται, η αλήθεια γράφεται, η εντολή σβήνει', async () => {
    const { db, read } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: RELEASE_ALL }));
    const { provider, capability, calls } = marketplaceMock();
    await expect(executeSettlement(db, provider, 'pchk_1', NOW_MS)).resolves.toBe('settled');
    expect(calls).toEqual(['release']);
    expect(capability.reconcilePaymentRefund).not.toHaveBeenCalled();
    expect(registry.recordPayableSettlement).toHaveBeenCalledWith(expect.objectContaining({ checkoutId: 'pchk_1' }), RELEASE_ALL, provider, 'trn_1');
    expect(read()?.marketplace).toEqual({ ...HELD, settlement: null, lease: null });
  });

  it('διαίρεση: ΑΝΤΙΛΟΓΙΣΜΟΣ → ΕΠΙΣΤΡΟΦΗ → ΑΠΟΔΕΣΜΕΥΣΗ, με δηλωτικά σύνολα', async () => {
    const split = { ...RELEASE_ALL, refundMinor: 1000, releaseMinor: 3000 };
    const { db } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: split }));
    const { provider, capability, calls } = marketplaceMock();
    await expect(executeSettlement(db, provider, 'pchk_1', NOW_MS)).resolves.toBe('settled');
    expect(calls).toEqual(['reversal', 'refund', 'release']);
    expect(capability.reconcileTransferReversal).toHaveBeenCalledWith({ transferReference: 'trn_1', reversedTotalMinor: 1000, description: 'pchk_1' });
    expect(capability.reconcilePaymentRefund).toHaveBeenCalledWith({ paymentReference: 'pmt_1', refundedTotalMinor: 1000 });
  });

  it('ο τομέας λέει «όχι πια» (π.χ. αντίρρηση) ⇒ voided: καμία κίνηση, η εντολή σβήνει', async () => {
    registry.judgePayableSettlement.mockResolvedValue('void');
    const { db, read } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: RELEASE_ALL }));
    const { provider, calls } = marketplaceMock();
    await expect(executeSettlement(db, provider, 'pchk_1', NOW_MS)).resolves.toBe('voided');
    expect(calls).toEqual([]);
    expect((read()?.marketplace as Doc).settlement).toBeNull();
  });

  it('ο τομέας δεν κρίνεται ⇒ held: καμία κίνηση, η εντολή ΜΕΝΕΙ, η μίσθωση φεύγει', async () => {
    registry.judgePayableSettlement.mockResolvedValue('hold');
    const { db, read } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: RELEASE_ALL }));
    const { provider, calls } = marketplaceMock();
    await expect(executeSettlement(db, provider, 'pchk_1', NOW_MS)).resolves.toBe('held');
    expect(calls).toEqual([]);
    expect(read()?.marketplace).toEqual({ ...HELD, settlement: RELEASE_ALL, lease: null });
  });

  it('πριν από την ώρα της ⇒ not-due· χωρίς μεταφορά ακόμη ⇒ awaiting-transfer· χωρίς εντολή ⇒ nothing', async () => {
    const { provider } = marketplaceMock();
    const early = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: { ...RELEASE_ALL, dueAt: '2026-11-20T09:00:00.000Z' } }));
    await expect(executeSettlement(early.db, provider, 'pchk_1', NOW_MS)).resolves.toBe('not-due');
    const untransferred = fakeCheckoutDb(advanceCheckoutDoc({ ...EMPTY_MARKETPLACE, settlement: RELEASE_ALL }));
    await expect(executeSettlement(untransferred.db, provider, 'pchk_1', NOW_MS)).resolves.toBe('awaiting-transfer');
    await expect(executeSettlement(fakeCheckoutDb(advanceCheckoutDoc(HELD)).db, provider, 'pchk_1', NOW_MS)).resolves.toBe('nothing');
    expect(registry.judgePayableSettlement).not.toHaveBeenCalled();
  });

  it('βλάβη παρόχου ⇒ ρίχνει· η εντολή ΜΕΝΕΙ και η μίσθωση φεύγει (το cron ξαναδοκιμάζει)', async () => {
    const { db, read } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: RELEASE_ALL }));
    const { provider, capability } = marketplaceMock();
    capability.releaseTransfer.mockRejectedValue(new Error('provider down'));
    await expect(executeSettlement(db, provider, 'pchk_1', NOW_MS)).rejects.toThrow('provider down');
    expect(read()?.marketplace).toEqual({ ...HELD, settlement: RELEASE_ALL, lease: null });
    expect(registry.recordPayableSettlement).not.toHaveBeenCalled();
  });

  it('επιστροφή από μεταφορά που ήδη πληρώθηκε στον δικαιούχο ⇒ σφάλμα προς άνθρωπο, καμία κίνηση', async () => {
    const split = { ...RELEASE_ALL, refundMinor: 1000, releaseMinor: 3000 };
    const { db } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: split }));
    const { provider, calls } = marketplaceMock(transferOf({ paidOut: true }));
    await expect(executeSettlement(db, provider, 'pchk_1', NOW_MS)).rejects.toThrow('needs a human');
    expect(calls).toEqual([]);
  });

  it('ζωντανή ξένη μίσθωση ⇒ busy, καμία κρίση, καμία κίνηση', async () => {
    const lease = { holder: 'ptls_other', until: new Date(NOW_MS + 60_000).toISOString() };
    const { db } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: RELEASE_ALL, lease }));
    const { provider, calls } = marketplaceMock();
    await expect(executeSettlement(db, provider, 'pchk_1', NOW_MS)).resolves.toBe('busy');
    expect(calls).toEqual([]);
    expect(registry.judgePayableSettlement).not.toHaveBeenCalled();
  });
});

describe('sweepDueSettlements — το cron', () => {
  it('κάθε εντολή που οφείλεται ⇒ ο ίδιος εκτελεστής· η αναφορά μετρά κάθε κάδο', async () => {
    const { db } = fakeCheckoutDb(advanceCheckoutDoc({ ...HELD, settlement: RELEASE_ALL }));
    const { provider } = marketplaceMock();
    await expect(sweepDueSettlements(db, () => provider, NOW_MS)).resolves.toEqual({
      considered: 1, settled: 1, voided: 0, waiting: 0, failed: 0, truncated: false,
    });
  });
});
