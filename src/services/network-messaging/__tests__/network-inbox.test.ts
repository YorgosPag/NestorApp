/**
 * @jest-environment node
 *
 * ADR-867 §4.5 (Β10) — ΑΓΚΥΡΕΣ του **κουτιού αδιάβαστων**: η γραμμή `network_inbox/{uid}/network_inbox_unread/{threadId}`
 * υπάρχει **⇔** η θέση μετρά ως αδιάβαστη. Εκτελούνται οι ΠΡΑΓΜΑΤΙΚΟΙ γραφείς, πάνω στην ψεύτικη Firestore.
 *
 *   Ι-1  Μήνυμα ⇒ ο παραλήπτης αποκτά γραμμή· ο αποστολέας **όχι** (διάβασε ό,τι έγραψε)
 *   Ι-2  «Το είδα» ⇒ η γραμμή φεύγει· νέο μήνυμα ⇒ ξαναέρχεται
 *   Ι-3  Σίγαση ⇒ η γραμμή φεύγει **αν και** το αδιάβαστο μένει· άρση ⇒ ξαναέρχεται (το αδιάβαστο δεν χάθηκε)
 *   Ι-4  Το «ακολουθώ» **δεν** αγγίζει το κουτί
 *   Ι-5  Ανάκληση του μόνου αδιάβαστου ⇒ η γραμμή φεύγει (ό,τι δεν υπάρχει δεν μετρά)
 *   Ι-6  Έξοδος από την ομάδα ⇒ η γραμμή φεύγει· επιστροφή ⇒ ξαναέρχεται με την ανάγνωση που επιβίωσε
 *   Ι-7  Νέο μέλος σε νήμα με μήνυμα ⇒ γραμμή (δεν διάβασε ποτέ)· νέο νήμα ⇒ καμία γραμμή
 *   Ι-8  Ιδεμποτία: δεύτερη αποστολή ίδιου `clientKey` και διπλό «το είδα» ⇒ ίδιο κουτί
 *   Ι-9  🛟 Συμφιλίωση: ορφανή γραμμή σβήνεται, χαμένη γραμμή ξαναγράφεται — από την αλήθεια
 *   Ι-10 🔒 Η προβολή δεν περνά ιδιωτικό πεδίο στη δημόσια γραμμή ούτε στα `audienceWrites`
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { EntityAuditService } from '@/services/entity-audit.service';
import {
  generateDeterministicNetworkActTeamId,
  generateDeterministicNetworkActThreadId,
} from '@/services/enterprise-id.service';
import { actTeamDocument, changeActTeam } from '@/services/network-messaging/act-team-writer';
import {
  markNetworkThreadRead,
  retractNetworkMessage,
  sendNetworkMessage,
  setNetworkThreadFollowing,
  setNetworkThreadMuted,
} from '@/services/network-messaging/thread-messages';
import { ensureActThread, reconcileInboxSeat } from '@/services/network-messaging/thread-writer';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { privateFieldsOnPublicRows } from './audience-private-fixture';

const HOST = 'comp_alfa';
const ACT_SEED = mandateActSeed('ownp_inbox', HOST);
const THREAD_ID = generateDeterministicNetworkActThreadId(ACT_SEED);
const TEAM_ID = generateDeterministicNetworkActTeamId(ACT_SEED);
const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const OWNER = 'user_kostas';
const BORN = '2026-09-22T09:00:00.000Z';
const at = (minute: number): string => `2026-09-22T10:${String(minute).padStart(2, '0')}:00.000Z`;
const quiet = async (): Promise<void> => undefined;

const MEMBERS_PATH = `${COLLECTIONS.COMPANIES}/${HOST}/${SUBCOLLECTIONS.WORKSPACE_MEMBERS}`;
const inboxPath = (uid: string): string =>
  `${COLLECTIONS.NETWORK_INBOX}/${uid}/${SUBCOLLECTIONS.NETWORK_INBOX_UNREAD}`;

beforeEach(() => jest.spyOn(EntityAuditService, 'recordChange').mockResolvedValue('eaud_1'));
afterEach(() => jest.restoreAllMocks());

async function world(): Promise<{ db: AdminFirestore; fake: FakeFirestore }> {
  const fake = new FakeFirestore();
  const db = fake as unknown as AdminFirestore;
  for (const uid of [MARIA, ELENI]) fake.seed(MEMBERS_PATH, uid, { uid, status: 'active', globalRole: 'internal_user' });
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

/** Η γραμμή του κουτιού ενός ανθρώπου για το νήμα — `null` ⇒ δεν μετρά. */
const inboxRow = (fake: FakeFirestore, uid: string): Record<string, unknown> | null =>
  JSON.parse(fake.snapshotOf(inboxPath(uid), THREAD_ID)) as Record<string, unknown> | null;

