/**
 * @fileoverview Άγκυρες ορθογραφίας των ονομάτων εμφάνισης — ADR-893.
 *
 * Κάθε περίπτωση εδώ είναι **μετρημένη** στις πηγές (ν. 3852/2010 σε OCR, Wikidata), όχι επινοημένη.
 */

import {
  cleanOcrText,
  isMonotonicWord,
  sameWrittenWords,
  syllableCount,
  transferWriting,
} from '../greek-orthography';

describe('syllableCount — φωνηεντικοί πυρήνες με τις δίφθογγους', () => {
  it.each([
    ['Κω', 1],
    ['Αθηναίων', 4],
    ['Αίγινας', 3], // «αί» μένει δίφθογγος — ο τόνος στο 2ο φωνήεν δεν τη σπάει
    ['Χαϊδαρίου', 5], // τα διαλυτικά τη σπάνε
    ['Μάιος', 3], // ο τόνος στο 1ο φωνήεν τη σπάει
    ['Ευόσμου', 3],
  ])('%s → %i', (word, count) => {
    expect(syllableCount(word)).toBe(count);
  });
});

describe('isMonotonicWord — ο κανόνας που κόβει τον χαμένο τόνο του OCR', () => {
  it.each(['Αθηναίων', 'Κω', 'Χαϊδαρίου', 'Ίος', 'και', 'Άργους'])('δεκτό: %s', (word) => {
    expect(isMonotonicWord(word)).toBe(true);
  });

  it.each([
    ['Ακτιου', 'πολυσύλλαβη χωρίς τόνο — μετρημένο στη Βικιθήκη'],
    ['Μενελαϊδας', 'διαλυτικά χωρίς τόνο — μετρημένο στη Βικιθήκη'],
    ['Αθήναίων', 'δύο τόνοι'],
    ['ΒΕΡΟΙΑΣ', 'κεφαλαία ετικέτα του Wikidata'],
    ['ΒΕΡΟΊΑΣ', 'κεφαλαία με τόνο'],
    ['Φρέ', 'μονοσύλλαβη με τόνο — ekloges.ypes.gr· ο Δήμος Αποκορώνου γράφει «Φρε»'],
  ])('απορρίπτεται: %s (%s)', (word) => {
    expect(isMonotonicWord(word)).toBe(false);
  });
});

describe('sameWrittenWords — ίδιο όνομα χωρίς τόνους, πεζοκεφαλαία και στίξη', () => {
  it('η στίξη δεν μετρά, οι λέξεις μετρούν', () => {
    expect(sameWrittenWords('ΔΙΟΥ-ΟΛΥΜΠΟΥ', 'Δίου - Ολύμπου')).toBe(true);
    expect(sameWrittenWords('ΙΕΡΑΣ ΠΟΛΗΣ ΜΕΣΟΛΟΓΓΙΟΥ', 'Ιεράς Πόλεως Μεσολογγίου')).toBe(false);
    expect(sameWrittenWords('ΝΕΑΣ ΣΜΥΡΝΗΣ', 'Σμύρνης')).toBe(false);
  });
});

describe('transferWriting — παίρνει τη γραφή, κρατά τη στίξη του επίσημου ονόματος', () => {
  it('«ΔΙΟΥ-ΟΛΥΜΠΟΥ» + «Δίου - Ολύμπου» ⇒ «Δίου-Ολύμπου» (η παύλα του μητρώου μένει)', () => {
    expect(transferWriting('ΔΙΟΥ-ΟΛΥΜΠΟΥ', 'Δίου - Ολύμπου')).toEqual({ ok: true, text: 'Δίου-Ολύμπου' });
  });

  it('το «και» μένει πεζό, το «ΆΡΓΟΥΣ» του μητρώου παίρνει τη γραφή του υποψηφίου', () => {
    expect(transferWriting('ΑΝΑΤΟΛΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ ΚΑΙ ΘΡΑΚΗΣ', 'Ανατολικής Μακεδονίας και Θράκης')).toEqual({
      ok: true,
      text: 'Ανατολικής Μακεδονίας και Θράκης',
    });
    expect(transferWriting('ΆΡΓΟΥΣ - ΜΥΚΗΝΩΝ', 'Άργους – Μυκηνών')).toEqual({ ok: true, text: 'Άργους - Μυκηνών' });
  });

  it('αρνείται άλλο όνομα και αρνείται χαμένο τόνο — με τον λόγο', () => {
    expect(transferWriting('ΣΤΑΓΕΙΡΩΝ ΑΚΑΝΘΟΥ', 'Σταγίρων Ακάνθου')).toEqual({ ok: false, reason: 'different-words' });
    expect(transferWriting('ΑΚΤΙΟΥ ΒΟΝΙΤΣΑΣ', 'Ακτιου Βόνιτσας')).toEqual({ ok: false, reason: 'not-monotonic' });
  });
});

describe('cleanOcrText — ό,τι χάλασε η σάρωση του ΦΕΚ', () => {
  it('µ (micro) → μ · ∆ (τελεστής) → Δ · λατινικά ομοιόγλυφα μέσα σε ελληνική λέξη', () => {
    expect(cleanOcrText('Αµφιλοχίας')).toBe('Αμφιλοχίας');
    expect(cleanOcrText('ΑΡΓΟΛΙ∆ΟΣ')).toBe('ΑΡΓΟΛΙΔΟΣ');
    expect(cleanOcrText('Nότιας Κυνουρίας')).toBe('Νότιας Κυνουρίας');
  });
});
