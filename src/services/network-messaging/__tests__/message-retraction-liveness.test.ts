/**
 * @jest-environment node
 *
 * ADR-867 Β9(β) Ε10 — ΑΓΚΥΡΕΣ: η ανάκληση αδιάβαστου **αποσύρει** ό,τι έλεγε «έχεις κάτι να διαβάσεις».
 *
 *   Ζ-1  Αποστολή ⇒ `lastLiveMessageAt` = τώρα, στην ίδια συναλλαγή
 *   Ζ-2  🔴 Ανάκληση του ΜΟΝΟΥ μηνύματος ⇒ κανένα ζωντανό · `lastMessageAt` ΜΕΝΕΙ (η ταφόπλακα είναι κίνηση)
 *   Ζ-3  Ανάκληση του τελευταίου, με παλαιότερο ζωντανό ⇒ το παλαιότερο
 *   Ζ-4  Ανάκληση ΠΑΛΑΙΟΤΕΡΟΥ ⇒ τίποτα δεν αλλάζει
 *   Ζ-5  🔴 Όριο σελίδας: 25 ανακλημένα πριν από το ζωντανό ⇒ βρίσκεται (μετάλλαξη: μόνο η πρώτη σελίδα)
 *   Ζ-6  🔴 Ίδιο χιλιοστό στο όριο σελίδας ⇒ δεν χάνεται (μετάλλαξη: σελιδοποίηση με τιμή αντί δρομέα)
 *   Ζ-7  🔴 Ζωντανό στο ΙΔΙΟ χιλιοστό με το ανακλημένο ⇒ μετράει (μετάλλαξη: `<` αντί `<=`)
 *   Κ-1  Κατάλογος: ανακλημένο πριν διαβαστεί ⇒ ΟΧΙ αδιάβαστο
 *   Α-1  🔑 Η ειδοποίηση του επεισοδίου ΑΠΟΣΥΡΕΤΑΙ — όχι σβήνεται
 *   Α-2  Υπάρχει κι άλλο ζωντανό αδιάβαστο ⇒ η ειδοποίηση ΜΕΝΕΙ (είναι ακόμη αλήθεια)
 *   Α-3  Ιδεμποτησία: ήδη κρυμμένη από τον άνθρωπο ⇒ δεν ξαναγράφεται · ανύπαρκτη ⇒ τίποτα
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { NOTIFICATION_EVENT_TYPES } from '@/config/notification-events';
import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { generateNotificationDedupeId } from '@/services/enterprise-id.service';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { withdrawNotifications } from '@/server/notifications/notification-withdraw';
import { messageEventId, retractionWithdrawals } from '@/services/network-messaging/network-notifier';
import { directoryItem } from '@/services/network-messaging/thread-directory';
import { retractNetworkMessage, sendNetworkMessage } from '@/services/network-messaging/thread-messages';
import { ensureActThread } from '@/services/network-messaging/thread-writer';
import type { NetworkAudienceSeat, NetworkThread } from '@/types/network-thread';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const HOST = 'comp_alfa';
const ACT_SEED = mandateActSeed('ownp_live', HOST);
const MARIA = 'user_maria';
const OWNER = 'user_kostas';
const BORN = '2026-09-21T09:00:00.000Z';
const at = (minute: number): string => `2026-09-21T10:${String(minute).padStart(2, '0')}:00.000Z`;
const quiet = async (): Promise<void> => undefined;

async function world(): Promise<{ db: AdminFirestore; fake: FakeFirestore; threadId: string }> {
  const fake = new FakeFirestore();
  const db = fake as unknown as AdminFirestore;
  const outcome = await ensureActThread(db, {
    actSeed: ACT_SEED,
    birth: { kind: 'act', actKind: 'mandate', actSeed: ACT_SEED, hostCompanyId: HOST, counterpartUid: OWNER },
    team: { responsibleUid: MARIA, memberUids: [MARIA] },
    newcomerReason: 'creator',
    addedBy: MARIA,
    nowISO: BORN,
  });
  return { db, fake, threadId: outcome.threadId as string };
}

async function send(db: AdminFirestore, threadId: string, nowISO: string, key: string): Promise<string> {
  const sent = await sendNetworkMessage(db, { threadId, senderUid: OWNER, text: 'Μήνυμα', nowISO, clientKey: key }, quiet);
  if (sent.kind !== 'sent') throw new Error(sent.reason);
  return sent.messageId;
}

const retract = (db: AdminFirestore, threadId: string, messageId: string, nowISO: string) =>
  retractNetworkMessage(db, { threadId, messageId, actorUid: OWNER, nowISO }, quiet);

const threadOf = (fake: FakeFirestore, threadId: string): NetworkThread =>
  JSON.parse(fake.snapshotOf(COLLECTIONS.NETWORK_THREADS, threadId)) as NetworkThread;

// ============================================================================
describe('Ζ — το τελευταίο ΖΩΝΤΑΝΟ μήνυμα', () => {
  it('Ζ-1 αποστολή ⇒ `lastLiveMessageAt` = τώρα', async () => {
    const { db, fake, threadId } = await world();
    await send(db, threadId, at(1), 'k1');
    expect(threadOf(fake, threadId)).toMatchObject({ lastMessageAt: at(1), lastLiveMessageAt: at(1) });
  });

  it('Ζ-2 🔴 ανάκληση του ΜΟΝΟΥ ⇒ κανένα ζωντανό · το `lastMessageAt` ΜΕΝΕΙ', async () => {
    const { db, fake, threadId } = await world();
    const id = await send(db, threadId, at(1), 'k1');
    expect(await retract(db, threadId, id, at(2))).toMatchObject({ kind: 'retracted' });
    expect(threadOf(fake, threadId)).toMatchObject({ lastMessageAt: at(1), lastLiveMessageAt: null });
  });

  it('Ζ-3 ανάκληση του τελευταίου, με παλαιότερο ζωντανό ⇒ το παλαιότερο', async () => {
    const { db, fake, threadId } = await world();
    await send(db, threadId, at(1), 'k1');
    const last = await send(db, threadId, at(5), 'k2');
    await retract(db, threadId, last, at(6));
    expect(threadOf(fake, threadId).lastLiveMessageAt).toBe(at(1));
  });

  it('Ζ-4 ανάκληση ΠΑΛΑΙΟΤΕΡΟΥ ⇒ τίποτα δεν αλλάζει', async () => {
    const { db, fake, threadId } = await world();
    const first = await send(db, threadId, at(1), 'k1');
    await send(db, threadId, at(5), 'k2');
    await retract(db, threadId, first, at(6));
    expect(threadOf(fake, threadId).lastLiveMessageAt).toBe(at(5));
  });

  it('Ζ-5 🔴 25 ανακλημένα πριν από το ζωντανό ⇒ βρίσκεται πέρα από την πρώτη σελίδα', async () => {
    const { db, fake, threadId } = await world();
    await send(db, threadId, at(0), 'live');
    const ids: string[] = [];
    for (let i = 1; i <= 26; i += 1) ids.push(await send(db, threadId, at(i), `k${i}`));
    for (let i = 0; i < ids.length; i += 1) await retract(db, threadId, ids[i], at(30 + i));
    expect(threadOf(fake, threadId).lastLiveMessageAt).toBe(at(0));
  });

  it('Ζ-6 🔴 ίδιο χιλιοστό στο όριο σελίδας ⇒ το ζωντανό δεν χάνεται', async () => {
    const { db, fake, threadId } = await world();
    // 21 μηνύματα στο ΙΔΙΟ χιλιοστό: τα 20 ανακλημένα γεμίζουν την πρώτη σελίδα, το ζωντανό μένει για τη δεύτερη.
    const same: string[] = [];
    for (let i = 0; i < 21; i += 1) same.push(await send(db, threadId, at(1), `s${i}`));
    const last = await send(db, threadId, at(2), 'last');
    const ordered = fake.all<{ id: string }>(`${COLLECTIONS.NETWORK_THREADS}/${threadId}/network_messages`)
      .map((m) => m.id).filter((id) => same.includes(id));
    for (const id of ordered.slice(0, 20)) await retract(db, threadId, id, at(3));
    await retract(db, threadId, last, at(4));
    expect(threadOf(fake, threadId).lastLiveMessageAt).toBe(at(1));
  });
});

// ============================================================================
describe('Ζ-7 — το ίδιο χιλιοστό', () => {
  it('Ζ-7 🔴 ζωντανό στο ΙΔΙΟ χιλιοστό με το ανακλημένο ⇒ μετράει', async () => {
    const { db, fake, threadId } = await world();
    const ids = [await send(db, threadId, at(1), 'a'), await send(db, threadId, at(1), 'b')];
    await retract(db, threadId, ids[1], at(2));
    expect(threadOf(fake, threadId).lastLiveMessageAt).toBe(at(1));
    await retract(db, threadId, ids[0], at(3));
    expect(threadOf(fake, threadId).lastLiveMessageAt).toBeNull();
  });
});

// ============================================================================
describe('Κ — ο κατάλογος ρωτά «υπάρχει ΑΚΟΜΗ;»', () => {
  it('Κ-1 ανακλημένο πριν διαβαστεί ⇒ ΟΧΙ αδιάβαστο (μετάλλαξη: ξανά `lastMessageAt`)', async () => {
    const { db, fake, threadId } = await world();
    const id = await send(db, threadId, at(1), 'k1');
    const seat = { uid: MARIA, lastReadAt: null, muted: false } as unknown as NetworkAudienceSeat;
    expect(directoryItem(threadId, seat, threadOf(fake, threadId), '/x').unread).toBe(true);
    await retract(db, threadId, id, at(2));
    expect(directoryItem(threadId, seat, threadOf(fake, threadId), '/x').unread).toBe(false);
  });
});

// ============================================================================
describe('Α — η απόσυρση της ειδοποίησης', () => {
  const notificationId = (threadId: string, episode = 'never') =>
    generateNotificationDedupeId(NOTIFICATION_EVENT_TYPES.NETWORK_THREAD_MESSAGE, MARIA, messageEventId(threadId, episode));
  const seedNotification = (fake: FakeFirestore, id: string, state = 'delivered') =>
    fake.seed(COLLECTIONS.NOTIFICATIONS, id, { userId: MARIA, title: 'Νέο μήνυμα', delivery: { state, attempts: 1 } });
  const notificationOf = (fake: FakeFirestore, id: string) =>
    JSON.parse(fake.snapshotOf(COLLECTIONS.NOTIFICATIONS, id)) as { delivery: { state: string }; withdrawnReason?: string };

  it('Α-1 🔑 ανάκληση του μόνου αδιάβαστου ⇒ η ειδοποίηση ΑΠΟΣΥΡΕΤΑΙ, δεν σβήνεται', async () => {
    const { db, fake, threadId } = await world();
    const id = await send(db, threadId, at(1), 'k1');
    seedNotification(fake, notificationId(threadId));

    await retractNetworkMessage(db, { threadId, messageId: id, actorUid: OWNER, nowISO: at(2) });

    expect(notificationOf(fake, notificationId(threadId))).toMatchObject({
      delivery: { state: 'withdrawn' },
      withdrawnReason: 'source-retracted',
    });
  });

  it('Α-2 υπάρχει κι άλλο ζωντανό αδιάβαστο ⇒ η ειδοποίηση ΜΕΝΕΙ (είναι ακόμη αλήθεια)', async () => {
    const { db, fake, threadId } = await world();
    await send(db, threadId, at(1), 'k1');
    const second = await send(db, threadId, at(2), 'k2');
    seedNotification(fake, notificationId(threadId));

    await retractNetworkMessage(db, { threadId, messageId: second, actorUid: OWNER, nowISO: at(3) });

    expect(notificationOf(fake, notificationId(threadId)).delivery.state).toBe('delivered');
  });

  it('Α-3 ιδεμποτησία: κρυμμένη από τον άνθρωπο ⇒ δεν ξαναγράφεται · ανύπαρκτη ⇒ τίποτα', async () => {
    const { db, fake, threadId } = await world();
    seedNotification(fake, notificationId(threadId), 'dismissed');
    const target = { eventType: NOTIFICATION_EVENT_TYPES.NETWORK_THREAD_MESSAGE, recipientId: MARIA, eventId: messageEventId(threadId, 'never') };
    const absent = { ...target, eventId: messageEventId(threadId, at(9)) };

    expect(await withdrawNotifications(db, [target, absent], 'source-retracted', at(5))).toStrictEqual({ withdrawn: [] });
    expect(notificationOf(fake, notificationId(threadId)).delivery.state).toBe('dismissed');
  });

  it('Α-4 ο αποστολέας δεν αποσύρεται ποτέ · όποιος έχει ακόμη ζωντανό αδιάβαστο κρατά την ειδοποίηση', () => {
    const seat = (uid: string, lastReadAt: string | null) => ({ uid, lastReadAt }) as unknown as NetworkAudienceSeat;
    const targets = retractionWithdrawals({
      threadId: 't1',
      senderUid: OWNER,
      audience: [seat(OWNER, null), seat(MARIA, null), seat('user_eleni', at(0))],
      liveAt: at(1),
      retractedAt: at(2),
    });
    // MARIA: ζωντανό στο at(1), δεν διάβασε ⇒ ΜΕΝΕΙ. ELENI: διάβασε at(0) < at(1) ⇒ ΜΕΝΕΙ. OWNER: αποστολέας.
    expect(targets).toStrictEqual([]);
    const none = retractionWithdrawals({ threadId: 't1', senderUid: OWNER, audience: [seat(MARIA, null)], liveAt: null, retractedAt: at(2) });
    expect(none.map((t) => t.recipientId)).toStrictEqual([MARIA]);
  });
});
