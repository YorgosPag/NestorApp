/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΟΡΤΑ ΤΗΣ ΠΗΓΗΣ ΕΙΣΑΓΩΓΗΣ** — ADR-841 §7 Α21.19.
 *
 * 🔑 Φυλά δύο πράγματα: (1) ταυτότητα **από τα claims**, ποτέ από το αίτημα· (2) «δεν μάθαμε» (503) ≠ «δεν έχεις
 * στοιχεία» (404) — η οθόνη λέει διαφορετικά πράγματα και προτείνει διαφορετική πράξη.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

const authContext = { uid: 'user_1', companyId: 'comp_alfa', isAuthenticated: true as const };

jest.mock('@/lib/auth/middleware', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(request, authContext),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const readSource = jest.fn();
jest.mock('@/services/mandate/showcase-card-import-source', () => ({
  readCompanyContactSource: (...args: unknown[]) => readSource(...args),
}));

import { GET } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json: () => Promise<unknown> }>;
const get = GET as unknown as Handler;

const SOURCE = { address: null, phones: ['2310 123456'], email: null, website: null };

describe('GET /api/agency-profile/card/import-source (Α21.19)', () => {
  beforeEach(() => readSource.mockReset());

  it('Π1 υπάρχει πηγή ⇒ 200, ταυτότητα από τα claims', async () => {
    readSource.mockResolvedValue({ kind: 'present', source: SOURCE });
    const response = await get({});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ source: SOURCE });
    expect(readSource).toHaveBeenCalledWith(expect.anything(), 'comp_alfa');
  });

  it('Π2 καμία δήλωση ⇒ 404 NO_COMPANY_DATA', async () => {
    readSource.mockResolvedValue({ kind: 'absent' });
    const response = await get({});
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'NO_COMPANY_DATA' });
  });

  it('Π3 🔴 δεν διαβάστηκε ⇒ 503 READ_FAILED, ΠΟΤΕ 404', async () => {
    readSource.mockResolvedValue({ kind: 'unavailable' });
    const response = await get({});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'READ_FAILED' });
  });
});
