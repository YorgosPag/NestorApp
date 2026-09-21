/**
 * @jest-environment node
 *
 * ADR-867 Β5 — ΑΓΚΥΡΕΣ πάνω στις **πραγματικές διαδρομές** του δικτύου. Η ταυτότητα έρχεται από
 * πλαστή πόρτα· **όλα τα υπόλοιπα** (σχήματα, γραφείς, κριτές, μετάφραση σε HTTP) είναι τα πραγματικά.
 *
 *   Δ-1  🔴 Ο super_admin σε ΞΕΝΟ χώρο **δεν** είναι μέλος του (`platform-bypass` ⇒ κανένας χώρος)
 *   Δ-2  🔴 Ξένος και ανύπαρκτο νήμα ⇒ **ίδιο** 404 — η διαδρομή δεν απαριθμεί συνομιλίες
 *   Δ-3  Ο αποστολέας είναι **πάντα** ο συνδεδεμένος — ένα `senderUid` στο σώμα απορρίπτεται/αγνοείται
 *   Δ-3β (Β7) Κλειδί ιδεμποτησίας: ίδιο κλειδί ⇒ ίδιο μήνυμα · χωρίς κλειδί ⇒ 400
 *   Δ-4  🔴 Χαλασμένος δρομέας ⇒ 400, ποτέ «πρώτη σελίδα» σιωπηλά
 *   Δ-5  🔴 Ο super_admin σε ξένο χώρο **δεν** αλλάζει ομάδα (θα έβαζε τον εαυτό του να διαβάζει)
 *   Δ-6  Ταυτόχρονη αλλαγή ⇒ 409 **με** την έκδοση που ισχύει
 *   Δ-7  Ο διαχειριστής χώρου αλλάζει υπεύθυνο· το απλό μέλος παίρνει 403
 *   Δ-8  Παρουσία: μόνο για όποιον διαβάζει ήδη — ξένος ⇒ 404
 *   Δ-9  (Β7) «Ακολουθώ»: η ΔΙΚΗ μου ιδιωτική πλευρά (Ε9), τελική κατάσταση — ξένος ⇒ 404
 *   Δ-10 (Β7) Επεξεργασία: μόνο ο αποστολέας (403 στον άλλον) · ίδιο κείμενο ⇒ `edited: false`
 *   Δ-12 (Β7) Επιλογέας ομάδας: μόνο ενεργά μέλη του γραφείου, με όνομα, κανένα email
 *   Δ-11 (Β7) Ονόματα: όνομα + φωτογραφία + επωνυμία γραφείου, ΚΑΝΕΝΑ email — ξένος ⇒ 404
 */

import { NextRequest } from 'next/server';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { ApiActor } from '@/lib/auth/personal-scope-middleware';
import type { AuthContext } from '@/lib/auth/types';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  generateDeterministicNetworkActThreadId,
  generateDeterministicNetworkActTeamId,
} from '@/services/enterprise-id.service';
import { actTeamDocument } from '@/services/network-messaging/act-team-writer';
import { ensureActThread } from '@/services/network-messaging/thread-writer';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  privateFieldsOnPublicRows,
  privateSideOf,
} from '@/services/network-messaging/__tests__/audience-private-fixture';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

// ── Η πλαστή πόρτα: ο δρων ορίζεται από το test, τίποτα άλλο δεν πλαστογραφείται ──────────
let personalActor: ApiActor;
let orgCtx: AuthContext;
let fake: FakeFirestore;

jest.mock('@/lib/middleware/with-rate-limit', () => {
  const pass = <H>(handler: H) => handler;
  return { withHighRateLimit: pass, withStandardRateLimit: pass, withSensitiveRateLimit: pass };
});
jest.mock('@/lib/auth/personal-scope-middleware', () => ({
  ...jest.requireActual('@/lib/auth/personal-scope-middleware'),
  withPersonalOrOrgAuth:
    (handler: (req: unknown, actor: unknown, rc: unknown) => unknown) =>
    (req: unknown, rc: unknown) => handler(req, personalActor, rc),
}));
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  withAuth:
    (handler: (req: unknown, ctx: unknown, cache: unknown, rc: unknown) => unknown) =>
    (req: unknown, rc: unknown) => handler(req, orgCtx, new Map(), rc),
}));
jest.mock('@/lib/firebaseAdmin', () => ({
  ...jest.requireActual('@/lib/firebaseAdmin'),
  getAdminFirestore: () => fake,
}));

