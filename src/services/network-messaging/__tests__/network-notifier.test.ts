/**
 * @jest-environment node
 *
 * ADR-867 Β6 — ΑΓΚΥΡΕΣ **ΠΑΝΩ ΣΤΙΣ ΠΡΑΓΜΑΤΙΚΕΣ ΔΙΑΔΡΟΜΕΣ**: `sendNetworkMessage` · `changeActTeam` ·
 * `transferActTeamsOnDeparture`, με τον πραγματικό σχεδιαστή, τον πραγματικό εκτελεστή και FakeFirestore.
 * Ψεύτικα είναι μόνο τα **σύνορα**: ο orchestrator (καμπανάκι + email), τα ονόματα, ο τίτλος της αγγελίας.
 *
 *   Ε-1  Ο ιδιοκτήτης γράφει ⇒ ο **υπεύθυνος** παίρνει ειδοποίηση — στον χώρο του γραφείου, με email που περιμένει 15′
 *   Ε-2  Το γραφείο γράφει ⇒ ο **ιδιοκτήτης**, στον **ιδιωτικό** του χώρο
 *   Ε-3  🔑 Δύο μηνύματα χωρίς ανάγνωση ⇒ **ίδια** ταυτότητα (μία ειδοποίηση)· μετά την ανάγνωση ⇒ **νέα**
 *   Ε-4  🏆 Ο υπεύθυνος **λείπει** ⇒ και η συνεργάτιδα, με τίτλο αναπλήρωσης
 *   Ε-5  🔴 Άρνηση αποστολής ⇒ **καμία** ειδοποίηση
 *   Ε-6  🔴 Σίγαση ⇒ **καμία** ειδοποίηση — το μήνυμα όμως **γράφτηκε**
 *   Ε-7  🔒 Το **κείμενο** του μηνύματος δεν φτάνει ποτέ στην ειδοποίηση
 *   Ο-1  Προσθήκη συνεργάτιδας ⇒ «προστεθήκατε», ταυτότητα = η **έκδοση**
 *   Ο-2  🔑 Αποχώρηση ⇒ ο **κληρονόμος** μαθαίνει (M365), με το όνομα όποιου έφυγε
 */

jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: jest.fn(async () => ({ success: true, dedupeKey: 'k', skipped: false })),
}));
jest.mock('@/server/notifications/notification-email-leg', () => ({
  resolveRecipientEmail: jest.fn(async () => null),
}));
jest.mock('@/lib/listings/listing-notice-title', () => ({
  listingNoticeTitle: jest.fn(async () => 'Διαμέρισμα Κυψέλη'),
}));
jest.mock('@/services/entity-audit.service', () => ({
  // ⚠️ `requireActual` + ΕΝΑ override: ο πλαστός δεν επιτρέπεται να στενέψει το module (ADR-867 §9 Β3).
  ...jest.requireActual('@/services/entity-audit.service'),
  resolveUserDisplayName: jest.fn(async (uid: string) => ({
    user_maria: 'Μαρία Γραφείου',
    user_eleni: 'Ελένη Γραφείου',
    user_kostas: 'Κώστας Ιδιοκτήτης',
  } as Record<string, string>)[uid] ?? null),
}));

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  generateDeterministicNetworkActTeamId,
  generateDeterministicNetworkActThreadId,
  generateDeterministicNetworkAwayId,
} from '@/services/enterprise-id.service';
import { actTeamDocument, changeActTeam } from '@/services/network-messaging/act-team-writer';
import { transferActTeamsOnDeparture } from '@/services/network-messaging/act-team-departure';
import { NETWORK_UNREAD_EMAIL_GRACE_MS } from '@/services/network-messaging/network-notifier';
import {
  markNetworkThreadRead,
  sendNetworkMessage,
  setNetworkThreadMuted,
} from '@/services/network-messaging/thread-messages';
import { ensureActThread } from '@/services/network-messaging/thread-writer';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const BORN = '2026-09-17T10:00:00.000Z';
const T1 = '2026-09-18T09:00:00.000Z';
const T2 = '2026-09-18T09:05:00.000Z';
const T3 = '2026-09-18T10:00:00.000Z';
const HOST = 'comp_alfa';
const ACT_SEED = mandateActSeed('ownp_1', HOST);
const THREAD_ID = generateDeterministicNetworkActThreadId(ACT_SEED);
const TEAM_ID = generateDeterministicNetworkActTeamId(ACT_SEED);
const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const OWNER = 'user_kostas';
const MEMBERS_PATH = `${COLLECTIONS.COMPANIES}/${HOST}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;

const dispatch = dispatchNotification as jest.MockedFunction<typeof dispatchNotification>;
type Request = Parameters<typeof dispatchNotification>[0];
const sent = (): readonly Request[] => dispatch.mock.calls.map(([request]) => request);

beforeEach(() => {
  dispatch.mockClear();
  jest.spyOn(EntityAuditService, 'recordChange').mockResolvedValue('eaud_1');
});
afterEach(() => jest.restoreAllMocks());

async function world(): Promise<{ db: AdminFirestore; fake: FakeFirestore }> {
  const fake = new FakeFirestore();
  const db = fake as unknown as AdminFirestore;
  for (const uid of [MARIA, ELENI]) fake.seed(MEMBERS_PATH, uid, { uid, status: 'active' });
  fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, TEAM_ID, {
    ...actTeamDocument({ actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, responsibleUid: MARIA }, BORN),
  });
  await ensureActThread(db, {
    actSeed: ACT_SEED,
    birth: { kind: 'act', actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, counterpartUid: OWNER },
    team: { responsibleUid: MARIA, memberUids: [MARIA] },
    newcomerReason: 'creator',
    addedBy: MARIA,
    nowISO: BORN,
  });
  return { db, fake };
}

const addEleni = (db: AdminFirestore) =>
  changeActTeam(db, {
    teamId: TEAM_ID,
    change: { kind: 'add-collaborator', uid: ELENI },
    actorUid: MARIA,
    actorWorkspaceId: HOST,
    actorIsManager: false,
    expectedVersion: 1,
    nowISO: BORN,
  });

const send = (db: AdminFirestore, senderUid: string, nowISO: string, text = 'Πότε η επόμενη προβολή;') =>
  sendNetworkMessage(db, { threadId: THREAD_ID, senderUid, text, nowISO });

// ============================================================================
describe('Ε — νέο μήνυμα, στην πραγματική διαδρομή αποστολής', () => {
  it('Ε-1 ο ιδιοκτήτης γράφει ⇒ ο υπεύθυνος, στον χώρο του γραφείου, email μόνο αν μείνει αδιάβαστο 15′', async () => {
    const { db } = await world();
    await send(db, OWNER, T1);

    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({
      eventType: NOTIFICATION_EVENT_TYPES.NETWORK_THREAD_MESSAGE,
      recipientId: MARIA,
      tenantId: HOST,
      workspace: { kind: 'org', companyId: HOST },
      titleKey: 'networkMessage.directTitle',
      titleParams: { sender: 'Κώστας Ιδιοκτήτης', subject: 'Διαμέρισμα Κυψέλη' },
      eventId: `network-thread:${THREAD_ID}:never`,
      entityId: THREAD_ID,
      emailFacts: { kind: 'network-thread-unread', threadId: THREAD_ID, since: T1 },
    });
    expect(sent()[0]?.emailNotBefore?.getTime()).toBe(Date.parse(T1) + NETWORK_UNREAD_EMAIL_GRACE_MS);
    expect(NETWORK_UNREAD_EMAIL_GRACE_MS).toBe(15 * 60_000);
  });

  it('Ε-2 το γραφείο γράφει ⇒ ο ιδιοκτήτης, στον ΙΔΙΩΤΙΚΟ του χώρο', async () => {
    const { db } = await world();
    await send(db, MARIA, T1);

    expect(sent().map((r) => [r.recipientId, r.tenantId, r.workspace])).toStrictEqual([
      [OWNER, OWNER, { kind: 'personal', userId: OWNER }],
    ]);
  });

  it('Ε-3 🔑 δύο μηνύματα χωρίς ανάγνωση ⇒ ΙΔΙΑ ταυτότητα· μετά την ανάγνωση ⇒ ΝΕΑ', async () => {
    const { db } = await world();
    await send(db, OWNER, T1);
    await send(db, OWNER, T2);
    await markNetworkThreadRead(db, THREAD_ID, MARIA, T2);
    await send(db, OWNER, T3);

    expect(sent().map((r) => r.eventId)).toStrictEqual([
      `network-thread:${THREAD_ID}:never`,
      `network-thread:${THREAD_ID}:never`,
      `network-thread:${THREAD_ID}:${T2}`,
    ]);
  });

  it('Ε-4 🏆 ο υπεύθυνος λείπει ⇒ και η συνεργάτιδα, ως αναπληρώτρια', async () => {
    const { db, fake } = await world();
    await addEleni(db);
    fake.seed(COLLECTIONS.NETWORK_AWAY, generateDeterministicNetworkAwayId(MARIA), {
      id: generateDeterministicNetworkAwayId(MARIA), uid: MARIA,
      startsAt: '2026-09-17T00:00:00.000Z', endsAt: '2026-09-24T00:00:00.000Z', updatedAt: BORN,
    });
    dispatch.mockClear();
    await send(db, OWNER, T1);

    const eleni = sent().find((r) => r.recipientId === ELENI);
    expect(sent().map((r) => r.recipientId).sort()).toStrictEqual([ELENI, MARIA].sort());
    expect(eleni).toMatchObject({
      titleKey: 'networkMessage.coveringTitle',
      titleParams: { sender: 'Κώστας Ιδιοκτήτης', subject: 'Διαμέρισμα Κυψέλη', absent: 'Μαρία Γραφείου' },
    });
  });

  it('Ε-5 🔴 άρνηση αποστολής ⇒ καμία ειδοποίηση', async () => {
    const { db } = await world();
    const outcome = await send(db, 'user_stranger', T1);
    expect(outcome).toStrictEqual({ kind: 'refused', reason: 'not-audience' });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('Ε-6 🔴 σίγαση ⇒ καμία ειδοποίηση — το μήνυμα όμως γράφτηκε', async () => {
    const { db, fake } = await world();
    await setNetworkThreadMuted(db, THREAD_ID, MARIA, true);
    const outcome = await send(db, OWNER, T1);

    expect(outcome.kind).toBe('sent');
    expect(fake.all(`${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES}`)).toHaveLength(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('Ε-7 🔒 το ΚΕΙΜΕΝΟ του μηνύματος δεν φτάνει ποτέ στην ειδοποίηση', async () => {
    const { db } = await world();
    await send(db, OWNER, T1, 'ΜΥΣΤΙΚΗ-ΤΙΜΗ-420000');
    expect(JSON.stringify(sent())).not.toContain('ΜΥΣΤΙΚΗ-ΤΙΜΗ-420000');
  });

  it('Ε-8 🔗 Β7 §8 #9 — «Άνοιγμα» στο ΝΗΜΑ: γραφείο ⇒ εντολή · ιδιοκτήτης ⇒ η αγγελία του, με τον χώρο (μετάλλαξη: μόνο χώρος)', async () => {
    const { db } = await world();
    await send(db, OWNER, T1);
    await send(db, MARIA, T2);

    const byRecipient = new Map(sent().map((r) => [r.recipientId, r]));
    expect(byRecipient.get(MARIA)).toMatchObject({
      workspace: { kind: 'org', companyId: HOST },
      actions: [{ id: 'view', url: `/listings/mandates/ownp_1#network-thread-${THREAD_ID}` }],
    });
    expect(byRecipient.get(OWNER)).toMatchObject({
      workspace: { kind: 'personal', userId: OWNER },
      actions: [{ id: 'view', url: `/offers/ownp_1#network-thread-${THREAD_ID}` }],
    });
  });
});

