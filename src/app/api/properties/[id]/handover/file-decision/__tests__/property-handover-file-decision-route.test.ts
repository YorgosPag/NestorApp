/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Ζ31–Ζ32 (Φ-Δ.4) — **η πόρτα «Απόφαση για αρχείο»**: τι περνά στον ΕΝΑ γραφέα, και τι επιστρέφει.
 * @related app/api/properties/[id]/handover/file-decision/route.ts
 *
 * Η κρίση και η συναλλαγή έχουν δικές τους άγκυρες (Ζ23–Ζ29 καθαρή · ροή στο fake Firestore). Εδώ ρωτάμε **μόνο**:
 *   · ο δρων και ο μισθωτής είναι του `withAuth`, ποτέ του σώματος · ο έλεγχος χώρου ζητά `intent: 'write'`
 *   · αιτιολογία **υποχρεωτική** (Purview) και `confirmConfidential` / `expected` **ρητά** — αλλιώς 400, ο γραφέας δεν καλείται
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

const decide = jest.fn();
jest.mock('@/services/property-handover/property-handover-file-decision.service', () => ({
  decideHandoverFile: (...args: unknown[]) => decide(...args),
}));

import { POST } from '../route';

const PROPERTY = 'prop_1';
const REASON = 'Ελέγχθηκε από τον νομικό σύμβουλο';
const BODY = { fileId: 'f_doc', choice: 'deliver', expected: null, reason: REASON, confirmConfidential: false };

interface RouteResponse { readonly status: number; json(): Promise<unknown> }

function request(body: unknown) {
  return {
    url: `https://app.example.test/api/properties/${PROPERTY}/handover/file-decision`,
    nextUrl: { pathname: `/api/properties/${PROPERTY}/handover/file-decision` },
    json: async () => body,
  };
}

async function post(body: unknown): Promise<{ status: number; body: unknown }> {
  const response = (await (POST as unknown as (req: unknown) => Promise<RouteResponse>)(request(body)));
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  decide.mockReset();
  tenantScope.mockClear();
});

describe('Ζ31 — ο ΕΝΑΣ γραφέας, με τον ΑΝΘΡΩΠΟ και τον ΜΙΣΘΩΤΗ του `withAuth`, πίσω από τον έλεγχο ΕΓΓΡΑΦΗΣ', () => {
  it('απόφαση ⇒ `decideHandoverFile` με uid + μισθωτή του πλαισίου · έλεγχος χώρου `write`', async () => {
    decide.mockResolvedValue({ kind: 'decided' });
    const result = await post({ ...BODY, performedBy: 'system', companyId: 'comp_evil' });
    expect(result).toEqual({ status: 200, body: { status: 'decided' } });
    expect(tenantScope).toHaveBeenCalledWith(expect.objectContaining({ propertyId: PROPERTY, intent: 'write' }));
    expect(decide).toHaveBeenCalledWith(expect.anything(), { ...BODY, companyId: 'comp_alfa', propertyId: PROPERTY, performedBy: 'uid_office' });
  });

  it.each([
    ['χωρίς αιτιολογία', { ...BODY, reason: undefined }],
    ['αιτιολογία μόνο κενά', { ...BODY, reason: '          ' }],
    ['πολύ σύντομη αιτιολογία', { ...BODY, reason: 'ok' }],
    ['χωρίς ρητό `confirmConfidential`', { ...BODY, confirmConfidential: undefined }],
    ['χωρίς ρητό `expected`', { ...BODY, expected: undefined }],
    ['`review` ως επιλογή (δεν είναι απόφαση)', { ...BODY, choice: 'review' }],
  ])('%s ⇒ 400, ο γραφέας ΔΕΝ καλείται', async (_case, body) => {
    expect((await post(body)).status).toBe(400);
    expect(decide).not.toHaveBeenCalled();
  });
});

describe('Ζ32 — κάθε έκβαση, μία απάντηση· 🔒 ποτέ αιτιολογία ή uid', () => {
  it.each([
    ['file-unknown', 404],
    ['protocol-file', 409],
    ['unrecognised', 409],
    ['stale', 409],
    ['already-delivered', 409],
    ['confidential-unconfirmed', 409],
  ] as const)('%s ⇒ %i με τον λόγο', async (reason, status) => {
    decide.mockResolvedValue({ kind: 'refused', reason });
    expect(await post(BODY)).toEqual({ status, body: { error: 'HANDOVER_FILE_DECISION_REFUSED', reason } });
  });

  it('ο γραφέας απέτυχε ⇒ 503 «δεν μπόρεσα τώρα»', async () => {
    decide.mockResolvedValue({ kind: 'failed' });
    expect(await post(BODY)).toEqual({ status: 503, body: { error: 'FILE_DECISION_UNAVAILABLE' } });
  });

  it('`unchanged` ⇒ 200 · καμία απάντηση δεν περιέχει αιτιολογία ή uid', async () => {
    decide.mockResolvedValue({ kind: 'unchanged' });
    const result = await post(BODY);
    expect(result).toEqual({ status: 200, body: { status: 'unchanged' } });
    const payload = JSON.stringify(result.body);
    for (const secret of [REASON, 'uid_office']) expect(payload).not.toContain(secret);
  });
});
