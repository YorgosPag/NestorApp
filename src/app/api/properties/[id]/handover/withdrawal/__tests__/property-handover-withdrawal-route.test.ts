/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Ζ51–Ζ52 (Φ-Δ.5) — **η πόρτα «Ανάκληση παράδοσης»**: τι περνά στον ΕΝΑ γραφέα, και τι επιστρέφει.
 * @related app/api/properties/[id]/handover/withdrawal/route.ts
 *
 * Η κρίση και η συναλλαγή έχουν δικές τους άγκυρες (Ζ35–Ζ43 καθαρή · Ζ45–Ζ50 ροή στο fake Firestore). Εδώ ρωτάμε **μόνο**:
 *   · ο δρων και ο μισθωτής είναι του `withAuth`, ποτέ του σώματος · ο έλεγχος χώρου ζητά `intent: 'write'`
 *   · αιτιολογία **υποχρεωτική** και επιβεβαίωση του μη αναστρέψιμου **ρητά `true`** — αλλιώς 400, ο γραφέας δεν καλείται
 *   · κάθε έκβαση έχει **μία** απάντηση, και καμία δεν κουβαλά αιτιολογία ή uid
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
const REASON = 'Η πώληση ακυρώθηκε με δικαστική απόφαση';
const BODY = { handoverId: 'phov_1', reason: REASON, confirmIrreversible: true };

interface RouteResponse { readonly status: number; json(): Promise<unknown> }

function request(body: unknown) {
  return {
    url: `https://app.example.test/api/properties/${PROPERTY}/handover/withdrawal`,
    nextUrl: { pathname: `/api/properties/${PROPERTY}/handover/withdrawal` },
    json: async () => body,
  };
}

async function post(body: unknown): Promise<{ status: number; body: unknown }> {
  const response = (await (POST as unknown as (req: unknown) => Promise<RouteResponse>)(request(body)));
  return { status: response.status, body: await response.json() };
}

const synced = (withdrawal: unknown) => ({
  kind: 'synced', writes: 1, invitationWrites: 0, invitationsAwaitingConfiguration: 0, renewal: null, withdrawal,
});

beforeEach(() => {
  sync.mockReset();
  tenantScope.mockClear();
});

describe('Ζ51 — ο ΕΝΑΣ γραφέας, με τον ΑΝΘΡΩΠΟ του `withAuth`, πίσω από τον έλεγχο ΕΓΓΡΑΦΗΣ', () => {
  it('ανάκληση ⇒ `syncPropertyHandovers` με αιτία `office-withdrawal` + uid του πλαισίου · έλεγχος χώρου `write`', async () => {
    sync.mockResolvedValue(synced({ kind: 'withdrawn' }));
    const result = await post({ ...BODY, performedBy: 'system', companyId: 'comp_evil' });
    expect(result).toEqual({ status: 200, body: { status: 'withdrawn' } });
    expect(tenantScope).toHaveBeenCalledWith(expect.objectContaining({ propertyId: PROPERTY, intent: 'write' }));
    expect(sync).toHaveBeenCalledWith(expect.anything(), PROPERTY, {
      cause: 'office-withdrawal', performedBy: 'uid_office', withdrawal: { handoverId: 'phov_1', reason: REASON },
    });
  });

  it.each([
    ['χωρίς αιτιολογία', { ...BODY, reason: undefined }],
    ['αιτιολογία μόνο κενά', { ...BODY, reason: '          ' }],
    ['πολύ σύντομη αιτιολογία', { ...BODY, reason: 'λάθος' }],
    ['χωρίς επιβεβαίωση', { ...BODY, confirmIrreversible: undefined }],
    ['επιβεβαίωση `false`', { ...BODY, confirmIrreversible: false }],
    ['χωρίς παράδοση', { ...BODY, handoverId: '' }],
  ])('%s ⇒ 400, ο γραφέας ΔΕΝ καλείται', async (_case, body) => {
    expect((await post(body)).status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });
});

describe('Ζ52 — κάθε έκβαση, μία απάντηση· 🔒 ποτέ αιτιολογία ή uid', () => {
  it.each([
    ['not-withdrawable', 409],
    ['handover-unknown', 404],
  ] as const)('%s ⇒ %i με τον λόγο', async (reason, status) => {
    sync.mockResolvedValue(synced({ kind: 'refused', reason }));
    expect(await post(BODY)).toEqual({ status, body: { error: 'HANDOVER_WITHDRAWAL_REFUSED', reason } });
  });

  it('ο γραφέας απέτυχε ⇒ 503 «δεν μπόρεσα τώρα»', async () => {
    sync.mockResolvedValue({ kind: 'failed' });
    expect(await post(BODY)).toEqual({ status: 503, body: { error: 'WITHDRAWAL_UNAVAILABLE' } });
  });

  it('ο γραφέας δεν είπε τίποτα για την ανάκληση ⇒ handover-unknown, ποτέ ψεύτικη επιτυχία', async () => {
    sync.mockResolvedValue(synced(null));
    expect(await post(BODY)).toEqual({ status: 404, body: { error: 'HANDOVER_WITHDRAWAL_REFUSED', reason: 'handover-unknown' } });
  });

  it('`unchanged` ⇒ 200 · καμία απάντηση δεν περιέχει αιτιολογία ή uid', async () => {
    sync.mockResolvedValue(synced({ kind: 'unchanged' }));
    const result = await post(BODY);
    expect(result).toEqual({ status: 200, body: { status: 'unchanged' } });
    const payload = JSON.stringify(result.body);
    for (const secret of [REASON, 'uid_office']) expect(payload).not.toContain(secret);
  });
});
