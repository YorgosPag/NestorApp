/**
 * @jest-environment node
 *
 * @fileoverview **Η ΕΚΔΟΣΗ ΣΥΝΕΔΡΙΑΣ ΡΩΤΑ ΤΟΝ ΙΔΙΟ ΚΡΙΤΗ ΜΕ ΤΗΝ ΑΝΑΓΝΩΣΗ** (ADR-908 §3.5).
 * @related app/api/auth/session/route.ts · lib/auth/token-credentials.ts (`judgeIdToken`) ·
 *   lib/auth/revocation-watermark.ts
 *
 * 🔴 Μετρημένο στην παραγωγή 2026-10-08: το `__session` ξαναστηνόταν 0,25 s μετά την αποσύνδεση, γιατί εδώ
 * έτρεχε ωμό `adminAuth.verifyIdToken` **παράλληλα** με το `createSessionCookie`.
 *
 * Ο κριτής (`token-credentials` + `revocation-watermark`) **ΔΕΝ** γίνεται mock: τρέχει ολόκληρος. Mock μόνο
 * το Auth (ό,τι θα απαντούσε η Firebase) και η λίστα ανακλήσεων ανά σύνδεση.
 *
 * | Μετάλλαξη | Άγκυρα που κοκκινίζει |
 * |---|---|
 * | ωμό `adminAuth.verifyIdToken` πίσω στη θέση του κριτή | Ρ1 · Ρ2 |
 * | `Promise.all([createSessionCookie, …])` — cookie πριν από τον κριτή | Ρ1 · Ρ2 (το `createSessionCookie` καλείται) |
 * | το `code` της ανάκλησης φεύγει / μπαίνει και στο ληγμένο token | Ρ1 · Ρ3 |
 * | «δεν μπόρεσα να ρωτήσω» απαντιέται 401 | Ρ4 |
 * | αστοχία έκδοσης απαντιέται 401 (όπως πριν) | Ρ5 |
 */

jest.mock('server-only', () => ({}));

const verifyIdToken = jest.fn();
const createSessionCookie = jest.fn();
const getUser = jest.fn();
jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => true,
  getAdminAuth: () => ({
    verifyIdToken: (token: string) => verifyIdToken(token),
    createSessionCookie: (token: string, options: unknown) => createSessionCookie(token, options),
    getUser: (uid: string) => getUser(uid),
  }),
}));

const readRevokedSignIns = jest.fn(async (_uid: string): Promise<ReadonlySet<number>> => new Set<number>());
jest.mock('@/lib/auth/revoked-sign-ins', () => ({ readRevokedSignIns: (uid: string) => readRevokedSignIns(uid) }));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withSensitiveRateLimit: <T>(handler: T) => handler,
}));

const ensureCompanyDocument = jest.fn(async () => undefined);
jest.mock('@/services/company-document.service', () => ({
  ensureCompanyDocument: () => ensureCompanyDocument(),
}));
const ensureIdentityRecord = jest.fn(async () => undefined);
jest.mock('@/server/auth/identity-record', () => ({
  ensureIdentityRecord: () => ensureIdentityRecord(),
}));

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    readonly setCookies: { name: string; value: string }[] = [];
    readonly cookies = {
      set: (name: string, value: string) => { this.setCookies.push({ name, value }); },
    };
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

import { SIGN_IN_REVOKED_ERROR_CODE } from '@/lib/auth/session-issue-wire';
import { forgetRevocationState } from '@/lib/auth/revocation-watermark';

const route = require('../route') as typeof import('../route');

type Reply = {
  status: number;
  setCookies: { name: string; value: string }[];
  json: () => Promise<Record<string, unknown>>;
};

const SIGNED_IN_AT_S = 1_790_000_000;
const UID = 'u-session';

const issue = (idToken: unknown = 'id-token'): Promise<Reply> =>
  (route.POST as unknown as (request: unknown) => Promise<Reply>)({ json: async () => ({ idToken }) });

