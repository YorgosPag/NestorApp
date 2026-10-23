/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Ζ22 (Φ-Δ.3) — **η πόρτα «Νέα πρόσκληση»**: τι περνά στον ΕΝΑ γραφέα, και τι επιστρέφει.
 * @related app/api/properties/[id]/handover/invitation/route.ts
 *
 * Η κρίση και η συναλλαγή έχουν δικές τους άγκυρες (Ζ17 καθαρή · Ζ18–Ζ21 fake Firestore). Εδώ ρωτάμε **μόνο**:
 *   · ο δρων είναι ο **άνθρωπος** του `withAuth`, ποτέ το σώμα · ο έλεγχος χώρου ζητά `intent: 'write'` (αποσυρμένο ⇒ 409)
 *   · κάθε έκβαση έχει **μία** απάντηση, και καμία δεν κουβαλά email ή token
 *   · `confirmDeclined` είναι **ρητό**: σώμα χωρίς αυτό ⇒ 400, ποτέ σιωπηλό `false`
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | `intent: 'read'` στον έλεγχο χώρου | Ζ22α ⇒ 🔴 |
 * | `performedBy` από το σώμα / `'system'` | Ζ22α ⇒ 🔴 |
 * | `handover-unknown` ⇒ 409 | Ζ22β ⇒ 🔴 |
 * | βλάβη έκδοσης ⇒ `renewed` | Ζ22β ⇒ 🔴 |
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> { return this.body; }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({ withSensitiveRateLimit: <T>(h: T) => h }));

const authContext = { uid: 'uid_office', companyId: 'comp_alfa', isAuthenticated: true, globalRole: 'company_admin', permissions: [] };
jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authContext, {}),
}));

const tenantScope = jest.fn(async (_params: Record<string, unknown>): Promise<void> => undefined);
jest.mock('@/lib/auth/tenant-isolation', () => ({
  requirePropertyInTenantScope: (params: Record<string, unknown>) => tenantScope(params),
}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const sync = jest.fn();
jest.mock('@/services/property-handover/property-handover-write.service', () => ({
  syncPropertyHandovers: (...args: unknown[]) => sync(...args),
}));

import { POST } from '../route';

const PROPERTY = 'prop_1';
const BUYER_EMAIL = 'anna@example.test';

interface RouteResponse { readonly status: number; json(): Promise<unknown> }

function request(body: unknown) {
  return {
    url: `https://app.example.test/api/properties/${PROPERTY}/handover/invitation`,
    nextUrl: { pathname: `/api/properties/${PROPERTY}/handover/invitation` },
    json: async () => body,
  };
}

async function post(body: unknown): Promise<{ status: number; body: unknown }> {
  const response = (await (POST as unknown as (req: unknown) => Promise<RouteResponse>)(request(body)));
  return { status: response.status, body: await response.json() };
}

const synced = (renewal: unknown) => ({ kind: 'synced', writes: 0, invitationWrites: 1, invitationsAwaitingConfiguration: 0, renewal });

beforeEach(() => {
  sync.mockReset();
  tenantScope.mockClear();
});

describe('Ζ22α — ο ΕΝΑΣ γραφέας, με τον ΑΝΘΡΩΠΟ ως δρώντα, πίσω από τον έλεγχο ΕΓΓΡΑΦΗΣ', () => {
  it('ανανέωση ⇒ `syncPropertyHandovers({cause: office-renewal, performedBy: <uid>, renewal})` · έλεγχος χώρου `write`', async () => {
    sync.mockResolvedValue(synced({ kind: 'renewed', invitationId: 'phin_new' }));
    const result = await post({ handoverId: 'phov_1', confirmDeclined: false, performedBy: 'system' });
    expect(result).toEqual({ status: 200, body: { status: 'renewed' } });
    expect(tenantScope).toHaveBeenCalledWith(expect.objectContaining({ propertyId: PROPERTY, intent: 'write' }));
    expect(sync).toHaveBeenCalledWith(expect.anything(), PROPERTY, {
      cause: 'office-renewal', performedBy: 'uid_office', renewal: { handoverId: 'phov_1', confirmDeclined: false },
    });
  });

  it('αποσυρμένο ακίνητο (ο έλεγχος χώρου πετά 409) ⇒ ο γραφέας ΔΕΝ καλείται', async () => {
    tenantScope.mockRejectedValueOnce(Object.assign(new Error('ENTITY_RETIRED'), { statusCode: 409 }));
    await expect(post({ handoverId: 'phov_1', confirmDeclined: false })).rejects.toThrow('ENTITY_RETIRED');
    expect(sync).not.toHaveBeenCalled();
  });

  it('σώμα χωρίς ρητό `confirmDeclined` ⇒ 400, ο γραφέας ΔΕΝ καλείται', async () => {
    expect((await post({ handoverId: 'phov_1' })).status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });
});

describe('Ζ22β — κάθε έκβαση, μία απάντηση· 🔒 ποτέ email ή token', () => {
  it.each([
    ['not-renewable', 409],
    ['declined-unconfirmed', 409],
    ['no-address', 409],
    ['awaiting-configuration', 409],
    ['handover-unknown', 404],
  ] as const)('%s ⇒ %i με τον λόγο', async (reason, status) => {
    sync.mockResolvedValue(synced({ kind: 'refused', reason }));
    expect(await post({ handoverId: 'phov_1', confirmDeclined: true })).toEqual({
      status, body: { error: 'HANDOVER_INVITATION_RENEWAL_REFUSED', reason },
    });
  });

  it.each([
    ['ο γραφέας απέτυχε', { kind: 'failed' }],
    ['βλάβη στην έκδοση', synced({ kind: 'failed' })],
  ])('%s ⇒ 503 «δεν μπόρεσα τώρα», ποτέ ονομασμένη άρνηση', async (_case, outcome) => {
    sync.mockResolvedValue(outcome);
    expect(await post({ handoverId: 'phov_1', confirmDeclined: false })).toEqual({ status: 503, body: { error: 'RENEWAL_UNAVAILABLE' } });
  });

  it('η απάντηση επιτυχίας δεν περιέχει email, token ή id πρόσκλησης', async () => {
    sync.mockResolvedValue(synced({ kind: 'renewed', invitationId: 'phin_new' }));
    const payload = JSON.stringify((await post({ handoverId: 'phov_1', confirmDeclined: false })).body);
    for (const secret of [BUYER_EMAIL, 'phin_new', 'token']) expect(payload).not.toContain(secret);
  });
});
