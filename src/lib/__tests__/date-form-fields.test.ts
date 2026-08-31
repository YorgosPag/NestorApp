/**
 * **date-form-fields** — το ζεύγος ημερομηνία + `"HH:MM"` που γεμίζει άνθρωπος.
 *
 * Οι άγκυρες μετακόμισαν μαζί με τις συναρτήσεις: το `date-local` πέρασε τις **519**
 * γραμμές (N.7.1) και κόπηκε στην **ευθύνη** — «πώς **δείχνεται** μια στιγμή σε δύο
 * χωριστά πεδία;» δεν είναι η ερώτηση «τι στιγμή είναι αυτό;».
 *
 * @see ADR-584 — η κεντρικοποίηση από τα 4 αντιγραμμένα σημεία κλήσης
 */

import { combineDateAndTime, splitDateAndTime } from '../date-form-fields';

const ISO = '2026-01-15T10:30:00.000Z';

/**
 * The form-field pair: the CRM task dialogs hold a date and an "HH:MM" string in
 * two separate controls, and must round-trip them through a single `dueDate`.
 *
 * @see ADR-584 — extracted from 4 copy-pasted call sites
 */
describe('combineDateAndTime', () => {
  it('puts the time onto the date', () => {
    const result = combineDateAndTime(new Date('2026-01-15T00:00:00'), '14:45');
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(45);
  });

  it('zeroes seconds and millis so equal form values compare equal', () => {
    const seeded = new Date('2026-01-15T00:00:00');
    seeded.setSeconds(37, 421);
    const result = combineDateAndTime(seeded, '09:00');
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the date it is given', () => {
    const original = new Date('2026-01-15T08:00:00');
    combineDateAndTime(original, '23:59');
    expect(original.getHours()).toBe(8);
  });

  // A half-typed time field must never produce an Invalid Date the caller then
  // writes to Firestore.
  it('falls back to midnight for an unparseable time instead of Invalid Date', () => {
    const result = combineDateAndTime(new Date('2026-01-15T08:30:00'), '');
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it('treats a missing minutes half as zero', () => {
    const result = combineDateAndTime(new Date('2026-01-15T00:00:00'), '14');
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('splitDateAndTime', () => {
  it('round-trips with combineDateAndTime', () => {
    const combined = combineDateAndTime(new Date('2026-01-15T00:00:00'), '14:45');
    expect(splitDateAndTime(combined).time).toBe('14:45');
  });

  it('pads single-digit hours and minutes to the "HH:MM" the input expects', () => {
    const split = splitDateAndTime(new Date('2026-01-15T09:05:00'));
    expect(split.time).toBe('09:05');
  });

  // The reason this helper goes through normalizeToDate rather than checking for
  // toDate() itself — the ad-hoc version it replaced dropped these.
  it('reads a JSON-serialised Timestamp that has no toDate()', () => {
    const at = new Date('2026-01-15T16:20:00');
    const split = splitDateAndTime({ seconds: at.getTime() / 1000, nanoseconds: 0 });
    expect(split.time).toBe('16:20');
  });

  it('uses the fallback time when the value is unreadable', () => {
    expect(splitDateAndTime(null).time).toBe('09:00');
    expect(splitDateAndTime({ foo: 'bar' }, '08:30').time).toBe('08:30');
  });
});
