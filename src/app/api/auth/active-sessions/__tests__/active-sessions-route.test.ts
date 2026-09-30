/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **Οι πόρτες των συσκευών μου** (ADR-894) — σώμα → σχήμα → γραφέας → έγγραφο → HTTP.
 * @related app/api/auth/active-sessions/route.ts · [sessionId]/route.ts · services/session/session-server.service.ts
 *
 * Ο γραφέας **ΔΕΝ** γίνεται mock: τρέχει πάνω σε ψεύτικη Firestore. Mock μόνο η ταυτότητα (ο δρων), το όριο
 * ρυθμού και η **βάση** GeoIP (η επίλυση έχει δικές της άγκυρες στο `ip-geolocation.test.ts`).
 *
 * | Μετάλλαξη | Άγκυρα που κοκκινίζει |
 * |---|---|
 * | ωμή IP στο έγγραφο (αντί αποτυπώματος) | Π1 |
 * | UA από το σώμα αντί της κεφαλίδας / `.strict()` αφαιρεμένο | Π1 · Π5 |
 * | νέα επίλυση σε κάθε άγγιγμα / καμία στην αλλαγή δικτύου | Π2 · Π3 |
 * | αναζήτηση id έξω από `users/{uid}` | Π4 · Δ2 |
 * | όριο που ανακαλεί τη ΝΕΟΤΕΡΗ | Π6 |
 * | η ανάκληση ΔΕΝ φτάνει στο διαπιστευτήριο (λίστα `auth_time`) | Δ4 · Π7 |
 * | ο φρουρός εαυτού αφαιρείται (το φάντασμα του ίδιου browser αποσυνδέει τον καλούντα) | Δ5 |
 * | «όλων των άλλων» χωρίς `revokeRefreshTokens` / κλειδί από σκέτο cookie | Α3 · Α4 |
 * | ειδοποίηση νέας σύνδεσης που δεν στέλνεται / στέλνεται στην ΠΡΩΤΗ ή σε γνωστή χώρα | Ν1 · Ν2 · Ν3 |
 */

import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { IpPlace } from '@/lib/geo/ip-place.types';

const fake = new FakeFirestore();
const ME = 'u-route';
const OTHER = 'u-other';
const HOME_IP = '62.103.0.1';
const ROAMING_IP = '41.58.0.1';

const THESSALONIKI: IpPlace = {
  countryCode: 'GR', city: 'Thessaloniki', region: null, precision: 'city', basis: 'geoip',
  source: { database: 'DBIP-City-Lite', edition: '2026-09' },
};
const LAGOS: IpPlace = { ...THESSALONIKI, countryCode: 'NG', city: 'Lagos' };
const resolveIpPlace = jest.fn(async (ip: string): Promise<IpPlace> => (ip === HOME_IP ? THESSALONIKI : LAGOS));

const revokeRefreshTokens = jest.fn(async (_uid: string) => undefined);
const createCustomToken = jest.fn(async (_uid: string) => 'custom_token_1');
// ADR-894 §10.7 — τα claims ζουν στο Auth: εδώ ένας χάρτης, ώστε η ΠΡΟΒΟΛΗ της λίστας να κρίνεται στον πραγματικό γραφέα.
const claimsOf = new Map<string, Record<string, unknown>>();
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
  getAdminAuth: () => ({
    getUser: async (uid: string) => ({ tokensValidAfterTime: undefined, disabled: false, customClaims: claimsOf.get(uid) }),
    setCustomUserClaims: async (uid: string, claims: Record<string, unknown>) => { claimsOf.set(uid, claims); },
    revokeRefreshTokens: (uid: string) => revokeRefreshTokens(uid),
    createCustomToken: (uid: string) => createCustomToken(uid),
  }),
}));

jest.mock('@/lib/geo/ip-geolocation', () => ({ resolveIpPlace: (ip: string) => resolveIpPlace(ip) }));

// ADR-894 §10 Β3 — ο αγωγός ειδοποιήσεων έχει τις δικές του άγκυρες· εδώ κρίνεται ΑΝ και ΤΙ του ζητείται.
const dispatchNotification = jest.fn(async (_request: Record<string, unknown>) => ({ success: true, skipped: false, dedupeKey: 'k' }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (request: Record<string, unknown>) => dispatchNotification(request),
}));

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

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withSensitiveRateLimit: <T>(h: T) => h,
}));

jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  withPersonalOrOrgAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown, route?: unknown) =>
      callback(request, { scope: 'personal', ctx: { uid: ME, authTimeSec: callerAuthTime } }, route),
}));

/** Η σύνδεση του καλούντα (`auth_time`) — ADR-894 §10 Β1. */
const MY_SIGN_IN = 1_790_000_000;
const OTHER_SIGN_IN = MY_SIGN_IN + 3_600;
let callerAuthTime: number | undefined = MY_SIGN_IN;

const collectionRoute = require('../route') as typeof import('../route');
const sessionRoute = require('../[sessionId]/route') as typeof import('../[sessionId]/route');

type Reply = { status: number; json: () => Promise<Record<string, unknown>> };
type Handler = (request: unknown, route?: unknown) => Promise<Reply>;

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

function request(opts: { body?: unknown; ip?: string; query?: string; bearer?: boolean } = {}) {
  const headers = new Headers({ 'user-agent': CHROME_UA, 'x-forwarded-for': `${opts.ip ?? HOME_IP}, 10.0.0.2` });
  if (opts.bearer !== false) headers.set('authorization', 'Bearer id-token');
  return {
    json: async () => opts.body,
    headers,
    nextUrl: new URL(`https://nestorconstruct.gr/api/auth/active-sessions${opts.query ?? ''}`),
  };
}

const sync = (body: unknown, ip?: string) => (collectionRoute.POST as unknown as Handler)(request({ body, ip }));
const sessions = (uid = ME) => fake.collection('users').doc(uid).collection('sessions');
async function sessionDoc(id: string, uid = ME): Promise<Record<string, unknown>> {
  return (await sessions(uid).doc(id).get()).data() as Record<string, unknown>;
}

async function revokedSignIns(uid = ME): Promise<number[]> {
  const data = (await fake.collection('users').doc(uid).collection('security').doc('revoked_sign_ins').get()).data();
  return ((data?.entries ?? []) as { authTimeSec: number }[]).map((e) => e.authTimeSec).sort();
}

function seedLive(uid: string, id: string, lastActiveMinutesAgo: number, authTimeSec?: number): void {
  const now = Date.now();
  fake.pathBucket(`users/${uid}/sessions`).set(id, {
    id, userId: uid, status: 'active',
    ...(authTimeSec !== undefined ? { signIn: { authTimeSec } } : {}),
    deviceInfo: { browser: 'Chrome 140', browserType: 'Chrome', os: 'Windows' },
    location: { ...THESSALONIKI, ipFingerprint: 'seed' },
    timestamps: {
      createdAt: Timestamp.fromMillis(now - 86_400_000),
      lastActiveAt: Timestamp.fromMillis(now - lastActiveMinutesAgo * 60_000),
      expiresAt: Timestamp.fromMillis(now + 3_600_000),
    },
  });
}

