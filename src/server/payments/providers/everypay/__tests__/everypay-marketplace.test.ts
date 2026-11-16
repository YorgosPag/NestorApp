/**
 * @jest-environment node
 *
 * ADR-943 §5.7 — EveryPay Marketplace: αναγνώστες (κανένα «εξουσιοδοτημένος» από ελλιπή δεδομένα), webhook KYC ⇒ σήμα,
 * και **δηλωτικές** πράξεις χρημάτων — δεύτερη εκτέλεση = καμία κίνηση (ο πάροχος δεν έχει κλειδί ιδεμποτίας).
 */

import { createHmac } from 'crypto';

import { createEverypayProvider } from '../everypay-adapter';
import { EVERYPAY_ENDPOINTS, type EverypayCredentials } from '../everypay-config';
import { createEverypayMarketplace } from '../everypay-marketplace';
import { payeeAccountOf, payeeKycStatusOf, payeeTransferOf, sellerKycEventOf } from '../everypay-marketplace-readers';

const credentials: EverypayCredentials = {
  mode: 'sandbox', secretKey: 'sk_test', publicKey: 'pk_test', endpoints: EVERYPAY_ENDPOINTS.sandbox, marketplace: true,
};

function marketplace() {
  const capability = createEverypayMarketplace(credentials);
  if (capability === null) throw new Error('marketplace must be enabled in this suite');
  return capability;
}

const respond = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

interface SentCall { readonly method: string; readonly path: string; readonly form: URLSearchParams }

function sentCalls(spy: jest.SpyInstance): SentCall[] {
  return spy.mock.calls.map(([url, init]) => ({
    method: String(init?.method ?? 'GET'),
    path: new URL(String(url)).pathname,
    form: new URLSearchParams(typeof init?.body === 'string' ? init.body : ''),
  }));
}

const TRANSFER = {
  token: 'tra_1', amount: 3000, commission_amount: 0, on_hold: true, seller: 'sel_1', payment: 'pmt_1',
  payout: null, reversed_amount: 0,
};

afterEach(() => jest.restoreAllMocks());

describe('ενεργοποίηση', () => {
  it('χωρίς EVERYPAY_MARKETPLACE ⇒ καμία ικανότητα (ο πάροχος δηλώνει null, όχι κλήσεις σε endpoint που λείπει)', () => {
    expect(createEverypayMarketplace({ ...credentials, marketplace: false })).toBeNull();
    expect(createEverypayProvider({ ...credentials, marketplace: false }).marketplace).toBeNull();
    expect(createEverypayProvider(credentials).marketplace).not.toBeNull();
  });
});

describe('αναγνώστες', () => {
  it('πωλητής: γνωστή κατάσταση ⇒ πεζά· άγνωστη ή απούσα ⇒ unknown, ΠΟΤΕ authorized', () => {
    expect(payeeAccountOf({ token: 'sel_1', status: 'Authorized', kyc_process_url: 'https://kyc/x' }))
      .toEqual({ reference: 'sel_1', status: 'authorized', kycProcessUrl: 'https://kyc/x' });
    expect(payeeAccountOf({ token: 'sel_1', status: 'Pending review' })?.status).toBe('unknown');
    expect(payeeAccountOf({ token: 'sel_1' })?.status).toBe('unknown');
    expect(payeeAccountOf({ status: 'Authorized' })).toBeNull();
  });

  it('KYC: οι τρεις γραφές της τεκμηρίωσης για «σε εξέλιξη» ⇒ μία τιμή', () => {
    for (const raw of ['In progress', 'in progress', 'in-progress', 'IN_PROGRESS']) expect(payeeKycStatusOf(raw)).toBe('in-progress');
    expect(payeeKycStatusOf('Verified')).toBe('verified');
    expect(payeeKycStatusOf('whatever')).toBe('unknown');
    expect(payeeKycStatusOf(undefined)).toBe('unknown');
  });

  it('μεταφορά: σημαία κράτησης ως boolean ή 1/0· χωρίς σημαία ⇒ μη αναγνώσιμη (ποτέ «αποδεσμευμένη»)', () => {
    expect(payeeTransferOf(TRANSFER)).toMatchObject({ reference: 'tra_1', held: true, paidOut: false, payeeReference: 'sel_1' });
    expect(payeeTransferOf({ ...TRANSFER, on_hold: 0, payout: 'pyt_1' })).toMatchObject({ held: false, paidOut: true });
    expect(payeeTransferOf({ ...TRANSFER, seller: { token: 'sel_2' } })?.payeeReference).toBe('sel_2');
    expect(payeeTransferOf({ ...TRANSFER, on_hold: undefined })).toBeNull();
  });

  it('webhook KYC: μόνο το SELLER_KYC.STATUS με πωλητή', () => {
    const event = { event_type: 'SELLER_KYC.STATUS', payload: { seller_token: 'sel_1', status: 'Pending', kyc_process_url: 'https://kyc/x' } };
    expect(sellerKycEventOf(event)).toEqual({ payeeReference: 'sel_1', kycStatus: 'pending', kycProcessUrl: 'https://kyc/x' });
    expect(sellerKycEventOf({ event_type: 'OTHER', payload: event.payload })).toBeNull();
    expect(sellerKycEventOf({ event_type: 'SELLER_KYC.STATUS', payload: {} })).toBeNull();
  });
});

