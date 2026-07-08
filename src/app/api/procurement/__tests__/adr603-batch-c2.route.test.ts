/**
 * Contract tests — ADR-603 procurement migration batch C2
 * (RFQ-lines + sourcing-events mutations + PO share).
 *
 * Proves the defineRoute-migrated routes are BYTE-IDENTICAL to their previous
 * inline handlers — same envelopes (bare `{success,data}`, message-shaped
 * `{success,message}`, top-level-extra `{success,data,count}`), status codes,
 * 404 messages, and the shared error→status mapping — through the REAL factory
 * + REAL `resolveProcurementErrorStatus` (mutation mode: not-found→404,
 * Forbidden→403, else→400; sourcing-events create → flat 400):
 *
 *   - rfqs/[rfqId]/lines          (GET list, POST create + null-guard 500)
 *   - rfqs/[rfqId]/lines/[lineId] (PATCH update, DELETE message)
 *   - rfqs/[rfqId]/lines/bulk     (POST data+count @201)
 *   - rfqs/[rfqId]/lines/snapshot (POST data+count @201)
 *   - sourcing-events            (GET list, POST create → flat 400)
 *   - sourcing-events/[eventId]  (GET 404, PATCH errorStatus)
 *   - sourcing-events/[eventId]/archive (POST message)
 *   - sourcing-events/[eventId]/rfqs    (POST/DELETE message)
 *   - [poId]/share               (POST 201 token URL / 404, DELETE bespoke 400 / 500)
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

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

// ---- rfq-line-service ------------------------------------------------------
var rfqLineSvc = {
  listRfqLines: jest.fn(async () => [{ id: 'l1' }]),
  addRfqLine: jest.fn(async () => ({ id: 'l1' })),
  updateRfqLine: jest.fn(async () => ({ id: 'l1' })),
  deleteRfqLine: jest.fn(async () => undefined),
  addRfqLinesBulk: jest.fn(async () => [{ id: 'l1' }, { id: 'l2' }]),
  snapshotFromBoq: jest.fn(async () => [{ id: 'l1' }]),
};
jest.mock('@/subapps/procurement/services/rfq-line-service', () => ({
  listRfqLines: (...a: unknown[]) => rfqLineSvc.listRfqLines(...a),
  addRfqLine: (...a: unknown[]) => rfqLineSvc.addRfqLine(...a),
  updateRfqLine: (...a: unknown[]) => rfqLineSvc.updateRfqLine(...a),
  deleteRfqLine: (...a: unknown[]) => rfqLineSvc.deleteRfqLine(...a),
  addRfqLinesBulk: (...a: unknown[]) => rfqLineSvc.addRfqLinesBulk(...a),
  snapshotFromBoq: (...a: unknown[]) => rfqLineSvc.snapshotFromBoq(...a),
}));

// ---- sourcing-event-service ------------------------------------------------
var seSvc = {
  listSourcingEvents: jest.fn(async () => [{ id: 'ev1' }]),
  createSourcingEvent: jest.fn(async () => ({ id: 'ev1' })),
  getSourcingEvent: jest.fn(async () => ({ id: 'ev1', title: 'Event' })),
  updateSourcingEvent: jest.fn(async () => ({ id: 'ev1' })),
  archiveSourcingEvent: jest.fn(async () => undefined),
  addRfqToSourcingEvent: jest.fn(async () => undefined),
  removeRfqFromSourcingEvent: jest.fn(async () => undefined),
};
jest.mock('@/subapps/procurement/services/sourcing-event-service', () => ({
  listSourcingEvents: (...a: unknown[]) => seSvc.listSourcingEvents(...a),
  createSourcingEvent: (...a: unknown[]) => seSvc.createSourcingEvent(...a),
  getSourcingEvent: (...a: unknown[]) => seSvc.getSourcingEvent(...a),
  updateSourcingEvent: (...a: unknown[]) => seSvc.updateSourcingEvent(...a),
  archiveSourcingEvent: (...a: unknown[]) => seSvc.archiveSourcingEvent(...a),
  addRfqToSourcingEvent: (...a: unknown[]) => seSvc.addRfqToSourcingEvent(...a),
  removeRfqFromSourcingEvent: (...a: unknown[]) => seSvc.removeRfqFromSourcingEvent(...a),
}));

// ---- PO share --------------------------------------------------------------
var shareSvc = {
  getPO: jest.fn(async () => ({ companyId: 'comp_1', poNumber: 'PO-1' })),
  createPOShare: jest.fn(async () => ({
    shareId: 'sh1', token: 'tok123', expiresAt: '2026-08-01T00:00:00.000Z',
  })),
  revokePOShare: jest.fn(async () => true),
};
jest.mock('@/services/procurement', () => ({
  getPO: (...a: unknown[]) => shareSvc.getPO(...a),
}));
jest.mock('@/services/procurement/po-share-service', () => ({
  createPOShare: (...a: unknown[]) => shareSvc.createPOShare(...a),
  revokePOShare: (...a: unknown[]) => shareSvc.revokePOShare(...a),
}));

import type { NextRequest } from 'next/server';
import { GET as linesGet, POST as linesPost } from '../rfqs/[rfqId]/lines/route';
import { PATCH as linePatch, DELETE as lineDelete } from '../rfqs/[rfqId]/lines/[lineId]/route';
import { POST as bulkPost } from '../rfqs/[rfqId]/lines/bulk/route';
import { POST as snapshotPost } from '../rfqs/[rfqId]/lines/snapshot/route';
import { GET as seGet, POST as sePost } from '../sourcing-events/route';
import { GET as seOneGet, PATCH as seOnePatch } from '../sourcing-events/[eventId]/route';
import { POST as archivePost } from '../sourcing-events/[eventId]/archive/route';
import { POST as seRfqPost, DELETE as seRfqDelete } from '../sourcing-events/[eventId]/rfqs/route';
import { POST as sharePost, DELETE as shareDelete } from '../[poId]/share/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}
type Seg<T> = { params: Promise<T> };

function req(url: string, body?: unknown, method = 'POST'): NextRequest {
  const u = new URL(url);
  return {
    url,
    nextUrl: u,
    method: body === undefined ? 'GET' : method,
    json: async () => body,
  } as unknown as NextRequest;
}

const BASE = 'https://app.test/api/procurement';
const rfqSeg: Seg<{ rfqId: string }> = { params: Promise.resolve({ rfqId: 'r1' }) };
const lineSeg: Seg<{ rfqId: string; lineId: string }> = {
  params: Promise.resolve({ rfqId: 'r1', lineId: 'l1' }),
};
const evSeg: Seg<{ eventId: string }> = { params: Promise.resolve({ eventId: 'ev1' }) };
const poSeg: Seg<{ poId: string }> = { params: Promise.resolve({ poId: 'po_1' }) };

const validLine = { source: 'ad_hoc', description: 'Item', trade: 'concrete' };

beforeEach(() => {
  jest.clearAllMocks();
  rfqLineSvc.addRfqLine.mockResolvedValue({ id: 'l1' });
  shareSvc.getPO.mockResolvedValue({ companyId: 'comp_1', poNumber: 'PO-1' });
  shareSvc.revokePOShare.mockResolvedValue(true);
  seSvc.getSourcingEvent.mockResolvedValue({ id: 'ev1', title: 'Event' });
});

// ===========================================================================
describe('rfqs/[rfqId]/lines — GET / POST', () => {
  it('GET → 200 { success, data:lines }', async () => {
    const res = (await linesGet(req(`${BASE}/rfqs/r1/lines`), rfqSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'l1' }] });
  });

  it('POST → 201 created(line)', async () => {
    const res = (await linesPost(req(`${BASE}/rfqs/r1/lines`, validLine), rfqSeg)) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'l1' } });
  });

  it('POST invalid body → 400 Validation failed', async () => {
    const res = (await linesPost(req(`${BASE}/rfqs/r1/lines`, { source: 'ad_hoc' }), rfqSeg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('POST null result → 500 Failed to create line', async () => {
    rfqLineSvc.addRfqLine.mockResolvedValue(null as unknown as { id: string });
    const res = (await linesPost(req(`${BASE}/rfqs/r1/lines`, validLine), rfqSeg)) as Envelope;
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Failed to create line');
  });

  it('POST service "not found" → 404 (mutation mapping)', async () => {
    rfqLineSvc.addRfqLine.mockRejectedValue(new Error('RFQ not found'));
    const res = (await linesPost(req(`${BASE}/rfqs/r1/lines`, validLine), rfqSeg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('RFQ not found');
  });

  it('POST service "Forbidden" → 403 (mutation mapping)', async () => {
    rfqLineSvc.addRfqLine.mockRejectedValue(new Error('Forbidden'));
    const res = (await linesPost(req(`${BASE}/rfqs/r1/lines`, validLine), rfqSeg)) as Envelope;
    expect(res.status).toBe(403);
  });

  it('POST service other error → 400 (mutation fallback)', async () => {
    rfqLineSvc.addRfqLine.mockRejectedValue(new Error('boom'));
    const res = (await linesPost(req(`${BASE}/rfqs/r1/lines`, validLine), rfqSeg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('boom');
  });
});

describe('rfqs/[rfqId]/lines/[lineId] — PATCH / DELETE', () => {
  it('PATCH → 200 ok(line)', async () => {
    const res = (await linePatch(req(`${BASE}/rfqs/r1/lines/l1`, { description: 'X' }, 'PATCH'), lineSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'l1' } });
  });

  it('PATCH service "not found" → 404', async () => {
    rfqLineSvc.updateRfqLine.mockRejectedValue(new Error('line not found'));
    const res = (await linePatch(req(`${BASE}/rfqs/r1/lines/l1`, {}, 'PATCH'), lineSeg)) as Envelope;
    expect(res.status).toBe(404);
  });

  it('DELETE → 200 { success, message:"RFQ line deleted" }', async () => {
    const res = (await lineDelete(req(`${BASE}/rfqs/r1/lines/l1`, undefined), lineSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'RFQ line deleted' });
  });

  it('DELETE service error → 400 fallback', async () => {
    rfqLineSvc.deleteRfqLine.mockRejectedValue(new Error('nope'));
    const res = (await lineDelete(req(`${BASE}/rfqs/r1/lines/l1`, undefined), lineSeg)) as Envelope;
    expect(res.status).toBe(400);
  });
});

describe('rfqs/[rfqId]/lines/bulk — POST', () => {
  it('→ 201 { success, data, count }', async () => {
    const body = { lines: [validLine, validLine] };
    const res = (await bulkPost(req(`${BASE}/rfqs/r1/lines/bulk`, body), rfqSeg)) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'l1' }, { id: 'l2' }], count: 2 });
  });

  it('empty lines → 400 Validation failed', async () => {
    const res = (await bulkPost(req(`${BASE}/rfqs/r1/lines/bulk`, { lines: [] }), rfqSeg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });
});

describe('rfqs/[rfqId]/lines/snapshot — POST', () => {
  it('→ 201 { success, data, count }', async () => {
    const body = { boqItemIds: ['b1'], trade: 'concrete' };
    const res = (await snapshotPost(req(`${BASE}/rfqs/r1/lines/snapshot`, body), rfqSeg)) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'l1' }], count: 1 });
  });
});

describe('sourcing-events — GET / POST', () => {
  it('GET → 200 { success, data }', async () => {
    const res = (await seGet(req(`${BASE}/sourcing-events`))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'ev1' }] });
  });

  it('POST → 201 created(event)', async () => {
    const res = (await sePost(req(`${BASE}/sourcing-events`, { projectId: 'p1', title: 'T' }))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'ev1' } });
  });

  it('POST invalid → 400 Validation failed', async () => {
    const res = (await sePost(req(`${BASE}/sourcing-events`, { projectId: 'p1' }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('POST service error → flat 400 (NOT errorStatus, even "not found")', async () => {
    seSvc.createSourcingEvent.mockRejectedValue(new Error('project not found'));
    const res = (await sePost(req(`${BASE}/sourcing-events`, { projectId: 'p1', title: 'T' }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('project not found');
  });
});

describe('sourcing-events/[eventId] — GET / PATCH', () => {
  it('GET → 200 { success, data }', async () => {
    const res = (await seOneGet(req(`${BASE}/sourcing-events/ev1`), evSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('GET not found → 404 Sourcing event not found', async () => {
    seSvc.getSourcingEvent.mockResolvedValue(null as unknown as { id: string; title: string });
    const res = (await seOneGet(req(`${BASE}/sourcing-events/ev1`), evSeg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Sourcing event not found');
  });

  it('PATCH → 200 ok(event)', async () => {
    const res = (await seOnePatch(req(`${BASE}/sourcing-events/ev1`, { title: 'New' }, 'PATCH'), evSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'ev1' } });
  });

  it('PATCH service "not found" → 404', async () => {
    seSvc.updateSourcingEvent.mockRejectedValue(new Error('event not found'));
    const res = (await seOnePatch(req(`${BASE}/sourcing-events/ev1`, {}, 'PATCH'), evSeg)) as Envelope;
    expect(res.status).toBe(404);
  });
});

describe('sourcing-events/[eventId]/archive — POST', () => {
  it('→ 200 { success, message:"Sourcing event archived" }', async () => {
    const res = (await archivePost(req(`${BASE}/sourcing-events/ev1/archive`, undefined), evSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'Sourcing event archived' });
  });

  it('service error → mapped (Forbidden → 403)', async () => {
    seSvc.archiveSourcingEvent.mockRejectedValue(new Error('Forbidden'));
    const res = (await archivePost(req(`${BASE}/sourcing-events/ev1/archive`, undefined), evSeg)) as Envelope;
    expect(res.status).toBe(403);
  });
});

describe('sourcing-events/[eventId]/rfqs — POST / DELETE', () => {
  it('POST → 200 { success, message:"RFQ linked to sourcing event" }', async () => {
    const res = (await seRfqPost(req(`${BASE}/sourcing-events/ev1/rfqs`, { rfqId: 'r1' }), evSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'RFQ linked to sourcing event' });
  });

  it('DELETE → 200 { success, message:"RFQ unlinked from sourcing event" }', async () => {
    const res = (await seRfqDelete(req(`${BASE}/sourcing-events/ev1/rfqs`, { rfqId: 'r1' }, 'DELETE'), evSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'RFQ unlinked from sourcing event' });
  });

  it('POST invalid body → 400 Validation failed', async () => {
    const res = (await seRfqPost(req(`${BASE}/sourcing-events/ev1/rfqs`, {}), evSeg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });
});

describe('[poId]/share — POST / DELETE', () => {
  it('POST → 201 { success, data:{shareId,token,url,expiresAt} }', async () => {
    const res = (await sharePost(req(`${BASE}/po_1/share`, {}), poSeg)) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        shareId: 'sh1',
        token: 'tok123',
        url: 'https://nestor-app.vercel.app/shared/po/tok123',
        expiresAt: '2026-08-01T00:00:00.000Z',
      },
    });
  });

  it('POST PO not found → 404 PO not found', async () => {
    shareSvc.getPO.mockResolvedValue(null as unknown as { companyId: string; poNumber: string });
    const res = (await sharePost(req(`${BASE}/po_1/share`, {}), poSeg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('PO not found');
  });

  it('POST wrong tenant → 404 PO not found', async () => {
    shareSvc.getPO.mockResolvedValue({ companyId: 'other', poNumber: 'PO-1' });
    const res = (await sharePost(req(`${BASE}/po_1/share`, {}), poSeg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('PO not found');
  });

  it('DELETE → 200 { success:true }', async () => {
    const res = (await shareDelete(req(`${BASE}/po_1/share`, { shareId: 's1' }, 'DELETE'), poSeg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('DELETE bad body → 400 shareId is required', async () => {
    const res = (await shareDelete(req(`${BASE}/po_1/share`, {}, 'DELETE'), poSeg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('shareId is required');
  });

  it('DELETE revoke false → 500 Failed to revoke share', async () => {
    shareSvc.revokePOShare.mockResolvedValue(false);
    const res = (await shareDelete(req(`${BASE}/po_1/share`, { shareId: 's1' }, 'DELETE'), poSeg)) as Envelope;
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Failed to revoke share');
  });
});
