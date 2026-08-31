/**
 * Άγκυρες για το `lib/serialized-size` — ADR-833 Φάση 5Α.
 *
 * Η ερώτηση που φυλάνε: **«μετράμε το ίδιο νούμερο που ανεβαίνει στο δίκτυο;»**
 * Το σχήμα που έσπασε τέσσερις φορές στο repo είναι «`String.length` για bytes», και
 * είναι ύπουλο επειδή δίνει **σωστό** αποτέλεσμα σε αγγλικά και **μικρότερο** σε ελληνικά:
 * ένα όριο μετρημένο έτσι δεν μπλοκάρει ποτέ όταν πρέπει.
 */

import {
  utf8ByteLength,
  serializedByteLength,
  checkSizeFits,
} from '../serialized-size';

describe('🔴 UTF-8 ΕΝΑΝΤΙ UTF-16 — η διαφορά που πληρώθηκε ×1,45', () => {
  it('ένα ελληνικό γράμμα είναι ΔΥΟ bytes, ενώ το `.length` λέει ένα', () => {
    expect('α'.length).toBe(1);
    expect(utf8ByteLength('α')).toBe(2);
  });

  it('ένα λατινικό γράμμα είναι ΕΝΑ byte — γι΄ αυτό το λάθος περνά απαρατήρητο στα αγγλικά', () => {
    expect(utf8ByteLength('a')).toBe(1);
  });

  it('ελληνική λέξη: το `.length` υποτιμά — και ΠΑΝΤΑ προς τα κάτω', () => {
    const greek = 'Δοκός';
    expect(greek.length).toBe(5);
    expect(utf8ByteLength(greek)).toBe(10);
    expect(utf8ByteLength(greek)).toBeGreaterThan(greek.length);
  });

  it('emoji (εκτός BMP): 4 bytes UTF-8, 2 μονάδες UTF-16 — η άλλη κατεύθυνση του ίδιου λάθους', () => {
    expect('🏗'.length).toBe(2);
    expect(utf8ByteLength('🏗')).toBe(4);
  });

  it('κενό κείμενο ⇒ μηδέν bytes', () => {
    expect(utf8ByteLength('')).toBe(0);
  });
});

describe('🔑 ΤΑΥΤΟΤΗΤΑ ΜΕ ΤΗ ΔΙΑΔΡΟΜΗ ΑΠΟΘΗΚΕΥΣΗΣ', () => {
  it('δίνει ΑΚΡΙΒΩΣ ό,τι κωδικοποιεί το `saveToStorageImpl` πριν το ανέβασμα', () => {
    const scene = { entities: [{ id: 'e1', label: 'Υποστύλωμα Κ1' }], units: 'mm' };
    // Η γραμμή που όντως τρέχει στην αποθήκευση: stringify → TextEncoder → .length
    const asUploaded = new TextEncoder().encode(JSON.stringify(scene)).length;
    expect(serializedByteLength(scene)).toBe(asUploaded);
  });

  it('ΔΙΑΦΕΡΕΙ από το `JSON.stringify(...).length` όταν υπάρχουν ελληνικά', () => {
    const scene = { label: 'Πίνακας οπλισμού' };
    expect(serializedByteLength(scene)).toBeGreaterThan(JSON.stringify(scene).length);
  });
});

describe('Τιμές που το JSON δεν γράφει', () => {
  it('`undefined` ⇒ 0 bytes, όχι εξαίρεση', () => {
    expect(serializedByteLength(undefined)).toBe(0);
  });

  it('συνάρτηση ⇒ 0 bytes — δεν γράφεται, δεν κοστίζει', () => {
    expect(serializedByteLength(() => 'κάτι')).toBe(0);
  });

  it('`null` ΓΡΑΦΕΤΑΙ, άρα κοστίζει τα 4 bytes του', () => {
    expect(serializedByteLength(null)).toBe(4);
  });

  it('⚠️ Η ΠΑΓΙΔΑ: ο `Map` γίνεται `{}` σιωπηλά — 2 bytes, όσα κι αν κρατά', () => {
    const map = new Map([['r0:c0', { kind: 'text', value: 'Δοκός Δ1' }]]);
    expect(serializedByteLength(map)).toBe(2);
  });
});

describe('«Χωράει;» — ετυμηγορία ΜΕ ΑΡΙΘΜΟΥΣ, ποτέ σκέτο boolean', () => {
  it('χωράει ⇒ `overBy` μηδέν, και οι αριθμοί είναι μέσα', () => {
    expect(checkSizeFits(100, 500)).toEqual({
      fits: true,
      bytes: 100,
      limit: 500,
      overBy: 0,
    });
  });

  it('δεν χωράει ⇒ `overBy` λέει ΑΚΡΙΒΩΣ πόσο πρέπει να κοπεί', () => {
    expect(checkSizeFits(750, 500)).toEqual({
      fits: false,
      bytes: 750,
      limit: 500,
      overBy: 250,
    });
  });

  it('ακριβώς στο όριο ⇒ ΧΩΡΑΕΙ (το όριο είναι το τελευταίο αποδεκτό, όχι το πρώτο απορριπτέο)', () => {
    const verdict = checkSizeFits(500, 500);
    expect(verdict.fits).toBe(true);
    expect(verdict.overBy).toBe(0);
  });

  it('ένα byte πάνω ⇒ ΔΕΝ χωράει — το σύνορο είναι εκεί που το δηλώνει', () => {
    expect(checkSizeFits(501, 500).fits).toBe(false);
  });
});
