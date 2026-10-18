/**
 * @fileoverview `PUT /api/document-registry/document-facts` — σύνορο, δικαίωμα, εμβέλεια από το `ctx`, και κάθε άρνηση
 *   με τον δικό της κωδικό (ADR-915 §33).
 * @related app/api/document-registry/document-facts/route.ts
 *
 * ⚠️ Η πράξη ασκείται αληθινά στο `facts-declaration.service.test.ts`· εδώ μόνο η μετάφραση σε HTTP. Το σχήμα του σώματος
 * και ο πίνακας κωδικών είναι τα **αληθινά** (κοινά με την οθόνη).
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

jest.mock('@/lib/auth/middleware', () => ({
  withAuth: jest.fn((callback: (...args: unknown[]) => Promise<unknown>) => async (request: unknown) =>
    callback(request, { uid: 'user_1', email: 'agent@example.test', companyId: 'comp_alfa', isAuthenticated: true })),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const declare = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({ ok: true, outcome: 'changed' }));
jest.mock('@/services/document-registry/facts-declaration.service', () => ({
  declareDocumentFacts: (...args: unknown[]) => declare(...args),
}));

import { withAuth } from '@/lib/auth/middleware';
import {
  FACTS_DECLARATION_ERROR_CODES,
  FACTS_DECLARATION_REFUSALS,
  FACTS_DECLARATION_SERVER_REFUSALS,
} from '@/lib/document-validity/facts-declaration';
import { PUT } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json(): Promise<unknown> }>;
const put = (body: unknown) => (PUT as unknown as Handler)({ json: async () => body });

const BODY = {
  fileId: 'file_y', kind: 'electrical-installation', issuedOn: '2022-03-01', printedValidUntil: '2032-03-01',
  classification: 'A', storagePath: 'companies/comp_alfa/yde.pdf',
};

describe('PUT /api/document-registry/document-facts', () => {
  it('περνά από το `withAuth` ΜΕ το δικαίωμα των εγγραφών του μητρώου', () => {
    expect(jest.mocked(withAuth).mock.calls[0][1]).toEqual({ permissions: 'properties:properties:update' });
  });

  it('η εμβέλεια = `ctx` — ένα `companyId` ή `recordedBy` στο σώμα αγνοείται', async () => {
    const response = await put({ ...BODY, companyId: 'comp_beta', recordedBy: 'someone' });
    expect(response.status).toBe(200);
    expect(declare.mock.calls[0][1]).toEqual({ companyId: 'comp_alfa', uid: 'user_1' });
    expect(declare.mock.calls[0][2]).toEqual(BODY);
  });

  it('σώμα με άγνωστο είδος · χωρίς αντικείμενο (CAS) ⇒ 400, καμία πράξη', async () => {
    declare.mockClear();
    expect((await put({ ...BODY, kind: 'passport' })).status).toBe(400);
    expect((await put({ ...BODY, storagePath: '' })).status).toBe(400);
    expect(declare).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', 404], ['kind-not-promised', 422], ['not-this-object', 409], ['outranked', 409],
    ['empty', 422], ['invalid-date', 422], ['not-printed', 422], ['validity-before-issue', 422], ['classification-invalid', 422],
  ] as const)('άρνηση `%s` ⇒ %i με τον κωδικό του κοινού πίνακα', async (refusal, status) => {
    declare.mockResolvedValueOnce({ ok: false, refusal });
    await expect(put(BODY)).rejects.toMatchObject({ statusCode: status, errorCode: FACTS_DECLARATION_ERROR_CODES[refusal] });
  });

  it('ο πίνακας της δοκιμής καλύπτει ΚΑΘΕ άρνηση (νέα άρνηση χωρίς γραμμή εδώ ⇒ κόκκινο)', () => {
    expect([...FACTS_DECLARATION_REFUSALS, ...FACTS_DECLARATION_SERVER_REFUSALS]).toHaveLength(9);
  });
});
