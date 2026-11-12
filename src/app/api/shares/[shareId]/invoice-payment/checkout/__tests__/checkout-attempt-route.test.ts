/**
 * @jest-environment node
 *
 * @fileoverview **GET …/invoice-payment/checkout?checkout=pchk_…** — η πόρτα της έκβασης απόπειρας (ADR-ACC-030 §5.6).
 * @related app/api/shares/[shareId]/invoice-payment/checkout/route.ts
 *
 * Η υπηρεσία (`readInvoicePaymentAttempt`) έχει δική της σουίτα· εδώ φυλάσσεται **η πόρτα**: χωρίς κουπόνι επίσκεψης
 * ή με αναγνωριστικό εκτός σχήματος, η βάση **δεν** ρωτιέται καθόλου· με έγκυρα, το `shareId` της διαδρομής
 * (αποκωδικοποιημένο) και το `?checkout=` φτάνουν αυτούσια στην υπηρεσία· κάθε απάντηση είναι 200 με ιδιωτικές
 * κεφαλίδες (καμία κρυφή μνήμη, καμία ευρετηρίαση).
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    readonly headers: Record<string, string>;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = init?.headers ?? {};
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T>(h: T) => h }));

jest.mock('@/lib/auth/middleware', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, routeContext: unknown) =>
      callback(request, { isAuthenticated: false }, undefined, routeContext),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const grantMock = jest.fn();
jest.mock('@/server/sharing/share-access-grant', () => ({
  requestHasShareAccessGrant: (...args: unknown[]) => grantMock(...args),
}));

const readAttemptMock = jest.fn();
jest.mock('@/server/accounting/payments/invoice-payment-attempt', () => ({
  readInvoicePaymentAttempt: (...args: unknown[]) => readAttemptMock(...args),
}));

jest.mock('@/server/accounting/payments/invoice-payment-checkout', () => ({ startInvoicePaymentCheckout: jest.fn() }));
jest.mock('@/server/payments/payment-return-cookie', () => ({
  isPaymentReturnPath: () => true,
  setPaymentReturnCookie: jest.fn(),
}));

import { GET } from '../route';

type AttemptGet = (request: unknown, routeContext: unknown) => Promise<{
  status: number; headers: Record<string, string>; json(): Promise<unknown>;
}>;
const get = GET as unknown as AttemptGet;

function call(shareIdInPath: string, checkout: string | null) {
  const searchParams = new URLSearchParams(checkout === null ? {} : { checkout });
  return get({ nextUrl: { searchParams } }, { params: Promise.resolve({ shareId: shareIdInPath }) });
}

beforeEach(() => {
  grantMock.mockReset().mockReturnValue(true);
  readAttemptMock.mockReset().mockResolvedValue({ status: 'ok', attempt: 'failed' });
});

describe('GET …/invoice-payment/checkout — έκβαση απόπειρας', () => {
  it('χωρίς κουπόνι επίσκεψης ⇒ visit-expired, η βάση δεν ρωτιέται', async () => {
    grantMock.mockReturnValue(false);
    const response = await call('share_1', 'pchk_1');
    expect(await response.json()).toEqual({ status: 'refused', reason: 'visit-expired' });
    expect(readAttemptMock).not.toHaveBeenCalled();
  });

  it.each([null, '', 'pnt_1', 'pchk_', 'pchk_1/../x', `pchk_${'a'.repeat(65)}`])(
    'αναγνωριστικό εκτός σχήματος (%p) ⇒ unknown-attempt, η βάση δεν ρωτιέται',
    async (checkout) => {
      const response = await call('share_1', checkout);
      expect(await response.json()).toEqual({ status: 'refused', reason: 'unknown-attempt' });
      expect(readAttemptMock).not.toHaveBeenCalled();
    },
  );

  it('έγκυρα ⇒ η υπηρεσία με το αποκωδικοποιημένο shareId, και η απάντησή της αυτούσια', async () => {
    const response = await call('share%5F1', 'pchk_59a3be71-fd7a-427f-b318-64f27ff7f50b');
    expect(grantMock).toHaveBeenCalledWith(expect.anything(), 'share_1');
    expect(readAttemptMock).toHaveBeenCalledWith({}, {
      shareId: 'share_1', checkoutId: 'pchk_59a3be71-fd7a-427f-b318-64f27ff7f50b',
    });
    expect(await response.json()).toEqual({ status: 'ok', attempt: 'failed' });
  });

  it('κάθε απάντηση: 200 με ιδιωτικές κεφαλίδες (no-store · noindex)', async () => {
    grantMock.mockReturnValueOnce(false);
    for (const response of [await call('share_1', 'pchk_1'), await call('share_1', 'x'), await call('share_1', 'pchk_1')]) {
      expect(response.status).toBe(200);
      expect(response.headers).toEqual({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    }
  });
});
