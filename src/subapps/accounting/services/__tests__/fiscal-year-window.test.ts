/**
 * Παράθυρο αυτόματου ανοίγματος χρήσης (ADR-ACC-010 §2.1.1 Φ9) — `[max(τρέχον − 1, έτος έναρξης), τρέχον + 1]`.
 */

import { autoOpenableFiscalYears, fiscalYearOfDay, isAutoOpenableFiscalYear } from '../fiscal-year-window';

describe('fiscal-year-window', () => {
  it('χωρίς έναρξη εργασιών ⇒ [τρέχον − 1, τρέχον + 1]', () => {
    expect(autoOpenableFiscalYears('2026-11-07', null)).toEqual({ from: 2025, to: 2027 });
  });

  it('έναρξη μέσα στο παράθυρο ⇒ το κάτω όριο ανεβαίνει στο έτος έναρξης', () => {
    expect(autoOpenableFiscalYears('2026-01-10', { date: '2026-03-01' })).toEqual({ from: 2026, to: 2027 });
  });

  it('παλιά έναρξη ⇒ ποτέ πριν το τρέχον − 1', () => {
    expect(autoOpenableFiscalYears('2026-01-10', { date: '2010-05-01' })).toEqual({ from: 2025, to: 2027 });
  });

  it('έναρξη μετά το τρέχον + 1 ⇒ καμία χρήση', () => {
    expect(autoOpenableFiscalYears('2026-01-10', { date: '2030-01-01' })).toBeNull();
    expect(isAutoOpenableFiscalYear(2026, '2026-01-10', { date: '2030-01-01' })).toBe(false);
  });

  it.each([
    [2024, false], [2025, true], [2026, true], [2027, true], [2028, false],
  ])('%i με «σήμερα» 2026-11-07 ⇒ %s', (year, expected) => {
    expect(isAutoOpenableFiscalYear(year, '2026-11-07', null)).toBe(expected);
  });

  it('το έτος μιας λογιστικής ημέρας', () => {
    expect(fiscalYearOfDay('2026-12-31')).toBe(2026);
  });
});