import { networkActorOf, NETWORK_REFUSAL_STATUS } from '../_shared/network-door';
import { GET as listThreads } from '../threads/route';
import { POST as sendMessage } from '../threads/[threadId]/messages/route';
import { GET as presence } from '../threads/[threadId]/presence/route';
import { GET as readTeam, PATCH as changeTeam } from '../act-teams/[teamId]/route';
import { PUT as follow } from '../threads/[threadId]/follow/route';
import { PATCH as editMessage } from '../threads/[threadId]/messages/[messageId]/route';
import { GET as people } from '../threads/[threadId]/people/route';

const NOW = '2026-09-17T10:00:00.000Z';
const HOST = 'comp_alfa';
const ACT_SEED = mandateActSeed('ownp_1', HOST);
const THREAD_ID = generateDeterministicNetworkActThreadId(ACT_SEED);
const TEAM_ID = generateDeterministicNetworkActTeamId(ACT_SEED);
const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const OWNER = 'user_kostas';
/** Κλειδιά ιδεμποτησίας (Β7) — ό,τι θα έδινε το `generateOpaqueToken()` του πελάτη. */
const KEY_A = '0f5e4c8a-1d2b-4c3e-9f60-7a8b9c0d1e2f';
const KEY_B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const ctxOf = (uid: string, globalRole: AuthContext['globalRole'], verdict: AuthContext['membershipVerdict']): AuthContext => ({
  uid,
  email: `${uid}@example.test`,
  companyId: HOST,
  globalRole,
  mfaEnrolled: false,
  isAuthenticated: true,
  membershipVerdict: verdict,
});
const asPerson = (uid: string): ApiActor => ({ scope: 'personal', ctx: { uid } as ApiActor['ctx'] });
const params = <P extends Record<string, string>>(value: P) => ({ params: Promise.resolve(value) });
const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(async () => {
  jest.spyOn(EntityAuditService, 'recordChange').mockResolvedValue('eaud_1');
  fake = new FakeFirestore();
  const db = fake as unknown as AdminFirestore;
  for (const uid of [MARIA, ELENI, 'user_admin']) {
    fake.seed(`${COLLECTIONS.COMPANIES}/${HOST}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`, uid, { uid, status: 'active', globalRole: 'internal_user' });
  }
  fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, TEAM_ID, {
    ...actTeamDocument({ actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, responsibleUid: MARIA }, NOW),
  });
  await ensureActThread(db, {
    actSeed: ACT_SEED,
    birth: { kind: 'act', actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, counterpartUid: OWNER },
    team: { responsibleUid: MARIA, memberUids: [MARIA] },
    newcomerReason: 'creator',
    addedBy: MARIA,
    nowISO: NOW,
  });
});
afterEach(() => jest.restoreAllMocks());