describe('Ο — είσοδος στην ομάδα, στις πραγματικές διαδρομές', () => {
  it('Ο-1 προσθήκη συνεργάτιδας ⇒ «προστεθήκατε», ταυτότητα = η ΕΚΔΟΣΗ', async () => {
    const { db } = await world();
    dispatch.mockClear();
    await addEleni(db);

    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({
      eventType: NOTIFICATION_EVENT_TYPES.NETWORK_TEAM_JOINED,
      recipientId: ELENI,
      tenantId: HOST,
      workspace: { kind: 'org', companyId: HOST },
      titleKey: 'networkTeamJoined.addedTitle',
      eventId: `network-team:${TEAM_ID}:v2`,
      // 🔗 Β7 §8 #9 — ο νέος ανοίγει την εντολή, στο νήμα της (εκεί ζει και η ομάδα).
      actions: [{ id: 'view', url: `/listings/mandates/ownp_1#network-thread-${THREAD_ID}` }],
    });
  });

  it('Ο-2 🔑 αποχώρηση ⇒ ο ΚΛΗΡΟΝΟΜΟΣ μαθαίνει, με το όνομα όποιου έφυγε (Microsoft 365)', async () => {
    const { db } = await world();
    await addEleni(db);
    dispatch.mockClear();
    await transferActTeamsOnDeparture(db, {
      companyId: HOST, departingUid: MARIA, fallbackUid: null, performedBy: 'user_super', nowISO: T1,
    });

    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({
      recipientId: ELENI,
      titleKey: 'networkTeamJoined.failoverTitle',
      titleParams: { subject: 'Διαμέρισμα Κυψέλη', previous: 'Μαρία Γραφείου' },
      eventId: `network-team:${TEAM_ID}:v3`,
    });
  });
});
