/**
 * Contract tests — ADR-603 accounting migration batch Φ1.
 *
 * Proves each defineRoute-migrated route is BYTE-IDENTICAL to its previous inline
 * handler: same envelopes, status codes, validation messages, and (for
 * fiscal-periods) the `error.flatten()` details shape — through the REAL factory.
 *
 * Routes covered: apy-certificates/[id], assets, balances/[customerId],
 * fiscal-periods, fiscal-periods/[periodId].
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
  companyId: 'comp_caller',
  email: 'g@example.com',
  globalRole: 'admin',
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, segmentData?: unknown) =>
      callback(request, authCtx, { cache: true }, segmentData),
  logAuditEvent: jest.fn(async () => undefined),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

var repo = {
  getAPYCertificate: jest.fn(),
  updateAPYCertificate: jest.fn(async () => undefined),
  listFixedAssets: jest.fn(),
  createFixedAsset: jest.fn(),
  getCustomerBalance: jest.fn(),
  listCustomerBalances: jest.fn(async () => []),
  listFiscalPeriods: jest.fn(async () => []),
  getFiscalPeriod: jest.fn(),
};

jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({ repository: repo }),
}));

var svc = {
  createFiscalYear: jest.fn(),
  getYearEndChecklist: jest.fn(),
  closePeriod: jest.fn(async () => undefined),
  lockPeriod: jest.fn(async () => undefined),
  reopenPeriod: jest.fn(async () => undefined),
};

jest.mock('@/subapps/accounting/services/fiscal-period-service', () => ({
  createFiscalYear: (...a: unknown[]) => svc.createFiscalYear(...a),
  getYearEndChecklist: (...a: unknown[]) => svc.getYearEndChecklist(...a),
  closePeriod: (...a: unknown[]) => svc.closePeriod(...a),
  lockPeriod: (...a: unknown[]) => svc.lockPeriod(...a),
  reopenPeriod: (...a: unknown[]) => svc.reopenPeriod(...a),
}));

import type { NextRequest } from 'next/server';
import { GET as apyGet, PATCH as apyPatch } from '../apy-certificates/[id]/route';
import { POST as assetsPost } from '../assets/route';
import { GET as balGet } from '../balances/route';
import { GET as balCustGet } from '../balances/[customerId]/route';
import { GET as fpGet, POST as fpPost } from '../fiscal-periods/route';
import { PATCH as fpPatch } from '../fiscal-periods/[periodId]/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}
type Seg<T> = { params: Promise<T> };

function req(body?: unknown, url = 'https://app.test/api/accounting/x'): NextRequest {
  return { url, method: body ? 'POST' : 'GET', json: async () => body } as unknown as NextRequest;
}

beforeEach(() => jest.clearAllMocks());

describe('apy-certificates/[id]', () => {
  const seg: Seg<{ id: string }> = { params: Promise.resolve({ id: 'apy_1' }) };

  it('GET found → 200 { success:true, data }', async () => {
    repo.getAPYCertificate.mockResolvedValue({ certificateId: 'apy_1' });
    const res = (await apyGet(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { certificateId: 'apy_1' } });
  });

  it('GET not found → 404', async () => {
    repo.getAPYCertificate.mockResolvedValue(null);
    const res = (await apyGet(req(), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, error: 'APY certificate not found' });
  });

  it('PATCH → 200 { success:true } (no data) and persists', async () => {
    repo.getAPYCertificate.mockResolvedValue({ certificateId: 'apy_1' });
    const res = (await apyPatch(req({ isReceived: true }), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(repo.updateAPYCertificate).toHaveBeenCalledWith('apy_1', { isReceived: true });
  });

  it('PATCH not found → 404, no write', async () => {
    repo.getAPYCertificate.mockResolvedValue(null);
    const res = (await apyPatch(req({ isReceived: true }), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect(repo.updateAPYCertificate).not.toHaveBeenCalled();
  });
});

describe('assets POST — manual validation', () => {
  it('missing required fields → 400 exact message', async () => {
    const res = (await assetsPost(req({ acquisitionCost: 10 }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('description, category, and acquisitionDate are required');
  });

  it('non-positive cost → 400 exact message', async () => {
    const res = (await assetsPost(req({ description: 'd', category: 'c', acquisitionDate: '2026-01-01', acquisitionCost: 0 }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('acquisitionCost must be a positive number');
  });

  it('valid → 201 { success:true, data:{ assetId } }', async () => {
    repo.createFixedAsset.mockResolvedValue({ id: 'asset_9' });
    const res = (await assetsPost(req({ description: 'd', category: 'c', acquisitionDate: '2026-01-01', acquisitionCost: 100 }))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { assetId: 'asset_9' } });
  });
});

describe('balances/[customerId]', () => {
  it('missing customerId → 400', async () => {
    const res = (await balCustGet(req(), { params: Promise.resolve({ customerId: '' }) })) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Missing customerId');
  });

  it('not found → 404', async () => {
    repo.getCustomerBalance.mockResolvedValue(null);
    const res = (await balCustGet(req(), { params: Promise.resolve({ customerId: 'cust_1' }) })) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Customer balance not found');
  });

  it('found → 200 { success:true, data }', async () => {
    repo.getCustomerBalance.mockResolvedValue({ customerId: 'cust_1', balance: 42 });
    const res = (await balCustGet(req(), { params: Promise.resolve({ customerId: 'cust_1' }) })) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { customerId: 'cust_1', balance: 42 } });
  });
});

describe('fiscal-periods POST — flatten() details shape preserved', () => {
  it('invalid → 400 with { details: { fieldErrors } } (NOT the safeParseBody array)', async () => {
    const res = (await fpPost(req({ fiscalYear: 'nope' }))) as Envelope;
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Validation failed');
    expect(payload.details).toHaveProperty('fieldErrors');
    expect(payload.details).toHaveProperty('formErrors');
  });

  it('valid → 201 { data:{ fiscalYear, periodsCreated } }', async () => {
    svc.createFiscalYear.mockResolvedValue([1, 2, 3]);
    const res = (await fpPost(req({ fiscalYear: 2026 }))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { fiscalYear: 2026, periodsCreated: 3 } });
  });
});

describe('resolveFiscalYearParam SSoT (balances + fiscal-periods GET)', () => {
  it('balances GET defaults fiscalYear + returns items/total shape', async () => {
    repo.listCustomerBalances.mockResolvedValue([{ id: 'b1' }]);
    const res = (await balGet(req())) as Envelope;
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect((payload.data as { total: number }).total).toBe(1);
  });

  it('balances GET invalid fiscalYear → 400 Invalid fiscalYear', async () => {
    const res = (await balGet(req(undefined, 'https://app.test/api/accounting/balances?fiscalYear=abc'))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid fiscalYear');
  });

  it('fiscal-periods GET with checklist → merges yearEndChecklist', async () => {
    repo.listFiscalPeriods.mockResolvedValue([{ id: 'p1' }]);
    svc.getYearEndChecklist.mockResolvedValue({ ready: true });
    const res = (await fpGet(req(undefined, 'https://app.test/api/accounting/fiscal-periods?checklist=true'))) as Envelope;
    expect(res.status).toBe(200);
    const data = (await res.json()).data as Record<string, unknown>;
    expect(data.yearEndChecklist).toEqual({ ready: true });
  });
});

describe('fiscal-periods/[periodId] PATCH', () => {
  const seg: Seg<{ periodId: string }> = { params: Promise.resolve({ periodId: 'fp_1' }) };

  it('reopen without reason → 400 exact message', async () => {
    const res = (await fpPatch(req({ action: 'reopen' }), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Reason is required for reopen action');
    expect(svc.reopenPeriod).not.toHaveBeenCalled();
  });

  it('invalid action → 400 Validation failed (flatten)', async () => {
    const res = (await fpPatch(req({ action: 'boom' }), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('close → 200 { success:true, data: updated }', async () => {
    repo.getFiscalPeriod.mockResolvedValue({ periodId: 'fp_1', status: 'closed' });
    const res = (await fpPatch(req({ action: 'close' }), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { periodId: 'fp_1', status: 'closed' } });
    expect(svc.closePeriod).toHaveBeenCalledWith(repo, 'fp_1', 'user_1');
  });
});