// ============================================================================
describe('Δ — η πόρτα', () => {
  it('Δ-1 🔴 super_admin σε ξένο χώρο: ΚΑΝΕΝΑΣ χώρος μέλους· στον δικό του: ναι', () => {
    const bypass = networkActorOf({ scope: 'organization', ctx: ctxOf('user_root', 'super_admin', 'platform-bypass') });
    const home = networkActorOf({ scope: 'organization', ctx: ctxOf(MARIA, 'internal_user', 'home') });
    const citizen = networkActorOf(asPerson(OWNER));

    expect(bypass.memberWorkspaceId).toBeNull();
    expect(home.memberWorkspaceId).toBe(HOST);
    expect(citizen).toStrictEqual({ uid: OWNER, memberWorkspaceId: null, organization: null });
  });

  it('Δ-2 🔴 ξένος και ανύπαρκτο νήμα ⇒ ΙΔΙΟ 404', async () => {
    expect(NETWORK_REFUSAL_STATUS['not-audience']).toBe(NETWORK_REFUSAL_STATUS['thread-absent']);

    personalActor = asPerson('user_stranger');
    const foreign = await sendMessage(
      json(`http://localhost/api/network/threads/${THREAD_ID}/messages`, 'POST', { text: 'γεια', clientKey: KEY_A }),
      params({ threadId: THREAD_ID }),
    );
    const absent = await sendMessage(
      json('http://localhost/api/network/threads/nthr_none/messages', 'POST', { text: 'γεια', clientKey: KEY_A }),
      params({ threadId: 'nthr_none' }),
    );

    expect(foreign.status).toBe(404);
    expect(absent.status).toBe(404);
  });

  it('Δ-3 ο αποστολέας είναι ο συνδεδεμένος — ξένο πεδίο στο σώμα δεν αλλάζει τίποτα', async () => {
    personalActor = asPerson(OWNER);

    const sent = await sendMessage(
      json(`http://localhost/api/network/threads/${THREAD_ID}/messages`, 'POST', { text: 'Καλημέρα', senderUid: MARIA, clientKey: KEY_A }),
      params({ threadId: THREAD_ID }),
    );

    expect(sent.status).toBe(201);
    const stored = fake.all<{ senderUid: string }>(
      `${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES}`,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]?.senderUid).toBe(OWNER);
  });

  it('Δ-3β 🔁 (Β7) ΙΔΙΟ κλειδί ⇒ ΙΔΙΟ μήνυμα, καμία δεύτερη εγγραφή · άλλο κλειδί ⇒ νέο · χωρίς κλειδί ⇒ 400 (μετάλλαξη: τυχαίο id)', async () => {
    personalActor = asPerson(OWNER);
    const url = `http://localhost/api/network/threads/${THREAD_ID}/messages`;
    const post = (body: Record<string, unknown>) => sendMessage(json(url, 'POST', body), params({ threadId: THREAD_ID }));

    const first = (await (await post({ text: 'Καλημέρα', clientKey: KEY_A })).json()) as { messageId: string };
    const retry = (await (await post({ text: 'Καλημέρα', clientKey: KEY_A })).json()) as { messageId: string };
    expect(retry.messageId).toBe(first.messageId);
    await post({ text: 'Καλημέρα', clientKey: KEY_B });
    expect(fake.all(`${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES}`)).toHaveLength(2);

    expect((await post({ text: 'χωρίς κλειδί' })).status).toBe(400);
  });

  it('Δ-4 🔴 χαλασμένος δρομέας ⇒ 400', async () => {
    personalActor = asPerson(OWNER);

    const response = await listThreads(json('http://localhost/api/network/threads?cursor=xyz', 'GET'));

    expect(response.status).toBe(400);
  });
});

