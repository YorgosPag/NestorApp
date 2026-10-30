/**
 * Άγκυρες «τελευταία ημέρα μήνα/τριμήνου» των προεπιλογών αναφορών — από το SSoT `daysInMonth` (ADR-828 §1),
 * όχι από τοπικό `Date(y, m + 1, 0)`. Φεβρουάριος δίσεκτου/μη · Δεκέμβριος · αλλαγή έτους.
 * Το «τώρα» σταθεροποιείται στο μεσημέρι UTC ώστε η ημέρα να είναι ίδια σε κάθε ζώνη του runner.
 */

import { resolveReportPeriods, validateDateFilter } from '../report-date-utils';

describe('report-date-utils — «τώρα» = ημέρα Αθήνας, μετατοπίσεις ψαλιδισμένες', () => {
  it('30/11 23:30Z = 1η Δεκεμβρίου στην Ελλάδα ⇒ this_month είναι ο Δεκέμβριος (όχι ο Νοέμβριος του UTC)', () => {
    const periods = resolveReportPeriods({ preset: 'this_month' }, new Date('2026-11-30T23:30:00.000Z'));
    expect(periods.current).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(periods.previousPeriod).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });

  it('ytd: έως ΣΗΜΕΡΑ στην Αθήνα', () => {
    const periods = resolveReportPeriods({ preset: 'ytd' }, new Date('2026-12-31T22:30:00.000Z'));
    expect(periods.current).toEqual({ from: '2027-01-01', to: '2027-01-01' });
  });

  it('σύγκριση έτους του Φεβρουαρίου 2028 ⇒ 28/2/2027, ποτέ η ανύπαρκτη 29/2/2027', () => {
    const periods = resolveReportPeriods({ preset: 'this_month' }, new Date('2028-02-15T12:00:00.000Z'));
    expect(periods.yearOverYear).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });

  it('προηγούμενο τρίμηνο του Q1 ⇒ Q4 του προηγούμενου έτους', () => {
    const periods = resolveReportPeriods({ preset: 'this_quarter' }, new Date('2027-02-10T12:00:00.000Z'));
    expect(periods.previousPeriod).toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });
});

describe('validateDateFilter — custom', () => {
  it.each([
    [{ preset: 'custom' as const, customFrom: '2026-02-30', customTo: '2026-03-31' }, 'existing calendar days'],
    [{ preset: 'custom' as const, customFrom: '2026-01-01T00:00:00Z', customTo: '2026-03-31' }, 'existing calendar days'],
    [{ preset: 'custom' as const, customFrom: '2026-04-01', customTo: '2026-03-31' }, 'before'],
    [{ preset: 'custom' as const, customFrom: '2021-01-01', customTo: '2026-01-02' }, '5 years'],
  ])('απορρίπτει %o', (filter, message) => {
    expect(validateDateFilter(filter)).toContain(message);
  });

  it('δέχεται ακριβώς 5 ημερολογιακά έτη', () => {
    expect(validateDateFilter({ preset: 'custom', customFrom: '2021-01-01', customTo: '2026-01-01' })).toBeNull();
  });
});

function at(iso: string): void {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(iso));
}

afterEach(() => {
  jest.useRealTimers();
});

describe('report-date-utils — τέλος μήνα/τριμήνου', () => {
  it('this_month σε Φεβρουάριο δίσεκτου ⇒ 29/2', () => {
    at('2028-02-15T12:00:00.000Z');
    expect(resolveReportPeriods({ preset: 'this_month' }).current).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('this_month σε Φεβρουάριο μη δίσεκτου ⇒ 28/2', () => {
    at('2027-02-15T12:00:00.000Z');
    expect(resolveReportPeriods({ preset: 'this_month' }).current).toEqual({ from: '2027-02-01', to: '2027-02-28' });
  });

  it('last_month τον Ιανουάριο ⇒ ο Δεκέμβριος του προηγούμενου έτους', () => {
    at('2027-01-10T12:00:00.000Z');
    expect(resolveReportPeriods({ preset: 'last_month' }).current).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it.each([
    ['2026-02-15T12:00:00.000Z', { from: '2026-01-01', to: '2026-03-31' }],
    ['2026-05-15T12:00:00.000Z', { from: '2026-04-01', to: '2026-06-30' }],
    ['2026-11-15T12:00:00.000Z', { from: '2026-10-01', to: '2026-12-31' }],
  ])('this_quarter στις %s', (now, expected) => {
    at(now);
    expect(resolveReportPeriods({ preset: 'this_quarter' }).current).toEqual(expected);
  });
});