beforeEach(() => {
  jest.clearAllMocks();
  forgetRevocationState(UID);
  verifyIdToken.mockResolvedValue({ uid: UID, auth_time: SIGNED_IN_AT_S, companyId: 'comp_a' });
  createSessionCookie.mockResolvedValue('cookie-value');
  getUser.mockResolvedValue({ disabled: false, tokensValidAfterTime: undefined });
  readRevokedSignIns.mockResolvedValue(new Set<number>());
});

describe('ADR-908 §3.5 — POST /api/auth/session', () => {
  it('Ρ0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ζωντανή σύνδεση ⇒ 200 και ένα cookie', async () => {
    const reply = await issue();

    expect(reply.status).toBe(200);
    expect(reply.setCookies).toHaveLength(1);
    expect(reply.setCookies[0].value).toBe('cookie-value');
    expect(ensureCompanyDocument).toHaveBeenCalledTimes(1);
  });

  it('Ρ1 🔴 — η σύνδεση ανακλήθηκε ΜΙΑ-ΜΙΑ ⇒ 401 με κωδικό, ΚΑΝΕΝΑ cookie, και το cookie δεν ζητήθηκε καν', async () => {
    readRevokedSignIns.mockResolvedValue(new Set([SIGNED_IN_AT_S]));

    const reply = await issue();

    expect(reply.status).toBe(401);
    expect((await reply.json()).code).toBe(SIGN_IN_REVOKED_ERROR_CODE);
    expect(reply.setCookies).toHaveLength(0);
    expect(createSessionCookie).not.toHaveBeenCalled();
    // Ούτε παράπλευρη εγγραφή για άνθρωπο που δεν συνδέθηκε.
    expect(ensureCompanyDocument).not.toHaveBeenCalled();
    expect(ensureIdentityRecord).not.toHaveBeenCalled();
  });

  it('Ρ2 🔴 — ανάκληση ΟΛΩΝ (`tokensValidAfterTime` μετά τη σύνδεση) ⇒ 401 με κωδικό, κανένα cookie', async () => {
    getUser.mockResolvedValue({
      disabled: false,
      tokensValidAfterTime: new Date((SIGNED_IN_AT_S + 60) * 1000).toUTCString(),
    });

    const reply = await issue();

    expect(reply.status).toBe(401);
    expect((await reply.json()).code).toBe(SIGN_IN_REVOKED_ERROR_CODE);
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it('Ρ3 — token που ΔΕΝ στέκει (ληγμένο/πλαστό) ⇒ 401 ΧΩΡΙΣ κωδικό ανάκλησης', async () => {
    // ⚠️ Ο πελάτης αποσυνδέει ΜΟΝΟ στον κωδικό. Κωδικός εδώ θα πετούσε έξω άνθρωπο για ένα ληγμένο token.
    verifyIdToken.mockRejectedValue(Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }));

    const reply = await issue();

    expect(reply.status).toBe(401);
    expect((await reply.json()).code).toBeUndefined();
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it('Ρ4 🔴 — το Auth δεν απαντά και δεν υπάρχει σφραγίδα ⇒ 503, ΠΟΤΕ «ανακλήθηκε»', async () => {
    getUser.mockRejectedValue(new Error('auth backend down'));

    const reply = await issue();

    expect(reply.status).toBe(503);
    expect((await reply.json()).code).toBeUndefined();
    expect(createSessionCookie).not.toHaveBeenCalled();
  });

  it('Ρ5 — ο κριτής είπε «ναι» αλλά η έκδοση απέτυχε ⇒ 500, όχι 401', async () => {
    createSessionCookie.mockRejectedValue(new Error('signBlob failed'));

    const reply = await issue();

    expect(reply.status).toBe(500);
    expect(reply.setCookies).toHaveLength(0);
    // Η αιτία μένει στα ίχνη — δεν ταξιδεύει στο σώμα.
    expect(JSON.stringify(await reply.json())).not.toContain('signBlob');
  });

  it('Ρ6 — χωρίς `idToken` ⇒ 400, και ο κριτής δεν ρωτήθηκε', async () => {
    // `null`, όχι `undefined`: το δεύτερο θα ενεργοποιούσε την προεπιλογή του `issue`.
    const reply = await issue(null);

    expect(reply.status).toBe(400);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
