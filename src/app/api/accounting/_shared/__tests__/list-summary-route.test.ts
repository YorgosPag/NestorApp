/**
 * ΑΓΚΥΡΑ του εργοστασίου `listSummaryRoute` — μέσω του πραγματικού `GET /api/accounting/invoices/summary`
 * (ADR-ACC-010 §2.1.1 «σελίδα ≠ καθολικό» — κάρτες σύνοψης).
 *
 * Τρεις υποσχέσεις: (α) η σύνοψη ΔΕΝ εξαρτάται από `pageSize` / `cursor` — ίδια φίλτρα ⇒ ίδιο άθροισμα·
 * (β) οι αρνήσεις του πελάτη είναι 400 με τους ΙΔΙΟΥΣ κωδικούς με τη σελίδα (όχι 500)· (γ) σφάλμα της βάσης ⇒ 500,
 * ποτέ «0».
 *
 * Τρέχει μέσα από το ΠΡΑΓΜΑΤΙΚΟ `defineRoute` (mock μόνο auth / rate-limit / repository).
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withHighRateLimit: <T>(h: T) => h,
  withStandardRateLimit: <T>(h: T) => h,
  withSensitiveRateLimit: <T>(h: T) => h,
  withHeavyRateLimit: <T>(h: T) => h,
  withWebhookRateLimit: <T>(h: T) => h,
  withTelegramRateLimit: <T>(h: T) => h,
}));

var authCtx = {
  uid: 'user_1',
  companyId: 'comp_caller',
  email: 'giorgio@example.com',
  globalRole: 'admin',
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

var repo = { collectInvoiceList: jest.fn() };

jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({ repository: repo }),
}));

import type { NextRequest } from 'next/server';
import { UnsupportedListFilterError } from '@/subapps/accounting/services/repository/accounting-repo-list';
import { GET } from '../../invoices/summary/route';
import { LIST_ERROR_CODES } from '../list-request-context';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}

const BASE = 'https://app.test/api/accounting/invoices/summary';

function req(query: string): NextRequest {
  return { url: `${BASE}${query}`, method: 'GET' } as unknown as NextRequest;
}

const unpaid = (balanceDue: number) => ({
  type: 'service_invoice',
  issueDate: '2026-03-01',
  paymentStatus: 'unpaid',
  balanceDue,
  totalGrossAmount: balanceDue,
  mydata: { status: 'sent' },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listSummaryRoute (GET /api/accounting/invoices/summary)', () => {
  /**
   * 🔴 Η κάρτα ήταν άθροισμα της φορτωμένης σελίδας ⇒ άλλαζε με το `pageSize`. ΜΕΤΑΛΛΑΞΗ: πέρνα `readPageRequest`
   * στο `collect` ή κόψε τις γραμμές σε σελίδα ⇒ κόκκινο.
   */
  it('🔴 Λ1 — ίδια φίλτρα, pageSize 1 ή 100 ή δρομέας ⇒ ΙΔΙΑ σύνοψη, πάνω σε ΟΛΕΣ τις γραμμές', async () => {
    repo.collectInvoiceList.mockResolvedValue([unpaid(100), unpaid(50), unpaid(25)]);

    const bodies = await Promise.all(
      ['?fiscalYear=2026', '?fiscalYear=2026&pageSize=1', '?fiscalYear=2026&pageSize=100&cursor=opaque'].map(
        async (query) => {
          const res = (await GET(req(query))) as Envelope;
          expect(res.status).toBe(200);
          return (await res.json()).data as Record<string, unknown>;
        },
      ),
    );

    expect(bodies[0]).toMatchObject({ invoiceCount: 3, unpaidBalance: 175, unpaidCount: 3 });
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    // Το `collect` παίρνει ΜΟΝΟ φίλτρα — καμία έννοια σελίδας δεν φτάνει στο repository.
    for (const [filters] of repo.collectInvoiceList.mock.calls) {
      expect(filters).toEqual({ type: undefined, paymentStatus: undefined, fiscalYear: 2026, propertyId: undefined });
    }
  });

  /** Η σελίδα απαντά 400 σε συνδυασμό χωρίς δείκτη — οι κάρτες δεν επιτρέπεται να απαντούν 500 στο ίδιο φίλτρο. */
  it('Λ2 — συνδυασμός φίλτρων εκτός συνόλου ⇒ 400 UNSUPPORTED_LIST_FILTER (ίδιος κωδικός με τη σελίδα)', async () => {
    repo.collectInvoiceList.mockRejectedValue(new UnsupportedListFilterError('accounting_invoices', ['type']));

    const res = (await GET(req('?type=service_invoice'))) as Envelope;

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ success: false, errorCode: LIST_ERROR_CODES.UNSUPPORTED_LIST_FILTER });
  });

  it('Λ3 — άκυρη τιμή φίλτρου ⇒ 400, χωρίς ανάγνωση', async () => {
    const res = (await GET(req('?fiscalYear=abc'))) as Envelope;

    expect(res.status).toBe(400);
    expect(repo.collectInvoiceList).not.toHaveBeenCalled();
  });

  it('Λ4 — σφάλμα της βάσης ⇒ 500, ποτέ σύνοψη «0»', async () => {
    repo.collectInvoiceList.mockRejectedValue(new Error('FAILED_PRECONDITION: The query requires an index'));

    const res = (await GET(req('?fiscalYear=2026'))) as Envelope;

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false });
  });
});
