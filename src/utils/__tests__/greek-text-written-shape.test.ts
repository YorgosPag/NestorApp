/**
 * 🔴 ADR-828 §1 — άγκυρες της **μορφής γραφής**.
 *
 * Ξεχωριστό αρχείο από το `greek-text.test.ts` για τον ίδιο λόγο που υπάρχει και το
 * `greek-text-word-sequence.test.ts`: μια ερώτηση ανά αρχείο, ώστε το κόκκινο να λέει
 * **ποια** ερώτηση απαντήθηκε λάθος.
 */

import { applyWrittenWordShape, writtenWordShape } from '../greek-text';

describe('ανάγνωση της μορφής', () => {
  it('ΙΑΝΟΥΑΡΙΟΣ: κεφαλαία, χωρίς τόνο', () => {
    expect(writtenWordShape('ΙΑΝΟΥΑΡΙΟΣ')).toEqual({ casing: 'upper', accented: false });
  });

  it('Ιανουάριος: Title Case, με τόνο', () => {
    expect(writtenWordShape('Ιανουάριος')).toEqual({ casing: 'title', accented: true });
  });

  it('ιανουάριος: πεζά, με τόνο', () => {
    expect(writtenWordShape('ιανουάριος')).toEqual({ casing: 'lower', accented: true });
  });

  it('ιανουαριος: πεζά, χωρίς τόνο', () => {
    expect(writtenWordShape('ιανουαριος')).toEqual({ casing: 'lower', accented: false });
  });

  it('η συντομογραφία σε κεφαλαία διαβάζεται ως κεφαλαία', () => {
    expect(writtenWordShape('ΙΑΝ').casing).toBe('upper');
    expect(writtenWordShape('Ιαν').casing).toBe('title');
  });

  it('ανάμεικτη γραφή δηλώνεται ανάμεικτη — δεν μαντεύεται', () => {
    expect(writtenWordShape('ΙΑΝουάριος').casing).toBe('mixed');
    expect(writtenWordShape('iPhone').casing).toBe('mixed');
  });

  it('κείμενο χωρίς γράμματα είναι ανάμεικτο, όχι κεφαλαίο', () => {
    expect(writtenWordShape('123').casing).toBe('mixed');
  });
});

describe('εφαρμογή της μορφής', () => {
  /**
   * 🔴 ΤΟ ΚΕΝΤΡΙΚΟ TEST ΟΛΟΥ ΤΟΥ ΑΡΧΕΙΟΥ. Η δεύτερη προσδοκία **είναι** το test: το σκέτο
   * `.toUpperCase()` δίνει `ΦΕΒΡΟΥΆΡΙΟΣ` (μετρημένο σε node v20), δηλαδή κεφαλαίο με τόνο,
   * που δεν υπάρχει στην ελληνική ορθογραφία. Αν κάποιος «απλοποιήσει» τη σειρά των δύο
   * πράξεων, εδώ κοκκινίζει.
   */
  it('τόνοι φεύγουν ΠΡΙΝ τα κεφαλαία', () => {
    const upper = applyWrittenWordShape('Φεβρουάριος', { casing: 'upper', accented: false });
    expect(upper).toBe('ΦΕΒΡΟΥΑΡΙΟΣ');
    expect(upper).not.toBe('ΦΕΒΡΟΥΆΡΙΟΣ');
  });

  it('τα κεφαλαία ρίχνουν τον τόνο ακόμη κι όταν ο σπόρος τον είχε', () => {
    expect(applyWrittenWordShape('Φεβρουάριος', { casing: 'upper', accented: true })).toBe(
      'ΦΕΒΡΟΥΑΡΙΟΣ',
    );
  });

  it('Title Case με τόνο κρατά τον τόνο', () => {
    expect(applyWrittenWordShape('Φεβρουάριος', { casing: 'title', accented: true })).toBe(
      'Φεβρουάριος',
    );
  });

  it('σπόρος γραμμένος χωρίς τόνους δίνει συνέχεια χωρίς τόνους', () => {
    expect(applyWrittenWordShape('Φεβρουάριος', { casing: 'title', accented: false })).toBe(
      'Φεβρουαριος',
    );
    expect(applyWrittenWordShape('Φεβρουάριος', { casing: 'lower', accented: false })).toBe(
      'φεβρουαριος',
    );
  });

  it('πεζά με τόνο', () => {
    expect(applyWrittenWordShape('Φεβρουάριος', { casing: 'lower', accented: true })).toBe(
      'φεβρουάριος',
    );
  });

  it('ανάμεικτη μορφή αφήνει το κανονικό ΑΥΤΟΥΣΙΟ — καμία μαντεψιά', () => {
    expect(applyWrittenWordShape('Φεβρουάριος', { casing: 'mixed', accented: true })).toBe(
      'Φεβρουάριος',
    );
  });

  it('δουλεύει και στα αγγλικά', () => {
    expect(applyWrittenWordShape('February', { casing: 'upper', accented: false })).toBe(
      'FEBRUARY',
    );
    expect(applyWrittenWordShape('February', { casing: 'lower', accented: false })).toBe(
      'february',
    );
  });

  /**
   * ⚠️ Δηλωμένη απόκλιση (ADR-828): η ορθογραφία θα ήθελε `ΜΑΪΟΣ` με διαλυτικά. Η ICU-free
   * επιλογή δίνει `ΜΑΙΟΣ` — ταυτόσημο με τον πίνακα που ήδη χρησιμοποιούσε ο αναγνώστης
   * πινακίδων, άρα καμία οπισθοδρόμηση. Καρφώνεται ώστε η αλλαγή να είναι απόφαση.
   */
  it('ΔΗΛΩΜΕΝΗ ΑΠΟΚΛΙΣΗ: Μάιος σε κεφαλαία δίνει ΜΑΙΟΣ, όχι ΜΑΪΟΣ', () => {
    expect(applyWrittenWordShape('Μάιος', { casing: 'upper', accented: false })).toBe('ΜΑΙΟΣ');
  });

  /** Η στρογγυλή διαδρομή: ό,τι διάβασε η μία, το ξαναφτιάχνει η άλλη. */
  it('ανάγνωση και εφαρμογή είναι αντίστροφες για τις κανονικές μορφές', () => {
    for (const written of ['ΙΑΝΟΥΑΡΙΟΣ', 'Ιανουάριος', 'ιανουάριος', 'ιανουαριος']) {
      expect(applyWrittenWordShape('Ιανουάριος', writtenWordShape(written))).toBe(written);
    }
  });
});
