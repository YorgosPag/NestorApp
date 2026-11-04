/**
 * ADR-923 κύμα 3 Λ5β — `GET /api/procurement/[poId]/pdf` μέσα από την ασπίδα του ADR-603.
 *
 * Πριν: `withAuth` με το χέρι, και σε 500 το `getErrorMessage(err)` έφευγε στον πελάτη (μηνύματα
 * Firestore/SDK) χωρίς καμία πολιτική cache. Τώρα: `defineRoute` ⇒ `private, no-store` σε ΚΑΘΕ
 * απόκριση, γενικό μήνυμα + `requestId` σε 500, και ο ΑΛΗΘΙΝΟΣ φράχτης εταιρείας (`findOwnedPO`).
 */

jest.mock('server-only', () => ({}));

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

var getPurchaseOrder = jest.fn();
jest.mock('@/services/procurement/procurement-repository', () => ({
  getPurchaseOrder: (...a: unknown[]) => getPurchaseOrder(...a),
}));
jest.mock('@/services/procurement', () => ({
  findOwnedPO: jest.requireActual<typeof import('@/services/procurement/po-tenant-scope')>(
    '@/services/procurement/po-tenant-scope',
  ).findOwnedPO,
}));

var PARTIES_OK = { ok: true, companyInfo: { name: 'Co' }, supplierInfo: { name: 'Supplier' } };
var parties = { resolvePODocumentParties: jest.fn(async (): Promise<unknown> => PARTIES_OK) };
jest.mock('@/services/procurement/po-document-parties', () => ({
  resolvePODocumentParties: (...a: unknown[]) => parties.resolvePODocumentParties(...a),
}));
var pdf = { generatePurchaseOrderPdf: jest.fn(async (): Promise<Uint8Array> => new Uint8Array([37, 80, 68, 70])) };
jest.mock('@/services/procurement/po-pdf-generator', () => ({
  generatePurchaseOrderPdf: (...a: unknown[]) => pdf.generatePurchaseOrderPdf(...a),
}));

import type { NextRequest } from 'next/server';
import { GET } from '../[poId]/pdf/route';

interface ShieldedResponse {
  status: number;
  headers: { get(name: string): string | null };
  json: () => Promise<Record<string, unknown>>;
}

const seg = { params: Promise.resolve({ poId: 'po_1' }) };
const URL_PDF = 'https://app.test/api/procurement/po_1/pdf?lang=en';

function req(): NextRequest {
  return { url: URL_PDF, nextUrl: new URL(URL_PDF), method: 'GET' } as unknown as NextRequest;
}

async function call(): Promise<ShieldedResponse> {
  return (await GET(req(), seg)) as unknown as ShieldedResponse;
}

beforeEach(() => {
  jest.clearAllMocks();
  getPurchaseOrder.mockResolvedValue({ id: 'po_1', poNumber: 'PO-0001', companyId: 'comp_1' });
  parties.resolvePODocumentParties.mockResolvedValue(PARTIES_OK);
});

describe('[poId]/pdf — ασπίδα ADR-603 + φράχτης εταιρείας', () => {
  it('own PO → 200 application/pdf, private no-store, English when asked', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(pdf.generatePurchaseOrderPdf).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
  });

  it('foreign PO → 404 PO not found, no PDF generated', async () => {
    getPurchaseOrder.mockResolvedValue({ id: 'po_1', poNumber: 'PO-0001', companyId: 'comp_other' });
    const res = await call();
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('PO not found');
    expect(pdf.generatePurchaseOrderPdf).not.toHaveBeenCalled();
  });

  it('UNEXPECTED failure → 500 generic + requestId, raw text never on the wire, no-store', async () => {
    pdf.generatePurchaseOrderPdf.mockRejectedValue(new Error('Firestore: purchase_orders/po_1 permission denied'));
    const res = await call();
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Failed to generate PDF', errorCode: 'INTERNAL_SERVER_ERROR' });
    expect(typeof body.requestId).toBe('string');
    expect(JSON.stringify(body)).not.toContain('purchase_orders/po_1');
  });

  it('unresolvable parties → 422 with the reason (a typed, client-facing refusal)', async () => {
    parties.resolvePODocumentParties.mockResolvedValue({ ok: false, reason: 'supplier_missing' });
    const res = await call();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('supplier_missing');
  });
});
