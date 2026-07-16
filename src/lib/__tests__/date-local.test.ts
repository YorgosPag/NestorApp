/**
 * date-local — ADR-218 SSoT for instant normalisation.
 *
 * Focus: `normalizeToDate` is the single funnel every other helper here goes
 * through, and it must accept every shape a Firestore instant legitimately
 * arrives in — including the two JSON-serialised ones, which have no methods.
 *
 * @see ADR-663 §4 part 5 — why the serialised shapes reach this helper at all
 */

import { normalizeToDate, normalizeToISO, normalizeToMillis, fieldToISO } from '../date-local';

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
