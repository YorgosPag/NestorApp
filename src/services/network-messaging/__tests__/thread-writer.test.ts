/**
 * @jest-environment node
 *
 * ADR-867 §4.1 · §4.2 · §6 Β4 — ΑΓΚΥΡΕΣ του **ενός γραφέα νήματος / ακροατηρίου / μηνυμάτων**.
 *
 *   Ν-1  Γέννηση με **ντετερμινιστικό** κλειδί· ακροατήριο = ομάδα **+ αντισυμβαλλόμενος**
 *   Ν-2  🔴 **Ιδεμποτής**: δεύτερη κλήση ⇒ **καμία** γραφή, το `since` **δεν** ανανεώνεται
 *   Ν-3  🔴 **Χωρίς ακμή δεν γεννιέται νήμα** (§8 #1) — ομάδα ναι, νήμα όχι
 *   Ν-4  🏆 Αποχώρηση ⇒ ο αποχωρών **ΣΦΡΑΓΙΖΕΤΑΙ** (η γραμμή ΜΕΝΕΙ), ο κληρονόμος μπαίνει
 *   Ν-5  Αλλαγή ρόλου **κρατά** το `since` — ανέβηκε, δεν μπήκε
 *   Ν-6  Ο αντισυμβαλλόμενος του **υπάρχοντος** νήματος ΔΕΝ αντικαθίσταται από νέο `plan`
 *   Μ-1  Αποστολή: μήνυμα **ΚΑΙ** `lastMessageAt`, ή τίποτα
 *   Μ-2  Μη-μέλος ⇒ `not-audience`, **καμία** γραφή
 *   Μ-3  🔴 **Σφραγισμένη** γραμμή ⇒ `not-audience` — ίδια ερώτηση με τον κανόνα Firestore
 *   Μ-4  Κλειστό νήμα (ΓΚΠΔ) ⇒ `thread-closed`
 *   Σ-1  🔴 `touchOwnAudience` σε μη-μέλος **ΔΕΝ ΔΗΜΙΟΥΡΓΕΙ** γραμμή (update, ποτέ set)
 *   Σ-2  Η σίγαση πάει στο **ιδιωτικό** έγγραφο — η δημόσια γραμμή μένει ανέγγιχτη (Ε9)
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { privateFieldsOnPublicRows, privateSideOf } from './audience-private-fixture';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import {
  generateDeterministicNetworkActThreadId,
  generateDeterministicNetworkActTeamId,
} from '@/services/enterprise-id.service';
import { actTeamDocument } from '@/services/network-messaging/act-team-writer';
import { transferActTeamsOnDeparture } from '@/services/network-messaging/act-team-departure';
import {
  ensureActThread,
  touchOwnAudience,
  type ActThreadTopic,
} from '@/services/network-messaging/thread-writer';
import {
  markNetworkThreadRead,
  retractNetworkMessage,
  sendNetworkMessage,
  setNetworkThreadMuted,
  MAX_NETWORK_MESSAGE_CHARS,
} from '@/services/network-messaging/thread-messages';
import type { NetworkAudienceEntry, NetworkMessage } from '@/types/network-thread';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const NOW = '2026-09-17T10:00:00.000Z';
const LATER = '2026-11-01T10:00:00.000Z';

const ACT_SEED = mandateActSeed('ownp_1', 'comp_alfa');
const THREAD_ID = generateDeterministicNetworkActThreadId(ACT_SEED);

const MARIA = 'user_maria';
const ELENI = 'user_eleni';
const ADMIN = 'user_admin';
const OWNER = 'user_kostas';

const TOPIC: ActThreadTopic = {
  kind: 'act',
  actKind: 'mandate',
  actSeed: ACT_SEED,
  hostCompanyId: 'comp_alfa',
  counterpartUid: OWNER,
};

function freshDb(): { db: AdminFirestore; fake: FakeFirestore } {
  const fake = new FakeFirestore();
  return { db: fake as unknown as AdminFirestore, fake };
}

const audiencePath = (threadId = THREAD_ID): string =>
  `${COLLECTIONS.NETWORK_THREADS}/${threadId}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE}`;
const messagesPath = (threadId = THREAD_ID): string =>
  `${COLLECTIONS.NETWORK_THREADS}/${threadId}/${SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES}`;

function audienceOf(fake: FakeFirestore, threadId = THREAD_ID): readonly NetworkAudienceEntry[] {
  return fake.all<NetworkAudienceEntry>(audiencePath(threadId));
}

function threadDoc(fake: FakeFirestore): Record<string, unknown> | null {
  return JSON.parse(fake.snapshotOf(COLLECTIONS.NETWORK_THREADS, THREAD_ID)) as Record<string, unknown> | null;
}

/** Το νήμα όπως το αφήνει η αποδοχή: ομάδα ενός ανθρώπου + ο ιδιοκτήτης. */
async function bornThread(db: AdminFirestore): Promise<void> {
  await ensureActThread(db, {
    actSeed: ACT_SEED,
    birth: TOPIC,
    team: { responsibleUid: MARIA, memberUids: [MARIA] },
    newcomerReason: 'creator',
    addedBy: MARIA,
    nowISO: NOW,
  });
}

