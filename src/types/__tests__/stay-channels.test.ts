/**
 * ADR-835 §22 (Στάδιο Γ) — **το λεξιλόγιο των καναλιών είναι κλειστό και ΠΛΗΡΕΣ.**
 *
 * 🔑 Ο φρουρός `STAY_CHANNEL_FAILURES_COMPLETE` είναι **τύπος**: αν ο αναγνώστης iCal
 * αποκτήσει νέα αποτυχία χωρίς γραμμή στο λεξιλόγιο του τομέα, **δεν μεταγλωττίζεται**.
 * Αυτή η άγκυρα είναι ο **καταναλωτής** του — χωρίς αυτόν, ο φρουρός θα ήταν σχόλιο.
 */

import type { IcalReadFailure } from '@/lib/ical/ical-read';
import {
  isStayChannelFailure,
  STAY_CHANNEL_ACCEPTS_IMPORT,
  STAY_CHANNEL_FAILURES,
  STAY_CHANNEL_FAILURES_COMPLETE,
  STAY_CHANNEL_FRESHNESS,
  STAY_CHANNEL_KINDS,
  STAY_FRESHNESS_TRUSTED,
} from '@/types/stay-channels';

describe('Λ — το λεξιλόγιο των καναλιών', () => {
  it('🔑 κάθε αποτυχία του αναγνώστη iCal έχει γραμμή στο λεξιλόγιο του τομέα', () => {
    expect(STAY_CHANNEL_FAILURES_COMPLETE).toBe(true);
    const icalFailures: readonly IcalReadFailure[] = [
      'not-a-calendar', 'truncated', 'event-without-uid', 'event-without-start',
      'unreadable-date', 'recurrence-unsupported', 'too-many-events',
    ];
    for (const failure of icalFailures) expect(isStayChannelFailure(failure)).toBe(true);
    expect(STAY_CHANNEL_FAILURES).toHaveLength(7 + icalFailures.length);
  });

  it('άγνωστος κωδικός αποτυχίας ⇒ `false` (ο φρουρός δεν μαντεύει)', () => {
    for (const value of ['', 'κάτι', 42, null, undefined]) {
      expect(isStayChannelFailure(value)).toBe(false);
    }
  });

  it('🔴 κάθε κανάλι απαντά «δέχεται τον σύνδεσμό μας;» — και η Booking.com λέει ΟΧΙ', () => {
    for (const kind of STAY_CHANNEL_KINDS) {
      expect(typeof STAY_CHANNEL_ACCEPTS_IMPORT[kind]).toBe('boolean');
    }
    expect(STAY_CHANNEL_ACCEPTS_IMPORT.booking).toBe(false);
    expect(STAY_CHANNEL_ACCEPTS_IMPORT.airbnb).toBe(true);
  });

  it('🔴 κάθε βαθμίδα απαντά «υπόσχεται διαθεσιμότητα;» — και μόνο δύο λένε ναι', () => {
    const trusted = STAY_CHANNEL_FRESHNESS.filter((tier) => STAY_FRESHNESS_TRUSTED[tier]);
    expect(trusted).toEqual(['fresh', 'lagging']);
    // Παρονομαστής: ένα «όλα ναι» θα έκανε τη βαθμίδα διακοσμητική.
    expect(STAY_CHANNEL_FRESHNESS.filter((tier) => !STAY_FRESHNESS_TRUSTED[tier])).toEqual(['stale', 'paused']);
  });
});
