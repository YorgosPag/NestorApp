/**
 * ADR-835 §20 — ο αναλυτής των πράξεων ημερολογίου. Κρίνει **μόνο σχήμα**· το «χωράει;»
 * είναι του κριτή μέσα στη συναλλαγή.
 */

import {
  STAY_BLOCK_MAX_NIGHTS,
  STAY_BOOKING_MAX_NIGHTS,
  STAY_GUEST_LABEL_MAX_LENGTH,
  stayCalendarCommandFrom,
} from '@/lib/stay/stay-calendar-command';
import { addDaysToDateKey } from '@/lib/calendar/date-key';

const FROM = '2027-10-10';
const plus = (days: number): string => addDaysToDateKey(FROM, days) ?? '';

describe('stayCalendarCommandFrom', () => {
  it('δέχεται block με σημείωση που κόβεται στα άκρα, κενή ⇒ null', () => {
    expect(stayCalendarCommandFrom({ action: 'block', from: FROM, to: plus(4), note: '  ' })).toEqual({
      ok: true, command: { action: 'block', from: FROM, to: plus(4), note: null },
    });
  });

  it.each([
    ['μηδέν νύχτες', FROM, FROM],
    ['ανάποδο', plus(2), FROM],
    ['ανύπαρκτη μέρα', '2027-02-30', '2027-03-02'],
    ['πάνω από το όριο', FROM, plus(STAY_BLOCK_MAX_NIGHTS + 1)],
  ])('block %s ⇒ malformed from/to', (_label, from, to) => {
    expect(stayCalendarCommandFrom({ action: 'block', from, to })).toEqual({ ok: false, malformed: ['from', 'to'] });
  });

  it('κράτηση χωρίς όνομα ΔΕΝ είναι κράτηση — είναι block', () => {
    const parsed = stayCalendarCommandFrom({ action: 'book', checkIn: FROM, checkOut: plus(3), guests: 2, pets: 0, guestLabel: '' });
    expect(parsed).toEqual({ ok: false, malformed: ['guestLabel'] });
  });

  it('κράτηση: άτομα ακέραιος ≥1, όνομα με όριο, διάρκεια με όριο', () => {
    const parsed = stayCalendarCommandFrom({
      action: 'book',
      checkIn: FROM,
      checkOut: plus(STAY_BOOKING_MAX_NIGHTS + 1),
      guests: 1.5,
      pets: 6,
      guestLabel: 'x'.repeat(STAY_GUEST_LABEL_MAX_LENGTH + 1),
    });
    expect(parsed).toEqual({ ok: false, malformed: ['checkIn', 'checkOut', 'guests', 'pets', 'guestLabel'] });
  });

  it('έγκυρη κράτηση', () => {
    expect(stayCalendarCommandFrom({ action: 'book', checkIn: FROM, checkOut: plus(3), guests: 4, pets: 1, guestLabel: ' Μαρία ' })).toEqual({
      ok: true,
      command: { action: 'book', checkIn: FROM, checkOut: plus(3), guests: 4, pets: 1, guestLabel: 'Μαρία', acknowledgedWarnings: [] },
    });
  });

  it('declare / unblock / cancel', () => {
    expect(stayCalendarCommandFrom({ action: 'declare', declared: true })).toMatchObject({ ok: true });
    expect(stayCalendarCommandFrom({ action: 'declare', declared: 'ναι' })).toEqual({ ok: false, malformed: ['declared'] });
    expect(stayCalendarCommandFrom({ action: 'unblock', blockId: ' ' })).toEqual({ ok: false, malformed: ['blockId'] });
    expect(stayCalendarCommandFrom({ action: 'cancel', bookingId: 'stay_1' })).toEqual({
      ok: true, command: { action: 'cancel', bookingId: 'stay_1' },
    });
  });

  it('άγνωστη πράξη ή μη-αντικείμενο ⇒ ονομασμένη άρνηση, ποτέ προεπιλογή', () => {
    expect(stayCalendarCommandFrom({ action: 'delete-all' })).toEqual({ ok: false, malformed: ['action'] });
    expect(stayCalendarCommandFrom(null)).toEqual({ ok: false, malformed: ['body'] });
  });
});
