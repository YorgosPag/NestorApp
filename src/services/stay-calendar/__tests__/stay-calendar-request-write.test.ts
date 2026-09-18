/**
 * @jest-environment node
 *
 * ADR-835 §23 (Στάδιο Δ) — **οι άγκυρες του αιτήματος κράτησης** πάνω στον ΕΝΑ γραφέα.
 *
 * Εκτελούν την **πραγματική** υπηρεσία πάνω στην πλαστή Firestore με σημασιολογία συναλλαγής.
 * ⚠️ Ο ανταγωνισμός δοκιμάζεται με `interfere` (ανταγωνιστής ανάμεσα σε ανάγνωση και commit), **ποτέ**
 * με `Promise.all`: το πλαστό κάνει έλεγχο-και-commit μη ατομικά (μετρημένο §20.8) — δύο παράλληλες
 * πράξεις θα περνούσαν ΑΚΟΜΗ ΚΑΙ με κεφαλή, και η άγκυρα δεν θα απεδείκνυε τίποτα.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { StayActor } from '@/lib/stay/stay-command-authority';
import { STAY_GUEST_MAX_ACTIVE_HOLDS } from '@/lib/stay/stay-guest-head';
import { listingOf } from '@/lib/stay/__tests__/stay-rules-fixtures';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { executeStayCalendarCommand } from '@/services/stay-calendar/stay-calendar-write.service';
import type { OfferKind } from '@/types/property-offers';
import { STAY_RULES_NONE } from '@/types/stay-rules';

const mockRecordChange = jest.fn();
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (...args: unknown[]) => mockRecordChange(...args) },
}));
const mockAnnounce = jest.fn();
jest.mock('@/services/stay-calendar/stay-booking-notifier.service', () => ({
  announceStayBookingNotice: (...args: unknown[]) => mockAnnounce(...args),
}));
let sequence = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  enterpriseIdService: {
    generateStayBlockId: () => `sblk_${++sequence}`,
    generateStayBookingId: () => `stay_${++sequence}`,
    generateDeterministicStayCalendarMonthId: (propertyId: string, month: string) => `scmo_${propertyId}_${month}`,
  },
}));

const PROPERTY = 'ownp_a';
const STAMP = '2026-01-01T00:00:00.000Z';
/** Ζωντανή για πάντα στο πλαίσιο της σουίτας · νεκρή εδώ και χρόνια. */
const FAR_FUTURE = '2099-01-01T00:00:00.000Z';
const LONG_AGO = '2020-01-01T00:00:00.000Z';

const HOST: StayActor = { kind: 'host', actor: { uid: 'user-1', companyId: null } };
const GUEST: StayActor = { kind: 'guest', uid: 'guest-1', displayName: 'Μαρία' };
const OTHER_GUEST: StayActor = { kind: 'guest', uid: 'guest-2', displayName: null };
const SYSTEM: StayActor = { kind: 'system' };

const db = new FakeFirestore();
const adminDb = db as unknown as AdminFirestore;

function givenStay(offerKinds: readonly OfferKind[] = ['leaseShort']): void {
  const offers = offerKinds.map((kind) => (kind === 'leaseShort' ? offerOf('leaseShort', 65) : offerOf(kind, 210_000)));
  db.seed(COLLECTIONS.OWNER_PROPERTIES, PROPERTY, { ...validOwnerProperty({ offers }) });
  db.seed(COLLECTIONS.PUBLIC_LISTINGS, PROPERTY, {
    ...listingOf({ minNights: null, maxGuests: 4, nextAvailableFrom: null }, offerKinds), id: PROPERTY,
  });
  db.seed(COLLECTIONS.STAY_CALENDARS, PROPERTY, {
    propertyId: PROPERTY, authorUserId: 'user-1', declaredAt: STAMP, version: 1, rules: STAY_RULES_NONE,
    timezone: 'Europe/Athens', createdAt: STAMP, updatedAt: STAMP,
  });
}

