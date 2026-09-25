/**
 * @fileoverview Άγκυρα της ΜΙΑΣ απόστασης επεξεργασίας (ADR-883 §5.11) — Levenshtein, Damerau (OSA),
 * όριο, και απόσταση από πρόθεμα. Οι τρεις παλιές υλοποιήσεις την καλούν πλέον.
 */

import { editDistance, prefixEditDistance } from '../edit-distance';

describe('editDistance', () => {
  it.each([
    ['', '', 0],
    ['', 'abc', 3],
    ['kitten', 'sitting', 3],
    ['cat', 'cats', 1],
    ['θεσσαλονικη', 'θεσαλονικη', 1],
  ])('Levenshtein %s ↔ %s = %i', (a, b, expected) => {
    expect(editDistance(a, b)).toBe(expected);
    expect(editDistance(b, a)).toBe(expected);
  });

  it('🔑 μετάθεση: 2 λάθη στη Levenshtein, 1 στη Damerau (OSA)', () => {
    expect(editDistance('ξυλοπολη', 'ξυλοπλοη')).toBe(2);
    expect(editDistance('ξυλοπολη', 'ξυλοπλοη', { transpositions: true })).toBe(1);
  });

  it('OSA, όχι απεριόριστη Damerau: ca → abc = 3 (κάθε υποσυμβολοσειρά επεξεργάζεται μία φορά)', () => {
    expect(editDistance('ca', 'abc', { transpositions: true })).toBe(3);
  });

  it('πάνω από το όριο ⇒ max + 1, και από διαφορά μήκους και από γραμμή που ξεπέρασε', () => {
    expect(editDistance('a', 'abcdef', { max: 2 })).toBe(3);
    expect(editDistance('abcdef', 'uvwxyz', { max: 2 })).toBe(3);
    expect(editDistance('abcdef', 'abcdxf', { max: 2 })).toBe(1);
  });
});

describe('prefixEditDistance — η ερώτηση της αυτόματης συμπλήρωσης', () => {
  it('ακριβές πρόθεμα = 0 λάθη', () => {
    expect(prefixEditDistance('ξυλοπ', 'ξυλοπολεωσ', 1)).toBe(0);
  });

  it('🔑 «ξυλουπ» (βόρειο ο→ου) απέχει ΕΝΑ λάθος από την αρχή του «ξυλοπολεωσ»', () => {
    expect(prefixEditDistance('ξυλουπ', 'ξυλοπολεωσ', 1)).toBe(1);
  });

  it('η υπόλοιπη λέξη δεν μετρά ως λάθος — μετρά μόνο ό,τι γράφτηκε', () => {
    expect(prefixEditDistance('αλεξανρ', 'αλεξανδρουπολησ', 1)).toBe(1);
    expect(editDistance('αλεξανρ', 'αλεξανδρουπολησ', { max: 1 })).toBe(2);
  });

  it('`minPrefixLength`: μόνο προθέματα από εκεί και πέρα (θέμα απέναντι σε λέξη με κατάληξη ως 4)', () => {
    // «ξυλουπολ» vs «ξυλοπολεωσ»: το «ξυλοπολ» (7) είναι μέσα στο παράθυρο [10−4, 10].
    expect(prefixEditDistance('ξυλουπολ', 'ξυλοπολεωσ', 1, 6)).toBe(1);
    // …αλλά το «ξυλ» δεν είναι θέμα του «ξυλοκαστρου» — πολύ κοντό πρόθεμα για το παράθυρο.
    expect(prefixEditDistance('ξυλ', 'ξυλοκαστρου', 1, 7)).toBe(2);
  });

  it('όριο: πολύ μακριά ⇒ max + 1', () => {
    expect(prefixEditDistance('καλαματα', 'ξυλοκαστρο', 2)).toBe(3);
  });
});