describe('Δ — η ομάδα', () => {
  const patch = (body: unknown) =>
    changeTeam(json(`http://localhost/api/network/act-teams/${TEAM_ID}`, 'PATCH', body), params({ teamId: TEAM_ID }));
  const assignEleni = { change: { kind: 'assign-responsible', uid: ELENI }, expectedVersion: 1 };

  it('Δ-5 🔴 super_admin σε ξένο χώρο ⇒ 404, και η ομάδα ΑΝΕΓΓΙΧΤΗ', async () => {
    orgCtx = ctxOf('user_root', 'super_admin', 'platform-bypass');

    const response = await patch({ change: { kind: 'add-collaborator', uid: 'user_root' }, expectedVersion: 1 });

    expect(response.status).toBe(404);
    expect(JSON.parse(fake.snapshotOf(COLLECTIONS.NETWORK_ACT_TEAMS, TEAM_ID))).toMatchObject({ version: 1 });
  });

  it('Δ-7 ο διαχειριστής αλλάζει υπεύθυνο· το απλό μέλος παίρνει 403', async () => {
    orgCtx = ctxOf(MARIA, 'internal_user', 'home');
    expect((await patch(assignEleni)).status).toBe(403);

    orgCtx = ctxOf('user_admin', 'company_admin', 'home');
    const applied = await patch(assignEleni);

    expect(applied.status).toBe(200);
    expect(await applied.json()).toMatchObject({ applied: true, team: { responsibleUid: ELENI, version: 2 } });
  });

  it('Δ-12 (Β7) ο επιλογέας ομάδας προτείνει ΜΟΝΟ ενεργά μέλη του γραφείου, με όνομα (μετάλλαξη: χωρίς φίλτρο κατάστασης)', async () => {
    fake.seed(`${COLLECTIONS.COMPANIES}/${HOST}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`, 'user_gone', { uid: 'user_gone', status: 'suspended' });
    fake.seed(COLLECTIONS.USERS, ELENI, { displayName: 'Ελένη Γραφείου', email: 'eleni@alfa.test' });
    orgCtx = ctxOf(MARIA, 'internal_user', 'home');

    const res = await readTeam(json(`http://x/api/network/act-teams/${TEAM_ID}`, 'GET'), params({ teamId: TEAM_ID }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { candidates: { uid: string; name: string | null }[]; canManage: boolean };
    expect(body.candidates.map((c) => c.uid).sort()).toStrictEqual([ELENI, MARIA, 'user_admin'].sort());
    expect(body.candidates.find((c) => c.uid === ELENI)?.name).toBe('Ελένη Γραφείου');
    expect(JSON.stringify(body)).not.toContain('@');
  });

  it('🔴 Δ-12β (ADR-867 Ε1β) ο ΕΠΙΣΚΕΠΤΗΣ του γραφείου δεν προτείνεται — και ο κριτής τον αρνείται ονομαστικά', async () => {
    // Zendesk light agent: υπάρχει στον χώρο (ενεργή θέση), δεν ανατίθεται. Παρονομαστής: Δ-12 (ίδιο σχήμα, ρόλος προσωπικού ⇒ προτείνεται).
    fake.seed(`${COLLECTIONS.COMPANIES}/${HOST}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`, 'user_guest', { uid: 'user_guest', status: 'active', globalRole: 'external_user' });
    orgCtx = ctxOf('user_admin', 'company_admin', 'home');

    const res = await readTeam(json(`http://x/api/network/act-teams/${TEAM_ID}`, 'GET'), params({ teamId: TEAM_ID }));
    const body = (await res.json()) as { candidates: { uid: string }[] };
    expect(body.candidates.map((c) => c.uid)).not.toContain('user_guest');
    expect(body.candidates.map((c) => c.uid)).toContain(ELENI);

    const refused = await patch({ change: { kind: 'add-collaborator', uid: 'user_guest' }, expectedVersion: 1 });
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ error: 'target-cannot-serve' });
  });


  it('Δ-6 ταυτόχρονη αλλαγή ⇒ 409 ΜΕ την έκδοση που ισχύει', async () => {
    orgCtx = ctxOf('user_admin', 'company_admin', 'home');
    await patch(assignEleni);

    const stale = await patch({ change: { kind: 'add-collaborator', uid: 'user_admin' }, expectedVersion: 1 });

    expect(stale.status).toBe(409);
    // ⚠️ `toEqual` και όχι `toStrictEqual`: το `Response.json()` δίνει αντικείμενο **άλλου realm**,
    //    και το strict συγκρίνει πρωτότυπα. Εδώ δεν υπάρχει πίνακας — η παγίδα των `undefined` δεν αφορά.
    expect(await stale.json()).toEqual({ success: false, error: 'stale-version', currentVersion: 2 });
  });
});

describe('Δ — η παρουσία', () => {
  it('Δ-8 μόνο για όποιον διαβάζει ήδη — ξένος ⇒ 404', async () => {
    const url = `http://localhost/api/network/threads/${THREAD_ID}/presence`;

    personalActor = asPerson('user_stranger');
    expect((await presence(json(url, 'GET'), params({ threadId: THREAD_ID }))).status).toBe(404);

    personalActor = asPerson(OWNER);
    const seen = await presence(json(url, 'GET'), params({ threadId: THREAD_ID }));
    expect(seen.status).toBe(200);
    const body = (await seen.json()) as { away: unknown[]; covering: unknown[] };
    expect(body.away).toHaveLength(0);
    expect(body.covering).toHaveLength(0);
  });
});

// ============================================================================
// Β7 — ΟΙ ΝΕΕΣ ΠΟΡΤΕΣ ΤΗΣ ΟΘΟΝΗΣ
// ============================================================================

