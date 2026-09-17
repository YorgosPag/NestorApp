/**
 * **Ο ΑΥΣΤΗΡΟΣ ΑΝΑΓΝΩΣΤΗΣ** — ADR-835 §22.
 *
 * 🔑 Κάθε άγκυρα ρωτά το **ίδιο** πράγμα από άλλη γωνία: *«μπορεί αυτό το feed να
 * παραγάγει σιωπηλά ελεύθερη νύχτα;»*. Η απάντηση πρέπει να είναι **όχι**, με όνομα.
 */

import { readIcalCalendar, type IcalReadOptions } from '../ical-read';
import {
  AIRBNB_FEED,
  BOOKING_FEED_DAY_1,
  BOOKING_FEED_DAY_2,
  ics,
  VRBO_FEED,
} from './ical-fixtures';

/** Η ζώνη του καταλύματος στις δοκιμές: UTC+3 (Αθήνα, θερινή) — ένα σταθερό `Z` ⇒ ημέρα. */
const options: IcalReadOptions = {
  dateKeyOfInstant: (epochMs) => new Date(epochMs + 3 * 60 * 60 * 1000).toISOString().slice(0, 10),
};

const read = (raw: string) => readIcalCalendar(raw, options);

describe('readIcalCalendar — τα κανάλια όπως είναι', () => {
  it('Airbnb: κράτηση + κλεισμένες μέρες, ημι-ανοιχτά διαστήματα, χωρίς τα προσωπικά', () => {
    const result = read(AIRBNB_FEED);
    expect(result).toEqual({
      ok: true,
      calendarName: 'Airbnb (Διαμέρισμα στο κέντρο)',
      events: [
        { uid: '1a2b3c4d5e@airbnb.com', from: '2026-10-12', to: '2026-10-15', summary: 'Reserved' },
        { uid: '9f8e7d6c5b@airbnb.com', from: '2026-10-18', to: '2026-10-20', summary: 'Airbnb (Not available)' },
      ],
    });
  });

  it('Booking.com: το κυλιόμενο UID δίνει ΔΥΟ διαφορετικά γεγονότα με ΙΔΙΑ αναχώρηση', () => {
    const day1 = read(BOOKING_FEED_DAY_1);
    const day2 = read(BOOKING_FEED_DAY_2);
    expect(day1.ok && day1.events[0]).toEqual({
      uid: 'TRU-9LZDAN', from: '2026-09-15', to: '2026-09-20', summary: 'CLOSED - Not available',
    });
    // Η ταυτότητα άλλαξε και η άφιξη μετακινήθηκε — **μόνο** η αναχώρηση κρατά.
    expect(day2.ok && day2.events[0]).toEqual({
      uid: 'TRU-2BASUD', from: '2026-09-16', to: '2026-09-20', summary: 'CLOSED - Not available',
    });
  });

  it('Vrbo: DURATION αντί για DTEND, και το RRULE του VTIMEZONE ΔΕΝ είναι επανάληψη γεγονότος', () => {
    expect(read(VRBO_FEED)).toEqual({
      ok: true,
      calendarName: null,
      events: [{ uid: '1234567890abcdef@vrbo.com', from: '2026-11-01', to: '2026-11-05', summary: 'Reserved - Vrbo' }],
    });
  });
});