const sessionIdOf = (n: number) => `sess_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeEach(() => {
  fake.reset();
  resolveIpPlace.mockClear();
  revokeRefreshTokens.mockClear();
  createCustomToken.mockClear();
  dispatchNotification.mockClear();
  claimsOf.clear();
  callerAuthTime = MY_SIGN_IN;
});

describe('POST /api/auth/active-sessions', () => {
  it('Π1 — νέα εγγραφή: τοποθεσία από την IP του ΑΙΤΗΜΑΤΟΣ, συσκευή από την ΚΕΦΑΛΙΔΑ, ΠΟΤΕ ωμή IP', async () => {
    const reply = await sync({ sessionId: null, loginMethod: 'email', language: 'el' });
    expect(reply.status).toBe(201);
    const { sessionId } = await reply.json();
    const doc = await sessionDoc(sessionId as string);

    expect(doc.location).toMatchObject({ countryCode: 'GR', city: 'Thessaloniki', precision: 'city' });
    expect((doc.location as { ipFingerprint: string }).ipFingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(doc.deviceInfo).toMatchObject({ browserType: 'Chrome', os: 'Windows', language: 'el' });
    expect(doc.purgeAt).toBeInstanceOf(Timestamp);
    expect(JSON.stringify(doc)).not.toContain(HOME_IP);
    expect(resolveIpPlace).toHaveBeenCalledWith(HOME_IP);
  });

  it('Π2 — ίδιος browser, ίδιο δίκτυο ⇒ άγγιγμα της ΙΔΙΑΣ εγγραφής, καμία νέα επίλυση', async () => {
    const { sessionId } = await (await sync({ sessionId: null, loginMethod: 'email' })).json();
    resolveIpPlace.mockClear();

    const again = await sync({ sessionId, loginMethod: 'email' });
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ sessionId, created: false });
    expect(resolveIpPlace).not.toHaveBeenCalled();
    expect((await sessions().get()).size).toBe(1);
  });

  it('Π3 — άλλο δίκτυο ⇒ lastLocation, η θέση σύνδεσης μένει', async () => {
    const { sessionId } = await (await sync({ sessionId: null, loginMethod: 'email' })).json();
    await sync({ sessionId, loginMethod: 'email' }, ROAMING_IP);
    const doc = await sessionDoc(sessionId as string);
    expect(doc.location).toMatchObject({ city: 'Thessaloniki' });
    expect(doc.lastLocation).toMatchObject({ city: 'Lagos', countryCode: 'NG' });
  });

  it('Π4 — id ΞΕΝΟΥ χρήστη ⇒ δεν αγγίζεται· γεννιέται νέα εγγραφή στον δικό μου χώρο', async () => {
    seedLive(OTHER, sessionIdOf(7), 5);
    const reply = await sync({ sessionId: sessionIdOf(7), loginMethod: 'email' });
    const { sessionId, created } = await reply.json();
    expect(created).toBe(true);
    expect(sessionId).not.toBe(sessionIdOf(7));
    const foreign = await sessionDoc(sessionIdOf(7), OTHER);
    expect((foreign.location as { ipFingerprint: string }).ipFingerprint).toBe('seed');
    expect(foreign.lastLocation).toBeUndefined();
  });

  it.each([
    ['ξένο πεδίο (uid)', { sessionId: null, loginMethod: 'email', uid: OTHER }],
    ['id που δεν είναι sess_<uuid>', { sessionId: '../../users/x', loginMethod: 'email' }],
    ['άγνωστη μέθοδος σύνδεσης', { sessionId: null, loginMethod: 'magic' }],
    ['γλώσσα ως ελεύθερο κείμενο', { sessionId: null, loginMethod: 'email', language: '<script>' }],
  ])('Π5 — %s ⇒ 400, καμία εγγραφή', async (_label, body) => {
    const reply = await sync(body);
    expect(reply.status).toBe(400);
    expect((await sessions().get()).size).toBe(0);
  });

  it('Π6 — στο όριο ανακαλείται η ΠΑΛΑΙΟΤΕΡΗ, όχι η πιο πρόσφατη', async () => {
    for (let n = 1; n <= 10; n += 1) seedLive(ME, sessionIdOf(n), n * 10); // n=10 η παλαιότερη
    await sync({ sessionId: null, loginMethod: 'email' });
    expect((await sessionDoc(sessionIdOf(10))).status).toBe('revoked');
    expect((await sessionDoc(sessionIdOf(10))).revocationReason).toBe('auto_revoked_max_sessions');
    expect((await sessionDoc(sessionIdOf(1))).status).toBe('active');
  });

  it('Π7 — η εγγραφή ξέρει τη σύνδεσή της· το όριο αποσυνδέει ΚΑΙ τη σύνδεση της παλαιότερης', async () => {
    for (let n = 1; n <= 10; n += 1) seedLive(ME, sessionIdOf(n), n * 10, OTHER_SIGN_IN + n);
    const { sessionId } = await (await sync({ sessionId: null, loginMethod: 'email' })).json();
    expect((await sessionDoc(sessionId as string)).signIn).toEqual({ authTimeSec: MY_SIGN_IN });
    expect(await revokedSignIns()).toEqual([OTHER_SIGN_IN + 10]);
  });

  it('Π8 — νέα σύνδεση στον ίδιο browser ⇒ το άγγιγμα ενημερώνει τη σύνδεση της εγγραφής', async () => {
    seedLive(ME, sessionIdOf(1), 5, OTHER_SIGN_IN);
    await sync({ sessionId: sessionIdOf(1), loginMethod: 'email' });
    expect((await sessionDoc(sessionIdOf(1))).signIn).toEqual({ authTimeSec: MY_SIGN_IN });
  });
});

describe('DELETE /api/auth/active-sessions/{sessionId}', () => {
  const revoke = (id: string, query = '') =>
    (sessionRoute.DELETE as unknown as Handler)(request({ query }), { params: Promise.resolve({ sessionId: id }) });

  it('Δ1 — ανάκληση με λόγο logout', async () => {
    seedLive(ME, sessionIdOf(1), 1);
    expect((await revoke(sessionIdOf(1), '?reason=logout')).status).toBe(200);
    expect(await sessionDoc(sessionIdOf(1))).toMatchObject({ status: 'revoked', revocationReason: 'logout' });
  });

  it('Δ2 — ξένη ή ανύπαρκτη ή άκυρη ταυτότητα ⇒ ΙΔΙΟ 404, ξένη εγγραφή ανέγγιχτη', async () => {
    seedLive(OTHER, sessionIdOf(2), 1);
    expect((await revoke(sessionIdOf(2))).status).toBe(404);
    expect((await revoke(sessionIdOf(3))).status).toBe(404);
    expect((await revoke('not-a-session')).status).toBe(404);
    expect((await sessionDoc(sessionIdOf(2), OTHER)).status).toBe('active');
  });

  it('Δ3 — άγνωστος λόγος ⇒ 400 (κανένα ελεύθερο κείμενο στο έγγραφο)', async () => {
    seedLive(ME, sessionIdOf(1), 1);
    expect((await revoke(sessionIdOf(1), '?reason=hacked')).status).toBe(400);
    expect((await sessionDoc(sessionIdOf(1))).status).toBe('active');
  });

  it('Δ4 🔴 «Αποσύνδεση» άλλης συσκευής ⇒ ανακαλείται ΚΑΙ η σύνδεσή της (όχι μόνο η εγγραφή)', async () => {
    seedLive(ME, sessionIdOf(2), 1, OTHER_SIGN_IN);
    const reply = await revoke(sessionIdOf(2));
    expect(reply.status).toBe(200);
    expect((await reply.json()).session).toEqual({ kind: 'unchanged' });
    expect(await revokedSignIns()).toEqual([OTHER_SIGN_IN]);
    expect(revokeRefreshTokens).not.toHaveBeenCalled(); // ΜΙΑ συσκευή, όχι όλες
  });

  it('Δ7 🔴 §10.7 — η ανάκληση φτάνει και στους ΚΑΝΟΝΕΣ: το claim `revokedSignIns` = η λίστα, τα άλλα claims μένουν', async () => {
    claimsOf.set(ME, { globalRole: 'external_user', mfaEnrolled: true });
    seedLive(ME, sessionIdOf(2), 1, OTHER_SIGN_IN);
    expect((await revoke(sessionIdOf(2))).status).toBe(200);
    expect(claimsOf.get(ME)).toEqual(expect.objectContaining({
      globalRole: 'external_user', mfaEnrolled: true, revokedSignIns: [OTHER_SIGN_IN],
    }));
  });

  it('Δ5 🔴 φρουρός εαυτού: εγγραφή με τη ΔΙΚΗ μου σύνδεση (φάντασμα του ίδιου browser) δεν με αποσυνδέει', async () => {
    seedLive(ME, sessionIdOf(3), 1, MY_SIGN_IN);
    expect((await revoke(sessionIdOf(3))).status).toBe(200);
    expect(await revokedSignIns()).toEqual([]);
  });

  it('Δ6 — logout: η δική μου σύνδεση ανακαλείται (αντίγραφο του cookie δεν επιβιώνει)', async () => {
    seedLive(ME, sessionIdOf(1), 1, MY_SIGN_IN);
    await revoke(sessionIdOf(1), '?reason=logout');
    expect(await revokedSignIns()).toEqual([MY_SIGN_IN]);
  });
});

describe('DELETE /api/auth/active-sessions?keep=', () => {
  const revokeOthers = (query: string) => (collectionRoute.DELETE as unknown as Handler)(request({ query }));

  it('Α1 — όλες εκτός από αυτή του browser', async () => {
    [1, 2, 3].forEach((n) => seedLive(ME, sessionIdOf(n), n));
    const reply = await revokeOthers(`?keep=${sessionIdOf(1)}`);
    expect((await reply.json()).revokedSessionIds).toEqual([sessionIdOf(2), sessionIdOf(3)]);
    expect((await sessionDoc(sessionIdOf(1))).status).toBe('active');
  });

  it('Α2 — άκυρο keep ⇒ 400, τίποτα δεν ανακαλείται', async () => {
    seedLive(ME, sessionIdOf(1), 1);
    expect((await revokeOthers('?keep=../x')).status).toBe(400);
    expect((await sessionDoc(sessionIdOf(1))).status).toBe('active');
    expect(revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('Α3 🔴 «όλων των άλλων» ⇒ revokeRefreshTokens (πραγματικό κλείσιμο) + κλειδί για ΑΥΤΗ τη συσκευή', async () => {
    [1, 2].forEach((n) => seedLive(ME, sessionIdOf(n), n));
    const body = await (await revokeOthers(`?keep=${sessionIdOf(1)}`)).json();
    expect(revokeRefreshTokens).toHaveBeenCalledWith(ME);
    expect(body.session).toEqual({ kind: 'reissued', token: 'custom_token_1' });
  });

  it('Α5 — §10.7 μετά την ανάκληση ΟΛΩΝ η λίστα αδειάζει ⇒ και το claim (κανένα byte για ό,τι καλύπτει η σφραγίδα)', async () => {
    claimsOf.set(ME, { globalRole: 'external_user', revokedSignIns: [OTHER_SIGN_IN] });
    [1, 2].forEach((n) => seedLive(ME, sessionIdOf(n), n));
    await revokeOthers(`?keep=${sessionIdOf(1)}`);
    expect(claimsOf.get(ME)).not.toHaveProperty('revokedSignIns');
    expect(claimsOf.get(ME)).toEqual(expect.objectContaining({ globalRole: 'external_user' }));
  });

  it('Α4 🔴 κλειδί ΠΟΤΕ από σκέτο cookie (χωρίς Bearer) ⇒ ended', async () => {
    seedLive(ME, sessionIdOf(1), 1);
    const reply = await (collectionRoute.DELETE as unknown as Handler)(request({ query: `?keep=${sessionIdOf(1)}`, bearer: false }));
    expect((await reply.json()).session).toEqual({ kind: 'ended' });
    expect(createCustomToken).not.toHaveBeenCalled();
  });
});

describe('ADR-894 §10 Β3 — «νέα σύνδεση από νέα χώρα / συσκευή»', () => {
  it('Ν1 — η ΠΡΩΤΗ εγγραφή του λογαριασμού ⇒ καμία ειδοποίηση (τίποτα να συγκριθεί)', async () => {
    await sync({ sessionId: null, loginMethod: 'email' });
    expect(dispatchNotification).not.toHaveBeenCalled();
  });

  it('Ν2 🔴 γνωστή Ελλάδα + Chrome/Windows, νέα σύνδεση από Νιγηρία ⇒ ΥΠΟΧΡΕΩΤΙΚΗ ειδοποίηση ασφαλείας', async () => {
    seedLive(ME, sessionIdOf(1), 30);
    const { sessionId } = await (await sync({ sessionId: null, loginMethod: 'email' }, ROAMING_IP)).json();
    expect(dispatchNotification).toHaveBeenCalledTimes(1);
    const sent = dispatchNotification.mock.calls[0][0];
    expect(sent).toMatchObject({
      eventType: 'security.newDeviceLogin',
      recipientId: ME,
      eventId: `new-sign-in:${ME}:${sessionId as string}`,
      reasons: ['new-country'],
      titleParams: { place: 'Lagos, NG' },
    });
    expect(JSON.stringify(sent)).not.toContain(ROAMING_IP); // ποτέ IP στην ειδοποίηση
  });

  it('Ν3 — ίδια χώρα, ίδια συσκευή ⇒ σιωπή (όχι ειδοποίηση σε κάθε σύνδεση)', async () => {
    seedLive(ME, sessionIdOf(1), 30);
    await sync({ sessionId: null, loginMethod: 'email' });
    expect(dispatchNotification).not.toHaveBeenCalled();
  });
});