describe('Δ — Β7: ακολουθώ · επεξεργασία · ονόματα', () => {
  it('Δ-9 «ακολουθώ» γράφει ΜΟΝΟ το following της δικής μου ιδιωτικής πλευράς — ξένος ⇒ 404 (μετάλλαξη: γράφει τη σίγαση)', async () => {
    personalActor = asPerson(MARIA);
    const ok = await follow(json(`http://x/api/network/threads/${THREAD_ID}/follow`, 'PUT', { following: true }), params({ threadId: THREAD_ID }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ success: true, following: true });
    // 🔒 Ε9: στο ΙΔΙΩΤΙΚΟ έγγραφο, μόνο το `following` — και καμία δημόσια γραμμή δεν το μαρτυρά.
    expect(privateSideOf(fake, THREAD_ID, MARIA)).toStrictEqual({ following: true });
    expect(privateFieldsOnPublicRows(fake, THREAD_ID)).toStrictEqual([]);

    personalActor = asPerson('user_stranger');
    const stranger = await follow(json(`http://x/api/network/threads/${THREAD_ID}/follow`, 'PUT', { following: true }), params({ threadId: THREAD_ID }));
    expect(stranger.status).toBe(404);
  });

  it('Δ-10 επεξεργασία: ο αποστολέας ναι, ο άλλος 403 · ίδιο κείμενο ⇒ edited:false (μετάλλαξη: αγνοείται ο δρων)', async () => {
    personalActor = asPerson(MARIA);
    const sentRes = await sendMessage(json(`http://x/api/network/threads/${THREAD_ID}/messages`, 'POST', { text: 'τιμή 180.000', clientKey: KEY_A }), params({ threadId: THREAD_ID }));
    const { messageId } = (await sentRes.json()) as { messageId: string };
    const url = `http://x/api/network/threads/${THREAD_ID}/messages/${messageId}`;
    const route = params({ threadId: THREAD_ID, messageId });

    personalActor = asPerson(OWNER);
    const foreign = await editMessage(json(url, 'PATCH', { text: 'πλαστό' }), route);
    expect(foreign.status).toBe(403);
    expect(await foreign.json()).toEqual({ success: false, error: 'not-sender' });

    personalActor = asPerson(MARIA);
    const edited = await editMessage(json(url, 'PATCH', { text: 'τιμή 185.000' }), route);
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ success: true, edited: true, readBeforeEdit: false });

    const same = await editMessage(json(url, 'PATCH', { text: ' τιμή 185.000 ' }), route);
    expect(await same.json()).toEqual({ success: true, edited: false });
  });

  it('Δ-11 ονόματα: μόνο για όποιον διαβάζει · όνομα + φωτογραφία + επωνυμία, ΚΑΝΕΝΑ email (μετάλλαξη: email στην απάντηση)', async () => {
    fake.seed(COLLECTIONS.USERS, MARIA, { displayName: 'Μαρία Γραφείου', email: 'maria@alfa.test', photoURL: 'https://img/m.png' });
    fake.seed(COLLECTIONS.USERS, OWNER, { displayName: 'Κώστας Ιδιοκτήτης', email: 'kostas@home.test' });
    fake.seed(COLLECTIONS.COMPANIES, HOST, { name: 'Άλφα Ακίνητα' });

    personalActor = asPerson(OWNER);
    const res = await people(json(`http://x/api/network/threads/${THREAD_ID}/people`, 'GET'), params({ threadId: THREAD_ID }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { people: { uid: string; name: string | null; photoUrl: string | null }[]; hostName: string };
    expect(body.hostName).toBe('Άλφα Ακίνητα');
    expect(body.people).toHaveLength(2);
    expect(body.people.find((p) => p.uid === MARIA)).toEqual({ uid: MARIA, name: 'Μαρία Γραφείου', photoUrl: 'https://img/m.png' });
    expect(JSON.stringify(body)).not.toContain('@');

    personalActor = asPerson('user_stranger');
    const stranger = await people(json(`http://x/api/network/threads/${THREAD_ID}/people`, 'GET'), params({ threadId: THREAD_ID }));
    expect(stranger.status).toBe(404);
  });
});
