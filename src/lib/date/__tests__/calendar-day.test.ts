/**
 * 📅 ADR-919 — άγκυρες του **ενός** κριτή «υπάρχει αυτή η ημέρα;».
 *
 * Ο κανόνας που φυλάνε: μια ημέρα που δεν υπάρχει **απορρίπτεται** — δεν ψαλιδίζεται, δεν κυλά στον
 * επόμενο μήνα, δεν περνά επειδή «μοιάζει» με ημέρα.
 */

import { z } from 'zod';

import {
  calendarDayExists,
  formatCalendarDay,
  hasCalendarDayShape,
  isCalendarDay,
  parseCalendarDay,
} from '../calendar-day';
import { calendarDaySchema } from '../calendar-day-schema';

/** Οι άγκυρες της εκκρεμότητας — μία λίστα, για κάθε είσοδο του κριτή. */
const ACCEPTED = ['2027-02-28', '2028-02-29', '2000-02-29', '2027-12-31', '2027-01-01', '0099-01-01', '0000-02-29', '9999-12-31'];
const REJECTED = [
  '2027-02-30', // ο λόγος ύπαρξης του αρχείου
  '2027-02-29', // μη δίσεκτο
  '1900-02-29', // αιώνας, όχι ανά 400
  '2027-04-31',
  '2027-13-01',
  '2027-00-10',
  '2027-01-00',
  '2027-9-1',
  '27-09-01',
  '2027-09-01T00:00:00Z', // στιγμή, όχι ημέρα
  '2027-09-01 ',
  ' 2027-09-01',
  '2027/09/01',
  '',
];

describe('isCalendarDay', () => {
  it.each(ACCEPTED)('«%s» υπάρχει', (value) => {
    expect(isCalendarDay(value)).toBe(true);
  });

  it.each(REJECTED)('«%s» δεν είναι υπαρκτή ημέρα', (value) => {
    expect(isCalendarDay(value)).toBe(false);
  });

  it('μη συμβολοσειρές ⇒ false, ποτέ σφάλμα', () => {
    for (const value of [null, undefined, 20270228, new Date('2027-02-28'), {}, []]) {
      expect(isCalendarDay(value)).toBe(false);
    }
  });
});

describe('parseCalendarDay', () => {
  it('δίνει συνιστώσες με μήνα 1-based', () => {
    expect(parseCalendarDay('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
  });

  /** Η παγίδα του `Date.UTC(99, …)` ⇒ 1999: το ISO έτος 0099 είναι το 99. */
  it('δεν διαβάζει τα διψήφια έτη ως 19xx', () => {
    expect(parseCalendarDay('0099-01-01')).toEqual({ year: 99, month: 1, day: 1 });
    expect(parseCalendarDay('0000-02-29')).toEqual({ year: 0, month: 2, day: 29 });
  });

  it('ανύπαρκτη ημέρα ⇒ null, ΠΟΤΕ κυλισμένη στον Μάρτιο', () => {
    expect(parseCalendarDay('2027-02-30')).toBeNull();
  });
});

describe('calendarDayExists', () => {
  it('κρίνει συνιστώσες από άλλες μορφές με τον ίδιο κανόνα', () => {
    expect(calendarDayExists(2028, 2, 29)).toBe(true);
    expect(calendarDayExists(2027, 2, 29)).toBe(false);
    expect(calendarDayExists(2027, 13, 1)).toBe(false);
    expect(calendarDayExists(2027, 1, 0)).toBe(false);
  });

  it('μη ακέραιες συνιστώσες ⇒ false', () => {
    expect(calendarDayExists(2027, 1.5, 1)).toBe(false);
    expect(calendarDayExists(Number.NaN, 1, 1)).toBe(false);
  });
});

describe('hasCalendarDayShape', () => {
  it('σχήμα χωρίς κρίση ύπαρξης — για να ξεχωρίσει «ημέρα» από «στιγμή»', () => {
    expect(hasCalendarDayShape('2027-02-30')).toBe(true);
    expect(hasCalendarDayShape('2027-02-28T10:00:00Z')).toBe(false);
  });
});

describe('formatCalendarDay', () => {
  it('μηδενικά μπροστά, και στο έτος', () => {
    expect(formatCalendarDay(2027, 9, 3)).toBe('2027-09-03');
    expect(formatCalendarDay(99, 1, 1)).toBe('0099-01-01');
  });

  it('είναι το αντίστροφο του parseCalendarDay', () => {
    for (const value of ACCEPTED) {
      const day = parseCalendarDay(value);
      expect(day).not.toBeNull();
      expect(formatCalendarDay(day!.year, day!.month, day!.day)).toBe(value);
    }
  });
});

describe('calendarDaySchema', () => {
  it.each(ACCEPTED)('«%s» περνά', (value) => {
    expect(calendarDaySchema.safeParse(value).success).toBe(true);
  });

  it.each(REJECTED)('«%s» απορρίπτεται', (value) => {
    expect(calendarDaySchema.safeParse(value).success).toBe(false);
  });

  /** Ο λόγος που δεν χρειάζεται δεύτερος κανόνας: το `z.string().date()` απαντά το ίδιο σε κάθε άγκυρα. */
  it('συμφωνεί με το z.string().date() του zod σε κάθε άγκυρα', () => {
    const zodDate = z.string().date();
    for (const value of [...ACCEPTED, ...REJECTED]) {
      expect(calendarDaySchema.safeParse(value).success).toBe(zodDate.safeParse(value).success);
    }
  });
});
