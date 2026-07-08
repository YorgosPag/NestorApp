/**
 * Contract tests — ADR-603 procurement migration batch A (catalog CRUD).
 *
 * Proves each defineRoute-migrated route is BYTE-IDENTICAL to its previous
 * inline handler: same `{success,data}` envelopes, status codes, validation
 * messages, and the contract-risky error→status mapping — through the REAL
 * factory + REAL safeParseBody + REAL zod schemas + REAL
 * `resolveProcurementErrorStatus` SSoT:
 *
 *   - materials (+[materialId]) and agreements (+[agreementId])
 *   - create-mode mapping: conflict→409, validation→400, else→**500**
 *   - mutation-mode mapping: conflict→409, validation→400,
 *     `not found`→404, `Forbidden`→403, else→**400**
 *   - 404 not-found (GET detail), 201 created, 200 { success:true } (DELETE)
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

var materialSvc = {
  listMaterials: jest.fn(async () => []),
  createMaterial: jest.fn(),
  getMaterial: jest.fn(),
  updateMaterial: jest.fn(),
  softDeleteMaterial: jest.fn(async () => undefined),
};

jest.mock('@/subapps/procurement/services/material-service', () => ({
  listMaterials: (...a: unknown[]) => materialSvc.listMaterials(...a),
  createMaterial: (...a: unknown[]) => materialSvc.createMaterial(...a),
  getMaterial: (...a: unknown[]) => materialSvc.getMaterial(...a),
  updateMaterial: (...a: unknown[]) => materialSvc.updateMaterial(...a),
  softDeleteMaterial: (...a: unknown[]) => materialSvc.softDeleteMaterial(...a),
}));

var agreementSvc = {
  listFrameworkAgreements: jest.fn(async () => []),
  createFrameworkAgreement: jest.fn(),
  getFrameworkAgreement: jest.fn(),
  updateFrameworkAgreement: jest.fn(),
  softDeleteFrameworkAgreement: jest.fn(async () => undefined),
};

jest.mock('@/subapps/procurement/services/framework-agreement-service', () => ({
  listFrameworkAgreements: (...a: unknown[]) => agreementSvc.listFrameworkAgreements(...a),
  createFrameworkAgreement: (...a: unknown[]) => agreementSvc.createFrameworkAgreement(...a),
  getFrameworkAgreement: (...a: unknown[]) => agreementSvc.getFrameworkAgreement(...a),
  updateFrameworkAgreement: (...a: unknown[]) => agreementSvc.updateFrameworkAgreement(...a),
  softDeleteFrameworkAgreement: (...a: unknown[]) => agreementSvc.softDeleteFrameworkAgreement(...a),
}));

import type { NextRequest } from 'next/server';
import { GET as matGet, POST as matPost } from '../materials/route';
import { GET as matIdGet, PATCH as matIdPatch, DELETE as matIdDelete } from '../materials/[materialId]/route';
import { GET as agrGet, POST as agrPost } from '../agreements/route';
import { GET as agrIdGet, PATCH as agrIdPatch, DELETE as agrIdDelete } from '../agreements/[agreementId]/route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}
type Seg<T> = { params: Promise<T> };

function req(body?: unknown, url = 'https://app.test/api/procurement/x'): NextRequest {
  return {
    url,
    method: body === undefined ? 'GET' : 'POST',
    json: async () => body,
  } as unknown as NextRequest;
}

function named(name: string, message = 'boom'): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

const validMaterial = {
  code: 'MAT-1', name: 'Cement', unit: 'kg', atoeCategoryCode: 'A1',
};
const validAgreement = {
  agreementNumber: 'FA-1', title: 'Deal', vendorContactId: 'v1',
  validFrom: '2026-01-01', validUntil: '2026-12-31', discountType: 'flat',
};

beforeEach(() => {
  jest.clearAllMocks();
  materialSvc.listMaterials.mockResolvedValue([]);
  agreementSvc.listFrameworkAgreements.mockResolvedValue([]);
});

// ===========================================================================
// materials — list + create
// ===========================================================================

describe('materials — GET/POST', () => {
  it('GET → 200 { success:true, data }', async () => {
    materialSvc.listMaterials.mockResolvedValue([{ id: 'm1' }]);
    const res = (await matGet(req())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'm1' }] });
  });

  it('POST valid → 201 created', async () => {
    materialSvc.createMaterial.mockResolvedValue({ id: 'm1', ...validMaterial });
    const res = (await matPost(req(validMaterial))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'm1', ...validMaterial } });
  });

  it('POST zod invalid → 400 Validation failed', async () => {
    const res = (await matPost(req({ code: '' }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('POST conflict → 409', async () => {
    materialSvc.createMaterial.mockRejectedValue(named('MaterialCodeConflictError', 'dup code'));
    const res = (await matPost(req(validMaterial))) as Envelope;
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('dup code');
  });

  it('POST validation-error → 400', async () => {
    materialSvc.createMaterial.mockRejectedValue(named('MaterialValidationError', 'bad'));
    const res = (await matPost(req(validMaterial))) as Envelope;
    expect(res.status).toBe(400);
  });

  it('POST unknown error → 500 (create fallback)', async () => {
    materialSvc.createMaterial.mockRejectedValue(named('WeirdError', 'kaboom'));
    const res = (await matPost(req(validMaterial))) as Envelope;
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('kaboom');
  });
});

// ===========================================================================
// materials/[materialId] — detail CRUD
// ===========================================================================

describe('materials/[materialId] — GET/PATCH/DELETE', () => {
  const seg: Seg<{ materialId: string }> = { params: Promise.resolve({ materialId: 'm1' }) };

  it('GET found → 200', async () => {
    materialSvc.getMaterial.mockResolvedValue({ id: 'm1' });
    const res = (await matIdGet(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'm1' } });
  });

  it('GET not found → 404', async () => {
    materialSvc.getMaterial.mockResolvedValue(null);
    const res = (await matIdGet(req(), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Material not found');
  });

  it('PATCH ok → 200 data', async () => {
    materialSvc.updateMaterial.mockResolvedValue({ id: 'm1', name: 'X' });
    const res = (await matIdPatch(req({ name: 'X' }), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: 'm1', name: 'X' } });
  });

  it('PATCH not-found message → 404 (mutation)', async () => {
    materialSvc.updateMaterial.mockRejectedValue(new Error('Material not found'));
    const res = (await matIdPatch(req({ name: 'X' }), seg)) as Envelope;
    expect(res.status).toBe(404);
  });

  it('PATCH forbidden message → 403 (mutation)', async () => {
    materialSvc.updateMaterial.mockRejectedValue(new Error('Forbidden'));
    const res = (await matIdPatch(req({ name: 'X' }), seg)) as Envelope;
    expect(res.status).toBe(403);
  });

  it('PATCH unknown → 400 (mutation fallback)', async () => {
    materialSvc.updateMaterial.mockRejectedValue(new Error('whatever'));
    const res = (await matIdPatch(req({ name: 'X' }), seg)) as Envelope;
    expect(res.status).toBe(400);
  });

  it('DELETE ok → 200 { success:true }', async () => {
    const res = (await matIdDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('DELETE conflict → 409', async () => {
    materialSvc.softDeleteMaterial.mockRejectedValue(named('MaterialCodeConflictError'));
    const res = (await matIdDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(409);
  });
});

// ===========================================================================
// agreements — mirror (same SSoT helper, different error names)
// ===========================================================================

describe('agreements — GET/POST', () => {
  it('GET → 200 data', async () => {
    agreementSvc.listFrameworkAgreements.mockResolvedValue([{ id: 'a1' }]);
    const res = (await agrGet(req())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'a1' }] });
  });

  it('POST valid → 201 created', async () => {
    agreementSvc.createFrameworkAgreement.mockResolvedValue({ id: 'a1' });
    const res = (await agrPost(req(validAgreement))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'a1' } });
  });

  it('POST conflict → 409', async () => {
    agreementSvc.createFrameworkAgreement.mockRejectedValue(named('FrameworkAgreementNumberConflictError', 'dup'));
    const res = (await agrPost(req(validAgreement))) as Envelope;
    expect(res.status).toBe(409);
  });

  it('POST unknown → 500 (create fallback)', async () => {
    agreementSvc.createFrameworkAgreement.mockRejectedValue(new Error('oops'));
    const res = (await agrPost(req(validAgreement))) as Envelope;
    expect(res.status).toBe(500);
  });
});

describe('agreements/[agreementId] — GET/PATCH/DELETE', () => {
  const seg: Seg<{ agreementId: string }> = { params: Promise.resolve({ agreementId: 'a1' }) };

  it('GET not found → 404', async () => {
    agreementSvc.getFrameworkAgreement.mockResolvedValue(null);
    const res = (await agrIdGet(req(), seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Framework agreement not found');
  });

  it('PATCH not-found message → 404', async () => {
    agreementSvc.updateFrameworkAgreement.mockRejectedValue(new Error('agreement not found'));
    const res = (await agrIdPatch(req({ title: 'X' }), seg)) as Envelope;
    expect(res.status).toBe(404);
  });

  it('DELETE ok → 200 { success:true }', async () => {
    const res = (await agrIdDelete(req(), seg)) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
