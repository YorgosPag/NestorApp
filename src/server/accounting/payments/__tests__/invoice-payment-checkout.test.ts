/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.11 — email πληρωτή στην έναρξη πληρωμής τιμολογίου: ο φάκελος νικά τη σελίδα· κάρτα χωρίς κανένα email
 * ⇒ ονομασμένη άρνηση ΠΡΙΝ από κάθε εγγραφή· IRIS ⇒ καμία ερώτηση.
 */

let customerEmail: string | null = null;
jest.mock('@/server/accounting/public-invoice/invoice-public-session', () => ({
  readSharedInvoice: async () => ({
    kind: 'ok',
    share: { companyId: 'comp_1' },
    repository: {},
    invoice: { invoiceId: 'inv_1', series: 'A', number: 20, currency: 'EUR', customer: { email: customerEmail } },
  }),
}));
jest.mock('@/server/accounting/public-invoice/invoice-link-opened', () => ({ linkHolderActor: () => 'link-holder:share_1' }));
jest.mock('@/lib/sharing/share-token', () => ({ isPlausibleShareToken: () => true }));
jest.mock('@/server/sharing/share-token-lookup', () => ({ findActiveShareByToken: async () => ({ id: 'share_1' }) }));
jest.mock('@/server/payments/payment-provider-registry', () => ({
  paymentProviderForCompany: () => ({ id: 'everypay', methods: ['card', 'iris'] }),
}));

const closeMock = jest.fn();
jest.mock('@/server/payments/payment-checkout-closing', () => ({ closePendingCheckoutsOf: (...args: unknown[]) => closeMock(...args) }));
const createMock = jest.fn();
jest.mock('@/server/payments/payment-checkout-store', () => ({ createPaymentCheckout: (...args: unknown[]) => createMock(...args) }));
const launchMock = jest.fn();
jest.mock('@/server/payments/payment-checkout-launch', () => ({
  CHECKOUT_LIFETIME_MS: 30 * 60 * 1000,
  launchCheckoutAtProvider: (...args: unknown[]) => launchMock(...args),
}));
jest.mock('@/subapps/accounting/services/accounting-audit-service', () => ({ logAccountingEvent: async () => undefined }));
jest.mock('@/services/enterprise-id.service', () => ({ generatePaymentCheckoutId: () => 'pchk_t1' }));
jest.mock('@/subapps/accounting/services/payments/invoice-payment-link', () => ({
  ...jest.requireActual('@/subapps/accounting/services/payments/invoice-payment-link'),
  invoiceAmountDueNow: () => 12.4,
}));

import type { OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';

import { startInvoicePaymentCheckout } from '../invoice-payment-checkout';

const db = {} as never;

function start(method: OnlinePaymentMethod, payerEmail?: string) {
  return startInvoicePaymentCheckout(db, {
    method, locale: 'el', returnPath: '/shared/tok_1', shareId: 'share_1', origin: 'https://app.test', nowMs: Date.parse('2026-11-18T10:00:00.000Z'),
    ...(payerEmail === undefined ? {} : { payerEmail }),
  });
}

const payerSent = (): unknown => (launchMock.mock.calls[0][3] as { payer: unknown }).payer;

beforeEach(() => {
  customerEmail = null;
  closeMock.mockReset().mockResolvedValue(undefined);
  createMock.mockReset().mockResolvedValue(undefined);
  launchMock.mockReset().mockResolvedValue({ status: 'started', checkoutId: 'pchk_t1', launch: { kind: 'redirect', url: 'https://pay.test' } });
});

describe('startInvoicePaymentCheckout — email πληρωτή', () => {
  it('γνωστό email στον φάκελο ⇒ φεύγει αυτό, και ΝΙΚΑ εκείνο της σελίδας', async () => {
    customerEmail = 'pelatis@example.gr';
    await expect(start('card', 'allos@example.gr')).resolves.toMatchObject({ status: 'started' });
    expect(payerSent()).toEqual({ email: 'pelatis@example.gr' });
  });

  it('άγνωστο email + email από τη σελίδα ⇒ φεύγει της σελίδας', async () => {
    await start('card', 'pliroti@example.gr');
    expect(payerSent()).toEqual({ email: 'pliroti@example.gr' });
  });

  it('άκυρο email στον φάκελο λογίζεται άγνωστο ⇒ φεύγει της σελίδας', async () => {
    customerEmail = 'not-an-email';
    await start('card', 'pliroti@example.gr');
    expect(payerSent()).toEqual({ email: 'pliroti@example.gr' });
  });

  it('κάρτα χωρίς κανένα email ⇒ payer-email-required, χωρίς εγγραφή / κλείσιμο / πάροχο', async () => {
    await expect(start('card')).resolves.toEqual({ status: 'refused', reason: 'payer-email-required' });
    expect(closeMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
    expect(launchMock).not.toHaveBeenCalled();
  });

  it('IRIS χωρίς email ⇒ ξεκινά, με email null', async () => {
    await expect(start('iris')).resolves.toMatchObject({ status: 'started' });
    expect(payerSent()).toEqual({ email: null });
  });
});