describe('judgeWebhook — KYC', () => {
  const provider = createEverypayProvider(credentials);
  const signed = (body: string) => {
    const hex = createHmac('sha256', credentials.secretKey).update(body).digest('hex');
    return new Headers({ 'X-Signature-SHA256': Buffer.from(hex).toString('base64') });
  };

  it('υπογεγραμμένο event KYC ⇒ σήμα payee-kyc', () => {
    const body = JSON.stringify({ event_type: 'SELLER_KYC.STATUS', version: 'v1', payload: { seller_token: 'sel_1', status: 'Verified' } });
    expect(provider.judgeWebhook(body, signed(body))).toEqual({
      valid: true,
      signal: { kind: 'payee-kyc', payeeReference: 'sel_1', kycStatus: 'verified', kycProcessUrl: null },
      signatureScheme: 'webhook-header',
    });
  });

  it('event KYC χωρίς πωλητή ⇒ ignored με λόγο (όχι «άγνωστο event»)', () => {
    const body = JSON.stringify({ event_type: 'SELLER_KYC.STATUS', payload: {} });
    const verdict = provider.judgeWebhook(body, signed(body));
    expect(verdict.valid && verdict.signal).toEqual({ kind: 'ignored', reason: 'kyc-payload-incomplete' });
  });

  it('πλαστό event KYC ⇒ άρνηση', () => {
    const body = JSON.stringify({ event_type: 'SELLER_KYC.STATUS', payload: { seller_token: 'sel_1', status: 'Verified' } });
    expect(provider.judgeWebhook(body, signed('{}')).valid).toBe(false);
  });
});

