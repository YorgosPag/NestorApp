/**
 * Contract tests — ADR-603 procurement migration batch B (PO core).
 *
 * Proves the defineRoute-migrated PO routes are BYTE-IDENTICAL to their previous
 * inline handlers: same `{success,data}` / message-shaped envelopes, status
 * codes, validation messages, and the action-switch success shapes — through the
 * REAL factory + REAL safeParseBody + REAL zod schemas:
 *
 *   - procurement (list GET / create POST) — create failures → **400** (NOT 500)
 *   - procurement/[poId] GET (404 not-found), PATCH action-switch, DELETE
 *   - action-switch: approve/order/close/cancel/link-invoice/update → message,
 *     record-delivery → message + top-level data, duplicate → 201 { data }
 *
 * @enterprise ADR-603 API Route-Handler Factory SSoT
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

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

var poSvc = {
  listPOs: jest.fn(async () => []),
  createPO: jest.fn(),
  getPO: jest.fn(),
  updatePO: jest.fn(async () => undefined),
  approvePO: jest.fn(async () => undefined),
  markOrdered: jest.fn(async () => undefined),
  closePO: jest.fn(async () => undefined),
  cancelPO: jest.fn(async () => undefined),
  recordPODelivery: jest.fn(async () => ({ newStatus: 'partially_received' })),
  linkInvoiceToPO: jest.fn(async () => undefined),
  deletePO: jest.fn(async () => undefined),
  duplicatePO: jest.fn(),
};

jest.mock('@/services/procurement', () => ({
  listPOs: (...a: unknown[]) => poSvc.listPOs(...a),
  createPO: (...a: unknown[]) => poSvc.createPO(...a),
  getPO: (...a: unknown[]) => poSvc.getPO(...a),
  updatePO: (...a: unknown[]) => poSvc.updatePO(...a),
  approvePO: (...a: unknown[]) => poSvc.approvePO(...a),
  markOrdered: (...a: unknown[]) => poSvc.markOrdered(...a),
  closePO: (...a: unknown[]) => poSvc.closePO(...a),
  cancelPO: (...a: unknown[]) => poSvc.cancelPO(...a),
  recordPODelivery: (...a: unknown[]) => poSvc.recordPODelivery(...a),
  linkInvoiceToPO: (...a: unknown[]) => poSvc.linkInvoiceToPO(...a),
  deletePO: (...a: unknown[]) => poSvc.deletePO(...a),
  duplicatePO: (...a: unknown[]) => poSvc.duplicatePO(...a),
}));

import type { NextRequest } from 'next/server';
import { GET as listGet, POST as listPost } from '../route';
import { GET as poGet, PATCH as poPatch, DELETE as poDelete } from '../[poId]/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}
type Seg<T> = { params: Promise<T> };
const seg: Seg<{ poId: string }> = { params: Promise.resolve({ poId: 'po_1' }) };

function req(body?: unknown, url = 'https://app.test/api/procurement/po_1'): NextRequest {
  return {
    url,
    method: body === undefined ? 'GET' : 'PATCH',
    json: async () => body,
  } as unknown as NextRequest;
}

const validPO = {
  projectId: 'p1',
  supplierId: 's1',
  items: [{ description: 'x', quantity: 1, unit: 'kg', unitPrice: 1, total: 1, categoryCode: 'A1' }],
  taxRate: 24,
};

beforeEach(() => {
  jest.clearAllMocks();
  poSvc.listPOs.mockResolvedValue([]);
  poSvc.recordPODelivery.mockResolvedValue({ newStatus: 'partially_received' });
});

// ===========================================================================
// procurement — list + create
// ===========================================================================

describe('procurement — GET/POST', () => {
  it('GET → 200 { success:true, data }', async () => {
    poSvc.listPOs.mockResolvedValue([{ id: 'po_1' }]);
    const res = (await listGet(req())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'po_1' }] });
  });

  it('POST valid → 201 created', async () => {
    poSvc.createPO.mockResolvedValue({ id: 'po_1' });
    const res = (await listPost(req(validPO))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'po_1' } });
  });

  it('POST zod invalid → 400 Validation failed', async () => {
    const res = (await listPost(req({ projectId: '' }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('POST service error → 400 (create fallback is 400, NOT 500)', async () => {
    poSvc.createPO.mockRejectedValue(new Error('supplier missing'));
    const res = (await listPost(req(validPO))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('supplier missing');
  });
});

// ===========================================================================
// procurement/[poId] — GET
// ===========================================================================

describe('procurement/[poId] — GET', () => {
  it('GET found → 200 { success:true, data }', async () => {
    poSvc.getPO.mockResolvedValue({ id: 'po_1' });
    const res = (await poGet(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'po_1' } });
  });

  it('GET not found → 404 Purchase order not found', async () => {
    poSvc.getPO.mockResolvedValue(null);
    const res = (await poGet(req(), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Purchase order not found');
  });
});

// ===========================================================================
// procurement/[poId] — PATCH action-switch
// ===========================================================================

function patchReq(action: string, body?: unknown): NextRequest {
  return req(body ?? {}, `https://app.test/api/procurement/po_1?action=${action}`);
}

describe('procurement/[poId] — PATCH action-switch', () => {
  it('approve → 200 { success:true, message }', async () => {
    const res = (await poPatch(patchReq('approve'), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'PO approved' });
  });

  it('order → message PO marked as ordered', async () => {
    const res = (await poPatch(patchReq('order'), seg)) as Envelope;
    expect(await res.json()).toEqual({ success: true, message: 'PO marked as ordered' });
  });

  it('close → message PO closed', async () => {
    const res = (await poPatch(patchReq('close'), seg)) as Envelope;
    expect(await res.json()).toEqual({ success: true, message: 'PO closed' });
  });

  it('cancel valid → message PO cancelled', async () => {
    const res = (await poPatch(patchReq('cancel', { reason: 'plan_change' }), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'PO cancelled' });
  });

  it('cancel zod invalid → 400', async () => {
    const res = (await poPatch(patchReq('cancel', { reason: 'bogus' }), seg)) as Envelope;
    expect(res.status).toBe(400);
  });

  it('record-delivery → message + top-level data.newStatus', async () => {
    const res = (await poPatch(
      patchReq('record-delivery', { items: [{ itemId: 'i1', quantityReceived: 2 }] }),
      seg,
    )) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: 'Delivery recorded',
      data: { newStatus: 'partially_received' },
    });
  });

  it('link-invoice → message Invoice linked', async () => {
    const res = (await poPatch(patchReq('link-invoice', { invoiceId: 'inv_1' }), seg)) as Envelope;
    expect(await res.json()).toEqual({ success: true, message: 'Invoice linked' });
  });

  it('duplicate → 201 { success:true, data }', async () => {
    poSvc.duplicatePO.mockResolvedValue({ id: 'po_2' });
    const res = (await poPatch(patchReq('duplicate'), seg)) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'po_2' } });
  });

  it('update (default action) → message PO updated', async () => {
    const res = (await poPatch(patchReq('update', { supplierNotes: 'hi' }), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'PO updated' });
  });

  it('service error → 400', async () => {
    poSvc.approvePO.mockRejectedValue(new Error('cannot approve'));
    const res = (await poPatch(patchReq('approve'), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('cannot approve');
  });
});

// ===========================================================================
// procurement/[poId] — DELETE
// ===========================================================================

describe('procurement/[poId] — DELETE', () => {
  it('DELETE ok → 200 { success:true, message }', async () => {
    const res = (await poDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'PO deleted' });
  });

  it('DELETE service error → 400', async () => {
    poSvc.deletePO.mockRejectedValue(new Error('locked'));
    const res = (await poDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('locked');
  });
});
