/**
 * ADR-835 §23.4 — **η κεφαλή του επισκέπτη**: μετρά μόνο ό,τι ζει, και ο αναγνώστης είναι αυστηρός.
 */

import {
  guestHeadWithHold,
  guestHeadWithoutHold,
  guestHoldLimitReached,
  liveGuestHolds,
  STAY_GUEST_MAX_ACTIVE_HOLDS,
  stayGuestHeadFromDocument,
  type StayGuestHead,
} from '@/lib/stay/stay-guest-head';
import { STAY_COMMAND_AUTHORITY } from '@/lib/stay/stay-command-authority';

const NOW = '2026-09-01T07:00:00.000Z';
const LIVE = '2026-09-02T07:00:00.000Z';
const DEAD = '2026-09-01T07:00:00.000Z';

const head = (expires: readonly string[]): StayGuestHead => ({
  userId: 'g', version: 1, updatedAt: NOW,
  holds: expires.map((expiresAt, i) => ({ bookingId: `stay_${i}`, propertyId: 'p', expiresAt })),
});

describe('Ζ — μόνο ζωντανά', () => {
  it('🔑 η στιγμή λήξης ΕΙΝΑΙ ήδη λήξη (ημι-ανοιχτό, όπως τα διαστήματα)', () => {
    expect(liveGuestHolds(head([LIVE, DEAD]), NOW).map((h) => h.bookingId)).toEqual(['stay_0']);
  });

  it(`το όριο (${STAY_GUEST_MAX_ACTIVE_HOLDS}) μετρά ζωντανά — ${STAY_GUEST_MAX_ACTIVE_HOLDS} νεκρά δεν πιάνουν θέση`, () => {
    expect(guestHoldLimitReached(head(Array(STAY_GUEST_MAX_ACTIVE_HOLDS).fill(LIVE)), NOW)).toBe(true);
    expect(guestHoldLimitReached(head(Array(STAY_GUEST_MAX_ACTIVE_HOLDS).fill(DEAD)), NOW)).toBe(false);
    expect(guestHoldLimitReached(null, NOW)).toBe(false);
  });

  it('προσθήκη κλαδεύει τα νεκρά και αυξάνει version· αφαίρεση βγάζει μόνο το ένα', () => {
    const added = guestHeadWithHold(head([DEAD, LIVE]), 'g', { bookingId: 'stay_new', propertyId: 'p', expiresAt: LIVE }, NOW);
    expect(added.holds.map((h) => h.bookingId)).toEqual(['stay_1', 'stay_new']);
    expect(added.version).toBe(2);
    expect(guestHeadWithoutHold(added, 'g', 'stay_1', NOW).holds.map((h) => h.bookingId)).toEqual(['stay_new']);
  });
});

describe('Α — ο αναγνώστης', () => {
  it('🔴 ένα χαλασμένο hold ⇒ όλη η κεφαλή `null` — ποτέ «μετράω όσα διαβάζονται»', () => {
    expect(stayGuestHeadFromDocument({ userId: 'g', version: 1, updatedAt: NOW, holds: [{ bookingId: 'x' }] }, 'g')).toBeNull();
    expect(stayGuestHeadFromDocument({ userId: 'other', version: 1, updatedAt: NOW, holds: [] }, 'g')).toBeNull();
    expect(stayGuestHeadFromDocument(head([LIVE]), 'g')).toEqual(head([LIVE]));
  });
});

describe('Ε — ο πίνακας εξουσίας', () => {
  it('ο επισκέπτης εκδίδει ΜΟΝΟ αίτημα και απόσυρση· το σύστημα ΜΟΝΟ λήξη', () => {
    const byActor = (kind: string) => Object.entries(STAY_COMMAND_AUTHORITY).filter(([, k]) => k === kind).map(([a]) => a).sort();
    expect(byActor('guest')).toEqual(['request', 'withdraw']);
    expect(byActor('system')).toEqual(['expire']);
  });
});