// ============================================================================
describe('Ν — το νήμα και το ακροατήριό του', () => {
  it('Ν-1 γεννιέται με ντετερμινιστικό κλειδί· ακροατήριο = ομάδα + αντισυμβαλλόμενος', async () => {
    const { db, fake } = freshDb();

    const outcome = await ensureActThread(db, {
      actSeed: ACT_SEED,
      birth: TOPIC,
      team: { responsibleUid: MARIA, memberUids: [MARIA, ELENI] },
      newcomerReason: 'creator',
      addedBy: MARIA,
      nowISO: NOW,
    });

    expect(outcome.created).toBe(true);
    expect(outcome.threadId).toBe(THREAD_ID);
    expect(threadDoc(fake)).toMatchObject({ state: 'open', createdAt: NOW, lastMessageAt: null });

    const seats = audienceOf(fake);
    expect(seats).toHaveLength(3);
    expect(seats.find((s) => s.uid === MARIA)).toMatchObject({ side: 'host', role: 'responsible', until: null, since: NOW });
    expect(seats.find((s) => s.uid === ELENI)).toMatchObject({ side: 'host', role: 'collaborator', until: null });
    // 🔑 Ο **πελάτης** είναι στο ακροατήριο του ΙΔΙΟΥ εγγράφου — ίδια ερώτηση, δύο πλευρές.
    expect(seats.find((s) => s.uid === OWNER)).toMatchObject({ side: 'counterpart', role: 'counterpart', until: null });
  });

  it('Ν-2 🔴 δεύτερη κλήση ⇒ ΚΑΜΙΑ γραφή, το `since` ΔΕΝ ανανεώνεται', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);
    const writesAfterBirth = fake.writes;

    const again = await ensureActThread(db, {
      actSeed: ACT_SEED,
      birth: TOPIC,
      team: { responsibleUid: MARIA, memberUids: [MARIA] },
      newcomerReason: 'creator',
      addedBy: MARIA,
      nowISO: LATER,
    });

    expect(again.created).toBe(false);
    expect(again.audienceWrites).toEqual([]);
    expect(fake.writes).toBe(writesAfterBirth);
    expect(audienceOf(fake).find((s) => s.uid === MARIA)?.since).toBe(NOW);
  });

  it('Ν-3 🔴 ΧΩΡΙΣ ακμή δεν γεννιέται νήμα — ιδιοκτήτης χωρίς λογαριασμό (§8 #1)', async () => {
    const { db, fake } = freshDb();

    const outcome = await ensureActThread(db, {
      actSeed: ACT_SEED,
      birth: null,
      team: { responsibleUid: MARIA, memberUids: [MARIA] },
      newcomerReason: 'creator',
      addedBy: MARIA,
      nowISO: NOW,
    });

    expect(outcome.threadId).toBeNull();
    expect(threadDoc(fake)).toBeNull();
    expect(audienceOf(fake)).toEqual([]);
  });

  it('Ν-4 🏆 αποχώρηση ⇒ ο αποχωρών ΣΦΡΑΓΙΖΕΤΑΙ (η γραμμή μένει), ο κληρονόμος μπαίνει', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    fake.seed(COLLECTIONS.NETWORK_ACT_TEAMS, generateDeterministicNetworkActTeamId(ACT_SEED), {
      ...actTeamDocument(
        { actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: 'comp_alfa', responsibleUid: MARIA },
        NOW,
      ),
    });

    const result = await transferActTeamsOnDeparture(db, {
      companyId: 'comp_alfa',
      departingUid: MARIA,
      fallbackUid: ADMIN,
      performedBy: ADMIN,
      nowISO: LATER,
    });

    expect(result.transferred).toBe(1);

    const seats = audienceOf(fake);
    const departed = seats.find((s) => s.uid === MARIA);
    // 🔴 ΥΠΑΡΧΕΙ — και ΔΕΝ διαβάζει. Ένα `delete` θα έκανε το «ποιος διάβαζε;» αναπάντητο.
    expect(departed).toBeDefined();
    expect(departed?.until).toBe(LATER);
    expect(seats.find((s) => s.uid === ADMIN)).toMatchObject({
      role: 'responsible',
      reason: 'failover',
      until: null,
      since: LATER,
    });
    expect(seats.find((s) => s.uid === OWNER)?.until).toBeNull();
  });

  it('Ν-5 αλλαγή ρόλου ΚΡΑΤΑ το `since` — ανέβηκε, δεν μπήκε', async () => {
    const { db, fake } = freshDb();
    await ensureActThread(db, {
      actSeed: ACT_SEED,
      birth: TOPIC,
      team: { responsibleUid: MARIA, memberUids: [MARIA, ELENI] },
      newcomerReason: 'creator',
      addedBy: MARIA,
      nowISO: NOW,
    });

    await ensureActThread(db, {
      actSeed: ACT_SEED,
      birth: null,
      team: { responsibleUid: ELENI, memberUids: [MARIA, ELENI] },
      newcomerReason: 'failover',
      addedBy: ADMIN,
      nowISO: LATER,
    });

    const eleni = audienceOf(fake).find((s) => s.uid === ELENI);
    expect(eleni).toMatchObject({ role: 'responsible', since: NOW, until: null });
    expect(audienceOf(fake).find((s) => s.uid === MARIA)).toMatchObject({ role: 'collaborator', until: null });
  });

  it('Ν-6 ο αντισυμβαλλόμενος του ΥΠΑΡΧΟΝΤΟΣ νήματος δεν αντικαθίσταται από νέο plan', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    await ensureActThread(db, {
      actSeed: ACT_SEED,
      birth: { ...TOPIC, counterpartUid: 'user_alien' },
      team: { responsibleUid: MARIA, memberUids: [MARIA] },
      newcomerReason: 'creator',
      addedBy: MARIA,
      nowISO: LATER,
    });

    expect(audienceOf(fake)).toHaveLength(2);
    expect(audienceOf(fake).map((s) => s.uid).sort()).toStrictEqual([MARIA, OWNER].sort());
  });
});