async function send(db: AdminFirestore, sender: string, nowISO: string, key?: string): Promise<string> {
  const sent = await sendNetworkMessage(db, { threadId: THREAD_ID, senderUid: sender, text: 'Μήνυμα', nowISO, clientKey: key }, quiet);
  if (sent.kind !== 'sent') throw new Error(sent.reason);
  return sent.messageId;
}

const changeEleni = (db: AdminFirestore, kind: 'add-collaborator' | 'remove-collaborator', version: number, nowISO: string) =>
  changeActTeam(db, {
    teamId: TEAM_ID,
    change: { kind, uid: ELENI },
    actorUid: MARIA,
    actorWorkspaceId: HOST,
    actorIsManager: false,
    expectedVersion: version,
    nowISO,
  });

// ============================================================================
describe('Ι — το κουτί αδιάβαστων ακολουθεί την αλήθεια, στην ίδια συναλλαγή', () => {
  it('Ι-7β νέο νήμα χωρίς μήνυμα ⇒ ΚΑΜΙΑ γραμμή σε κανέναν', async () => {
    const { fake } = await world();
    expect(inboxRow(fake, MARIA)).toBeNull();
    expect(inboxRow(fake, OWNER)).toBeNull();
  });

  it('Ι-1 μήνυμα ⇒ ο παραλήπτης αποκτά γραμμή· ο αποστολέας ΟΧΙ', async () => {
    const { db, fake } = await world();
    await send(db, OWNER, at(1));
    expect(inboxRow(fake, MARIA)).toStrictEqual({ liveMessageAt: at(1) });
    expect(inboxRow(fake, OWNER)).toBeNull();
  });

  it('Ι-2 «το είδα» ⇒ η γραμμή φεύγει· νέο μήνυμα ⇒ ξαναέρχεται', async () => {
    const { db, fake } = await world();
    await send(db, OWNER, at(1));
    await markNetworkThreadRead(db, THREAD_ID, MARIA, at(2));
    expect(inboxRow(fake, MARIA)).toBeNull();

    await send(db, OWNER, at(3));
    expect(inboxRow(fake, MARIA)).toStrictEqual({ liveMessageAt: at(3) });
  });

  it('Ι-3 σίγαση ⇒ η γραμμή φεύγει· άρση ⇒ ξαναέρχεται (το αδιάβαστο δεν χάθηκε)', async () => {
    const { db, fake } = await world();
    await send(db, OWNER, at(1));
    await setNetworkThreadMuted(db, THREAD_ID, MARIA, true);
    expect(inboxRow(fake, MARIA)).toBeNull();

    await send(db, OWNER, at(2));
    expect(inboxRow(fake, MARIA)).toBeNull();

    await setNetworkThreadMuted(db, THREAD_ID, MARIA, false);
    expect(inboxRow(fake, MARIA)).toStrictEqual({ liveMessageAt: at(2) });
  });

  it('Ι-4 το «ακολουθώ» ΔΕΝ αγγίζει το κουτί', async () => {
    const { db, fake } = await world();
    await send(db, OWNER, at(1));
    await setNetworkThreadFollowing(db, THREAD_ID, MARIA, true);
    expect(inboxRow(fake, MARIA)).toStrictEqual({ liveMessageAt: at(1) });
  });

  it('Ι-5 ανάκληση του μόνου αδιάβαστου ⇒ η γραμμή φεύγει· ανάκληση του νεότερου ⇒ δείχνει το προηγούμενο', async () => {
    const { db, fake } = await world();
    const first = await send(db, OWNER, at(1), 'k1');
    const second = await send(db, OWNER, at(2), 'k2');

    await retractNetworkMessage(db, { threadId: THREAD_ID, messageId: second, actorUid: OWNER, nowISO: at(3) }, quiet);
    expect(inboxRow(fake, MARIA)).toStrictEqual({ liveMessageAt: at(1) });

    await retractNetworkMessage(db, { threadId: THREAD_ID, messageId: first, actorUid: OWNER, nowISO: at(4) }, quiet);
    expect(inboxRow(fake, MARIA)).toBeNull();
  });

  it('Ι-6 έξοδος ⇒ η γραμμή φεύγει· επιστροφή ⇒ ξαναέρχεται με την ανάγνωση που επιβίωσε', async () => {
    const { db, fake } = await world();
    await changeEleni(db, 'add-collaborator', 1, BORN);
    await send(db, OWNER, at(1));
    expect(inboxRow(fake, ELENI)).toStrictEqual({ liveMessageAt: at(1) });

    await changeEleni(db, 'remove-collaborator', 2, at(2));
    expect(inboxRow(fake, ELENI)).toBeNull();

    await changeEleni(db, 'add-collaborator', 3, at(3));
    expect(inboxRow(fake, ELENI)).toStrictEqual({ liveMessageAt: at(1) });
  });

  it('Ι-6β επιστροφή ΑΦΟΥ είχε διαβάσει ⇒ καμία γραμμή (η ανάγνωση του ανθρώπου επιβιώνει)', async () => {
    const { db, fake } = await world();
    await changeEleni(db, 'add-collaborator', 1, BORN);
    await send(db, OWNER, at(1));
    await markNetworkThreadRead(db, THREAD_ID, ELENI, at(2));
    await changeEleni(db, 'remove-collaborator', 2, at(3));
    await changeEleni(db, 'add-collaborator', 3, at(4));
    expect(inboxRow(fake, ELENI)).toBeNull();
  });

  it('Ι-7 νέο μέλος σε νήμα με μήνυμα ⇒ γραμμή (δεν διάβασε ποτέ)', async () => {
    const { db, fake } = await world();
    await send(db, OWNER, at(1));
    await changeEleni(db, 'add-collaborator', 1, at(2));
    expect(inboxRow(fake, ELENI)).toStrictEqual({ liveMessageAt: at(1) });
  });

  it('Ι-8 ιδεμποτία: ίδια αποστολή δύο φορές και διπλό «το είδα» ⇒ ίδιο κουτί', async () => {
    const { db, fake } = await world();
    await send(db, OWNER, at(1), 'same');
    await send(db, OWNER, at(1), 'same');
    expect(fake.all(inboxPath(MARIA))).toHaveLength(1);

    await markNetworkThreadRead(db, THREAD_ID, MARIA, at(2));
    await markNetworkThreadRead(db, THREAD_ID, MARIA, at(2));
    expect(fake.all(inboxPath(MARIA))).toHaveLength(0);
  });

  it('Ι-9 🛟 συμφιλίωση: χαμένη γραμμή ξαναγράφεται, ορφανή σβήνεται — από την αλήθεια', async () => {
    const { db, fake } = await world();
    await send(db, OWNER, at(1));
    // Βλάβη: η γραμμή χάθηκε έξω από τον γραφέα.
    fake.pathBucket(inboxPath(MARIA)).delete(THREAD_ID);
    expect(await reconcileInboxSeat(db, THREAD_ID, MARIA)).toBe('unread');
    expect(inboxRow(fake, MARIA)).toStrictEqual({ liveMessageAt: at(1) });

    // Βλάβη: ορφανή γραμμή σε κάποιον που δεν είναι καν στο ακροατήριο.
    fake.write(inboxPath(ELENI), THREAD_ID, { liveMessageAt: at(1) });
    expect(await reconcileInboxSeat(db, THREAD_ID, ELENI)).toBe('clear');
    expect(inboxRow(fake, ELENI)).toBeNull();

    // Ιδεμποτία του διχτυού.
    expect(await reconcileInboxSeat(db, THREAD_ID, MARIA)).toBe('unread');
    expect(fake.all(inboxPath(MARIA))).toHaveLength(1);
  });

  it('Ι-10 🔒 η προβολή δεν περνά ιδιωτικό πεδίο στη δημόσια γραμμή ούτε στα `audienceWrites`', async () => {
    const { db, fake } = await world();
    await changeEleni(db, 'add-collaborator', 1, BORN);
    await markNetworkThreadRead(db, THREAD_ID, ELENI, at(1));
    await setNetworkThreadMuted(db, THREAD_ID, ELENI, true);

    const outcome = await changeEleni(db, 'remove-collaborator', 2, at(2));

    expect(privateFieldsOnPublicRows(fake, THREAD_ID)).toStrictEqual([]);
    const writes = outcome.kind === 'applied' ? outcome.audienceWrites : [];
    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      expect(Object.keys(write.entry)).not.toEqual(expect.arrayContaining(['lastReadAt']));
      expect(Object.keys(write.entry)).not.toEqual(expect.arrayContaining(['muted']));
    }
  });
});
