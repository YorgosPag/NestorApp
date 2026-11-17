/**
 * @fileoverview `PUT /api/document-registry/issuance-assignments` — σύνορο, δικαίωμα, εμβέλεια από το `ctx`, σχήμα του
 *   σώματος (το ΑΛΗΘΙΝΟ, από το `issuance-request.ts`) και κάθε άρνηση με τον δικό της κωδικό (ADR-915 §27).
 * @related app/api/document-registry/issuance-assignments/route.ts
 *
 * ⚠️ Η πράξη ασκείται αληθινά στο `issuance-assignment.service.test.ts`· εδώ μόνο η μετάφραση σε HTTP.
 * 🔑 Οι κωδικοί του route = οι κωδικοί που ξέρει η οθόνη (`ISSUANCE_REFUSAL_CODES`) — άγκυρα ισότητας.
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

const actOn = jest.fn(async (..._args: unknown[]): Promise<unknown> => ({ ok: true, outcome: 'changed', stage: 'proposed' }));
jest.mock('@/services/document-registry/issuance-assignment.service', () => ({
  actOnIssuanceAssignment: (...args: unknown[]) => actOn(...args),
}));

import { withAuth } from '@/lib/auth/middleware';
import { ISSUANCE_REFUSAL_CODES } from '@/components/document-registry/issuance-labels';
import { PUT } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json(): Promise<unknown> }>;
const put = (body: unknown) => (PUT as unknown as Handler)({ json: async () => body });

const PROPOSE = {
  action: 'propose', propertyId: 'prop_1', documentKind: 'energy-certificate', expectedStage: null,
  professionalContactId: 'cont_pro', qualification: 'energy-inspector-registered', registryNumber: '  ',
};

const REFUSALS = [
  ['absent', 404, 'NOT_FOUND'],
  ['unavailable', 503, 'ASSIGNMENTS_UNAVAILABLE'],
  ['contact-unavailable', 422, 'CONTACT_UNAVAILABLE'],
  ['unqualified', 422, 'UNQUALIFIED'],
  ['lead-undesignated', 409, 'LEAD_UNDESIGNATED'],
  ['lead-changed', 409, 'LEAD_CHANGED'],
  ['stale', 409, 'STALE'],
  ['transition-refused', 409, 'TRANSITION_REFUSED'],
  ['actor-refused', 422, 'ACTOR_REFUSED'],
  ['terms-refused', 409, 'TERMS_REFUSED'],
  ['receipt-mismatch', 422, 'RECEIPT_MISMATCH'],
  ['settlement-busy', 409, 'SETTLEMENT_BUSY'],
] as const;

describe('PUT /api/document-registry/issuance-assignments', () => {
  it('περνά από το `withAuth` ΜΕ το δικαίωμα επεξεργασίας ακινήτου', () => {
    expect(jest.mocked(withAuth).mock.calls[0][1]).toEqual({ permissions: 'properties:properties:update' });
  });

  it('η εμβέλεια = `ctx.companyId`· κενός αριθμός μητρώου ⇒ `null` (το σχήμα κανονικοποιεί)', async () => {
    const response = await put({ ...PROPOSE, companyId: 'comp_beta' });
    expect(response.status).toBe(200);
    expect(actOn.mock.calls[0][1]).toEqual({ companyId: 'comp_alfa', uid: 'user_1', name: 'agent@example.test' });
    expect(actOn.mock.calls[0][2]).toEqual({ ...PROPOSE, registryNumber: null });
  });

  it('απόφαση ΧΩΡΙΣ τον υπεύθυνο που είδε η οθόνη ⇒ 400, καμία πράξη (η CAS του υπευθύνου είναι υποχρεωτική)', async () => {
    actOn.mockClear();
    const decide = { action: 'decide', propertyId: 'prop_1', documentKind: 'energy-certificate', expectedStage: 'quoted', outcome: 'approved', channel: 'phone', note: null, quoteRevision: 1 };
    expect((await put(decide)).status).toBe(400);
    expect(actOn).not.toHaveBeenCalled();
  });

  it('απόφαση ΧΩΡΙΣ την αναθεώρηση προσφοράς που είδε η οθόνη ⇒ 400, καμία πράξη (§42)', async () => {
    actOn.mockClear();
    const decide = {
      action: 'decide', propertyId: 'prop_1', documentKind: 'energy-certificate', expectedStage: 'quoted', outcome: 'approved',
      channel: 'phone', note: null, expectedOwnerContactId: 'cont_a',
    };
    expect((await put(decide)).status).toBe(400);
    expect(actOn).not.toHaveBeenCalled();
    expect((await put({ ...decide, quoteRevision: 1 })).status).toBe(200);
    expect(actOn).toHaveBeenCalledTimes(1);
  });

  it('καταγραφή προσφοράς: όροι σε λεπτά περνούν· ποσό 0 ή ΜΑΡΚ 14 ψηφίων ⇒ 400', async () => {
    actOn.mockClear();
    const terms = { basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31', scope: ['issuance'], deliveryBusinessDays: 5, advance: null };
    const quote = { action: 'record-quote', propertyId: 'prop_1', documentKind: 'energy-certificate', expectedStage: 'sent', terms, note: '  ' };
    expect((await put(quote)).status).toBe(200);
    expect(actOn.mock.calls[0][2]).toMatchObject({ action: 'record-quote', note: null, terms: { amountMinor: 10_000, scope: ['issuance'] } });
    expect((await put({ ...quote, terms: { ...terms, amountMinor: 0 } })).status).toBe(400);
    const receipt = { action: 'record-receipt', propertyId: 'prop_1', documentKind: 'energy-certificate', expectedStage: 'accepted', mark: '123456789012345', issuedOn: '2026-10-18', totalMinor: 12_400 };
    expect((await put(receipt)).status).toBe(200);
    expect((await put({ ...receipt, mark: '12345678901234' })).status).toBe(400);
  });

  it('άγνωστη πράξη ή είδος ⇒ 400', async () => {
    actOn.mockClear();
    expect((await put({ ...PROPOSE, action: 'assign-anyway' })).status).toBe(400);
    expect((await put({ ...PROPOSE, documentKind: 'passport' })).status).toBe(400);
    expect(actOn).not.toHaveBeenCalled();
  });

  it.each(REFUSALS)('άρνηση `%s` ⇒ %i %s', async (refusal, status, code) => {
    actOn.mockResolvedValueOnce({ ok: false, refusal });
    await expect(put(PROPOSE)).rejects.toMatchObject({ statusCode: status, errorCode: code });
  });

  it('κάθε κωδικός του route έχει μήνυμα στην οθόνη — και κανένας παραπάνω', () => {
    expect([...REFUSALS.map(([, , code]) => code)].sort()).toEqual([...ISSUANCE_REFUSAL_CODES].sort());
  });
});