// ============================================================================
describe('Μ — η αποστολή', () => {
  it('Μ-1 μήνυμα ΚΑΙ `lastMessageAt`, στην ίδια συναλλαγή', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    const outcome = await sendNetworkMessage(db, {
      threadId: THREAD_ID,
      senderUid: OWNER,
      text: '  Καλησπέρα σας  ',
      nowISO: LATER,
    });

    expect(outcome).toMatchObject({ kind: 'sent' });
    const messages = fake.all<{ text: string; senderUid: string }>(messagesPath());
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ text: 'Καλησπέρα σας', senderUid: OWNER });
    expect(threadDoc(fake)).toMatchObject({ lastMessageAt: LATER });
  });

  it('Μ-2 μη-μέλος ⇒ `not-audience`, ΚΑΜΙΑ γραφή', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    const outcome = await sendNetworkMessage(db, {
      threadId: THREAD_ID,
      senderUid: 'user_stranger',
      text: 'γεια',
      nowISO: LATER,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'not-audience' });
    expect(fake.all(messagesPath())).toEqual([]);
    expect(threadDoc(fake)).toMatchObject({ lastMessageAt: null });
  });

  it('Μ-3 🔴 ΣΦΡΑΓΙΣΜΕΝΗ γραμμή ⇒ `not-audience` — ίδια ερώτηση με τον κανόνα Firestore', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    const seat = audienceOf(fake).find((s) => s.uid === MARIA) as NetworkAudienceEntry;
    fake.seed(audiencePath(), MARIA, { ...seat, until: LATER });

    const outcome = await sendNetworkMessage(db, {
      threadId: THREAD_ID,
      senderUid: MARIA,
      text: 'μια τελευταία κουβέντα',
      nowISO: LATER,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'not-audience' });
    expect(fake.all(messagesPath())).toEqual([]);
  });

  it('Μ-4 κλειστό νήμα (αποσύνδεση ΓΚΠΔ) ⇒ `thread-closed`', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);
    fake.seed(COLLECTIONS.NETWORK_THREADS, THREAD_ID, {
      ...(threadDoc(fake) as Record<string, unknown>),
      state: 'closed',
    });

    const outcome = await sendNetworkMessage(db, {
      threadId: THREAD_ID,
      senderUid: MARIA,
      text: 'γεια',
      nowISO: LATER,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'thread-closed' });
  });

  it('Μ-5 κενό ή υπερμέγεθες κείμενο απορρίπτεται ΧΩΡΙΣ να αγγίξει τη βάση', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);
    const before = fake.writes;

    await expect(
      sendNetworkMessage(db, { threadId: THREAD_ID, senderUid: MARIA, text: '   ', nowISO: LATER }),
    ).resolves.toEqual({ kind: 'refused', reason: 'empty-text' });

    await expect(
      sendNetworkMessage(db, {
        threadId: THREAD_ID,
        senderUid: MARIA,
        text: 'α'.repeat(MAX_NETWORK_MESSAGE_CHARS + 1),
        nowISO: LATER,
      }),
    ).resolves.toEqual({ kind: 'refused', reason: 'too-long' });

    expect(fake.writes).toBe(before);
  });

  it('Μ-6 ανύπαρκτο νήμα ⇒ `thread-absent`, ποτέ σιωπηλή γέννηση', async () => {
    const { db } = freshDb();

    await expect(
      sendNetworkMessage(db, { threadId: THREAD_ID, senderUid: MARIA, text: 'γεια', nowISO: NOW }),
    ).resolves.toEqual({ kind: 'refused', reason: 'thread-absent' });
  });
});

