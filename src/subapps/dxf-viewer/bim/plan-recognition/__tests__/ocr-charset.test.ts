/**
 * ADR-929 §6.18 — **ο αναγνώστης δεν γράφει ποτέ ιδεόγραμμα σε κάτοψη.**
 *
 * Ζωντανά (παραγωγή `81f1425`, ΤΕΣΤ2 = διανυσματικό PDF): τα άκρα των γραμμών διάστασης διαβάστηκαν «下» και «皇». Η άγκυρα
 * ρωτά την αποκωδικοποίηση ευθέως: όταν η πιθανότερη κλάση είναι ιδεόγραμμα, κερδίζει η πιθανότερη **επιτρεπτή**, με την
 * **αρχική** της πιθανότητα (χαμηλή ⇒ «ύποπτη»), και ποτέ δεν αλλάζει ανάγνωση που ήταν ήδη έγκυρη.
 */

import { isPlanTextChar, planTextClassMask } from '../ocr/ocr-charset';
import { decodeCtc, type RecognizerOutput } from '../ocr/ocr-rec-decode';

/** Έξοδος αναγνώστη από πίνακα πιθανοτήτων ανά βήμα. */
function output(rows: readonly (readonly number[])[]): RecognizerOutput {
  return { data: Float32Array.from(rows.flat()), steps: rows.length, classes: rows[0].length };
}

describe('isPlanTextChar — γραφές κάτοψης', () => {
  it.each(['A', 'z', 'Ω', 'ά', 'μ', '0', '9', ',', '.', '-', '²', '°', '±', 'Ø', '×', 'µ', ' ', '/'])('δέχεται «%s»', (ch) => {
    expect(isPlanTextChar(ch)).toBe(true);
  });

  it.each(['下', '皇', '州', '山', 'あ', 'ア', '한', '２', '，', '　', 'Ж'])('απορρίπτει «%s»', (ch) => {
    expect(isPlanTextChar(ch)).toBe(false);
  });
});

describe('planTextClassMask', () => {
  it('το blank (κλάση 0) είναι πάντα επιτρεπτό, και η μάσκα υπολογίζεται μία φορά ανά λεξικό', () => {
    const classes = ['', '下', 'T', ' '];
    const mask = planTextClassMask(classes);
    expect(Array.from(mask)).toEqual([1, 0, 1, 1]);
    expect(planTextClassMask(classes)).toBe(mask);
  });
});

describe('decodeCtc — μάσκα πριν την επιλογή', () => {
  const classes = ['', '下', 'T', '2', ' '];

  it('ιδεόγραμμα πρώτο ⇒ κερδίζει η πιθανότερη επιτρεπτή, με την ΑΡΧΙΚΗ πιθανότητά της', () => {
    const read = decodeCtc(output([[0.1, 0.6, 0.3, 0, 0]]), classes);
    expect(read.text).toBe('T');
    expect(read.score).toBeCloseTo(0.3);
  });

  it('ιδεόγραμμα πρώτο και blank δεύτερο ⇒ τίποτα (κανένα σημάδι δεν γίνεται γράμμα)', () => {
    expect(decodeCtc(output([[0.35, 0.6, 0.05, 0, 0]]), classes)).toEqual({ text: '', score: 0 });
  });

  it('έγκυρη ανάγνωση μένει ίδια', () => {
    const read = decodeCtc(output([[0, 0, 0, 0.9, 0.1], [0.9, 0.1, 0, 0, 0], [0, 0, 0.8, 0.2, 0]]), classes);
    expect(read.text).toBe('2T');
    expect(read.score).toBeCloseTo(0.85);
  });
});