describe('readIcalCalendar — οι μορφές του χρόνου (RFC 5545 §3.3.4-5)', () => {
  const event = (...lines: readonly string[]): string =>
    ics('BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:x@test', ...lines, 'END:VEVENT', 'END:VCALENDAR');

  it('DTSTART ολοήμερο χωρίς DTEND ⇒ μία νύχτα', () => {
    const result = read(event('DTSTART;VALUE=DATE:20261012'));
    expect(result.ok && result.events[0]).toMatchObject({ from: '2026-10-12', to: '2026-10-13' });
  });

  it('DATE-TIME με TZID ⇒ η ΓΡΑΜΜΕΝΗ ημέρα, χωρίς μετάφραση', () => {
    const result = read(event(
      'DTSTART;TZID=Europe/Athens:20261012T220000',
      'DTEND;TZID=Europe/Athens:20261015T110000',
    ));
    expect(result.ok && result.events[0]).toMatchObject({ from: '2026-10-12', to: '2026-10-15' });
  });

  it('DATE-TIME σε UTC ⇒ η ημέρα του ΚΑΤΑΛΥΜΑΤΟΣ (22:00Z = 01:00 επόμενης στην Αθήνα)', () => {
    const result = read(event('DTSTART:20261012T220000Z', 'DTEND:20261015T080000Z'));
    expect(result.ok && result.events[0]).toMatchObject({ from: '2026-10-13', to: '2026-10-15' });
  });

  it('DURATION σε εβδομάδες', () => {
    const result = read(event('DTSTART;VALUE=DATE:20261012', 'DURATION:P1W'));
    expect(result.ok && result.events[0]).toMatchObject({ from: '2026-10-12', to: '2026-10-19' });
  });

  it('🔴 μηδενικό διάστημα ⇒ ΜΙΑ νύχτα κλειστή, ποτέ παράλειψη', () => {
    const result = read(event('DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261012'));
    expect(result.ok && result.events[0]).toMatchObject({ from: '2026-10-12', to: '2026-10-13' });
  });

  it('STATUS:CANCELLED ⇒ το γεγονός δεν κλείνει νύχτες', () => {
    const result = read(event('DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261015', 'STATUS:CANCELLED'));
    expect(result).toEqual({ ok: true, calendarName: null, events: [] });
  });

  it('διπλωμένη γραμμή 75 οκτάδων ξεδιπλώνεται (και με TAB)', () => {
    const result = read(ics(
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      'UID:very-long-identifier-that-the-channel-folded-across-two-physical-li',
      '\tnes@test',
      'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261013',
      'END:VEVENT', 'END:VCALENDAR',
    ));
    expect(result.ok && result.events[0]?.uid)
      .toBe('very-long-identifier-that-the-channel-folded-across-two-physical-lines@test');
  });

  it('παράμετρος σε εισαγωγικά με «:» δεν σπάει τη γραμμή', () => {
    const result = read(event('DTSTART;TZID="Europe/Athens":20261012T150000', 'DTEND;VALUE=DATE:20261014'));
    expect(result.ok && result.events[0]).toMatchObject({ from: '2026-10-12', to: '2026-10-14' });
  });
});

describe('readIcalCalendar — ό,τι δεν διαβάζεται ΑΠΟΤΥΓΧΑΝΕΙ ΜΕ ΟΝΟΜΑ', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['not-a-calendar', 'BEGIN:VTODO\r\nEND:VTODO\r\n'],
    ['not-a-calendar', 'Σφάλμα 404 — δεν βρέθηκε'],
    ['truncated', 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:x@t\r\nDTSTART;VALUE=DATE:20261012\r\n'],
    ['event-without-uid', ics('BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261012', 'END:VEVENT', 'END:VCALENDAR')],
    ['event-without-start', ics('BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x@t', 'END:VEVENT', 'END:VCALENDAR')],
    ['unreadable-date', ics('BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x@t', 'DTSTART;VALUE=DATE:20260230', 'END:VEVENT', 'END:VCALENDAR')],
    ['unreadable-date', ics('BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x@t', 'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261001', 'END:VEVENT', 'END:VCALENDAR')],
    ['recurrence-unsupported', ics('BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x@t', 'DTSTART;VALUE=DATE:20261012', 'RRULE:FREQ=WEEKLY', 'END:VEVENT', 'END:VCALENDAR')],
  ];

  it.each(cases)('%s', (failure, raw) => {
    expect(read(raw)).toEqual({ ok: false, failure });
  });

  it('🔴 κενό VCALENDAR είναι ΕΓΚΥΡΟ — η απόφαση «άνοιξε τις νύχτες;» ΔΕΝ είναι του αναγνώστη', () => {
    expect(read(ics('BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'))).toEqual({
      ok: true, calendarName: null, events: [],
    });
  });
});
