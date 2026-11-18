/**
 * @jest-environment node
 *
 * ADR-943 §8 #16 · ADR-ACC-030 §5.11 — η προκαταβολή στέλνει στον πάροχο το email της πρόσκλησης (`inviteeEmail`):
 * ο ιδιοκτήτης δεν ρωτιέται ποτέ, και η σελίδα της EveryPay δείχνει Google Pay / Apple Pay.
 */

const payer = {
  invitation: { companyId: 'comp_1', assignmentId: 'asg_1', contactId: 'cont_1', inviteeEmail: 'idioktitis@example.gr' },
  context: { assignment: { companyId: 'comp_1' }, registry: { people: {} }, label: { name: 'Οικία Α' } },
  record: {},
  state: { kind: 'awaiting-payment', amountMinor: 5000 },
};
jest.mock('../issuance-advance-payer', () => ({
  resolveAdvancePayer: async () => ({ ok: true, payer }),
  checkPayerAccess: async () => ({ ok: true }),
  accessHolderOf: async () => null,
  readPayerLink: async () => null,
}));
jest.mock('../issuance-active-engagement', () => ({ activeIssuanceEngagementOf: async () => ({ uid: 'uid_eng' }) }));
jest.mock('../issuance-advance-notifier', () => ({ announcePayeeRequired: async () => undefined }));
jest.mock('../issuance-link-access', () => ({ checkIssuanceAccessCode: jest.fn(), issuanceGateViewOf: jest.fn() }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: async () => null }));
jest.mock('@/server/payments/payment-provider-registry', () => ({
  paymentProviderForCompany: () => ({ id: 'everypay', methods: ['card', 'iris'], marketplace: {} }),
}));
jest.mock('@/server/payments/payment-payee-service', () => ({ readyPayeeOf: async () => ({ kind: 'ready', payeeReference: 'sel_1' }) }));
jest.mock('@/server/payments/payment-payee-store', () => ({ readPaymentPayee: async () => null }));
jest.mock('@/server/payments/payment-checkout-closing', () => ({ closePendingCheckoutsOf: async () => undefined }));
jest.mock('@/server/payments/payment-checkout-store', () => ({
  createPaymentCheckout: async () => undefined,
  readPaymentCheckout: async () => null,
}));
const launchMock = jest.fn();
jest.mock('@/server/payments/payment-checkout-launch', () => ({
  CHECKOUT_LIFETIME_MS: 30 * 60 * 1000,
  launchCheckoutAtProvider: (...args: unknown[]) => launchMock(...args),
}));
jest.mock('@/services/enterprise-id.service', () => ({ generatePaymentCheckoutId: () => 'pchk_adv1' }));

import { startIssuanceAdvanceCheckout } from '../issuance-advance-checkout';

describe('startIssuanceAdvanceCheckout — πληρωτής', () => {
  beforeEach(() => {
    launchMock.mockReset().mockResolvedValue({ status: 'started', checkoutId: 'pchk_adv1', launch: { kind: 'redirect', url: 'https://pay.test' } });
  });

  it('κάρτα ⇒ το email της πρόσκλησης φτάνει στον ΕΝΑ δρόμο εκκίνησης, χωρίς ερώτηση στον ιδιοκτήτη', async () => {
    const outcome = await startIssuanceAdvanceCheckout({} as never, 'tok_1', {
      body: { method: 'card', locale: 'el', accessCode: null }, origin: 'https://app.test', now: new Date('2026-11-18T10:00:00.000Z'),
    } as never);
    expect(outcome).toMatchObject({ kind: 'result', result: { status: 'started' } });
    expect(launchMock).toHaveBeenCalledTimes(1);
    expect((launchMock.mock.calls[0][3] as { payer: unknown }).payer).toEqual({ email: 'idioktitis@example.gr' });
  });
});