describe('ensureTransfer — ΜΙΑ μεταφορά ανά (πληρωμή, πωλητή)', () => {
  const target = {
    paymentReference: 'pmt_1', payeeReference: 'sel_1', amountMinor: 3000, commissionMinor: 0, description: 'Προκαταβολή', hold: true,
  };

  it('καμία ⇒ δημιουργείται κρατημένη, χωρίς προμήθεια', async () => {
    const spy = jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ total_count: 0, items: [] }))
      .mockImplementationOnce(() => respond(TRANSFER));
    await expect(marketplace().ensureTransfer(target)).resolves.toMatchObject({ reference: 'tra_1', held: true });
    const [, create] = sentCalls(spy);
    expect(create.method).toBe('POST');
    expect(create.path).toBe('/payments/pmt_1/transfers');
    expect(Object.fromEntries(create.form)).toEqual({
      seller: 'sel_1', amount: '3000', commission_amount: '0', description: 'Προκαταβολή', on_hold: '1',
    });
  });

  it('υπάρχει ήδη ⇒ επιστρέφεται, ΚΑΜΙΑ δεύτερη μεταφορά (επανάληψη μετά από timeout)', async () => {
    const spy = jest.spyOn(global, 'fetch').mockImplementationOnce(() => respond({ total_count: 1, items: [TRANSFER] }));
    await expect(marketplace().ensureTransfer(target)).resolves.toMatchObject({ reference: 'tra_1' });
    expect(sentCalls(spy).filter((call) => call.method === 'POST')).toHaveLength(0);
  });

  it('υπάρχει με άλλο ποσό ⇒ σφάλμα, ποτέ δεύτερη', async () => {
    jest.spyOn(global, 'fetch').mockImplementationOnce(() => respond({ total_count: 1, items: [{ ...TRANSFER, amount: 2500 }] }));
    await expect(marketplace().ensureTransfer(target)).rejects.toThrow('different amount');
  });

  it('προμήθεια ≥ ποσού ή μη θετικό ποσό ⇒ σφάλμα πριν από κάθε κλήση', async () => {
    const spy = jest.spyOn(global, 'fetch');
    await expect(marketplace().ensureTransfer({ ...target, commissionMinor: 3000 })).rejects.toThrow(RangeError);
    await expect(marketplace().ensureTransfer({ ...target, amountMinor: 0 })).rejects.toThrow(RangeError);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('releaseTransfer', () => {
  it('κρατημένη ⇒ PUT on_hold=0· ήδη αποδεσμευμένη ⇒ καμία εγγραφή', async () => {
    const spy = jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond(TRANSFER))
      .mockImplementationOnce(() => respond({ ...TRANSFER, on_hold: false }))
      .mockImplementationOnce(() => respond({ ...TRANSFER, on_hold: false }));
    await expect(marketplace().releaseTransfer('tra_1')).resolves.toMatchObject({ held: false });
    await expect(marketplace().releaseTransfer('tra_1')).resolves.toMatchObject({ held: false });
    const writes = sentCalls(spy).filter((call) => call.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe('/transfers/tra_1');
    expect(writes[0].form.get('on_hold')).toBe('0');
  });
});

describe('δηλωτικός αντιλογισμός / επιστροφή — μόνο η διαφορά', () => {
  it('αντιλογισμός: στόχος 1500, ήδη 1000 ⇒ στέλνει 500· στόχος ήδη πιασμένος ⇒ τίποτα', async () => {
    const spy = jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ ...TRANSFER, reversed_amount: 1000 }))
      .mockImplementationOnce(() => respond({ token: 'trr_1' }))
      .mockImplementationOnce(() => respond({ ...TRANSFER, reversed_amount: 1500 }));
    const target = { transferReference: 'tra_1', reversedTotalMinor: 1500, description: 'Ακύρωση' };
    await expect(marketplace().reconcileTransferReversal(target)).resolves.toEqual({ applied: true, reference: 'trr_1', amountMinor: 500 });
    await expect(marketplace().reconcileTransferReversal(target)).resolves.toEqual({ applied: false });
    const posts = sentCalls(spy).filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(Object.fromEntries(posts[0].form)).toEqual({ transfer: 'tra_1', amount: '500', description: 'Ακύρωση' });
  });

  it('στόχος πάνω από το ποσό της μεταφοράς ⇒ σφάλμα, ποτέ σιωπηλή περικοπή', async () => {
    jest.spyOn(global, 'fetch').mockImplementationOnce(() => respond(TRANSFER));
    await expect(marketplace().reconcileTransferReversal({ transferReference: 'tra_1', reversedTotalMinor: 3001, description: 'x' }))
      .rejects.toThrow(RangeError);
  });

  it('επιστροφή: στόχος 3000, ήδη 0 ⇒ POST /refunds 3000· δεύτερη φορά (ήδη 3000) ⇒ τίποτα', async () => {
    const spy = jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ token: 'pmt_1', amount: 3000, refund_amount: 0 }))
      .mockImplementationOnce(() => respond({ token: 'ref_1' }))
      .mockImplementationOnce(() => respond({ token: 'pmt_1', amount: 3000, refund_amount: 3000 }));
    const target = { paymentReference: 'pmt_1', refundedTotalMinor: 3000 };
    await expect(marketplace().reconcilePaymentRefund(target)).resolves.toEqual({ applied: true, reference: 'ref_1', amountMinor: 3000 });
    await expect(marketplace().reconcilePaymentRefund(target)).resolves.toEqual({ applied: false });
    expect(sentCalls(spy).filter((call) => call.method === 'POST')).toEqual([
      expect.objectContaining({ path: '/refunds', form: new URLSearchParams({ payment: 'pmt_1', amount: '3000' }) }),
    ]);
  });
});
