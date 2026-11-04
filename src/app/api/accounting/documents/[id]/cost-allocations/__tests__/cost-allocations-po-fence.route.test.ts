/**
 * ADR-923 κύμα 3 Λ5β — η πρόταση επιμερισμού και οι αριθμοί PO του `cost-allocations` GET περνούν
 * από τον ΕΝΑ φράχτη εταιρείας των PO (`findOwnedPO`, πρόθεση `compose`).
 *
 * Η συμπεριφορά μένει ίδια με τον παλιό χειρόγραφο έλεγχο: ξένη ή διαγραμμένη PO ⇒ καμία πρόταση,
 * ξένη PO ⇒ κανένας αριθμός· και ο υπερδιαχειριστής ΔΕΝ παίρνει ξένη PO μέσα σε παραστατικό της
 * δικής του εταιρείας. Αληθινά: το route, ο φράχτης, οι καθαρές συναρτήσεις επιμερισμού.
 */

jest.mock('server-only', () => ({}));

jest.mock('next/server', () =>
  jest.requireActual<typeof import('@/test-utils/next-response-json-mock')>('@/test-utils/next-response-json-mock')
    .nextServerJsonMock(),
);

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
  companyId: 'comp_1',
  email: 'g@example.com',
  globalRole: 'company_admin',
  isAuthenticated: true as const,
};
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));
jest.mock('@/services/project-cost/expense-cost-allocations.server', () => ({
  writeExpenseCostAllocations: jest.fn(),
}));

var expenseDocument: Record<string, unknown> = {};
jest.mock('../../../../_shared/expense-document-access', () => ({
  requireExpenseDocument: async () => ({ document: expenseDocument }),
}));

var getPurchaseOrder = jest.fn();
jest.mock('@/services/procurement/procurement-repository', () => ({
  getPurchaseOrder: (...a: unknown[]) => getPurchaseOrder(...a),
}));

import type { NextRequest } from 'next/server';
import { GET } from '../route';

interface Envelope {
  status: number;
  json: () => Promise<{ data: { proposal: unknown; purchaseOrderNumbers: Record<string, string> } }>;
}

function po(companyId: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'po_1', poNumber: 'PO-0001', projectId: 'proj_1', status: 'ordered', companyId, isDeleted: false,
    items: [{ id: 'poi_1', description: 'x', quantity: 1, unit: 'kg', unitPrice: 100, total: 100, categoryCode: 'OIK-2' }],
    ...extra,
  };
}

async function load(query = '?purchaseOrderId=po_1'): Promise<Awaited<ReturnType<Envelope['json']>>> {
  const url = `https://app.test/api/accounting/documents/doc_1/cost-allocations${query}`;
  const req = { url, nextUrl: new URL(url), method: 'GET' } as unknown as NextRequest;
  const res = (await GET(req, { params: Promise.resolve({ id: 'doc_1' }) })) as unknown as Envelope;
  expect(res.status).toBe(200);
  return res.json();
}

beforeEach(() => {
  jest.clearAllMocks();
  authCtx.globalRole = 'company_admin';
  expenseDocument = {
    id: 'doc_1', confirmedNetAmount: 100, allocationRevision: 0,
    costAllocations: [{ projectId: 'proj_1', costCode: 'OIK-2', amount: 100, purchaseOrderId: 'po_1', origin: 'manual' }],
  };
});

describe('cost-allocations GET — ο ένας φράχτης PO', () => {
  it('own PO → proposal + its number (positive control)', async () => {
    getPurchaseOrder.mockResolvedValue(po('comp_1'));
    const { data } = await load();
    expect(data.proposal).not.toBeNull();
    expect(data.purchaseOrderNumbers).toEqual({ po_1: 'PO-0001' });
  });

  it('foreign PO → no proposal and no number', async () => {
    getPurchaseOrder.mockResolvedValue(po('comp_other'));
    const { data } = await load();
    expect(data.proposal).toBeNull();
    expect(data.purchaseOrderNumbers).toEqual({});
  });

  it('deleted own PO → no proposal (kept), but its number still labels the stored line (kept)', async () => {
    getPurchaseOrder.mockResolvedValue(po('comp_1', { isDeleted: true }));
    const { data } = await load();
    expect(data.proposal).toBeNull();
    expect(data.purchaseOrderNumbers).toEqual({ po_1: 'PO-0001' });
  });

  it('super_admin gets NO foreign PO inside a document of its own company (compose = no bypass)', async () => {
    authCtx.globalRole = 'super_admin';
    getPurchaseOrder.mockResolvedValue(po('comp_other'));
    const { data } = await load();
    expect(data.proposal).toBeNull();
    expect(data.purchaseOrderNumbers).toEqual({});
  });
});
