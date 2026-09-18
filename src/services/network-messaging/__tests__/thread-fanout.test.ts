/**
 * @jest-environment node
 *
 * ADR-867 Β5 — ΑΓΚΥΡΕΣ του **fan-out on write** και των καθαρών κομματιών του καταλόγου.
 *
 *   Φ-1  Μήνυμα ⇒ **κάθε ζωντανή** γραμμή μαθαίνει τη δραστηριότητα, στην ίδια συναλλαγή
 *   Φ-2  🔴 Ο αποστολέας **δεν** γίνεται «αδιάβαστο» από το δικό του μήνυμα — ο παραλήπτης **γίνεται**
 *   Φ-3  🔴 Σφραγισμένη γραμμή **δεν** αγγίζεται (και δεν γεννιέται ξανά από `set`)
 *   Φ-4  Όποιος μπαίνει **μετά** από μήνυμα παίρνει τη δραστηριότητα **του νήματος**, όχι «τώρα»
 *   Φ-5  Νήμα χωρίς μηνύματα: δραστηριότητα = γέννηση (νέα συνομιλία ανεβαίνει, δεν βουλιάζει)
 *   Κ-1  «Αδιάβαστο» = μήνυμα **μετά** την τελευταία ανάγνωση — και ποτέ σε νήμα χωρίς μήνυμα
 *   Κ-2  🔴 Χαλασμένος δρομέας ⇒ `null` (η πόρτα απαντά 400), ποτέ «πρώτη σελίδα» σιωπηλά
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  generateDeterministicNetworkActThreadId,
  generateDeterministicNetworkActTeamId,
} from '@/services/enterprise-id.service';
import { actTeamDocument, changeActTeam } from '@/services/network-messaging/act-team-writer';
import { sendNetworkMessage } from '@/services/network-messaging/thread-messages';
import {
  decodeDirectoryCursor,
  directoryItem,
  encodeDirectoryCursor,
} from '@/services/network-messaging/thread-directory';
import { ensureActThread } from '@/services/network-messaging/thread-writer';
import type { NetworkAudienceEntry, NetworkThread } from '@/types/network-thread';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const BORN = '2026-09-17T10:00:00.000Z';
const T1 = '2026-09-18T09:00:00.000Z';
const T2 = '2026-09-18T11:00:00.000Z';
const HOST = 'comp_alfa';
const ACT_SEED = mandateActSeed('ownp_1', HOST);
const THREAD_ID = generateDeterministicNetworkActThreadId(ACT_SEED);
const TEAM_ID = generateDeterministicNetworkActTeamId(ACT_SEED);
const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const OWNER = 'user_kostas';

const AUDIENCE_PATH = `${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE}`;
const MEMBERS_PATH = `${COLLECTIONS.COMPANIES}/${HOST}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;

beforeEach(() => jest.spyOn(EntityAuditService, 'recordChange').mockResolvedValue('eaud_1'));
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

const rowOf = (fake: FakeFirestore, uid: string): NetworkAudienceEntry | undefined =>
  fake.all<NetworkAudienceEntry>(AUDIENCE_PATH).find((row) => row.uid === uid);

const addEleni = (db: AdminFirestore, version: number, nowISO: string) =>
  changeActTeam(db, {
    teamId: TEAM_ID,
    change: { kind: 'add-collaborator', uid: ELENI },
    actorUid: MARIA,
    actorWorkspaceId: HOST,
    actorIsManager: false,
    expectedVersion: version,
    nowISO,
  });

// ============================================================================
describe('Φ — fan-out on write', () => {
  it('Φ-5 νήμα χωρίς μηνύματα: η δραστηριότητα είναι η ΓΕΝΝΗΣΗ', async () => {
    const { fake } = await world();

    expect(rowOf(fake, MARIA)?.threadActivityAt).toBe(BORN);
    expect(rowOf(fake, OWNER)?.threadActivityAt).toBe(BORN);
  });

  it('Φ-1 + Φ-2 μήνυμα ⇒ όλοι μαθαίνουν τη δραστηριότητα· ο αποστολέας έχει ΔΙΑΒΑΣΕΙ', async () => {
    const { db, fake } = await world();

    await sendNetworkMessage(db, { threadId: THREAD_ID, senderUid: OWNER, text: 'Καλημέρα', nowISO: T1 });

    expect(rowOf(fake, OWNER)).toMatchObject({ threadActivityAt: T1, lastReadAt: T1 });
    expect(rowOf(fake, MARIA)).toMatchObject({ threadActivityAt: T1, lastReadAt: null });
  });

  it('Φ-3 🔴 σφραγισμένη γραμμή: ΚΑΜΙΑ γραφή — μένει σφραγισμένη, με την παλιά δραστηριότητα', async () => {
    const { db, fake } = await world();
    await addEleni(db, 1, BORN);
    await changeActTeam(db, {
      teamId: TEAM_ID,
      change: { kind: 'remove-collaborator', uid: ELENI },
      actorUid: MARIA,
      actorWorkspaceId: HOST,
      actorIsManager: false,
      expectedVersion: 2,
      nowISO: BORN,
    });

    await sendNetworkMessage(db, { threadId: THREAD_ID, senderUid: OWNER, text: 'Νέα', nowISO: T1 });

    expect(rowOf(fake, ELENI)).toMatchObject({ until: BORN, threadActivityAt: BORN });
  });

  it('Φ-4 όποιος μπαίνει ΜΕΤΑ από μήνυμα παίρνει τη δραστηριότητα του ΝΗΜΑΤΟΣ, όχι «τώρα»', async () => {
    const { db, fake } = await world();
    await sendNetworkMessage(db, { threadId: THREAD_ID, senderUid: OWNER, text: 'Καλημέρα', nowISO: T1 });

    await addEleni(db, 1, T2);

    expect(rowOf(fake, ELENI)).toMatchObject({ since: T2, threadActivityAt: T1 });
  });
});

describe('Κ — τα καθαρά κομμάτια του καταλόγου', () => {
  const THREAD: NetworkThread = {
    id: THREAD_ID,
    topic: { kind: 'act', actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, counterpartUid: OWNER },
    state: 'open',
    createdAt: BORN,
    lastMessageAt: T1,
  };
  const ENTRY: NetworkAudienceEntry = {
    uid: MARIA,
    side: 'host',
    role: 'responsible',
    reason: 'creator',
    addedBy: MARIA,
    since: BORN,
    until: null,
    lastReadAt: null,
    muted: false,
    threadActivityAt: T1,
  };

  it('Κ-1 αδιάβαστο = μήνυμα ΜΕΤΑ την ανάγνωση· ποτέ σε νήμα χωρίς μήνυμα', () => {
    expect(directoryItem(THREAD_ID, ENTRY, THREAD).unread).toBe(true);
    expect(directoryItem(THREAD_ID, { ...ENTRY, lastReadAt: T1 }, THREAD).unread).toBe(false);
    expect(directoryItem(THREAD_ID, { ...ENTRY, lastReadAt: BORN }, THREAD).unread).toBe(true);
    expect(directoryItem(THREAD_ID, ENTRY, { ...THREAD, lastMessageAt: null }).unread).toBe(false);
  });

  it('Κ-2 🔴 ο δρομέας ταξιδεύει ακέραιος· ο χαλασμένος δίνει null', () => {
    const cursor = { activityAt: T1, threadId: THREAD_ID };

    expect(decodeDirectoryCursor(encodeDirectoryCursor(cursor))).toStrictEqual(cursor);
    expect(decodeDirectoryCursor('όχι-δρομέας')).toBeNull();
    expect(decodeDirectoryCursor(Buffer.from('{"a":1,"t":"x"}').toString('base64url'))).toBeNull();
    expect(decodeDirectoryCursor(Buffer.from('{"a":"","t":"x"}').toString('base64url'))).toBeNull();
  });
});
