/**
 * @jest-environment node
 *
 * ADR-ACC-030 — adapter Everypay: κρίση webhook / επιστροφής ⇒ σήμα, και ανάγνωση της αλήθειας (mock fetch).
 */

import { createHmac } from 'crypto';

import { createEverypayProvider } from '../everypay-adapter';
import { EVERYPAY_ENDPOINTS, type EverypayCredentials } from '../everypay-config';

const credentials: EverypayCredentials = {
  mode: 'sandbox', secretKey: 'sk_test', publicKey: 'pk_test', endpoints: EVERYPAY_ENDPOINTS.sandbox,
};
const provider = createEverypayProvider(credentials);

function signedHeaders(body: string, secret = credentials.secretKey): Headers {
  return new Headers({ 'X-Signature-SHA256': createHmac('sha256', secret).update(body).digest('base64') });
}

function irisHash(payload: Record<string, unknown>, secret = credentials.secretKey): string {
  const json = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(json).digest('hex');
  return Buffer.from(`${signature}|${json}`).toString('base64');
}

describe('judgeWebhook', () => {
  it('ειδοποίηση (`pnt_`) ⇒ checkout-reference', () => {
    const body = JSON.stringify({ token: 'pnt_1', status: 'Paid' });
    expect(provider.judgeWebhook(body, signedHeaders(body))).toEqual({
      valid: true, signal: { kind: 'checkout-reference', providerReference: 'pnt_1' },
    });
  });

  it('πληρωμή (`pmt_`, π.χ. επιστροφή) ⇒ payment-reference', () => {
    const body = JSON.stringify({ token: 'pmt_9', refunded: true });
    expect(provider.judgeWebhook(body, signedHeaders(body))).toEqual({
      valid: true, signal: { kind: 'payment-reference', paymentReference: 'pmt_9' },
    });
  });

  it('IRIS: τα στοιχεία βγαίνουν από το ΥΠΟΓΕΓΡΑΜΜΕΝΟ json, όχι από τα εξωτερικά πεδία', () => {
    const body = JSON.stringify({ token: 'src_FORGED', md: 'pchk_FORGED', hash: irisHash({ token: 'src_1', md: 'pchk_1', type: 'iris' }) });
    expect(provider.judgeWebhook(body, new Headers())).toEqual({
      valid: true, signal: { kind: 'authorized-source', checkoutId: 'pchk_1', sourceToken: 'src_1' },
    });
  });

  it('IRIS αποτυχία στον πάροχο ⇒ ignored', () => {
    const body = JSON.stringify({ hash: irisHash({ md: 'pchk_1', error_status: 400, error_code: 41001 }) });
    const verdict = provider.judgeWebhook(body, new Headers());
    expect(verdict.valid && verdict.signal.kind).toBe('ignored');
  });

  it('πλαστή υπογραφή ⇒ άρνηση, καμία ανάγνωση σήματος', () => {
    const body = JSON.stringify({ token: 'pnt_1' });
    expect(provider.judgeWebhook(body, signedHeaders(body, 'sk_other'))).toEqual({ valid: false, reason: 'signature-invalid' });
    expect(provider.judgeWebhook(body, new Headers())).toEqual({ valid: false, reason: 'signature-missing' });
  });
});

describe('judgeReturn', () => {
  it('επιστροφή IRIS με έγκυρο hash ⇒ authorized-source', () => {
    const fields = new URLSearchParams({ hash: irisHash({ token: 'src_2', md: 'pchk_2', type: 'iris' }) });
    expect(provider.judgeReturn(fields)).toEqual({
      valid: true, signal: { kind: 'authorized-source', checkoutId: 'pchk_2', sourceToken: 'src_2' },
    });
  });
});

describe('readSettlement (κάρτα)', () => {
  const subject = { checkoutId: 'pchk_1', method: 'card' as const, amountMinor: 12400, currency: 'EUR' as const, providerReference: 'pnt_1' };
  const respond = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  afterEach(() => jest.restoreAllMocks());

  it('πληρωμένη ειδοποίηση ⇒ πληρωμή + επιστροφές από το API', async () => {
    jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ token: 'pnt_1', status: 'Paid', payment: 'pmt_1' }))
      .mockImplementationOnce(() => respond({ token: 'pmt_1', status: 'Partially Refunded', amount: 12400, currency: 'EUR', date_created: '2026-11-11T10:00:00Z' }))
      .mockImplementationOnce(() => respond({ data: [{ token: 'ref_1', status: 'Captured', amount: 2400, date_created: '2026-11-12T10:00:00Z' }] }));
    const settlement = await provider.readSettlement(subject);
    expect(settlement).toEqual({
      state: 'settled',
      paymentReference: 'pmt_1',
      movements: [
        { kind: 'payment', reference: 'pmt_1', amountMinor: 12400, currency: 'EUR', occurredAt: '2026-11-11T10:00:00.000Z' },
        { kind: 'refund', reference: 'ref_1', amountMinor: 2400, currency: 'EUR', occurredAt: '2026-11-12T10:00:00.000Z' },
      ],
    });
  });

  it('ληγμένη ειδοποίηση ⇒ closed/expired· εκκρεμής ⇒ open', async () => {
    jest.spyOn(global, 'fetch')
      .mockImplementationOnce(() => respond({ token: 'pnt_1', status: 'Expired', payment: null }))
      .mockImplementationOnce(() => respond({ token: 'pnt_1', status: 'Pending', payment: null }));
    await expect(provider.readSettlement(subject)).resolves.toEqual({ state: 'closed', reason: 'expired' });
    await expect(provider.readSettlement(subject)).resolves.toEqual({ state: 'open' });
  });
});