/** Αίτημα σπαρμένο κατευθείαν — για καταστάσεις που το ρολόι δεν θα παρήγαγε μέσα σε test (λήξη). */
function givenRequest(id: string, guest: string, expiresAt: string, checkIn = '2027-10-10', checkOut = '2027-10-14'): void {
  db.seed(COLLECTIONS.STAY_BOOKINGS, id, {
    propertyId: PROPERTY, offerKind: 'leaseShort', covers: [{ propertyId: PROPERTY, spaceId: null }],
    checkIn, checkOut, holder: { kind: 'user', userId: guest, displayName: null }, channel: 'platform',
    authorUserId: 'user-1', guests: 2, lifecycle: 'requested', riskDisclosedAt: null,
    hold: { expiresAt, tier: 'distant', bound: 'response-hours', respondentUserId: 'user-1' },
    resolution: null, guestUserId: guest, createdAt: STAMP, updatedAt: STAMP,
  });
}

const run = (command: StayCalendarCommand, actor: StayActor) => executeStayCalendarCommand(adminDb, PROPERTY, command, actor);
const request = (checkIn = '2027-10-10', checkOut = '2027-10-14', riskAcknowledged = false): StayCalendarCommand => ({
  action: 'request', checkIn, checkOut, guests: 2, riskAcknowledged,
});
const guestHolds = (uid: string): number => {
  const head = db.pathBucket(COLLECTIONS.STAY_GUESTS).get(uid) as { holds?: readonly unknown[] } | undefined;
  return head?.holds?.length ?? 0;
};

beforeEach(() => {
  db.reset();
  sequence = 0;
  mockRecordChange.mockReset();
  mockAnnounce.mockReset();
});

describe('Α — ο πίνακας εξουσίας: ποιος εκδίδει τι', () => {
  it('Α1. ο επισκέπτης ζητά ⇒ `requested` με hold, κεφαλή επισκέπτη, version+1, ειδοποίηση', async () => {
    givenStay();
    const result = await run(request(), GUEST);
    expect(result).toMatchObject({ kind: 'ok', entryId: 'stay_1', version: 2 });
    if (result.kind !== 'ok') throw new Error(result.kind);
    expect(result.holdExpiresAt).not.toBeNull();
    const stored = db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_1') as Record<string, unknown>;
    expect(stored).toMatchObject({
      lifecycle: 'requested', channel: 'platform', guestUserId: 'guest-1',
      holder: { kind: 'user', userId: 'guest-1', displayName: 'Μαρία' },
      hold: { tier: 'distant', bound: 'response-hours', respondentUserId: 'user-1', expiresAt: result.holdExpiresAt },
    });
    expect(guestHolds('guest-1')).toBe(1);
    expect(mockAnnounce).toHaveBeenCalledTimes(1);
    expect(mockAnnounce.mock.calls[0][2]).toMatchObject({ event: 'request' });
  });

  it.each([
    { label: 'οικοδεσπότης ζητά', command: request(), actor: HOST },
    { label: 'επισκέπτης δέχεται', command: { action: 'accept', bookingId: 'stay_x' } as StayCalendarCommand, actor: GUEST },
    { label: 'σύστημα κλείνει μέρες', command: { action: 'block', from: '2027-10-10', to: '2027-10-12', note: null } as StayCalendarCommand, actor: SYSTEM },
    { label: 'επισκέπτης λήγει', command: { action: 'expire', bookingId: 'stay_x' } as StayCalendarCommand, actor: GUEST },
  ])('🔴 Α2. $label ⇒ absent, και ΤΙΠΟΤΑ δεν γράφεται', async ({ command, actor }) => {
    givenStay();
    expect(await run(command, actor)).toEqual({ kind: 'absent' });
    expect(db.all(COLLECTIONS.STAY_BOOKINGS)).toHaveLength(0);
    expect(db.all(COLLECTIONS.STAY_BLOCKS)).toHaveLength(0);
  });

  it('Α3. ο οικοδεσπότης δεν ζητά στη δική του αγγελία ⇒ own-listing', async () => {
    givenStay();
    expect(await run(request(), { kind: 'guest', uid: 'user-1', displayName: null })).toEqual({ kind: 'own-listing' });
  });

  it('Α4. αγγελία που ΔΕΝ είναι δημόσια ⇒ absent για τον επισκέπτη', async () => {
    givenStay();
    db.pathBucket(COLLECTIONS.PUBLIC_LISTINGS).delete(PROPERTY);
    expect(await run(request(), GUEST)).toEqual({ kind: 'absent' });
  });
});

