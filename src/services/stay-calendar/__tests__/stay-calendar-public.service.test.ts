/**
 * @jest-environment node
 *
 * ADR-835 §21 — **η δημόσια διαθεσιμότητα**: ο διακομιστής απαντά, ποτέ δεν διαρρέει εγγραφές.
 * Εκτελεί την πραγματική υπηρεσία πάνω στην πλαστή Firestore.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  readPublicStayAnswers,
  readPublicStayNights,
} from '@/services/stay-calendar/stay-calendar-public.service';
import { STAY_RULES_NONE } from '@/types/stay-rules';
import { listingOf, PROPERTY } from '@/lib/stay/__tests__/stay-rules-fixtures';

const db = new FakeFirestore();
const adminDb = db as unknown as AdminFirestore;
/** 1/9/2027 10:00 ώρα Αθήνας. */
const NOW = new Date('2027-09-01T07:00:00.000Z');
const STAMP = '2027-01-01T00:00:00.000Z';

function givenListing(offerKinds: readonly ('leaseShort' | 'sell')[] = ['leaseShort']): void {
  const stay = offerKinds.includes('leaseShort') ? { minNights: 2, maxGuests: 4, pets: null, nextAvailableFrom: null } : null;
  db.seed(COLLECTIONS.PUBLIC_LISTINGS, PROPERTY, { ...listingOf(stay, offerKinds, 80) });
}

function givenCalendar(declared: boolean): void {
  db.seed(COLLECTIONS.STAY_CALENDARS, PROPERTY, {
    propertyId: PROPERTY, authorUserId: 'user-1', declaredAt: declared ? STAMP : null, version: 2,
    rules: { ...STAY_RULES_NONE, preparationNights: 1 }, timezone: 'Europe/Athens', createdAt: STAMP, updatedAt: STAMP,
  });
  db.seed(COLLECTIONS.STAY_BOOKINGS, 'stay_1', {
    propertyId: PROPERTY, offerKind: 'leaseShort', covers: [{ propertyId: PROPERTY, spaceId: null }],
    checkIn: '2027-09-10', checkOut: '2027-09-14', holder: { kind: 'offline', label: 'Μαρία Παπαδοπούλου' },
    channel: 'direct', authorUserId: 'user-1', guests: 2, lifecycle: 'confirmed', riskDisclosedAt: null,
    createdAt: STAMP, updatedAt: STAMP,
  });
  db.seed(COLLECTIONS.STAY_CALENDAR_MONTHS, 'scmo_1', {
    propertyId: PROPERTY, authorUserId: 'user-1', month: '2027-09', updatedAt: STAMP,
    days: { '2027-09-20': { nightlyRateMinor: 12000, closedToArrival: true } },
  });
}

beforeEach(() => db.reset());

describe('Η — ημερολόγιο ανά νύχτα', () => {
  it('κλειστές οι νύχτες της κράτησης ΚΑΙ της προετοιμασίας· 🔴 κανένα όνομα, καμία ταυτότητα', async () => {
    givenListing();
    givenCalendar(true);
    const view = await readPublicStayNights(adminDb, PROPERTY, '2027-09', 1, NOW);
    if (view?.kind !== 'declared') throw new Error(`δηλωμένο, ήρθε ${String(view?.kind)}`);
    const night = (date: string) => view.nights.find((n) => n.date === date);
    expect(night('2027-09-09')?.state).toBe('closed');
    expect(night('2027-09-12')?.state).toBe('closed');
    expect(night('2027-09-14')?.state).toBe('closed');
    expect(night('2027-09-20')?.checkInAllowed).toBe(false);
    const wire = JSON.stringify(view);
    expect(wire).not.toContain('Μαρία');
    expect(wire).not.toContain('stay_1');
  });

  it('🔴 αδήλωτο ημερολόγιο ⇒ `undeclared` — ποτέ «όλα ελεύθερα»', async () => {
    givenListing();
    givenCalendar(false);
    expect(await readPublicStayNights(adminDb, PROPERTY, '2027-09', 1, NOW)).toEqual({ kind: 'undeclared' });
  });

  it('ίδια απάντηση (null) για «δεν υπάρχει» και «δεν είναι κατάλυμα»', async () => {
    expect(await readPublicStayNights(adminDb, PROPERTY, '2027-09', 1, NOW)).toBeNull();
    givenListing(['sell']);
    expect(await readPublicStayNights(adminDb, PROPERTY, '2027-09', 1, NOW)).toBeNull();
  });
});

describe('Α — απαντήσεις αναζήτησης', () => {
  it('επικάλυψη ⇒ `occupied` με ό,τι απομένει· ελεύθερο ⇒ τιμολόγηση με την τιμή της ημέρας', async () => {
    givenListing();
    givenCalendar(true);
    const busy = await readPublicStayAnswers(adminDb, [PROPERTY], { checkIn: '2027-09-11', checkOut: '2027-09-13', guests: 2 }, NOW);
    expect(busy[PROPERTY].answer.kind).toBe('occupied');
    const free = await readPublicStayAnswers(adminDb, [PROPERTY], { checkIn: '2027-09-19', checkOut: '2027-09-21', guests: 2 }, NOW);
    expect(free[PROPERTY]).toEqual({
      answer: { kind: 'free' },
      quote: {
        kind: 'priced',
        nights: [
          { date: '2027-09-19', amountMinor: 8000, source: 'base' },
          { date: '2027-09-20', amountMinor: 12000, source: 'day' },
        ],
        nightsMinor: 20000,
        fees: [],
        totalMinor: 20000,
      },
      // 🏆 Στάδιο Δ (§23.5): η υπόσχεση ΠΡΙΝ το αίτημα — άφιξη σε 18 ημέρες ⇒ 48 ώρες, ρολόι τοίχου.
      hold: { kind: 'held', expiresAt: '2027-09-03T07:00:00.000Z', tier: 'upcoming', bound: 'response-hours' },
    });
  });

  it('🔴 αγγελία που ΔΕΝ βρίσκεται ⇒ `unreadable` (δικό μας χρέος), ΟΧΙ `not-a-stay`', async () => {
    givenListing(['sell']);
    const answers = await readPublicStayAnswers(adminDb, [PROPERTY, 'ownp_gone'], { checkIn: '2027-09-19', checkOut: '2027-09-21', guests: null }, NOW);
    expect(answers[PROPERTY].answer.kind).toBe('not-a-stay');
    expect(answers.ownp_gone.answer.kind).toBe('unreadable');
  });
});
