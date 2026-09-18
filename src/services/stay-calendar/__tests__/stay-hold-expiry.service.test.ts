/**
 * @jest-environment node
 *
 * ADR-835 §23.7 — **ο σαρωτής λήξης**: κάθε λήξη περνά από τον ΕΝΑ γραφέα, κάθε κάδος μετριέται.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { offerOf, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { expireLapsedHolds } from '@/services/stay-calendar/stay-hold-expiry.service';
import { STAY_RULES_NONE } from '@/types/stay-rules';

jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn() } }));
const mockAnnounce = jest.fn();
jest.mock('@/services/stay-calendar/stay-booking-notifier.service', () => ({
  announceStayBookingNotice: (...args: unknown[]) => mockAnnounce(...args),
}));

const PROPERTY = 'ownp_a';
const STAMP = '2026-01-01T00:00:00.000Z';
const AT = '2026-09-18T12:00:00.000Z';

const db = new FakeFirestore();
const adminDb = db as unknown as AdminFirestore;

function givenRequest(id: string, expiresAt: string, lifecycle = 'requested', checkIn = '2027-10-10', checkOut = '2027-10-12'): void {
  db.seed(COLLECTIONS.STAY_BOOKINGS, id, {
    propertyId: PROPERTY, offerKind: 'leaseShort', covers: [{ propertyId: PROPERTY, spaceId: null }],
    checkIn, checkOut, holder: { kind: 'user', userId: 'guest-1', displayName: null }, channel: 'platform',
    authorUserId: 'user-1', guests: 2, lifecycle, riskDisclosedAt: null,
    hold: { expiresAt, tier: 'distant', bound: 'response-hours', respondentUserId: 'user-1' },
    resolution: lifecycle === 'declined' ? { lifecycle: 'declined', at: STAMP } : null,
    guestUserId: 'guest-1', createdAt: STAMP, updatedAt: STAMP,
  });
}

beforeEach(() => {
  db.reset();
  mockAnnounce.mockReset();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, PROPERTY, { ...validOwnerProperty({ offers: [offerOf('leaseShort', 65)] }) });
  db.seed(COLLECTIONS.STAY_CALENDARS, PROPERTY, {
    propertyId: PROPERTY, authorUserId: 'user-1', declaredAt: STAMP, version: 1, rules: STAY_RULES_NONE,
    timezone: 'Europe/Athens', createdAt: STAMP, updatedAt: STAMP,
  });
});

describe('Λ — ο σαρωτής', () => {
  it('λήγει ΜΟΝΟ τα ληγμένα `requested` — μέσα από τον γραφέα (version+1, ειδοποίηση)', async () => {
    givenRequest('stay_dead', '2020-01-01T00:00:00.000Z');
    givenRequest('stay_live', '2099-01-01T00:00:00.000Z', 'requested', '2027-11-01', '2027-11-03');
    givenRequest('stay_declined', '2020-06-01T00:00:00.000Z', 'declined', '2027-12-01', '2027-12-03');
    const report = await expireLapsedHolds(adminDb, AT);
    expect(report).toEqual({ considered: 1, expired: 1, alreadyResolved: 0, failed: 0, truncated: false });
    expect(db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_dead')).toMatchObject({ lifecycle: 'expired' });
    expect(db.pathBucket(COLLECTIONS.STAY_BOOKINGS).get('stay_live')).toMatchObject({ lifecycle: 'requested' });
    expect(db.pathBucket(COLLECTIONS.STAY_CALENDARS).get(PROPERTY)).toMatchObject({ version: 2 });
    expect(mockAnnounce).toHaveBeenCalledTimes(1);
  });

  it('κάθε κάδος εκπέμπεται ΚΑΙ ΟΤΑΝ ΕΙΝΑΙ ΜΗΔΕΝ — «δεν έληξε τίποτα» ≠ «κανείς δεν κοίταξε»', async () => {
    expect(await expireLapsedHolds(adminDb, AT)).toEqual({
      considered: 0, expired: 0, alreadyResolved: 0, failed: 0, truncated: false,
    });
  });

  it('🔴 αίτημα χωρίς διαβάσιμο ακίνητο ⇒ μετριέται ως `failed`, ποτέ σιωπηλά', async () => {
    givenRequest('stay_dead', '2020-01-01T00:00:00.000Z');
    db.seed(COLLECTIONS.STAY_BOOKINGS, 'stay_orphan', { lifecycle: 'requested', hold: { expiresAt: '2020-01-01T00:00:00.000Z' } });
    const report = await expireLapsedHolds(adminDb, AT);
    expect(report.considered).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.expired).toBe(1);
  });
});
