/**
 * @fileoverview **ΟΙ ΚΑΝΟΝΕΣ ΤΟΥ ΚΑΤΑΛΥΜΑΤΟΣ** — άγκυρες του Σταδίου Β (ADR-835 §21).
 *
 * Κάθε κανόνας έχει **και** το σκέλος που πρέπει να αρνηθεί **και** τον παρονομαστή που
 * πρέπει να περάσει («και το ίσον;», παγίδα Φ2 #3). Σήμερα = Τρίτη 1/9/2026, 10:00 Αθήνα.
 */

import { stayAvailabilityFor } from '@/lib/stay/stay-availability';
import { stayCalendarOccupancies } from '@/lib/stay/stay-rules';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';

import {
  blockEntry,
  bookingEntry,
  calendarOf,
  CLOCK,
  listingOf,
  rulesInput,
} from './stay-rules-fixtures';

const LISTING = listingOf();
const ask = (checkIn: string, checkOut: string): StayQuery => ({ checkIn, checkOut, guests: 2 });

describe('Α — ειδοποίηση (advance notice)', () => {
  it('2 ημέρες ⇒ άφιξη αύριο απορρίπτεται με τη νωρίτερη άφιξη', () => {
    const cal = calendarOf([], rulesInput({ advanceNotice: { days: 2, sameDayCutoffHour: null } }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-02', '2026-09-05'), cal, null)).toEqual({
      kind: 'advance-notice',
      earliestCheckIn: '2026-09-03',
    });
  });

  it('🔴 …και ακριβώς στη νωρίτερη άφιξη ΠΕΡΝΑ', () => {
    const cal = calendarOf([], rulesInput({ advanceNotice: { days: 2, sameDayCutoffHour: null } }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-03', '2026-09-05'), cal, null).kind).toBe('free');
  });

  it('🔴 ίδια μέρα με αποκοπή: πριν την ώρα περνά, μετά την ώρα όχι — σε ΛΕΠΤΑ ΑΘΗΝΑΣ', () => {
    const notice = { advanceNotice: { days: 0, sameDayCutoffHour: 18 } } as const;
    const before = calendarOf([], rulesInput(notice, {}, { ...CLOCK, minutes: 17 * 60 + 59 }));
    const after = calendarOf([], rulesInput(notice, {}, { ...CLOCK, minutes: 18 * 60 }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-01', '2026-09-03'), before, null).kind).toBe('free');
    expect(stayAvailabilityFor(LISTING, ask('2026-09-01', '2026-09-03'), after, null).kind).toBe('advance-notice');
  });
});

describe('Β — παράθυρο κρατήσεων', () => {
  const cal = calendarOf([], rulesInput({ availabilityWindowMonths: 3 }));

  it('αναχώρηση μετά το παράθυρο ⇒ `outside-window` με την πρώτη μη διαθέσιμη νύχτα', () => {
    expect(stayAvailabilityFor(LISTING, ask('2026-11-28', '2026-12-02'), cal, null)).toEqual({
      kind: 'outside-window',
      bookableUntil: '2026-12-01',
    });
  });

  it('🔴 αναχώρηση ΑΚΡΙΒΩΣ στο όριο περνά (ημι-ανοιχτό)', () => {
    expect(stayAvailabilityFor(LISTING, ask('2026-11-28', '2026-12-01'), cal, null).kind).toBe('free');
  });
});

describe('Γ — μέρες άφιξης/αναχώρησης και CTA/CTD', () => {
  it('μόνο Σάββατο άφιξη ⇒ Τετάρτη απορρίπτεται, με την κοντινότερη πριν και μετά', () => {
    const cal = calendarOf([], rulesInput({ arrivalWeekdays: [6] }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-09', '2026-09-12'), cal, null)).toEqual({
      kind: 'arrival-not-allowed',
      nearestBefore: '2026-09-05',
      nearestAfter: '2026-09-12',
    });
    expect(stayAvailabilityFor(LISTING, ask('2026-09-12', '2026-09-15'), cal, null).kind).toBe('free');
  });

  it('CTA ανά ημερομηνία κλείνει ΜΟΝΟ εκείνη την άφιξη', () => {
    const cal = calendarOf([], rulesInput({}, { '2026-09-10': { closedToArrival: true } }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-12'), cal, null).kind).toBe('arrival-not-allowed');
    expect(stayAvailabilityFor(LISTING, ask('2026-09-09', '2026-09-12'), cal, null).kind).toBe('free');
  });

  it('🔴 CTD κρίνεται στη μέρα ΑΝΑΧΩΡΗΣΗΣ, όχι σε νύχτα της διαμονής', () => {
    const cal = calendarOf([], rulesInput({}, { '2026-09-12': { closedToDeparture: true } }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-12'), cal, null).kind).toBe('departure-not-allowed');
    // Η 12/09 ως ΝΥΧΤΑ της διαμονής δεν επηρεάζεται.
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-14'), cal, null).kind).toBe('free');
  });
});

describe('Δ — διάρκεια ανά ΗΜΕΡΑ ΑΦΙΞΗΣ', () => {
  it('ελάχιστο της ημέρας άφιξης υπερισχύει του όρου της αγγελίας', () => {
    const listing = listingOf({ minNights: 2, maxGuests: 4, nextAvailableFrom: null });
    const cal = calendarOf([], rulesInput({}, { '2026-09-10': { minNights: 5 } }));
    expect(stayAvailabilityFor(listing, ask('2026-09-10', '2026-09-13'), cal, null)).toEqual({
      kind: 'below-min-nights',
      minNights: 5,
      asked: 3,
    });
  });

  it('🔴 arrival, ΟΧΙ through: ελάχιστο σε νύχτα ΜΕΣΑ στη διαμονή δεν εφαρμόζεται', () => {
    const cal = calendarOf([], rulesInput({}, { '2026-09-11': { minNights: 7 } }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-13'), cal, null).kind).toBe('free');
  });

  it('μέγιστες νύχτες: πάνω απαντά με τον αριθμό, ακριβώς περνά', () => {
    const cal = calendarOf([], rulesInput({ maxNights: 3 }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-14'), cal, null)).toEqual({
      kind: 'above-max-nights',
      maxNights: 3,
      asked: 4,
    });
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-13'), cal, null).kind).toBe('free');
  });
});

describe('Ε — ορφανό κενό', () => {
  const listing = listingOf({ minNights: 5, maxGuests: 4, nextAvailableFrom: null });
  const entries = [bookingEntry('stay_a', '2026-09-05', '2026-09-10'), bookingEntry('stay_b', '2026-09-12', '2026-09-15')];

  it('κενό 2 νυχτών με κανόνα ≤2 ⇒ δίνυχτη διαμονή που το γεμίζει ΠΕΡΝΑ', () => {
    const cal = calendarOf(entries, rulesInput({ orphanGap: { maxNights: 2 } }));
    expect(stayAvailabilityFor(listing, ask('2026-09-10', '2026-09-12'), cal, null).kind).toBe('free');
  });

  it('🔴 χωρίς κανόνα το ίδιο κενό μένει κάτω από το ελάχιστο', () => {
    const cal = calendarOf(entries, rulesInput());
    expect(stayAvailabilityFor(listing, ask('2026-09-10', '2026-09-12'), cal, null).kind).toBe('below-min-nights');
  });

  it('🔴 κανόνας ≤1 ΔΕΝ χαλαρώνει κενό 2 νυχτών', () => {
    const cal = calendarOf(entries, rulesInput({ orphanGap: { maxNights: 1 } }));
    expect(stayAvailabilityFor(listing, ask('2026-09-10', '2026-09-12'), cal, null).kind).toBe('below-min-nights');
  });

  it('🔴 κενό που δεν κλείνει από ΚΑΙ τις δύο πλευρές δεν είναι ορφανό', () => {
    const open = [bookingEntry('stay_a', '2026-09-05', '2026-09-10')];
    const cal = calendarOf(open, rulesInput({ orphanGap: { maxNights: 3 } }));
    expect(stayAvailabilityFor(listing, ask('2026-09-10', '2026-09-12'), cal, null).kind).toBe('below-min-nights');
  });
});

describe('Ζ — προετοιμασία: μοιραζόμενη, για κάθε κανάλι, όχι για blocks ιδιοκτήτη', () => {
  const rules = rulesInput({ preparationNights: 1 });

  it('κράτηση [5,10) με 1 νύχτα: άφιξη 10 απορρίπτεται, άφιξη 11 περνά (η 10 μοιράζεται)', () => {
    const cal = calendarOf([bookingEntry('stay_a', '2026-09-05', '2026-09-10')], rules);
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-12'), cal, null).kind).toBe('occupied');
    expect(stayAvailabilityFor(LISTING, ask('2026-09-11', '2026-09-13'), cal, null).kind).toBe('free');
  });

  it('🔴 αναχώρηση ακριβώς πριν τη νύχτα προετοιμασίας περνά', () => {
    const cal = calendarOf([bookingEntry('stay_a', '2026-09-10', '2026-09-12')], rules);
    expect(stayAvailabilityFor(LISTING, ask('2026-09-06', '2026-09-09'), cal, null).kind).toBe('free');
    expect(stayAvailabilityFor(LISTING, ask('2026-09-06', '2026-09-10'), cal, null).kind).toBe('occupied');
  });

  it('εξωτερικό block (άλλο κανάλι) παίρνει προετοιμασία· block ιδιοκτήτη ΟΧΙ', () => {
    const external = calendarOf([blockEntry('sblk_x', '2026-09-05', '2026-09-10', 'external')], rules);
    const owner = calendarOf([blockEntry('sblk_o', '2026-09-05', '2026-09-10', 'owner')], rules);
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-12'), external, null).kind).toBe('occupied');
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-12'), owner, null).kind).toBe('free');
  });

  it('🔴 χωρίς προετοιμασία καμία συνθετική κατάληψη', () => {
    expect(stayCalendarOccupancies([bookingEntry('stay_a', '2026-09-05', '2026-09-10')], 0)).toHaveLength(1);
    expect(stayCalendarOccupancies([bookingEntry('stay_a', '2026-09-05', '2026-09-10')], 2)).toHaveLength(3);
  });
});

describe('Η — η σειρά-συμβόλαιο', () => {
  it('ειδοποίηση κρίνεται ΠΡΙΝ την κατάληψη· κατάληψη ΠΡΙΝ τις νύχτες', () => {
    const entries = [bookingEntry('stay_a', '2026-09-02', '2026-09-20')];
    const noticeCal = calendarOf(entries, rulesInput({ advanceNotice: { days: 7, sameDayCutoffHour: null } }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-03', '2026-09-04'), noticeCal, null).kind).toBe('advance-notice');
    const lengthCal = calendarOf(entries, rulesInput({ maxNights: 1 }));
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-14'), lengthCal, null).kind).toBe('occupied');
  });

  it('🔴 αδιάβαστο δηλωμένο ημερολόγιο ⇒ `unreadable`, ποτέ `unknown`', () => {
    expect(stayAvailabilityFor(LISTING, ask('2026-09-10', '2026-09-12'), { kind: 'unreadable' }, null).kind).toBe('unreadable');
  });
});
