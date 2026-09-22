/**
 * @jest-environment node
 *
 * ADR-867 Β9(β) Ε9 — ΑΓΚΥΡΕΣ της **ιδιωτικής πλευράς της θέσης** (ώρα ανάγνωσης · σίγαση · follow).
 *
 *   Ι-1  Ανύπαρκτο ιδιωτικό έγγραφο ⇒ οι ουδέτερες τιμές, όχι σφάλμα
 *   Ι-2  🔴 Contract: ιδιωτικό όνομα στη ΔΗΜΟΣΙΑ γραμμή ΔΕΝ είναι τιμή — η θέση το αγνοεί (εφεδρεία αφαιρέθηκε)
 *   Ι-3  🔴 `lastReadAt: null` στο ιδιωτικό είναι ΤΙΜΗ — δεν αντικαθίσταται από την ουδέτερη
 *   Ι-4  Κατάλοιπο: μεταφέρει ΜΟΝΟ ό,τι λείπει από το ιδιωτικό · σβήνει ΚΑΘΕ ιδιωτικό όνομα, ακόμη και χαλασμένο
 *   Ι-5  Η ένωση: `null` όπου δεν υπάρχει θέση — και ΚΑΜΙΑ ανάγνωση για ξένο
 *   Μ-1  Μετακίνηση: το πεδίο φεύγει από τη δημόσια γραμμή και φτάνει στο ιδιωτικό, στην ίδια συναλλαγή
 *   Μ-2  🔴 Ό,τι είχε ήδη γράψει ο νέος κώδικας ΔΕΝ ξαναγράφεται από το παλιό
 *   Μ-3  Ιδεμποτησία: δεύτερη κλήση ⇒ `clean`, καμία γραφή · ανύπαρκτη θέση ⇒ `absent`
 *   Π-1  Πύλη email: η σίγαση στο ΙΔΙΩΤΙΚΟ κόβει το email · σίγαση ΜΟΝΟ στη δημόσια γραμμή δεν μετρά (contract)
 *   Κ-1  Κατάλογος: «αδιάβαστο» και «σίγαση» από το ΙΔΙΩΤΙΚΟ έγγραφο
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { networkAudiencePrivateFromDocument } from '@/lib/network-messaging/network-thread-from-document';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { joinAudienceSeats, legacyPrivateResidue } from '@/services/network-messaging/audience-seats';
import { networkUnreadStillPending } from '@/services/network-messaging/network-unread-email';
import { listNetworkThreads } from '@/services/network-messaging/thread-directory';
import { moveLegacyPrivateSeat } from '@/services/network-messaging/thread-writer';
import { NETWORK_AUDIENCE_PRIVATE_DEFAULTS } from '@/types/network-thread';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { privateFieldsOnPublicRows, privateSideOf, seedPrivateSide } from './audience-private-fixture';

const THREAD_ID = 'nthr_private_1';
const MARIA = 'user_maria';
const OWNER = 'user_kostas';
const BORN = '2026-09-17T10:00:00.000Z';
const READ = '2026-09-18T09:00:00.000Z';
const LATER = '2026-09-18T12:00:00.000Z';

const AUDIENCE = `${COLLECTIONS.NETWORK_THREADS}/${THREAD_ID}/${SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE}`;

/** Μια δημόσια γραμμή **όπως** τη γράφει ο γραφέας σήμερα — χωρίς ιδιωτικά πεδία. */
const publicRow = (uid: string, side: 'host' | 'counterpart', extra: Record<string, unknown> = {}) => ({
  uid,
  side,
  role: side === 'host' ? 'responsible' : 'counterpart',
  reason: side === 'host' ? 'creator' : 'counterpart',
  addedBy: MARIA,
  since: BORN,
  until: null,
  threadActivityAt: LATER,
  alsoHostRole: null,
  ...extra,
});

function world(): { db: AdminFirestore; fake: FakeFirestore } {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.NETWORK_THREADS, THREAD_ID, {
    id: THREAD_ID,
    topic: { kind: 'act', actKind: 'mandate', actSeed: 'seed', hostCompanyId: 'comp_alfa', counterpartUid: OWNER },
    state: 'open',
    createdAt: BORN,
    lastMessageAt: LATER,
  });
  return { db: fake as unknown as AdminFirestore, fake };
}