describe('🏆 Κ — ο κριτής και η λήξη στην ανάγνωση', () => {
  it('Κ1. δεύτερος επισκέπτης στις ίδιες μέρες ⇒ unavailable(held) — «σε αναμονή», όχι «κλειστό»', async () => {
    givenStay();
    givenRequest('stay_a', 'guest-1', FAR_FUTURE);
    expect(await run(request(), OTHER_GUEST)).toEqual({ kind: 'unavailable', answer: 'held' });
  });

  it('🔴 Κ2. ληγμένο αίτημα ΔΕΝ μπλοκάρει — χωρίς να έχει τρέξει cron (η λήξη ισχύει στην ανάγνωση)', async () => {
    givenStay();
    givenRequest('stay_a', 'guest-1', LONG_AGO);
    expect((await run(request(), OTHER_GUEST)).kind).toBe('ok');
  });

  it('Κ3. ο οικοδεσπότης κλείνει μέρες πάνω σε ζωντανό αίτημα ⇒ conflict ΜΕ την προθεσμία του', async () => {
    givenStay();
    givenRequest('stay_a', 'guest-1', FAR_FUTURE);
    const result = await run({ action: 'block', from: '2027-10-11', to: '2027-10-12', note: null }, HOST);
    expect(result).toEqual({
      kind: 'conflict',
      conflicts: [{ entryKind: 'booking', entryId: 'stay_a', from: '2027-10-10', to: '2027-10-14', heldUntil: FAR_FUTURE }],
    });
  });
});

describe('🏆 Ο — το όριο ενεργών αιτημάτων (κεφαλή επισκέπτη)', () => {
  const seedHead = (expiresAt: string) => db.seed(COLLECTIONS.STAY_GUESTS, 'guest-1', {
    userId: 'guest-1', version: 3, updatedAt: STAMP,
    holds: Array.from({ length: STAY_GUEST_MAX_ACTIVE_HOLDS }, (_, i) => ({ bookingId: `stay_o${i}`, propertyId: 'ownp_other', expiresAt })),
  });

  it(`Ο1. ${STAY_GUEST_MAX_ACTIVE_HOLDS} ζωντανά ⇒ guest-hold-limit`, async () => {
    givenStay();
    seedHead(FAR_FUTURE);
    expect(await run(request(), GUEST)).toEqual({ kind: 'guest-hold-limit', limit: STAY_GUEST_MAX_ACTIVE_HOLDS });
  });

  it('🔴 Ο2. ο παρονομαστής: τα ίδια, ΛΗΓΜΕΝΑ ⇒ περνά — μετρά μόνο ό,τι ζει', async () => {
    givenStay();
    seedHead(LONG_AGO);
    expect((await run(request(), GUEST)).kind).toBe('ok');
    expect(guestHolds('guest-1')).toBe(1);
  });

  it('🏆 Ο3. ανταγωνιστικό αίτημα ΑΛΛΟΥ ακινήτου γεμίζει την κεφαλή ανάμεσα σε ανάγνωση και commit ⇒ η συναλλαγή ξαναπαίζεται και αρνείται', async () => {
    givenStay();
    db.interfere = () => {
      db.write(COLLECTIONS.STAY_GUESTS, 'guest-1', {
        userId: 'guest-1', version: 9, updatedAt: STAMP,
        holds: Array.from({ length: STAY_GUEST_MAX_ACTIVE_HOLDS }, (_, i) => ({ bookingId: `stay_r${i}`, propertyId: 'ownp_other', expiresAt: FAR_FUTURE })),
      });
    };
    expect(await run(request(), GUEST)).toEqual({ kind: 'guest-hold-limit', limit: STAY_GUEST_MAX_ACTIVE_HOLDS });
    expect(db.all(COLLECTIONS.STAY_BOOKINGS)).toHaveLength(0);
  });
});

