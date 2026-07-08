/**
 * Contract tests — ADR-603 procurement migration batch C1 (leaf routes, bare envelope).
 *
 * Proves the defineRoute-migrated leaf routes are BYTE-IDENTICAL to their previous
 * inline handlers: same `{success,data}` / `{success,error}` envelopes, status
 * codes, and validation-guard messages — through the REAL factory:
 *
 *   - project-overview-stats (GET, projectId guard → 400)
 *   - spend-analytics (GET, role guard → 403)
 *   - supplier-metrics (+comparison) (GET, supplierId guard → 400)
 *   - vendor-invites (GET, vendorContactId guard → 400)
 *   - sourcing-events/[eventId]/aggregate (GET, 404 not-found)
 *   - invoice-match (POST, expenseDocId/doc/extractedData guards → 400/404)
 *   - [poId]/email (POST, invalid-body → 400, PO not-found → 404, send-fail → 500)
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

// ---- Firestore admin (supplier-metrics + invoice-match) --------------------
var fsDoc = {
  get: jest.fn(async () => ({ exists: true, data: () => ({}) })),
  update: jest.fn(async () => undefined),
};
var fsCollection = { doc: jest.fn(() => fsDoc) };
var adminDb = { collection: jest.fn(() => fsCollection) };
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => adminDb }));
jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { CONTACTS: 'contacts', ACCOUNTING_EXPENSE_DOCUMENTS: 'accounting_expense_documents' },
}));

// ---- project-overview-stats ------------------------------------------------
var statsSvc = {
  computeProjectBasicStats: jest.fn(async () => ({
    openRfqCount: 1, pendingApprovalPoCount: 2, totalCommittedSpend: 3,
  })),
  computeBoqCoverageStats: jest.fn(async () => ({
    budgetVsCommitted: [], coveredBoqItemCount: 4, totalBoqItemCount: 5, coveragePercentage: 80,
  })),
};
jest.mock('@/services/procurement/aggregators/projectProcurementStats', () => ({
  computeProjectBasicStats: (...a: unknown[]) => statsSvc.computeProjectBasicStats(...a),
}));
jest.mock('@/services/procurement/aggregators/projectBoqCoverageStats', () => ({
  computeBoqCoverageStats: (...a: unknown[]) => statsSvc.computeBoqCoverageStats(...a),
}));

// ---- spend-analytics -------------------------------------------------------
var spendSvc = { computeSpendAnalytics: jest.fn(async () => ({ total: 100 })) };
jest.mock('@/services/procurement/aggregators/spendAnalyticsAggregator', () => ({
  computeSpendAnalytics: (...a: unknown[]) => spendSvc.computeSpendAnalytics(...a),
}));
var permSvc = { canViewSpendAnalytics: jest.fn(() => true) };
jest.mock('@/lib/auth/permissions/spend-analytics', () => ({
  canViewSpendAnalytics: (...a: unknown[]) => permSvc.canViewSpendAnalytics(...a),
}));
jest.mock('@/lib/date/quarter-helpers', () => ({
  getCurrentQuarterRange: () => ({ from: '2026-01-01', to: '2026-03-31' }),
}));
jest.mock('@/lib/url-filters/multi-value', () => ({
  parseFilterArray: (v: string | null) => (v ? v.split(',') : []),
}));

// ---- supplier-metrics ------------------------------------------------------
var metricsSvc = {
  calculateSupplierMetrics: jest.fn(async () => ({ score: 9 })),
  getSupplierPriceTrend: jest.fn(async () => ({ points: [] })),
  getSupplierComparison: jest.fn(async () => [{ supplierId: 's1' }]),
};
jest.mock('@/services/procurement/supplier-metrics-service', () => ({
  calculateSupplierMetrics: (...a: unknown[]) => metricsSvc.calculateSupplierMetrics(...a),
  getSupplierPriceTrend: (...a: unknown[]) => metricsSvc.getSupplierPriceTrend(...a),
  getSupplierComparison: (...a: unknown[]) => metricsSvc.getSupplierComparison(...a),
}));

// ---- vendor-invites --------------------------------------------------------
var vendorSvc = { listVendorInvitesByVendor: jest.fn(async () => [{ id: 'inv1' }]) };
jest.mock('@/subapps/procurement/services/vendor-invite-service', () => ({
  listVendorInvitesByVendor: (...a: unknown[]) => vendorSvc.listVendorInvitesByVendor(...a),
}));

// ---- sourcing-events aggregate ---------------------------------------------
var seSvc = {
  getSourcingEvent: jest.fn(async () => ({
    id: 'ev1', title: 'Event', status: 'open', rfqCount: 0, rfqIds: [],
  })),
};
jest.mock('@/subapps/procurement/services/sourcing-event-service', () => ({
  getSourcingEvent: (...a: unknown[]) => seSvc.getSourcingEvent(...a),
}));
jest.mock('@/subapps/procurement/services/rfq-service', () => ({
  getRfq: jest.fn(async () => null),
}));
jest.mock('@/subapps/procurement/services/quote-service', () => ({
  listQuotes: jest.fn(async () => []),
}));

// ---- invoice-match ---------------------------------------------------------
var matchSvc = {
  matchInvoiceToPO: jest.fn(async () => ({ candidates: [], bestMatch: null, autoMatched: false })),
};
jest.mock('@/services/procurement/po-invoice-matcher', () => ({
  matchInvoiceToPO: (...a: unknown[]) => matchSvc.matchInvoiceToPO(...a),
}));
jest.mock('@/lib/date-local', () => ({ nowISO: () => '2026-07-08T00:00:00.000Z' }));

// ---- [poId]/email ----------------------------------------------------------
var emailSvc = {
  getPO: jest.fn(async () => ({ companyId: 'comp_1', supplierId: null, poNumber: 'PO-1' })),
  sendPurchaseOrderEmail: jest.fn(async () => ({ success: true, messageId: 'msg_1' })),
  resolveContactDepartmentEmail: jest.fn(async () => null),
};
jest.mock('@/services/procurement', () => ({
  getPO: (...a: unknown[]) => emailSvc.getPO(...a),
}));
jest.mock('@/services/procurement/po-email-service', () => ({
  sendPurchaseOrderEmail: (...a: unknown[]) => emailSvc.sendPurchaseOrderEmail(...a),
}));
jest.mock('@/services/org-structure/org-routing-resolver', () => ({
  resolveContactDepartmentEmail: (...a: unknown[]) => emailSvc.resolveContactDepartmentEmail(...a),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(() => Promise.resolve()) },
}));

import type { NextRequest } from 'next/server';
import { GET as statsGet } from '../project-overview-stats/route';
import { GET as spendGet } from '../spend-analytics/route';
import { GET as smGet } from '../supplier-metrics/route';
import { GET as smCmpGet } from '../supplier-metrics/comparison/route';
import { GET as viGet } from '../vendor-invites/route';
import { GET as aggGet } from '../sourcing-events/[eventId]/aggregate/route';
import { POST as matchPost } from '../invoice-match/route';
import { POST as emailPost } from '../[poId]/email/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}
type Seg<T> = { params: Promise<T> };

function req(url: string, body?: unknown): NextRequest {
  const u = new URL(url);
  return {
    url,
    nextUrl: u,
    method: body === undefined ? 'GET' : 'POST',
    json: async () => body,
  } as unknown as NextRequest;
}

const BASE = 'https://app.test/api/procurement';

beforeEach(() => {
  jest.clearAllMocks();
  permSvc.canViewSpendAnalytics.mockReturnValue(true);
  fsDoc.get.mockResolvedValue({ exists: true, data: () => ({ extractedData: { x: 1 } }) });
  emailSvc.getPO.mockResolvedValue({ companyId: 'comp_1', supplierId: null, poNumber: 'PO-1' });
  emailSvc.sendPurchaseOrderEmail.mockResolvedValue({ success: true, messageId: 'msg_1' });
  emailSvc.resolveContactDepartmentEmail.mockResolvedValue(null);
});

// ===========================================================================
describe('project-overview-stats — GET', () => {
  it('200 { success, data:stats }', async () => {
    const res = (await statsGet(req(`${BASE}/project-overview-stats?projectId=p1`))) as Envelope;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect((body.data as { openRfqCount: number }).openRfqCount).toBe(1);
  });

  it('missing projectId → 400', async () => {
    const res = (await statsGet(req(`${BASE}/project-overview-stats`))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('projectId is required');
  });
});

describe('spend-analytics — GET', () => {
  it('200 { success, data }', async () => {
    const res = (await spendGet(req(`${BASE}/spend-analytics`))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { total: 100 } });
  });

  it('forbidden role → 403 Forbidden', async () => {
    permSvc.canViewSpendAnalytics.mockReturnValue(false);
    const res = (await spendGet(req(`${BASE}/spend-analytics`))) as Envelope;
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Forbidden');
  });
});

describe('supplier-metrics — GET', () => {
  it('200 { success, data:{metrics,priceTrend} }', async () => {
    const res = (await smGet(req(`${BASE}/supplier-metrics?supplierId=s1`))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { metrics: { score: 9 }, priceTrend: null },
    });
  });

  it('missing supplierId → 400', async () => {
    const res = (await smGet(req(`${BASE}/supplier-metrics`))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('supplierId query param is required');
  });
});

describe('supplier-metrics/comparison — GET', () => {
  it('200 { success, data }', async () => {
    const res = (await smCmpGet(req(`${BASE}/supplier-metrics/comparison`))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ supplierId: 's1' }] });
  });
});

describe('vendor-invites — GET', () => {
  it('200 { success, data }', async () => {
    const res = (await viGet(req(`${BASE}/vendor-invites?vendorContactId=v1`))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'inv1' }] });
  });

  it('missing vendorContactId → 400', async () => {
    const res = (await viGet(req(`${BASE}/vendor-invites`))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('vendorContactId query param is required');
  });
});

describe('sourcing-events/[eventId]/aggregate — GET', () => {
  const seg: Seg<{ eventId: string }> = { params: Promise.resolve({ eventId: 'ev1' }) };

  it('200 { success, data:aggregate }', async () => {
    const res = (await aggGet(req(`${BASE}/sourcing-events/ev1/aggregate`), seg)) as Envelope;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect((body.data as { eventId: string }).eventId).toBe('ev1');
  });

  it('event not found → 404', async () => {
    seSvc.getSourcingEvent.mockResolvedValue(null);
    const res = (await aggGet(req(`${BASE}/sourcing-events/ev1/aggregate`), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Sourcing event not found');
  });
});

describe('invoice-match — POST', () => {
  it('200 { success, data:{candidates,bestMatch,autoMatched} }', async () => {
    const res = (await matchPost(req(`${BASE}/invoice-match`, { expenseDocId: 'doc_1' }))) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { candidates: [], bestMatch: null, autoMatched: false },
    });
  });

  it('missing expenseDocId → 400', async () => {
    const res = (await matchPost(req(`${BASE}/invoice-match`, {}))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('expenseDocId is required');
  });

  it('doc not found → 404', async () => {
    fsDoc.get.mockResolvedValue({ exists: false, data: () => undefined });
    const res = (await matchPost(req(`${BASE}/invoice-match`, { expenseDocId: 'doc_1' }))) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Expense document not found');
  });

  it('no extractedData → 400', async () => {
    fsDoc.get.mockResolvedValue({ exists: true, data: () => ({ extractedData: null }) });
    const res = (await matchPost(req(`${BASE}/invoice-match`, { expenseDocId: 'doc_1' }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Document has no extracted data yet');
  });
});

describe('[poId]/email — POST', () => {
  const seg: Seg<{ poId: string }> = { params: Promise.resolve({ poId: 'po_1' }) };
  const validBody = { recipientEmail: 'a@b.com', recipientName: 'Acme' };

  it('200 { success, data:{messageId} }', async () => {
    const res = (await emailPost(req(`${BASE}/po_1/email`, validBody), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { messageId: 'msg_1' } });
  });

  it('invalid body → 400 Invalid request body', async () => {
    const res = (await emailPost(req(`${BASE}/po_1/email`, { recipientEmail: 'not-email' }), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid request body');
  });

  it('PO not found → 404 PO not found', async () => {
    emailSvc.getPO.mockResolvedValue(null);
    const res = (await emailPost(req(`${BASE}/po_1/email`, validBody), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('PO not found');
  });

  it('send failure → 500 with service error', async () => {
    emailSvc.sendPurchaseOrderEmail.mockResolvedValue({ success: false, error: 'smtp down' });
    const res = (await emailPost(req(`${BASE}/po_1/email`, validBody), seg)) as Envelope;
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('smtp down');
  });
});
