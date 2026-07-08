/**
 * Pilot migration contract test — /api/accounting/apy-certificates (ADR-602).
 *
 * Proves the defineRoute-migrated route is BYTE-IDENTICAL to the previous inline
 * handler assembly: same envelopes, same status codes, same 409 extra field.
 * Runs through the REAL defineRoute factory (only auth / rate-limit / repository
 * are mocked), so it also exercises the factory end-to-end.
 *
 * @enterprise ADR-602 API Route-Handler Factory SSoT
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

var repo = {
  listAPYCertificates: jest.fn(),
  createAPYCertificate: jest.fn(),
};

jest.mock('@/subapps/accounting/services/create-accounting-services', () => ({
  createAccountingServices: () => ({ repository: repo }),
}));

import type { NextRequest } from 'next/server';
import { GET, POST } from '../route';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}

function req(body?: unknown, url = 'https://app.test/api/accounting/apy-certificates'): NextRequest {
  return { url, method: body ? 'POST' : 'GET', json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/accounting/apy-certificates', () => {
  it('returns { success:true, data } 200', async () => {
    repo.listAPYCertificates.mockResolvedValue([{ certificateId: 'apy_1' }]);
    const res = (await GET(req())) as Envelope;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ certificateId: 'apy_1' }] });
  });

  it('invalid fiscalYear → 400 { success:false, error }', async () => {
    const res = (await GET(req(undefined, 'https://app.test/api/accounting/apy-certificates?fiscalYear=abc'))) as Envelope;
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: 'Invalid fiscalYear parameter' });
  });
});

describe('POST /api/accounting/apy-certificates', () => {
  const validBody = {
    fiscalYear: 2026,
    customerId: 'cust_1',
    provider: { name: 'P', vatNumber: '123' },
    customer: { name: 'C', vatNumber: '456' },
    lineItems: [{ x: 1 }],
    totalNetAmount: 100,
    totalWithholdingAmount: 20,
  };

  it('creates → 201 { success:true, data:{ id } }', async () => {
    repo.listAPYCertificates.mockResolvedValue([]);
    repo.createAPYCertificate.mockResolvedValue({ id: 'apy_new' });
    const res = (await POST(req(validBody))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'apy_new' } });
  });

  it('duplicate → 409 with existingCertificateId (byte-identical extra field)', async () => {
    repo.listAPYCertificates.mockResolvedValue([{ certificateId: 'apy_dup' }]);
    const res = (await POST(req(validBody))) as Envelope;
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: 'Certificate already exists for this customer and fiscal year',
      existingCertificateId: 'apy_dup',
    });
    expect(repo.createAPYCertificate).not.toHaveBeenCalled();
  });

  it('schema violation → 400 Validation failed', async () => {
    const res = (await POST(req({ fiscalYear: 'nope' }))) as Envelope;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });
});
