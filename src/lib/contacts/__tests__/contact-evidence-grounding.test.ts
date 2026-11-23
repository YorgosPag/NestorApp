/**
 * ADR-950 §8.4 — οι γειωτές που άλλαξαν μετά τον ζωντανό έλεγχο (σφραγίδα Παγώνη, 2026-11-23).
 * Κάθε περίπτωση είναι **πραγματική** ανάγνωση της AI από το `file_f6d8a0c9…`.
 */

import { contactValueKey, evidenceReadingKey, groundEvidence } from '@/lib/contacts/contact-evidence-grounding';

const CONFIDENT = 0.95;
const THRESHOLD = 0.6;

describe('Τ.Κ. — ο ΕΝΑΣ εξαγωγέας (`extractPostalCode`)', () => {
  it.each([
    ['Τ.Κ. 56334', '56334'],
    ['Τ.Κ. 563 34', '56334'],
    ['ΤΚ 56334', '56334'],
    ['546 24', '54624'],
    ['54624', '54624'],
  ])('«%s» ⇒ %s', (printed, expected) => {
    expect(groundEvidence('postalCode', printed, CONFIDENT, THRESHOLD)).toEqual({ ok: true, printed, display: expected, key: expected });
  });

  it.each(['Τ.Κ. 5633', 'Τ.Κ. 56334 και 54624', '16 56334', 'Θεσσαλονίκη'])('«%s» ⇒ δεν γειώνεται', (printed) => {
    expect(groundEvidence('postalCode', printed, CONFIDENT, THRESHOLD)).toMatchObject({ ok: false, reason: 'failed-check' });
  });
});

describe('Αριθμός μητρώου ΤΕΕ — μόνο τα ψηφία', () => {
  it.each([
    ['Μητρώου 74693', '74693'],
    ['ΑΡΙΘ. ΜΗΤΡΩΟΥ ΤΕΕ 74693', '74693'],
    ['Α.Μ. ΤΕΕ 74 693', '74693'],
    ['74693', '74693'],
  ])('«%s» ⇒ %s', (printed, expected) => {
    expect(groundEvidence('registryNumber', printed, CONFIDENT, THRESHOLD)).toMatchObject({ ok: true, display: expected, key: expected });
  });

  it('δύο χωριστοί αριθμοί ⇒ καμία επιλογή', () => {
    expect(groundEvidence('registryNumber', 'ΤΕΕ 12 / ΜΗΤΡΩΟ 345', CONFIDENT, THRESHOLD)).toMatchObject({ ok: false });
  });

  it('η επαφή κρατά σκέτο αριθμό ⇒ ίδιο κλειδί με την ανάγνωση', () => {
    expect(contactValueKey('registryNumber', '74693')).toBe('74693');
  });

  it('ο κωδικός ταυτότητας ΔΕΝ άλλαξε: τα γράμματα μένουν μέρος του κλειδιού', () => {
    expect(groundEvidence('code', 'ΑΚ 123456', CONFIDENT, THRESHOLD)).toMatchObject({ ok: true, key: 'AK123456' });
  });
});

describe('ΔΟΥ — μία αντιστοίχιση, αποσαφήνιση από τον χάρτη', () => {
  it('«Δ.Ο.Υ. Ιωνίας» χωρίς τόπο ⇒ διφορούμενο (Ιωνίας Θεσσαλονίκης · Νέας Ιωνίας) ⇒ ποτέ μαντεψιά', () => {
    expect(groundEvidence('taxOffice', 'Δ.Ο.Υ. Ιωνίας', CONFIDENT, THRESHOLD)).toMatchObject({ ok: false, reason: 'failed-check' });
  });

  it('«Δ.Ο.Υ. Ιωνίας» + ο χάρτης λέει Θεσσαλονίκη ⇒ 1317', () => {
    const grounded = groundEvidence('taxOffice', 'Δ.Ο.Υ. Ιωνίας', CONFIDENT, THRESHOLD, { places: ['Κορδελιό', 'Περιφερειακή Ενότητα Θεσσαλονίκης'] });
    expect(grounded).toMatchObject({ ok: true, key: '1317' });
  });

  it('ακριβές όνομα ⇒ η ΔΟΥ, χωρίς τόπο', () => {
    expect(groundEvidence('taxOffice', 'ΔΟΥ Νέας Ιωνίας', CONFIDENT, THRESHOLD)).toMatchObject({ ok: true, key: '1140' });
  });

  it('κωδικός καταλόγου ⇒ ο ίδιος', () => {
    expect(groundEvidence('taxOffice', '1317', CONFIDENT, THRESHOLD)).toMatchObject({ ok: true, key: '1317' });
  });
});

describe('evidenceReadingKey — η κανονική μορφή για σύγκριση δύο αναγνώσεων', () => {
  it('ίδιος αριθμός, άλλη γραφή ⇒ ίδιο κλειδί', () => {
    expect(evidenceReadingKey('phone', '2310 55 95 95')).toBe(evidenceReadingKey('phone', '2310559595'));
  });

  it('άλλο ψηφίο ⇒ άλλο κλειδί', () => {
    expect(evidenceReadingKey('phone', '2310 55 95 96')).not.toBe(evidenceReadingKey('phone', '2310 55 95 95'));
  });

  it('απουσία ⇒ null', () => {
    expect(evidenceReadingKey('phone', null)).toBeNull();
  });
});
