/**
 * ADR-739 §49 — **η γέφυρα**, στα σημεία που δεν φαίνονται από πάνω: αντιγραφή ορισμάτων,
 * σχήμα ορθογωνίου, χαρτογράφηση σφαλμάτων, σειριακή ημερομηνία και θερινή ώρα.
 *
 * Καθεμιά από αυτές τις δοκιμές αντιστοιχεί σε **μετρημένη** συμπεριφορά της 4.6.1, όχι σε
 * υπόθεση. Αν κάποια κοκκινίσει μετά από αναβάθμιση, η βιβλιοθήκη άλλαξε σύμβαση.
 */

import {
  excelSerialFromDate,
  fromNativeResult,
  toNativeArguments,
} from '../formula/library/formula-library-bridge';
import type { TableFormulaArgument } from '../formula/table-formula-value';

describe('ορίσματα', () => {
  const range = (values: readonly (string | number)[], rows: number, cols: number) =>
    ({ kind: 'list', values, rows, cols }) as const satisfies TableFormulaArgument;

  it('🔴 ο πίνακας ΑΝΤΙΓΡΑΦΕΤΑΙ — η βιβλιοθήκη μεταλλάσσει τα ορίσματά της', () => {
    const argument = range([1, 2, 3], 3, 1);
    const [first] = toNativeArguments([argument], 'flat');
    (first as unknown[]).push(99);
    // Χωρίς αντίγραφο, το `99` θα είχε προσαρτηθεί στην ίδια λίστα που κρατά ο αξιολογητής.
    expect(argument.values).toEqual([1, 2, 3]);
  });

  it('το επίπεδο σχήμα δίνει έναν πίνακα τιμών', () => {
    expect(toNativeArguments([range([1, 2, 3, 4], 2, 2)], 'flat')).toEqual([[1, 2, 3, 4]]);
  });

  it('το σχήμα «grid» αναδιπλώνει σε γραμμές × στήλες', () => {
    expect(toNativeArguments([range([1, 2, 3, 4], 2, 2)], 'grid')).toEqual([
      [
        [1, 2],
        [3, 4],
      ],
    ]);
  });

  it('ασυμφωνία σχήματος ⇒ μία γραμμή, χωρίς επινοημένο ορθογώνιο', () => {
    expect(toNativeArguments([range([1, 2, 3], 5, 5)], 'grid')).toEqual([[[1, 2, 3]]]);
  });

  it('🔑 το ελληνικό δεκαδικό γίνεται αριθμός, το κείμενο μένει κείμενο', () => {
    const args: readonly TableFormulaArgument[] = [
      { kind: 'value', value: '1.200,50' },
      { kind: 'value', value: 'Δοκός 12' },
      { kind: 'value', value: '>15' },
      { kind: 'value', value: '' },
      range(['2,5', 'χάλυβας'], 2, 1),
    ];
    expect(toNativeArguments(args, 'flat')).toEqual([
      1200.5,
      'Δοκός 12',
      '>15',
      '',
      [2.5, 'χάλυβας'],
    ]);
  });
});

describe('αποτελέσματα', () => {
  it.each([
    ['#DIV/0!', '#DIV/0!'],
    ['#VALUE!', '#VALUE!'],
    ['#REF!', '#REF!'],
    ['#NAME?', '#NAME?'],
    ['#NUM!', '#NUM!'],
    ['#N/A', '#N/A'],
    ['#NULL!', '#NULL!'],
    ['#CALC!', '#CALC!'],
    // Μεταβατική κατάσταση και μη-κωδικός του Excel: δεν επιτρέπεται να γραφτούν σε παραδοτέο.
    ['#GETTING_DATA', '#VALUE!'],
    ['#ERROR!', '#VALUE!'],
    ['κάτι εντελώς άλλο', '#VALUE!'],
  ])('το σφάλμα «%s» γίνεται «%s»', (message, expected) => {
    expect(fromNativeResult(new Error(message))).toBe(expected);
  });

  it.each([
    [42, 42],
    ['κείμενο', 'κείμενο'],
    [true, true],
  ])('η τιμή %s περνά αυτούσια', (input, expected) => {
    expect(fromNativeResult(input)).toBe(expected);
  });

  it('το μη πεπερασμένο γίνεται #NUM!', () => {
    expect(fromNativeResult(Number.POSITIVE_INFINITY)).toBe('#NUM!');
    expect(fromNativeResult(Number.NaN)).toBe('#NUM!');
  });

  it('ο πίνακας γίνεται #VALUE! — το κελί κρατά ΜΙΑ τιμή (δίχτυ ασφαλείας)', () => {
    expect(fromNativeResult([1, 2, 3])).toBe('#VALUE!');
  });

  it('το «τίποτα» γίνεται #VALUE!, όχι κενό που μοιάζει με αποτέλεσμα', () => {
    expect(fromNativeResult(undefined)).toBe('#VALUE!');
    expect(fromNativeResult(null)).toBe('#VALUE!');
  });
});

describe('🔑 σειριακή ημερομηνία Excel', () => {
  it.each([
    [new Date(2026, 7, 5), 46239],
    [new Date(2026, 0, 1), 46023],
    [new Date(1900, 2, 1), 61],
  ])('%s → %s', (date, serial) => {
    expect(excelSerialFromDate(date)).toBe(serial);
  });

  it('η ώρα γίνεται κλάσμα της μέρας', () => {
    expect(excelSerialFromDate(new Date(2026, 7, 5, 12, 0, 0))).toBe(46239.5);
  });

  it('🔴 η αλλαγή θερινής ώρας ΔΕΝ μετακινεί την ημερομηνία', () => {
    // Ωμή αφαίρεση χιλιοστών θα έδινε 46168,958 για την επομένη της αλλαγής (Ελλάδα, 29/3/2026)
    // — δηλαδή προηγούμενη μέρα μετά τη στρογγυλοποίηση, δύο φορές τον χρόνο.
    for (let day = 27; day <= 31; day += 1) {
      const serial = excelSerialFromDate(new Date(2026, 2, day));
      expect(Number.isInteger(serial)).toBe(true);
    }
    expect(excelSerialFromDate(new Date(2026, 2, 30)) - excelSerialFromDate(new Date(2026, 2, 29)))
      .toBe(1);
  });

  it('η άκυρη ημερομηνία γίνεται #VALUE!, όχι NaN', () => {
    expect(fromNativeResult(new Date(Number.NaN))).toBe('#VALUE!');
  });
});
