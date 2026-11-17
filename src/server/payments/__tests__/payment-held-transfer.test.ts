/**
 * @jest-environment node
 *
 * ADR-943 §5.9 · Δ-2 — η κρατημένη μεταφορά μετά την είσπραξη: **μία** μεταφορά, κρατημένη, χωρίς προμήθεια· μίσθωση
 * για ταυτόχρονους καλούντες· η οφειλή μένει γραμμένη όταν ο πάροχος αποτυγχάνει (το cron την ξαναπιάνει).
 */

import { ensureHeldTransfer, HELD_TRANSFER_POLICY, sweepHeldTransfers } from '../payment-held-transfer';
import { advanceCheckoutDoc, EMPTY_MARKETPLACE, fakeCheckoutDb, type Doc } from './checkout-fake-firestore.fixture';
import type { MarketplaceCapability, PayeeTransferTarget } from '../payment-marketplace';
import type { PaymentProvider } from '../payment-provider';

const NOW_MS = Date.parse('2026-11-17T10:00:00.000Z');

const fakeDb = fakeCheckoutDb;
const checkoutDoc = advanceCheckoutDoc;
const MARKETPLACE: Doc = EMPTY_MARKETPLACE;

function providerWith(ensureTransfer: jest.Mock): PaymentProvider {
  const marketplace = { ensureTransfer } as unknown as MarketplaceCapability;
  return { id: 'everypay', marketplace } as unknown as PaymentProvider;
}

const transferOk = () => jest.fn(async (target: PayeeTransferTarget) => ({
  reference: 'trn_1', paymentReference: target.paymentReference, payeeReference: target.payeeReference,
  amountMinor: target.amountMinor, commissionMinor: target.commissionMinor, held: target.hold, paidOut: false, reversedMinor: 0,
}));

const INPUT = { checkoutId: 'pchk_1', paymentReference: 'pmt_1', description: 'pchk_1', nowMs: NOW_MS };

describe('ensureHeldTransfer', () => {
  it('μία μεταφορά, ΚΡΑΤΗΜΕΝΗ, ολόκληρο το ποσό, προμήθεια 0 — η αναφορά γράφεται, η οφειλή σβήνει', async () => {
    const { db, read } = fakeDb(checkoutDoc(MARKETPLACE));
    const ensureTransfer = transferOk();
    await expect(ensureHeldTransfer(db, providerWith(ensureTransfer), INPUT)).resolves.toEqual({ kind: 'transferred', transferReference: 'trn_1' });
    expect(ensureTransfer).toHaveBeenCalledWith({
      paymentReference: 'pmt_1', payeeReference: 'sel_1', amountMinor: 4000, commissionMinor: 0, description: 'pchk_1', hold: true,
    });
    expect(HELD_TRANSFER_POLICY.commissionMinor).toBe(0);
    expect(read()?.marketplace).toEqual({ payeeReference: 'sel_1', transferReference: 'trn_1', transferDue: false, lease: null, settlement: null });
  });

  it('η μεταφορά υπάρχει ήδη ⇒ καμία κλήση στον πάροχο (webhook + cron + επιστροφή = μία μεταφορά)', async () => {
    const { db } = fakeDb(checkoutDoc({ ...MARKETPLACE, transferReference: 'trn_1' }));
    const ensureTransfer = transferOk();
    await expect(ensureHeldTransfer(db, providerWith(ensureTransfer), INPUT)).resolves.toEqual({ kind: 'transferred', transferReference: 'trn_1' });
    expect(ensureTransfer).not.toHaveBeenCalled();
  });

  it('ζωντανή ξένη μίσθωση ⇒ busy, καμία κλήση (ταυτόχρονος καλών)', async () => {
    const lease = { holder: 'ptls_other', until: new Date(NOW_MS + 60_000).toISOString() };
    const { db } = fakeDb(checkoutDoc({ ...MARKETPLACE, transferDue: true, lease }));
    const ensureTransfer = transferOk();
    await expect(ensureHeldTransfer(db, providerWith(ensureTransfer), INPUT)).resolves.toEqual({ kind: 'busy' });
    expect(ensureTransfer).not.toHaveBeenCalled();
  });

  it('μίσθωση που έληξε (κατάρρευση) ⇒ την παίρνει ο επόμενος — η δηλωτική πράξη κάνει τη δεύτερη απόπειρα ασφαλή', async () => {
    const lease = { holder: 'ptls_dead', until: new Date(NOW_MS - 1).toISOString() };
    const { db } = fakeDb(checkoutDoc({ ...MARKETPLACE, transferDue: true, lease }));
    const ensureTransfer = transferOk();
    await expect(ensureHeldTransfer(db, providerWith(ensureTransfer), INPUT)).resolves.toMatchObject({ kind: 'transferred' });
    expect(ensureTransfer).toHaveBeenCalledTimes(1);
  });

  it('βλάβη παρόχου ⇒ ρίχνει· η ΟΦΕΙΛΗ μένει γραμμένη και η μίσθωση φεύγει (το cron ξαναπιάνει αμέσως)', async () => {
    const { db, read } = fakeDb(checkoutDoc(MARKETPLACE));
    const ensureTransfer = jest.fn(async () => { throw new Error('provider down'); });
    await expect(ensureHeldTransfer(db, providerWith(ensureTransfer), INPUT)).rejects.toThrow('provider down');
    expect(read()?.marketplace).toEqual({ ...MARKETPLACE, transferDue: true, lease: null, settlement: null });
  });

  it('συνεδρία χωρίς κράτηση (τιμολόγιο) ή πάροχος χωρίς marketplace ⇒ not-applicable', async () => {
    const ensureTransfer = transferOk();
    await expect(ensureHeldTransfer(fakeDb({ ...checkoutDoc(null), subjectKind: 'invoice', invoiceId: 'inv_1', shareId: 's_1' }).db, providerWith(ensureTransfer), INPUT))
      .resolves.toEqual({ kind: 'not-applicable' });
    const noMarketplace = { id: 'everypay', marketplace: null } as unknown as PaymentProvider;
    await expect(ensureHeldTransfer(fakeDb(checkoutDoc(MARKETPLACE)).db, noMarketplace, INPUT)).resolves.toEqual({ kind: 'not-applicable' });
    expect(ensureTransfer).not.toHaveBeenCalled();
  });
});

describe('sweepHeldTransfers — το δίχτυ ασφαλείας', () => {
  it('οφειλόμενη μεταφορά ⇒ ο ίδιος δρόμος, με την πληρωμή της συνεδρίας', async () => {
    const { db } = fakeDb(checkoutDoc({ ...MARKETPLACE, transferDue: true }));
    const ensureTransfer = transferOk();
    const report = await sweepHeldTransfers(db, () => providerWith(ensureTransfer), NOW_MS);
    expect(report).toEqual({ considered: 1, transferred: 1, busy: 0, failed: 0, truncated: false });
    expect(ensureTransfer).toHaveBeenCalledWith(expect.objectContaining({ paymentReference: 'pmt_1', hold: true }));
  });

  it('βλάβη ⇒ μετριέται, δεν σταματά το πέρασμα', async () => {
    const { db } = fakeDb(checkoutDoc({ ...MARKETPLACE, transferDue: true }));
    const report = await sweepHeldTransfers(db, () => providerWith(jest.fn(async () => { throw new Error('x'); })), NOW_MS);
    expect(report).toMatchObject({ considered: 1, transferred: 0, failed: 1 });
  });
});
