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
  globalRole: 'company_admin' as string,
  mfaEnrolled: true,
  isAuthenticated: true as const,
};

/** Το σύνορο τιμά τον ΔΗΛΩΜΕΝΟ ρόλο της διαδρομής (ADR-ACC-010 Φ6: εγγραφές περιόδων = διοικητικός ρόλος). */
jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>, options?: { requiredGlobalRoles?: readonly string[] }) =>
    async (request: unknown, segmentData?: unknown) => {
      if (options?.requiredGlobalRoles && !options.requiredGlobalRoles.includes(authCtx.globalRole)) {
        return { status: 403, json: async () => ({ success: false, error: 'Forbidden' }) };
      }
      return callback(request, authCtx, { cache: true }, segmentData);
    },
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
  transitionFiscalPeriod: jest.fn(),
};

jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({ repository: repo }),
}));

var svc = {
  createFiscalYear: jest.fn(),
  getYearEndChecklist: jest.fn(),
};

jest.mock('@/subapps/accounting/services/fiscal-period-service', () => ({
  createFiscalYear: (...a: unknown[]) => svc.createFiscalYear(...a),
  getYearEndChecklist: (...a: unknown[]) => svc.getYearEndChecklist(...a),
}));

import type { NextRequest } from 'next/server';
import { GET as apyGet, PATCH as apyPatch } from '../apy-certificates/[id]/route';
import { POST as assetsPost } from '../assets/route';
import { GET as balGet } from '../balances/route';
import { GET as balCustGet } from '../balances/[customerId]/route';
import { GET as fpGet, POST as fpPost } from '../fiscal-periods/route';
import { PATCH as fpPatch } from '../fiscal-periods/[periodId]/route';
import {
  FiscalPeriodNotFoundError,
  FiscalPeriodTransitionError,
  FiscalYearExistsError,
} from '@/subapps/accounting/services/repository/accounting-repo-fiscal-periods';

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

  // Φάση 4 (ADR-ACC-010 §2.1.1): η κατηγορία αποφασίζει τον συντελεστή και οι ημερομηνίες τους μήνες απόσβεσης ⇒
  // ελέγχονται αυστηρά· ο συντελεστής του πελάτη δεν φτάνει ποτέ στη βάση (τον βάζει το repository).
  const VALID = {
    description: 'd', category: 'computers', acquisitionDate: '2026-01-01', depreciationStartDate: '2026-01-01',
    acquisitionCost: 100, residualValue: 0,
  };

  it.each([
    ['unknown category', { category: 'c' }, 'category must be one of ASSET_CATEGORIES'],
    ['impossible start date', { depreciationStartDate: '2026-02-30' }, 'acquisitionDate and depreciationStartDate must be YYYY-MM-DD'],
    ['non-positive cost', { acquisitionCost: 0 }, 'acquisitionCost must be a positive number'],
    ['residual above cost', { residualValue: 101 }, 'residualValue must be between 0 and acquisitionCost'],
  ])('%s → 400 exact message, nothing written', async (_label, override, message) => {
    const res = (await assetsPost(req({ ...VALID, ...override }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(message);
    expect(repo.createFixedAsset).not.toHaveBeenCalled();
  });

  it('valid → 201 { success:true, data:{ assetId } }', async () => {
    repo.createFixedAsset.mockResolvedValue({ id: 'asset_9' });
    const res = (await assetsPost(req(VALID))) as Envelope;
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

  it('υπάρχουσα χρήση ⇒ 409 FISCAL_YEAR_EXISTS (ποτέ αντικατάσταση)', async () => {
    svc.createFiscalYear.mockRejectedValue(new FiscalYearExistsError(2026));
    const res = (await fpPost(req({ fiscalYear: 2026 }))) as Envelope;
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ success: false, errorCode: 'FISCAL_YEAR_EXISTS' });
  });
});

describe('balances GET (ανοιχτά στοιχεία όλων των χρήσεων) + fiscal-periods GET', () => {
  it('balances GET → items/total χωρίς χρήση (ADR-ACC-010 §2.1.1 Φάση 3)', async () => {
    repo.listCustomerBalances.mockResolvedValue([{ id: 'b1' }]);
    const res = (await balGet(req())) as Envelope;
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({ items: [{ id: 'b1' }], total: 1 });
    expect(repo.listCustomerBalances).toHaveBeenCalledWith();
  });

  it('fiscal-periods GET invalid fiscalYear → 400 Invalid fiscalYear (SSoT resolveFiscalYearParam)', async () => {
    const res = (await fpGet(req(undefined, 'https://app.test/api/accounting/fiscal-periods?fiscalYear=abc'))) as Envelope;
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
    expect(repo.transitionFiscalPeriod).not.toHaveBeenCalled();
  });

  it('invalid action → 400 Validation failed (flatten)', async () => {
    const res = (await fpPatch(req({ action: 'boom' }), seg)) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('close → 200 { success:true, data: updated } — η περίοδος όπως ΤΗΝ ΕΓΡΑΨΕ ο γραφέας (καμία δεύτερη ανάγνωση)', async () => {
    repo.transitionFiscalPeriod.mockResolvedValue({ periodId: 'fp_1', status: 'CLOSED' });
    const res = (await fpPatch(req({ action: 'close' }), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { periodId: 'fp_1', status: 'CLOSED' } });
    expect(repo.transitionFiscalPeriod).toHaveBeenCalledWith('fp_1', { action: 'close', userId: 'user_1', reason: null });
  });

  it.each([
    ['PATCH (κλείδωμα)', () => fpPatch(req({ action: 'lock' }), seg), () => repo.transitionFiscalPeriod],
    ['POST (νέα χρήση)', () => fpPost(req({ fiscalYear: 2027 })), () => svc.createFiscalYear],
  ] as const)('%s χωρίς διοικητικό ρόλο ⇒ 403, τίποτα δεν εκτελείται (Xero: μόνο Adviser)', async (_l, call, target) => {
    authCtx.globalRole = 'internal_user';
    try {
      expect(((await call()) as Envelope).status).toBe(403);
      expect(target()).not.toHaveBeenCalled();
    } finally {
      authCtx.globalRole = 'company_admin';
    }
  });

  // ADR-ACC-010 §2.1.1 Φ6 — ανύπαρκτη/ξένη ⇒ 404 (καμία διαρροή ύπαρξης) · άκυρη μετάβαση ⇒ 409, με κωδικό.
  it.each([
    [new FiscalPeriodNotFoundError('fp_1'), 404, 'FISCAL_PERIOD_NOT_FOUND'],
    [new FiscalPeriodTransitionError('fp_1', 'reopen', 'LOCKED'), 409, 'FISCAL_PERIOD_INVALID_TRANSITION'],
  ] as const)('%s ⇒ %i %s', async (error, status, code) => {
    repo.transitionFiscalPeriod.mockRejectedValue(error);
    const res = (await fpPatch(req({ action: 'reopen', reason: 'διόρθωση ΦΠΑ' }), seg)) as Envelope;
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ success: false, errorCode: code });
  });
});
