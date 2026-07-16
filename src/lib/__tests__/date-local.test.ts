/**
 * date-local — ADR-218 SSoT for instant normalisation.
 *
 * Focus: `normalizeToDate` is the single funnel every other helper here goes
 * through, and it must accept every shape a Firestore instant legitimately
 * arrives in — including the two JSON-serialised ones, which have no methods.
 *
 * @see ADR-663 §4 part 5 — why the serialised shapes reach this helper at all
 */

import {
  normalizeToDate,
  normalizeToISO,
  normalizeToMillis,
  fieldToISO,
  combineDateAndTime,
  splitDateAndTime,
} from '../date-local';

const ISO = '2026-01-15T10:30:00.000Z';
const MS = Date.parse(ISO);
const SECONDS = MS / 1000;

describe('normalizeToDate', () => {
  it('reads a Timestamp via toDate() (client and admin SDK both expose it)', () => {
    expect(normalizeToDate({ toDate: () => new Date(ISO) })?.toISOString()).toBe(ISO);
  });

  it('passes a Date through', () => {
    expect(normalizeToDate(new Date(ISO))?.toISOString()).toBe(ISO);
  });

  it('parses an ISO string', () => {
    expect(normalizeToDate(ISO)?.toISOString()).toBe(ISO);
  });

  it('parses epoch millis', () => {
    expect(normalizeToDate(MS)?.toISOString()).toBe(ISO);
  });

  // The two method-less shapes: a Timestamp that has been through JSON.
  it('reads a JSON-serialised client Timestamp { seconds, nanoseconds }', () => {
    expect(normalizeToDate({ seconds: SECONDS, nanoseconds: 0 })?.toISOString()).toBe(ISO);
  });

  it('reads a JSON-serialised admin Timestamp { _seconds, _nanoseconds }', () => {
    expect(normalizeToDate({ _seconds: SECONDS, _nanoseconds: 0 })?.toISOString()).toBe(ISO);
  });

  it('prefers toDate() over the raw seconds fields when both are present', () => {
    // A live client Timestamp has BOTH a toDate() and a public `seconds`.
    const live = { seconds: 0, nanoseconds: 0, toDate: () => new Date(ISO) };
    expect(normalizeToDate(live)?.toISOString()).toBe(ISO);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['a non-instant object', { foo: 'bar' }],
    ['a non-numeric seconds field', { _seconds: 'nope' }],
    ['an unparseable string', 'not-a-date'],
  ])('returns null for %s', (_label, input) => {
    expect(normalizeToDate(input)).toBeNull();
  });
});

describe('the helpers built on it', () => {
  it('normalizeToISO handles the admin wire shape', () => {
    expect(normalizeToISO({ _seconds: SECONDS, _nanoseconds: 0 })).toBe(ISO);
  });

  it('normalizeToMillis handles the admin wire shape', () => {
    expect(normalizeToMillis({ _seconds: SECONDS, _nanoseconds: 0 })).toBe(MS);
  });

  it('normalizeToMillis returns 0 for an unreadable value', () => {
    expect(normalizeToMillis({ foo: 'bar' })).toBe(0);
  });

  it('fieldToISO reads the admin wire shape off a document', () => {
    expect(fieldToISO({ createdAt: { _seconds: SECONDS, _nanoseconds: 0 } }, 'createdAt')).toBe(ISO);
  });

  it('fieldToISO falls back when the field is unreadable', () => {
    expect(fieldToISO({ createdAt: null }, 'createdAt', 'fallback')).toBe('fallback');
  });
});

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
