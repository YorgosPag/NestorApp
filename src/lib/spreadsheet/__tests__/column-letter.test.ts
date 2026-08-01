/**
 * SSoT `columnLetter` / `columnIndexFromLetter` — bijective base-26.
 *
 * Κάθε προσδοκία εδώ είναι **προδιαγραφή φύλλου υπολογισμού**, όχι αποτύπωμα υλοποίησης:
 * οι τιμές `26 → AA`, `701 → ZZ`, `702 → AAA` είναι ακριβώς οι στήλες που δείχνει το Excel.
 *
 * Ο λόγος που υπάρχει η δεύτερη ομάδα (`ZZ` και πάνω) είναι μετρημένος: οι **τρεις**
 * υλοποιήσεις του `systems/guides/` που δεν ενοποιήθηκαν εδώ σπάνε ακριβώς εκεί, γιατί
 * χειρίζονται μόνο δύο γράμματα. Το test είναι η απόδειξη ότι αυτή είναι διαφορετική.
 */

import { columnIndexFromLetter, columnLetter } from '../column-letter';

describe('columnLetter — δείκτης σε γράμμα', () => {
  it.each([
    [0, 'A'],
    [1, 'B'],
    [25, 'Z'],
  ])('μονό γράμμα: %i → %s', (index, expected) => {
    expect(columnLetter(index)).toBe(expected);
  });

  it.each([
    [26, 'AA'],
    [27, 'AB'],
    [51, 'AZ'],
    [52, 'BA'],
    [701, 'ZZ'],
  ])('δεύτερο γράμμα — ΔΕΝ υπάρχει ψηφίο μηδέν: %i → %s', (index, expected) => {
    expect(columnLetter(index)).toBe(expected);
  });

  it('περνά πέρα από το ZZ, εκεί που σπάνε οι ετικέτες κανάβου: 702 → AAA', () => {
    expect(columnLetter(702)).toBe('AAA');
  });

  it.each([-1, 1.5, NaN])('μη έγκυρος δείκτης ⇒ κενό, ποτέ στρογγυλοποίηση: %p', (index) => {
    // Μια σιωπηλή στρογγυλοποίηση θα έδινε **λάθος αναφορά** σε τύπο — σφάλμα τιμής.
    expect(columnLetter(index)).toBe('');
  });
});

describe('columnIndexFromLetter — γράμμα σε δείκτη', () => {
  it.each([
    ['A', 0],
    ['Z', 25],
    ['AA', 26],
    ['ZZ', 701],
    ['AAA', 702],
  ])('%s → %i', (letters, expected) => {
    expect(columnIndexFromLetter(letters)).toBe(expected);
  });

  it('δέχεται πεζά — κανένα φύλλο υπολογισμού δεν απαιτεί Caps Lock', () => {
    expect(columnIndexFromLetter('aa')).toBe(26);
    expect(columnIndexFromLetter('aB')).toBe(27);
  });

  it.each(['', '1', 'A1', 'Α', ' A '])('απορρίπτει ό,τι δεν είναι γράμμα στήλης: %p', (bad) => {
    // Το τέταρτο είναι **ελληνικό Άλφα**: μοιάζει, δεν είναι. Μια αναφορά που το δεχόταν
    // θα έδειχνε σε στήλη που δεν υπάρχει.
    expect(columnIndexFromLetter(bad)).toBeNull();
  });

  it('κλειστός κύκλος για τις πρώτες 1.000 στήλες', () => {
    for (let i = 0; i < 1000; i++) {
      expect(columnIndexFromLetter(columnLetter(i))).toBe(i);
    }
  });
});
