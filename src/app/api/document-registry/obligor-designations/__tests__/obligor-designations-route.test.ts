/**
 * @fileoverview `PUT /api/document-registry/obligor-designations` — σύνορο, δικαίωμα, εμβέλεια από το `ctx`, και
 *   κάθε άρνηση με τον δικό της κωδικό (ADR-915 §26).
 * @related app/api/document-registry/obligor-designations/route.ts
 *
 * ⚠️ Η πράξη ασκείται αληθινά στο `obligor-designation.service.test.ts`· εδώ μόνο η μετάφραση σε HTTP.
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

const designate = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({ ok: true, outcome: 'changed' }));
jest.mock('@/services/document-registry/obligor-designation.service', () => {
  const { z } = jest.requireActual<typeof import('zod')>('zod');
  return {
    obligorDesignationBody: z.object({ propertyId: z.string().min(1), contactId: z.string().min(1).nullable() }),
    designateRegistryObligor: (...args: unknown[]) => designate(...args),
  };
});

import { withAuth } from '@/lib/auth/middleware';
import { PUT } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json(): Promise<unknown> }>;
const put = (body: unknown) => (PUT as unknown as Handler)({ json: async () => body });

describe('PUT /api/document-registry/obligor-designations', () => {
  it('περνά από το `withAuth` ΜΕ το δικαίωμα επεξεργασίας ακινήτου', () => {
    expect(jest.mocked(withAuth).mock.calls[0][1]).toEqual({ permissions: 'properties:properties:update' });
  });

  it('η εμβέλεια = `ctx.companyId` — ένα `companyId` στο σώμα αγνοείται', async () => {
    const response = await put({ propertyId: 'prop_1', contactId: 'cont_b', companyId: 'comp_beta' });
    expect(response.status).toBe(200);
    expect(designate.mock.calls[0][1]).toEqual({ companyId: 'comp_alfa', uid: 'user_1', name: 'agent@example.test' });
    expect(designate.mock.calls[0][2]).toEqual({ propertyId: 'prop_1', contactId: 'cont_b' });
  });

  it('σώμα χωρίς ακίνητο ⇒ 400, καμία πράξη', async () => {
    designate.mockClear();
    expect((await put({ contactId: 'cont_b' })).status).toBe(400);
    expect(designate).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', 404, 'NOT_FOUND'],
    ['owners-unknown', 409, 'OWNERS_UNKNOWN'],
    ['not-an-owner', 422, 'NOT_AN_OWNER'],
  ])('άρνηση `%s` ⇒ %i %s', async (refusal, status, code) => {
    designate.mockResolvedValueOnce({ ok: false, refusal });
    await expect(put({ propertyId: 'prop_1', contactId: 'cont_b' })).rejects.toMatchObject({ statusCode: status, errorCode: code });
  });
});