// ============================================================================
describe('Ι — ο αναλυτής και το κατάλοιπο (καθαρά)', () => {
  it('Ι-1 ανύπαρκτο ιδιωτικό έγγραφο ⇒ οι ουδέτερες τιμές', () => {
    expect(networkAudiencePrivateFromDocument(undefined)).toStrictEqual(NETWORK_AUDIENCE_PRIVATE_DEFAULTS);
  });

  it('Ι-2 🔴 contract: ιδιωτικό όνομα στη ΔΗΜΟΣΙΑ γραμμή δεν γίνεται τιμή της θέσης (μετάλλαξη: η εφεδρεία επιστρέφει)', async () => {
    const { db } = world();
    const noPrivateDoc = jest.fn(async (...refs: unknown[]) => refs.map(() => ({ data: () => undefined })));
    const [seat] = await joinAudienceSeats(noPrivateDoc as never, db, [
      { threadId: THREAD_ID, uid: MARIA, publicRaw: publicRow(MARIA, 'host', { lastReadAt: READ, muted: true, following: true }) },
    ]);
    expect(seat).toMatchObject({ uid: MARIA, ...NETWORK_AUDIENCE_PRIVATE_DEFAULTS });
  });

  it('Ι-3 🔴 `lastReadAt: null` στο ιδιωτικό είναι ΤΙΜΗ — δεν αντικαθίσταται από την ουδέτερη', () => {
    expect(networkAudiencePrivateFromDocument({ lastReadAt: null, muted: true }).lastReadAt).toBeNull();
    expect(networkAudiencePrivateFromDocument({ muted: true })).toStrictEqual({ ...NETWORK_AUDIENCE_PRIVATE_DEFAULTS, muted: true });
  });

  it('Ι-4 κατάλοιπο: μεταφέρει ΜΟΝΟ ό,τι λείπει · σβήνει ΚΑΘΕ ιδιωτικό όνομα, ακόμη και χαλασμένο', () => {
    const legacy = publicRow(MARIA, 'host', { lastReadAt: READ, muted: 'ναι', following: true });
    expect(legacyPrivateResidue(legacy, { following: false })).toStrictEqual({
      carry: { lastReadAt: READ },
      strip: ['lastReadAt', 'muted', 'following'],
    });
    expect(legacyPrivateResidue(publicRow(MARIA, 'host'), undefined)).toBeNull();
  });

  it('Ι-5 η ένωση: `null` όπου δεν υπάρχει θέση — και ΚΑΜΙΑ ανάγνωση για ξένο', async () => {
    const { db } = world();
    const read = jest.fn(async (...refs: unknown[]) => refs.map(() => ({ data: () => ({ muted: true }) })));
    const seats = await joinAudienceSeats(read as never, db, [
      { threadId: THREAD_ID, uid: MARIA, publicRaw: publicRow(MARIA, 'host') },
      { threadId: THREAD_ID, uid: 'user_stranger', publicRaw: undefined },
    ]);
    expect(seats[0]).toMatchObject({ uid: MARIA, muted: true, lastReadAt: null, following: false });
    expect(seats[1]).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]).toHaveLength(1);
  });
});

// ============================================================================
describe('Μ — η μετακίνηση του παλιού σχήματος (contract)', () => {
  it('Μ-1 το πεδίο φεύγει από τη δημόσια γραμμή και φτάνει στο ιδιωτικό', async () => {
    const { db, fake } = world();
    fake.seed(AUDIENCE, MARIA, publicRow(MARIA, 'host', { lastReadAt: READ, muted: true, following: false }));

    expect(await moveLegacyPrivateSeat(db, THREAD_ID, MARIA)).toBe('moved');

    expect(privateSideOf(fake, THREAD_ID, MARIA)).toStrictEqual({ lastReadAt: READ, muted: true, following: false });
    expect(privateFieldsOnPublicRows(fake, THREAD_ID)).toStrictEqual([]);
    // 🔑 Τα δημόσια πεδία μένουν ανέγγιχτα — η μετακίνηση δεν ξαναγράφει τη θέση.
    expect(fake.all(AUDIENCE)).toEqual([publicRow(MARIA, 'host')]);
  });

  it('Μ-2 🔴 ό,τι είχε ήδη γράψει ο νέος κώδικας ΔΕΝ ξαναγράφεται από το παλιό (μετάλλαξη: carry όλα)', async () => {
    const { db, fake } = world();
    fake.seed(AUDIENCE, MARIA, publicRow(MARIA, 'host', { lastReadAt: READ, muted: true }));
    seedPrivateSide(fake, THREAD_ID, MARIA, { muted: false, lastReadAt: LATER });

    await moveLegacyPrivateSeat(db, THREAD_ID, MARIA);

    expect(privateSideOf(fake, THREAD_ID, MARIA)).toStrictEqual({ muted: false, lastReadAt: LATER });
    expect(privateFieldsOnPublicRows(fake, THREAD_ID)).toStrictEqual([]);
  });

  it('Μ-3 ιδεμποτησία: δεύτερη κλήση ⇒ `clean` χωρίς γραφή · ανύπαρκτη θέση ⇒ `absent`', async () => {
    const { db, fake } = world();
    fake.seed(AUDIENCE, MARIA, publicRow(MARIA, 'host', { muted: true }));
    await moveLegacyPrivateSeat(db, THREAD_ID, MARIA);
    const after = JSON.stringify([fake.all(AUDIENCE), privateSideOf(fake, THREAD_ID, MARIA)]);

    expect(await moveLegacyPrivateSeat(db, THREAD_ID, MARIA)).toBe('clean');
    expect(JSON.stringify([fake.all(AUDIENCE), privateSideOf(fake, THREAD_ID, MARIA)])).toBe(after);
    expect(await moveLegacyPrivateSeat(db, THREAD_ID, 'user_stranger')).toBe('absent');
    expect(privateSideOf(fake, THREAD_ID, 'user_stranger')).toBeNull();
  });
});