describe('Μ — οι μεταβάσεις: μία φορά η καθεμία, με το σωστό όνομα', () => {
  it('Μ1. αποδοχή ζωντανού ⇒ confirmed, η κεφαλή του επισκέπτη αδειάζει, ειδοποίηση· δεύτερη αποδοχή ιδιοδύναμη', async () => {
    givenStay();
    expect((await run(request(), GUEST)).kind).toBe('ok');
    mockAnnounce.mockReset();
    expect((await run({ action: 'accept', bookingId: 'stay_1' }, HOST)).kind).toBe('ok');
    expect(db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_1')).toMatchObject({ lifecycle: 'confirmed', resolution: null });
    expect(guestHolds('guest-1')).toBe(0);
    expect(mockAnnounce).toHaveBeenCalledTimes(1);
    expect((await run({ action: 'accept', bookingId: 'stay_1' }, HOST)).kind).toBe('ok');
    expect(mockAnnounce).toHaveBeenCalledTimes(1);
  });

  it.each(['accept', 'decline'] as const)('🔴 Μ2. %s ΜΕΤΑ τη λήξη ⇒ hold-lapsed — η σιωπή δεν γίνεται «όχι» ούτε «ναι»', async (action) => {
    givenStay();
    givenRequest('stay_a', 'guest-1', LONG_AGO);
    expect(await run({ action, bookingId: 'stay_a' }, HOST)).toEqual({ kind: 'hold-lapsed' });
  });

  it('Μ3. άρνηση ⇒ declined με επίλυση', async () => {
    givenStay();
    givenRequest('stay_a', 'guest-1', FAR_FUTURE);
    expect((await run({ action: 'decline', bookingId: 'stay_a' }, HOST)).kind).toBe('ok');
    expect(db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_a')).toMatchObject({
      lifecycle: 'declined', resolution: { lifecycle: 'declined' },
    });
  });

  it('Μ4. απόσυρση ΞΕΝΟΥ αιτήματος ⇒ absent (καμία διαρροή)· δικού ⇒ withdrawn', async () => {
    givenStay();
    givenRequest('stay_a', 'guest-1', FAR_FUTURE);
    expect(await run({ action: 'withdraw', bookingId: 'stay_a' }, OTHER_GUEST)).toEqual({ kind: 'absent' });
    expect((await run({ action: 'withdraw', bookingId: 'stay_a' }, GUEST)).kind).toBe('ok');
    expect(db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_a')).toMatchObject({ lifecycle: 'withdrawn' });
  });

  it('🔴 Μ5. λήξη ΖΩΝΤΑΝΟΥ ⇒ hold-alive· νεκρού ⇒ expired με λόγο `no-answer`', async () => {
    givenStay();
    givenRequest('stay_live', 'guest-1', FAR_FUTURE);
    givenRequest('stay_dead', 'guest-2', LONG_AGO, '2027-11-01', '2027-11-03');
    expect(await run({ action: 'expire', bookingId: 'stay_live' }, SYSTEM)).toEqual({ kind: 'hold-alive' });
    expect((await run({ action: 'expire', bookingId: 'stay_dead' }, SYSTEM)).kind).toBe('ok');
    expect(db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_dead')).toMatchObject({
      lifecycle: 'expired', resolution: { lifecycle: 'expired', reason: 'no-answer' },
    });
  });

  it('Μ6. αίτημα ΔΕΝ «ακυρώνεται» — απαντιέται ή αποσύρεται', async () => {
    givenStay();
    givenRequest('stay_a', 'guest-1', FAR_FUTURE);
    expect(await run({ action: 'cancel', bookingId: 'stay_a' }, HOST)).toEqual({ kind: 'not-changeable', reason: 'lifecycle' });
  });
});

describe('Π — η αποκάλυψη πώλησης είναι ΓΕΓΟΝΟΣ (§4.7)', () => {
  it('ακίνητο και προς πώληση: χωρίς αποδοχή ⇒ risk-not-acknowledged· με αποδοχή ⇒ riskDisclosedAt γραμμένο', async () => {
    givenStay(['leaseShort', 'sell']);
    expect(await run(request(), GUEST)).toEqual({ kind: 'risk-not-acknowledged' });
    expect((await run(request('2027-10-10', '2027-10-14', true), GUEST)).kind).toBe('ok');
    const stored = db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_1') as { riskDisclosedAt: unknown };
    expect(typeof stored.riskDisclosedAt).toBe('string');
  });
});