// ============================================================================
describe('Σ — η δική του γραμμή', () => {
  it('Σ-1 🔴 μη-μέλος ΔΕΝ δημιουργεί γραμμή με το «το διάβασα»', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    const outcome = await touchOwnAudience(db, THREAD_ID, 'user_stranger', { lastReadAt: LATER });

    expect(outcome).toBe('not-audience');
    // 🔴 **ΤΟ `toHaveLength` ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ** (μετρημένο με μετάλλαξη Μ8):
    //    ένα σκέτο `toEqual` πάνω σε `map(s => s.uid)` **ΕΠΕΖΗΣΕ** τη μετάλλαξη «γράψε με
    //    `set` αντί για `update`», επειδή το jest `toEqual` **αγνοεί** τα `undefined` μέλη
    //    πίνακα — και η νόθα γραμμή (`{ lastReadAt }`, χωρίς `uid`) έδινε ακριβώς αυτό.
    //    Πράσινο test πάνω σε αυτοπρόσκληση σε ξένη συνομιλία.
    expect(audienceOf(fake)).toHaveLength(2);
    expect(audienceOf(fake).map((s) => s.uid).sort()).toStrictEqual([MARIA, OWNER].sort());
  });

  it('🔒 Σ-2 η σίγαση πάει στο ΙΔΙΩΤΙΚΟ έγγραφο — η δημόσια γραμμή μένει ανέγγιχτη και ΔΕΝ τη μαρτυρά (Ε9)', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);
    const before = audienceOf(fake).find((s) => s.uid === MARIA);

    expect(await setNetworkThreadMuted(db, THREAD_ID, MARIA, true)).toBe('updated');

    expect(privateSideOf(fake, THREAD_ID, MARIA)).toStrictEqual({ muted: true });
    // 🔴 Μετάλλαξη «γράψε στη δημόσια γραμμή»: η άλλη πλευρά θα διάβαζε `muted: true` με κανόνες.
    expect(audienceOf(fake).find((s) => s.uid === MARIA)).toStrictEqual(before);
    expect(privateFieldsOnPublicRows(fake, THREAD_ID)).toStrictEqual([]);
  });

  it('Σ-3 δεύτερη ρύθμιση ΔΕΝ σβήνει την πρώτη — `merge`, όχι αντικατάσταση', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    await setNetworkThreadMuted(db, THREAD_ID, MARIA, true);
    await touchOwnAudience(db, THREAD_ID, MARIA, { lastReadAt: LATER });

    expect(privateSideOf(fake, THREAD_ID, MARIA)).toStrictEqual({ muted: true, lastReadAt: LATER });
  });

  it('Σ-4 🔴 μη-μέλος ΔΕΝ γεννά ούτε ιδιωτικό έγγραφο', async () => {
    const { db, fake } = freshDb();
    await bornThread(db);

    expect(await setNetworkThreadMuted(db, THREAD_ID, 'user_stranger', true)).toBe('not-audience');
    expect(privateSideOf(fake, THREAD_ID, 'user_stranger')).toBeNull();
  });
});

