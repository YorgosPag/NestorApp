/**
 * @fileoverview `PUT /api/document-registry/upkeep-declarations` — σύνορο, δικαίωμα, εμβέλεια από το `ctx`, σχήμα (εξαίρεση
 *   ΠΑΝΤΑ με λόγο) και κάθε άρνηση με τον κωδικό του ΕΝΟΣ πίνακα (ADR-915 §35).
 * @related app/api/document-registry/upkeep-declarations/route.ts
 *
 * ⚠️ Η πράξη ασκείται αληθινά στο `upkeep-declaration.service.test.ts`· εδώ μόνο η μετάφραση σε HTTP. Το σχήμα είναι το
 *    **αληθινό** (`upkeep-declaration-request.ts`) — ο κοινός πίνακας κωδικών με την οθόνη ελέγχεται εδώ.
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
jest.mock('@/services/document-registry/upkeep-declaration.service', () => ({
  declareRegistryUpkeep: (...args: unknown[]) => declare(...args),
}));

import { withAuth } from '@/lib/auth/middleware';
import { UPKEEP_DECLARATION_ERROR_CODES, upkeepDeclarationRefusalOfCode } from '@/lib/document-validity/upkeep-declaration-request';
import { PUT } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json(): Promise<unknown> }>;
const put = (body: unknown) => (PUT as unknown as Handler)({ json: async () => body });
const BODY = { propertyId: 'prop_1', documentKind: 'electrical-installation', decision: 'required', exemptionReason: null };

describe('PUT /api/document-registry/upkeep-declarations', () => {
  beforeEach(() => declare.mockClear());

  it('περνά από το `withAuth` ΜΕ το δικαίωμα επεξεργασίας ακινήτου', () => {
    expect(jest.mocked(withAuth).mock.calls[0][1]).toEqual({ permissions: 'properties:properties:update' });
  });

  it('η εμβέλεια = `ctx.companyId` — ένα `companyId` στο σώμα αγνοείται, και η πρόταση ΔΕΝ περνά από τον πελάτη', async () => {
    const response = await put({ ...BODY, companyId: 'comp_beta', proposalAtDecision: { verdict: 'proposed' } });
    expect(response.status).toBe(200);
    expect(declare.mock.calls[0][1]).toEqual({ companyId: 'comp_alfa', uid: 'user_1', name: 'agent@example.test' });
    expect(declare.mock.calls[0][2]).toEqual(BODY);
  });

  it.each([
    [{ ...BODY, decision: 'not-required', exemptionReason: null }],
    [{ ...BODY, decision: 'required', exemptionReason: 'other' }],
    [{ ...BODY, documentKind: 'boiler' }],
    [{ decision: 'required', exemptionReason: null, documentKind: 'electrical-installation' }],
  ])('σώμα με αντίφαση ή ελλιπές (%j) ⇒ 400, καμία πράξη', async (body) => {
    expect((await put(body)).status).toBe(400);
    expect(declare).not.toHaveBeenCalled();
  });

  it.each([
    ['absent', 404, 'NOT_FOUND'],
    ['not-standing', 422, 'NOT_STANDING_OBLIGATION'],
  ])('άρνηση `%s` ⇒ %i %s — και η οθόνη διαβάζει τον ΙΔΙΟ κωδικό πίσω', async (refusal, status, code) => {
    declare.mockResolvedValueOnce({ ok: false, refusal });
    await expect(put(BODY)).rejects.toMatchObject({ statusCode: status, errorCode: code });
    expect(UPKEEP_DECLARATION_ERROR_CODES[refusal as 'absent' | 'not-standing']).toBe(code);
    expect(upkeepDeclarationRefusalOfCode(code)).toBe(refusal);
  });

  it('άγνωστος κωδικός ⇒ καμία άρνηση (η οθόνη λέει «δεν αποθηκεύτηκε»)', () => {
    expect(upkeepDeclarationRefusalOfCode('SOMETHING_ELSE')).toBeNull();
    expect(upkeepDeclarationRefusalOfCode(null)).toBeNull();
  });
});