// ============================================================================
describe('Π — η πύλη του email «αδιάβαστο» διαβάζει την ιδιωτική πλευρά', () => {
  const REF = { threadId: THREAD_ID, recipientUid: MARIA, since: READ };

  it('Π-1 σίγαση στο ΙΔΙΩΤΙΚΟ ⇒ το email δεν φεύγει (μετάλλαξη: η πύλη κοιτά τη δημόσια γραμμή)', async () => {
    const { db, fake } = world();
    fake.seed(AUDIENCE, MARIA, publicRow(MARIA, 'host'));
    expect((await networkUnreadStillPending(db, [REF], LATER)).size).toBe(1);

    seedPrivateSide(fake, THREAD_ID, MARIA, { muted: true });
    expect((await networkUnreadStillPending(db, [REF], LATER)).size).toBe(0);
  });

  it('Π-2 🔴 contract: σίγαση ΜΟΝΟ στη δημόσια γραμμή ΔΕΝ μετρά — η μόνη πηγή είναι το ιδιωτικό', async () => {
    const { db, fake } = world();
    fake.seed(AUDIENCE, MARIA, publicRow(MARIA, 'host', { muted: true }));
    expect((await networkUnreadStillPending(db, [REF], LATER)).size).toBe(1);
  });
});

// ============================================================================
/**
 * ⚠️ Ο πλαστός δεν έχει `collectionGroup` (το ερώτημα και ο δείκτης του έχουν δική τους άγκυρα:
 * `thread-directory-index.test.ts`). Εδώ το ερώτημα επιστρέφει τις δημόσιες γραμμές του νήματος **όπως
 * είναι τώρα** — ώστε να εκτελείται η πραγματική `hydrate`, δηλαδή η ένωση που κρίνεται.
 */
function withAudienceGroup(fake: FakeFirestore): void {
  const docs = () => fake.all<Record<string, unknown>>(AUDIENCE).map((row) => ({
    id: String(row.uid),
    data: () => row,
    ref: { parent: { parent: { id: THREAD_ID } } },
  }));
  const query = {
    where: () => query,
    orderBy: () => query,
    startAfter: () => query,
    limit: () => query,
    get: async () => ({ docs: docs() }),
  };
  Object.assign(fake, { collectionGroup: () => query });
}

describe('Κ — ο κατάλογος διαβάζει την ιδιωτική πλευρά', () => {
  it('Κ-1 «αδιάβαστο» και «σίγαση» από το ΙΔΙΩΤΙΚΟ έγγραφο (μετάλλαξη: από τη δημόσια γραμμή)', async () => {
    const { db, fake } = world();
    fake.seed(AUDIENCE, MARIA, publicRow(MARIA, 'host'));
    withAudienceGroup(fake);

    const before = await listNetworkThreads(db, { uid: MARIA, limit: 10, after: null });
    expect(before.items[0]).toMatchObject({ unread: true, muted: false });

    seedPrivateSide(fake, THREAD_ID, MARIA, { lastReadAt: LATER, muted: true });
    const after = await listNetworkThreads(db, { uid: MARIA, limit: 10, after: null });
    expect(after.items[0]).toMatchObject({ unread: false, muted: true });
  });
});