// ============================================================================
// Α — Η ΑΝΑΚΛΗΣΗ (Β4β · XEP-0424 · Teams «compliance copy»)
// ============================================================================
describe('Α — η ανάκληση: το κείμενο ΑΛΛΑΖΕΙ ΤΟΠΟ, δεν χάνεται', () => {
  const retractionsOf = (fake: FakeFirestore) =>
    fake.all<Record<string, unknown>>(COLLECTIONS.NETWORK_MESSAGE_RETRACTIONS);

  async function bornWithMessage(db: AdminFirestore): Promise<string> {
    await bornThread(db);
    const sent = await sendNetworkMessage(db, {
      threadId: THREAD_ID,
      senderUid: MARIA,
      text: 'η τιμή πέφτει στις 180.000',
      nowISO: NOW,
    });
    return (sent as { messageId: string }).messageId;
  }

  it('Α-1 ταφόπλακα: ίδιο έγγραφο, ΑΔΕΙΟ σώμα — και το κείμενο ζει στο βιβλίο', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);

    const outcome = await retractNetworkMessage(db, {
      threadId: THREAD_ID,
      messageId,
      actorUid: MARIA,
      nowISO: NOW,
    });

    expect(outcome).toEqual({ kind: 'retracted', readBeforeRetraction: false });

    const messages = fake.all<NetworkMessage>(messagesPath());
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: messageId,
      senderUid: MARIA,
      text: '',
      createdAt: NOW,
      retractedAt: NOW,
      readBeforeRetraction: false,
    });

    const book = retractionsOf(fake);
    expect(book).toHaveLength(1);
    expect(book[0]).toMatchObject({
      id: messageId,
      threadId: THREAD_ID,
      threadKind: 'act',
      senderUid: MARIA,
      retractedBy: MARIA,
      originalText: 'η τιμή πέφτει στις 180.000',
      originalCreatedAt: NOW,
      readBeforeRetraction: false,
    });
  });

  it('🏆 Α-2 Η ΕΙΛΙΚΡΙΝΕΙΑ: αν ο πελάτης το ΕΙΧΕ ΔΙΑΒΑΣΕΙ, το λέει', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);

    // Ο Κώστας το διάβασε — η πράξη που κανένας μεγάλος δεν λαμβάνει υπόψη.
    expect(await markNetworkThreadRead(db, THREAD_ID, OWNER, LATER)).toBe('updated');

    const outcome = await retractNetworkMessage(db, {
      threadId: THREAD_ID,
      messageId,
      actorUid: MARIA,
      nowISO: NOW,
    });

    expect(outcome).toEqual({ kind: 'retracted', readBeforeRetraction: true });
    expect(fake.all<NetworkMessage>(messagesPath())[0].readBeforeRetraction).toBe(true);
    expect(retractionsOf(fake)[0]).toMatchObject({ readBeforeRetraction: true });
  });

  it('🔴 Α-2β ο ΙΔΙΟΣ ο αποστολέας δεν μετράει ως «το είδε κάποιος»', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);

    // Η Μαρία διάβασε τα ΔΙΚΑ της λόγια — δεν λέει τίποτα σε κανέναν.
    expect(await markNetworkThreadRead(db, THREAD_ID, MARIA, LATER)).toBe('updated');

    await expect(
      retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid: MARIA, nowISO: NOW }),
    ).resolves.toEqual({ kind: 'retracted', readBeforeRetraction: false });
    expect(retractionsOf(fake)[0]).toMatchObject({ readBeforeRetraction: false });
  });

  it('🔴 Α-2γ ΣΦΡΑΓΙΣΜΕΝΟ μέλος που το είχε διαβάσει ΜΕΤΡΑΕΙ — η έξοδος δεν ξεγράφει το παρελθόν', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);
    expect(await markNetworkThreadRead(db, THREAD_ID, OWNER, LATER)).toBe('updated');

    // Ο Κώστας σφραγίζεται ΑΦΟΥ διάβασε.
    const seat = audienceOf(fake).find((s) => s.uid === OWNER) as NetworkAudienceEntry;
    fake.seed(audiencePath(), OWNER, { ...seat, until: LATER });

    await expect(
      retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid: MARIA, nowISO: NOW }),
    ).resolves.toEqual({ kind: 'retracted', readBeforeRetraction: true });
  });

  it('🔴 Α-4β ΧΑΛΑΣΜΕΝΗ ημερομηνία ⇒ ΕΚΤΟΣ παραθύρου, ποτέ «επιτρέπεται επειδή δεν κατάλαβα»', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);
    const stored = fake.all<NetworkMessage>(messagesPath())[0];
    fake.seed(messagesPath(), messageId, { ...stored, createdAt: 'ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ' });

    await expect(
      retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid: MARIA, nowISO: NOW }),
    ).resolves.toEqual({ kind: 'refused', reason: 'window-expired' });
    expect(retractionsOf(fake)).toHaveLength(0);
  });

  it('Α-3 ΜΟΝΟ ο αποστολέας ανακαλεί — ούτε ο παραλήπτης, ούτε τρίτος', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);

    for (const actorUid of [OWNER, ADMIN, 'user_stranger']) {
      await expect(
        retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid, nowISO: NOW }),
      ).resolves.toEqual({ kind: 'refused', reason: 'not-sender' });
    }

    expect(fake.all<NetworkMessage>(messagesPath())[0].text).toBe('η τιμή πέφτει στις 180.000');
    expect(retractionsOf(fake)).toHaveLength(0);
  });

  it('Α-4 το ΠΑΡΑΘΥΡΟ κλείνει — και το κείμενο μένει ανέγγιχτο', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);

    await expect(
      retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid: MARIA, nowISO: LATER }),
    ).resolves.toEqual({ kind: 'refused', reason: 'window-expired' });

    expect(fake.all<NetworkMessage>(messagesPath())[0].retractedAt).toBeNull();
    expect(retractionsOf(fake)).toHaveLength(0);
  });

  it('Α-5 δεύτερη ανάκληση ⇒ `already-retracted`: το βιβλίο δεν ξαναγράφεται', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);
    await retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid: MARIA, nowISO: NOW });

    await expect(
      retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid: MARIA, nowISO: NOW }),
    ).resolves.toEqual({ kind: 'refused', reason: 'already-retracted' });

    expect(retractionsOf(fake)).toHaveLength(1);
    expect(retractionsOf(fake)[0]).toMatchObject({ originalText: 'η τιμή πέφτει στις 180.000' });
  });

  it('🔴 Α-6 ΚΑΜΙΑ ΣΚΛΗΡΗ ΔΙΑΓΡΑΦΗ: το μήνυμα ΥΠΑΡΧΕΙ, στη θέση του, με το `createdAt` του', async () => {
    const { db, fake } = freshDb();
    const messageId = await bornWithMessage(db);
    await retractNetworkMessage(db, { threadId: THREAD_ID, messageId, actorUid: MARIA, nowISO: NOW });

    const messages = fake.all<NetworkMessage>(messagesPath());
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(messageId);
    expect(messages[0].createdAt).toBe(NOW);
  });
});
