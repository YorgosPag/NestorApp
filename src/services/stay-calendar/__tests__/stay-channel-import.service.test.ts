/**
 * @jest-environment node
 *
 * ADR-835 §22 (Στάδιο Γ) — **οι άγκυρες της εισαγωγής καναλιού.**
 *
 * Εκτελούν την **πραγματική** υπηρεσία πάνω στην πλαστή Firestore: η διαφορά γράφεται
 * μέσα στη συναλλαγή της κεφαλής, το `version` αυξάνεται **μόνο** όταν άλλαξαν νύχτες,
 * η αποτυχία **δεν σβήνει** τίποτα, και η σύγκρουση με κράτηση **δεν μπλοκάρει**.
 *
 * ⚠️ Δηλωμένο όριο: το πλαστό Firestore **δεν** αποδεικνύει ατομικότητα (ADR-835 §20.8) —
 * αποδεικνύει **ποιος γράφει τι**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  applyStayChannelRead,
  removeStayChannelFeed,
} from '@/services/stay-calendar/stay-channel-import.service';
import { STAY_CHANNEL_STATUS_NEW } from '@/types/stay-channels';

jest.mock('@/services/enterprise-id.service', () => ({
  enterpriseIdService: {
    generateDeterministicStayExternalBlockId: (feedId: string, uid: string) => `sblk_${feedId}_${uid}`,
  },
}));

const PROPERTY = 'ownp_a';
const FEED = 'schf_airbnb';
const OWNER_UID = 'user-1';

const db = new FakeFirestore();
const adminDb = db as unknown as AdminFirestore;

function givenChannels(overrides: Record<string, unknown> = {}): void {
  db.seed(COLLECTIONS.OWNER_PROPERTIES, PROPERTY, { ...validOwnerProperty({ offers: [offerOf('leaseShort', 65)] }) });
  db.seed(COLLECTIONS.STAY_CHANNELS, PROPERTY, {
    propertyId: PROPERTY,
    authorUserId: OWNER_UID,
    exportGeneration: 1,
    feeds: [{
      id: FEED,
      label: 'Airbnb',
      url: 'https://www.airbnb.com/calendar/ical/1.ics?s=x',
      channel: 'airbnb',
      status: { ...STAY_CHANNEL_STATUS_NEW, nextPollAt: '2027-01-01T00:00:00.000Z' },
      pendingRemovals: {},
      createdAt: '2027-01-01T00:00:00.000Z',
      createdBy: OWNER_UID,
    }],
    nextPollAt: '2027-01-01T00:00:00.000Z',
    createdAt: '2027-01-01T00:00:00.000Z',
    updatedAt: '2027-01-01T00:00:00.000Z',
    ...overrides,
  });
}

const events = (...ranges: ReadonlyArray<readonly [string, string, string]>) => ({
  kind: 'events' as const,
  events: ranges.map(([uid, from, to]) => ({ uid, from, to, summary: 'Reserved' })),
  etag: 'W/"abc"',
  lastModified: null,
});

const apply = (read: Parameters<typeof applyStayChannelRead>[3]) =>
  applyStayChannelRead(adminDb, PROPERTY, FEED, read);

const blocks = () => db.all(COLLECTIONS.STAY_BLOCKS) as ReadonlyArray<Record<string, unknown>>;
const head = () => db.all(COLLECTIONS.STAY_CALENDARS)[0] as Record<string, unknown> | undefined;
const feedStatus = () => {
  const doc = db.all(COLLECTIONS.STAY_CHANNELS)[0] as { feeds: ReadonlyArray<Record<string, unknown>> };
  return doc.feeds[0] as { status: Record<string, unknown>; pendingRemovals: Record<string, string> };
};

beforeEach(() => {
  db.reset();
});

describe('Ε — η εισαγωγή γράφει νύχτες μέσα στη συναλλαγή της κεφαλής', () => {
  it('Ε1. νέο γεγονός ⇒ εξωτερικό block με πηγή, ΧΩΡΙΣ σημείωση, + version 1', async () => {
    givenChannels();
    const outcome = await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));

    expect(outcome).toMatchObject({ created: 1, updated: 0, deleted: 0, applied: true, failure: null });
    expect(blocks()).toHaveLength(1);
    expect(blocks()[0]).toMatchObject({
      propertyId: PROPERTY,
      authorUserId: OWNER_UID,
      from: '2027-10-10',
      to: '2027-10-14',
      source: 'external',
      channel: { feedId: FEED, externalUid: 'abc@airbnb.com' },
      // 🔴 Το `SUMMARY` του καναλιού μπορεί να κουβαλά στοιχεία επισκέπτη — δεν αποθηκεύεται.
      note: null,
    });
    expect(head()).toMatchObject({ version: 1 });
  });

  it('🔑 Ε2. ΙΔΙΑ ανάγνωση δεύτερη φορά ⇒ καμία νέα εγγραφή, version ΑΜΕΤΑΒΛΗΤΟ', async () => {
    givenChannels();
    await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));
    const outcome = await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));

    expect(outcome).toMatchObject({ created: 0, updated: 0, deleted: 0 });
    expect(blocks()).toHaveLength(1);
    expect(head()).toMatchObject({ version: 1 });
  });

  it('Ε3. `304 not-modified` ⇒ επιτυχία χωρίς καμία συμφιλίωση', async () => {
    givenChannels();
    await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));
    const outcome = await apply({ kind: 'not-modified' });

    expect(outcome).toMatchObject({ created: 0, deleted: 0, applied: true });
    expect(blocks()).toHaveLength(1);
    expect(feedStatus().status.lastSuccessAt).not.toBeNull();
  });

  it('🏆 Ε4. γεγονός που ΛΕΙΠΕΙ σβήνεται στη ΔΕΥΤΕΡΗ ανάγνωση, ποτέ στην πρώτη', async () => {
    givenChannels();
    await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));

    const first = await apply(events());
    expect(first).toMatchObject({ deleted: 0, pending: 1 });
    expect(blocks()).toHaveLength(1);

    const second = await apply(events());
    expect(second).toMatchObject({ deleted: 1, pending: 0 });
    expect(blocks()).toHaveLength(0);
    expect(head()).toMatchObject({ version: 2 });
  });

  it('🔴 Ε5. ΑΠΟΤΥΧΙΑ ανάγνωσης ⇒ καμία νύχτα δεν αγγίζεται, μόνο η κατάσταση', async () => {
    givenChannels();
    await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));

    const outcome = await apply({ kind: 'failed', failure: 'timeout', httpStatus: null });

    expect(outcome).toMatchObject({ created: 0, deleted: 0, applied: true });
    expect(outcome.failure).toMatchObject({ failure: 'timeout' });
    expect(blocks()).toHaveLength(1);
    expect(head()).toMatchObject({ version: 1 });
    expect(feedStatus().status).toMatchObject({ consecutiveFailures: 1 });
  });

  it('🔴 Ε6. εισαγόμενη νύχτα πάνω σε ΚΡΑΤΗΣΗ γράφεται — το overbooking ΗΔΗ συνέβη', async () => {
    givenChannels();
    db.seed(COLLECTIONS.STAY_BOOKINGS, 'stay_1', {
      propertyId: PROPERTY, offerKind: 'leaseShort', covers: [{ propertyId: PROPERTY, spaceId: null }],
      checkIn: '2027-10-12', checkOut: '2027-10-16', holder: { kind: 'offline', label: 'κ. Π.' },
      channel: 'direct', authorUserId: OWNER_UID, guests: 2, lifecycle: 'confirmed', riskDisclosedAt: null,
      createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z',
    });

    const outcome = await apply(events(['abc@airbnb.com', '2027-10-14', '2027-10-18']));

    expect(outcome).toMatchObject({ created: 1, applied: true });
    expect(blocks()).toHaveLength(1);
  });

  it('🔴 Ε7. αδιάβαστη εγγραφή ημερολογίου ⇒ ΤΙΠΟΤΑ δεν γράφεται (ούτε κατάσταση)', async () => {
    givenChannels();
    db.seed(COLLECTIONS.STAY_BLOCKS, 'sblk_broken', { propertyId: PROPERTY, from: 'κάποτε' });

    const outcome = await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));

    expect(outcome).toMatchObject({ applied: false, created: 0 });
    expect(blocks()).toHaveLength(1);
    expect(feedStatus().status.lastSuccessAt).toBeNull();
  });

  it('Ε8. πηγή που δεν υπάρχει στο έγγραφο ⇒ καμία γραφή', async () => {
    givenChannels();
    const outcome = await applyStayChannelRead(adminDb, PROPERTY, 'schf_unknown', events());
    expect(outcome).toMatchObject({ applied: false });
  });
});

describe('Α — η αφαίρεση πηγής', () => {
  it('Α1. φεύγει η πηγή ΚΑΙ οι νύχτες της, με version + 1', async () => {
    givenChannels();
    await apply(events(['abc@airbnb.com', '2027-10-10', '2027-10-14']));

    expect(await removeStayChannelFeed(adminDb, PROPERTY, FEED)).toBe('ok');

    expect(blocks()).toHaveLength(0);
    const doc = db.all(COLLECTIONS.STAY_CHANNELS)[0] as { feeds: readonly unknown[] };
    expect(doc.feeds).toHaveLength(0);
    expect(head()).toMatchObject({ version: 2 });
  });

  it('Α2. πηγή που δεν υπάρχει ⇒ feed-absent, καμία γραφή', async () => {
    givenChannels();
    expect(await removeStayChannelFeed(adminDb, PROPERTY, 'schf_unknown')).toBe('feed-absent');
  });
});
