/**
 * ADR-947 §11 Δ-Φ2β.2 — ταυτοποίηση ακινήτου στο PDF: ο ΚΑΕΚ περνά ΜΟΝΟ από το `lib/geo/kaek`, η περιγραφή γίνεται όνομα
 * αρχείου με τη ΜΙΑ μεταγραφή.
 */

import {
  identificationFileSlug,
  kaekFieldState,
  resolveIdentification,
} from '../objective-value-identification';

describe('kaekFieldState', () => {
  it('κενό ⇒ empty (όχι σφάλμα — το πεδίο είναι προαιρετικό)', () => {
    expect(kaekFieldState('   ')).toEqual({ kind: 'empty' });
  });

  it('συμπαγής ή με κενά ⇒ κανονική μορφή με καθέτους', () => {
    expect(kaekFieldState('05 068 17 26 003/0/1')).toEqual({ kind: 'valid', canonical: '050681726003/0/1' });
  });

  it('κάτι που δεν είναι ΚΑΕΚ ⇒ invalid', () => {
    expect(kaekFieldState('12345')).toEqual({ kind: 'invalid' });
  });
});

describe('resolveIdentification', () => {
  it('καθαρίζει κενά και ΔΕΝ τυπώνει άκυρο ΚΑΕΚ', () => {
    expect(resolveIdentification({ description: '  Διαμέρισμα   Α2 ', kaek: 'abc' })).toEqual({ description: 'Διαμέρισμα Α2', kaek: null });
  });

  it('τίποτα δοσμένο ⇒ δύο null', () => {
    expect(resolveIdentification({ description: '', kaek: '' })).toEqual({ description: null, kaek: null });
  });
});

describe('identificationFileSlug', () => {
  it('ελληνικά ⇒ λατινικά πεζά με παύλες', () => {
    expect(identificationFileSlug({ description: 'Διαμέρισμα Α2, Εγνατίας 147', kaek: null })).toBe('diamerisma-a2-egnatias-147');
  });

  it('χωρίς περιγραφή ή μόνο σύμβολα ⇒ null', () => {
    expect(identificationFileSlug({ description: null, kaek: null })).toBeNull();
    expect(identificationFileSlug({ description: '!!!', kaek: null })).toBeNull();
  });
});
