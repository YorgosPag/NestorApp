/**
 * @fileoverview `GET /api/document-registry` — η εμβέλεια έρχεται ΜΟΝΟ από το `ctx` (ADR-915 Φ4β).
 * @related app/api/document-registry/route.ts
 *
 * ⚠️ Το 401 χωρίς ταυτότητα είναι συμβόλαιο του `withAuth` (CHECK 3.90): εδώ αγκυρώνεται ότι η διαδρομή **περνά από
 * αυτό** — η ίδια η άρνηση του `withAuth` δεν ξαναδοκιμάζεται (θα δοκίμαζε το mock).
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

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withStandardRateLimit: <T>(handler: T) => handler }));

// Η διαδρομή καλεί το `withAuth` κατά την εισαγωγή — πριν οριστεί οποιαδήποτε `const` του αρχείου· άρα όλα μέσα στο factory.
jest.mock('@/lib/auth/middleware', () => ({
  withAuth: jest.fn((callback: (...args: unknown[]) => Promise<unknown>) => async (request: unknown) =>
    callback(request, { uid: 'user_1', companyId: 'comp_alfa', isAuthenticated: true })),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const readRegistry = jest.fn(async (..._args: unknown[]) => ({ rows: [], tally: {}, truncated: false }));
jest.mock('@/services/document-registry/document-registry.service', () => ({
  readDocumentRegistry: (...args: unknown[]) => readRegistry(...args),
}));

import { withAuth } from '@/lib/auth/middleware';
import { GET } from '../route';

type Handler = (request: unknown) => Promise<{ status: number }>;

describe('GET /api/document-registry', () => {
  it('περνά από το `withAuth`', () => {
    expect(jest.mocked(withAuth)).toHaveBeenCalledTimes(1);
  });

  it('η εμβέλεια = `ctx.companyId` — μια παράμετρος του αιτήματος αγνοείται', async () => {
    const request = { url: 'https://example.test/api/document-registry?companyId=comp_beta', nextUrl: new URL('https://example.test/api/document-registry?companyId=comp_beta') };
    const response = await (GET as unknown as Handler)(request);
    expect(response.status).toBe(200);
    expect(readRegistry).toHaveBeenCalledTimes(1);
    expect(readRegistry.mock.calls[0][1]).toBe('comp_alfa');
  });
});
