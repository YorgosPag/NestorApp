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
  getCompanySetup: jest.fn(),
  collectInvoices: jest.fn(),
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
  const validBody = { fiscalYear: 2026, customerId: 'cust_1' };

  const profile = {
    businessName: 'P', vatNumber: '123', taxOffice: 'ΔΟΥ', address: 'A', city: 'C',
    postalCode: '1', profession: 'X', phone: null, email: null,
  };

  const ledgerInvoice = {
    invoiceId: 'inv_1', series: 'Α', number: 7, type: 'service_invoice', issueDate: '2026-03-01', fiscalYear: 2026,
    totalNetAmount: 1000, withholdingRate: 20, withholdingAmount: 200,
    mydata: { status: 'sent' },
    customer: { contactId: 'cust_1', name: 'C', vatNumber: '456', taxOffice: null, address: null, city: null },
  };

  beforeEach(() => {
    repo.getCompanySetup.mockResolvedValue(profile);
    repo.collectInvoices.mockResolvedValue([ledgerInvoice]);
  });

  it('creates → 201 { success:true, data:{ id } }', async () => {
    repo.listAPYCertificates.mockResolvedValue([]);
    repo.createAPYCertificate.mockResolvedValue({ id: 'apy_new' });
    const res = (await POST(req(validBody))) as Envelope;
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'apy_new' } });
  });

  /**
   * 🔴 Ο ΔΙΑΚΟΜΙΣΤΗΣ ΥΠΟΛΟΓΙΖΕΙ (ADR-ACC-020): ποσά από το σώμα αγνοούνται — αποθηκεύεται ό,τι βγάζει το καθολικό.
   * ΜΕΤΑΛΛΑΞΗ: ξαναπέρνα `body.lineItems`/σύνολα στο `createAPYCertificate` ⇒ κόκκινο.
   */
  it('🔴 stores LEDGER-computed lines/totals/snapshots, never amounts from the body', async () => {
    repo.listAPYCertificates.mockResolvedValue([]);
    repo.createAPYCertificate.mockResolvedValue({ id: 'apy_new' });

    await POST(req({ ...validBody, lineItems: [{ forged: true }], totalWithholdingAmount: 999_999 }));

    expect(repo.collectInvoices).toHaveBeenCalledWith({ scope: { kind: 'customer', customerId: 'cust_1', asOf: '2026-12-31' } });
    expect(repo.createAPYCertificate).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust_1',
      lineItems: [{ invoiceId: 'inv_1', invoiceNumber: 'Α-7', issueDate: '2026-03-01', netAmount: 1000, withholdingRate: 20, withholdingAmount: 200 }],
      totalNetAmount: 1000,
      totalWithholdingAmount: 200,
      provider: expect.objectContaining({ name: 'P', vatNumber: '123' }),
      customer: { name: 'C', vatNumber: '456', taxOffice: null, address: null, city: null },
    }));
  });

  it('no eligible invoice → 400, nothing stored', async () => {
    repo.listAPYCertificates.mockResolvedValue([]);
    repo.collectInvoices.mockResolvedValue([{ ...ledgerInvoice, withholdingAmount: 0 }]);
    const res = (await POST(req(validBody))) as Envelope;
    expect(res.status).toBe(400);
    expect(repo.createAPYCertificate).not.toHaveBeenCalled();
  });

  it('missing company setup → 400, nothing stored', async () => {
    repo.listAPYCertificates.mockResolvedValue([]);
    repo.getCompanySetup.mockResolvedValue(null);
    const res = (await POST(req(validBody))) as Envelope;
    expect(res.status).toBe(400);
    expect(repo.createAPYCertificate).not.toHaveBeenCalled();
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
