/**
 * @jest-environment node
 *
 * ADR-867 Β7 — ΑΓΚΥΡΕΣ του **γραφέα επεξεργασίας** και του **«ακολουθώ»** (`thread-messages.ts`),
 * πάνω στον πραγματικό γραφέα με `FakeFirestore`.
 *
 *   Γ-1  Επεξεργασία ⇒ νέο σώμα στο ΙΔΙΟ μήνυμα + η προηγούμενη μορφή στο βιβλίο αναθεωρήσεων
 *   Γ-2  🏆 «Το είχαν διαβάσει;» — για την ΤΡΕΧΟΥΣΑ μορφή
 *   Γ-3  Ίδιο κείμενο ⇒ `unchanged` και ΚΑΜΙΑ αναθεώρηση
 *   Γ-4  🔴 Όχι ο αποστολέας ⇒ τίποτα δεν αλλάζει
 *   Γ-5  🔴 Σφραγισμένος αποστολέας ⇒ `not-audience` (δεν ξαναγράφει ό,τι είπε ως μέλος)
 *   Γ-6  Η επεξεργασία ΔΕΝ κινεί το νήμα στον κατάλογο
 *   Γ-7  Follow: στο **ιδιωτικό** έγγραφο (Ε9) · η δημόσια γραμμή ανέγγιχτη · μη-μέλος δεν γεννά τίποτα
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { generateDeterministicNetworkActThreadId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { privateFieldsOnPublicRows, privateSideOf } from './audience-private-fixture';
import { ensureActThread, type ActThreadTopic } from '@/services/network-messaging/thread-writer';
import {
  editNetworkMessage,
  markNetworkThreadRead,
  sendNetworkMessage,
  setNetworkThreadFollowing,
} from '@/services/network-messaging/thread-messages';
import type { NetworkAudienceEntry, NetworkMessage, NetworkMessageRevision } from '@/types/network-thread';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const NOW = '2026-09-19T10:00:00.000Z';
const T1 = '2026-09-19T10:05:00.000Z';
const T2 = '2026-09-19T10:10:00.000Z';
const T3 = '2026-09-19T10:20:00.000Z';

const ACT_SEED = mandateActSeed('ownp_1', 'comp_alfa');
const THREAD_ID = generateDeterministicNetworkActThreadId(ACT_SEED);
const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const OWNER = 'user_owner';

const TOPIC: ActThreadTopic = { kind: 'act', actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: 'comp_alfa', counterpartUid: OWNER };

const messagesPath = `${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES}`;
const audiencePath = `${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE}`;

async function world(): Promise<{ db: AdminFirestore; fake: FakeFirestore; messageId: string }> {
  const fake = new FakeFirestore();
  const db = fake as unknown as AdminFirestore;
  await ensureActThread(db, {
    actSeed: ACT_SEED,
    birth: TOPIC,
    team: { responsibleUid: MARIA, memberUids: [MARIA, ELENI] },
    newcomerReason: 'creator',
    addedBy: MARIA,
    nowISO: NOW,
  });
  const sent = await sendNetworkMessage(
    db,
    { threadId: THREAD_ID, senderUid: MARIA, text: 'η τιμή είναι 180.000', nowISO: NOW },
    async () => undefined,
  );
  return { db, fake, messageId: (sent as { messageId: string }).messageId };
}

const edit = (db: AdminFirestore, messageId: string, text: string, actorUid = MARIA, nowISO = T2) =>
  editNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid, text, nowISO });

const messageOf = (fake: FakeFirestore) => fake.all<NetworkMessage>(messagesPath)[0];
const revisionsOf = (fake: FakeFirestore) => fake.all<NetworkMessageRevision>(COLLECTIONS.NETWORK_MESSAGE_REVISIONS);

describe('Γ — η επεξεργασία: η παλιά μορφή ΑΛΛΑΖΕΙ ΤΟΠΟ, δεν χάνεται', () => {
  it('Γ-1 νέο σώμα στο ΙΔΙΟ μήνυμα + η προηγούμενη μορφή στο βιβλίο (μετάλλαξη: χωρίς αντίγραφο)', async () => {
    const { db, fake, messageId } = await world();

    await expect(edit(db, messageId, 'η τιμή είναι 185.000')).resolves.toEqual({
      kind: 'edited',
      editedAt: T2,
      readBeforeEdit: false,
    });

    expect(fake.all(messagesPath)).toHaveLength(1);
    expect(messageOf(fake)).toMatchObject({ id: messageId, text: 'η τιμή είναι 185.000', createdAt: NOW, editedAt: T2 });
    const book = revisionsOf(fake);
    expect(book).toHaveLength(1);
    expect(book[0]).toMatchObject({ messageId, previousText: 'η τιμή είναι 180.000', previousAt: NOW, replacedAt: T2 });
    expect(book[0]?.id).toMatch(/^nmrv_/);
  });

  it('🏆 Γ-2 «το είχαν διαβάσει;» κρίνεται για την ΤΡΕΧΟΥΣΑ μορφή (μετάλλαξη: πάντα η αρχική)', async () => {
    const { db, fake, messageId } = await world();
    expect(await markNetworkThreadRead(db, THREAD_ID, OWNER, T1)).toBe('updated');

    // Ο ιδιοκτήτης είχε δει την αρχική ⇒ η πρώτη διόρθωση αλλάζει κάτι που ΕΙΔΕ.
    await expect(edit(db, messageId, 'η τιμή είναι 185.000', MARIA, T2)).resolves.toMatchObject({ readBeforeEdit: true });
    // Δεν ξαναδιάβασε ⇒ η δεύτερη διόρθωση αλλάζει κάτι που ΔΕΝ είδε.
    await expect(edit(db, messageId, 'η τιμή είναι 190.000', MARIA, T3)).resolves.toMatchObject({ readBeforeEdit: false });
    expect(messageOf(fake)).toMatchObject({ readBeforeEdit: false, editedAt: T3 });
    expect(revisionsOf(fake).map((r) => r.previousAt).sort()).toStrictEqual([NOW, T2]);
  });

  it('Γ-3 ίδιο κείμενο ⇒ `unchanged` και ΚΑΜΙΑ αναθεώρηση (μετάλλαξη: γράφει πάντα)', async () => {
    const { db, fake, messageId } = await world();
    await expect(edit(db, messageId, '  η τιμή είναι 180.000 ')).resolves.toEqual({ kind: 'unchanged' });
    expect(revisionsOf(fake)).toHaveLength(0);
    expect(messageOf(fake)?.editedAt).toBeNull();
  });

  it('Γ-4 🔴 όχι ο αποστολέας ⇒ τίποτα δεν αλλάζει (μετάλλαξη: αγνοείται ο δρων)', async () => {
    const { db, fake, messageId } = await world();
    await expect(edit(db, messageId, 'πλαστό', OWNER)).resolves.toEqual({ kind: 'refused', reason: 'not-sender' });
    expect(messageOf(fake)?.text).toBe('η τιμή είναι 180.000');
    expect(revisionsOf(fake)).toHaveLength(0);
  });

  it('Γ-5 🔴 ο αποστολέας που ΕΦΥΓΕ από την ομάδα δεν ξαναγράφει (μετάλλαξη: χωρίς έλεγχο ακροατηρίου)', async () => {
    const { db, fake, messageId } = await world();
    const seat = fake.all<NetworkAudienceEntry>(audiencePath).find((row) => row.uid === MARIA);
    fake.seed(audiencePath, MARIA, { ...seat, until: T1 });
    await expect(edit(db, messageId, 'αργότερα')).resolves.toEqual({ kind: 'refused', reason: 'not-audience' });
    expect(revisionsOf(fake)).toHaveLength(0);
  });

  it('Γ-6 η επεξεργασία ΔΕΝ κινεί το νήμα στον κατάλογο (μετάλλαξη: γράφει threadActivityAt)', async () => {
    const { db, fake, messageId } = await world();
    const before = fake.all<NetworkAudienceEntry>(audiencePath).map((row) => [row.uid, row.threadActivityAt]);
    await edit(db, messageId, 'η τιμή είναι 185.000');
    const after = fake.all<NetworkAudienceEntry>(audiencePath).map((row) => [row.uid, row.threadActivityAt]);
    expect(after).toStrictEqual(before);
  });
});

describe('Γ — «ακολουθώ»: μονομερές, στη δική μου γραμμή', () => {
  it('🔒 Γ-7 το follow πάει στο ΙΔΙΩΤΙΚΟ έγγραφο — η άλλη πλευρά δεν το μαθαίνει (Ε9) · μη-μέλος δεν γεννά τίποτα', async () => {
    const { db, fake } = await world();
    const before = fake.all<NetworkAudienceEntry>(audiencePath).find((r) => r.uid === ELENI);

    expect(await setNetworkThreadFollowing(db, THREAD_ID, ELENI, true)).toBe('updated');
    expect(privateSideOf(fake, THREAD_ID, ELENI)).toStrictEqual({ following: true });
    expect(fake.all<NetworkAudienceEntry>(audiencePath).find((r) => r.uid === ELENI)).toStrictEqual(before);
    expect(privateFieldsOnPublicRows(fake, THREAD_ID)).toStrictEqual([]);

    expect(await setNetworkThreadFollowing(db, THREAD_ID, 'user_stranger', true)).toBe('not-audience');
    expect(fake.all<NetworkAudienceEntry>(audiencePath)).toHaveLength(3);
  });
});
