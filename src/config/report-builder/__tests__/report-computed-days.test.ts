/**
 * report-computed-days — the ONE rounding policy of report-builder day columns (N.0.2, 2026-10-23).
 */

import { docAgeDays, docDaysPast } from '../report-computed-days';

const DAY = 86_400_000;
const isoDaysAgo = (days: number): string => new Date(Date.now() - days * DAY).toISOString();

describe('docDaysPast', () => {
  it('is signed: past positive, future negative', () => {
    expect(docDaysPast({ dueDate: isoDaysAgo(10) }, 'dueDate')).toBe(10);
    expect(docDaysPast({ dueDate: isoDaysAgo(-5) }, 'dueDate')).toBe(-5);
  });

  it('rounds to the nearest day by default and floors on request', () => {
    const doc = { at: isoDaysAgo(2.6) };
    expect(docDaysPast(doc, 'at')).toBe(3);
    expect(docDaysPast(doc, 'at', 'floor')).toBe(2);
  });

  it('answers null for an absent or unreadable date (never NaN)', () => {
    expect(docDaysPast({}, 'dueDate')).toBeNull();
    expect(docDaysPast({ dueDate: '' }, 'dueDate')).toBeNull();
    expect(docDaysPast({ dueDate: 'not a date' }, 'dueDate')).toBeNull();
  });

  it('follows a fallback chain to the first present field', () => {
    expect(docDaysPast({ valueDate: isoDaysAgo(4) }, ['transactionDate', 'valueDate'])).toBe(4);
    expect(docDaysPast({ transactionDate: isoDaysAgo(1), valueDate: isoDaysAgo(4) }, ['transactionDate', 'valueDate'])).toBe(1);
  });
});

describe('docAgeDays', () => {
  it('never goes negative: a future date is age 0', () => {
    expect(docAgeDays({ createdAt: isoDaysAgo(-3) }, 'createdAt')).toBe(0);
    expect(docAgeDays({ createdAt: isoDaysAgo(7) }, 'createdAt')).toBe(7);
  });

  it('keeps null for an absent date', () => {
    expect(docAgeDays({}, 'createdAt')).toBeNull();
  });
});
