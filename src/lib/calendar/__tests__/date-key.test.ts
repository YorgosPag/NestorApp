/**
 * ADR-841 §7 Α21.21 — κλειδιά ημερολογιακής ημέρας: αριθμητική σε μεσάνυχτα UTC, ανθεκτική στην αλλαγή ώρας.
 */

import { localDateOf } from '@/lib/date-local';
import {
  addDaysToDateKey,
  calendarDateOfDateKey,
  daysBetweenDateKeys,
  isDateKey,
  isoWeekdayOfDateKey,
} from '../date-key';

describe('date-key', () => {
  it('isDateKey: μόνο ΥΠΑΡΚΤΕΣ ημέρες', () => {
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-1')).toBe(false);
    expect(isDateKey(20260201)).toBe(false);
  });

  it('🔴 +1 ημέρα πάνω από την αλλαγή ώρας (29/3/2026) δεν «κολλά» στην ίδια ημερομηνία', () => {
    expect(addDaysToDateKey('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDaysToDateKey('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToDateKey('χθες', 1)).toBeNull();
  });

  it('daysBetweenDateKeys — προς τα εμπρός και πίσω', () => {
    expect(daysBetweenDateKeys('2026-09-15', '2027-09-16')).toBe(366);
    expect(daysBetweenDateKeys('2026-09-15', '2026-09-14')).toBe(-1);
    expect(daysBetweenDateKeys('2026-09-15', 'αύριο')).toBeNull();
  });

  it('isoWeekdayOfDateKey — Δευτέρα 1 … Κυριακή 7', () => {
    expect(isoWeekdayOfDateKey('2026-09-14')).toBe(1);
    expect(isoWeekdayOfDateKey('2026-09-20')).toBe(7);
  });

  it('επιλογέας ημερομηνίας: κλειδί ⇄ τοπική Date της ΙΔΙΑΣ ημέρας', () => {
    const date = calendarDateOfDateKey('2026-12-25');
    expect(date).not.toBeNull();
    expect(localDateOf(date as Date)).toBe('2026-12-25');
    expect(calendarDateOfDateKey('2026-02-30')).toBeNull();
  });
});
