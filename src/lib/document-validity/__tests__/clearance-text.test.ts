/**
 * ⚓ ADR-915 §19 — ανάγνωση φορολογικής · ασφαλιστικής · ΕΝΦΙΑ από το κείμενο του PDF.
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | φορολογική: «λήξη = η ημερομηνία μετά το "Ισχύει έως"» (θέση αντί διασταύρωσης) | Φ1 (pdf.js) |
 * | φορολογική: χωρίς έλεγχο ολογράφως μήνα | Φ3 |
 * | ΕΦΚΑ: ανοχή 0 ημερών | Ε1 (η τυπωμένη είναι −1 ημέρα) |
 * | ΕΝΦΙΑ: γενική πτώση → ονομαστική στο `matchCalendarName` | Ν1 |
 * | αναγνώστης λείπει από το `DOCUMENT_TEXT_READERS` | Α1 |
 */

import { CLEARANCE_TEXT_READERS, readClearanceText, type ClearanceTextResult } from '../clearance-text';
import { DOCUMENT_TEXT_READERS } from '../document-facts';
import { documentKindSpec } from '@/config/document-validity/document-validity';
import { printedBoundsOf } from '../validity-bounds';
import { ENFIA_PDFJS_PAGES, INSURANCE_PDFJS, TAX_LAYOUT, TAX_PDFJS } from './clearance-text.fixture';

function readingOf(result: ClearanceTextResult) {
  if (result.kind !== 'read') throw new Error('not read');
  return result.reading;
}

describe('φορολογική ενημερότητα (ΑΑΔΕ)', () => {
  it('Φ1 σειρά pdf.js (ετικέτα ΜΕΤΑ από την τιμή) ⇒ σωστή έκδοση και λήξη', () => {
    expect(readingOf(readClearanceText([TAX_PDFJS]))).toEqual({
      kind: 'tax-clearance', reader: 'aade-tax-clearance-text', issuedOn: '2026-07-22', printedValidUntil: '2026-08-22', unread: [],
    });
  });

  it('Φ2 σειρά οπτικής διάταξης ⇒ το ίδιο αποτέλεσμα', () => {
    expect(readingOf(readClearanceText([TAX_LAYOUT]))).toMatchObject({ issuedOn: '2026-07-22', printedValidUntil: '2026-08-22' });
  });

  it('Φ3 ο ολογράφως μήνας διαφωνεί ⇒ τίποτα (ποτέ μαντεψιά)', () => {
    const tampered = TAX_PDFJS.replace('ΑΥΓΟΥΣΤΟΥ', 'ΣΕΠΤΕΜΒΡΙΟΥ');
    expect(readingOf(readClearanceText([tampered]))).toMatchObject({ issuedOn: null, printedValidUntil: null, unread: ['issuedOn', 'printedValidUntil'] });
  });

  it('Φ4 διάρκεια που δεν ταιριάζει στο ζεύγος («2 μήνες») ⇒ τίποτα', () => {
    expect(readingOf(readClearanceText([TAX_PDFJS.replace('ισχύει για 1 μήνα', 'ισχύει για 2 μήνες')]))).toMatchObject({ issuedOn: null });
  });

  it('Φ5 η ανάγνωση είναι μέσα στο νόμιμο εύρος του κανόνα (1–2 μήνες)', () => {
    expect(printedBoundsOf(documentKindSpec('tax-clearance').rule, '2026-07-22')).toEqual({ floor: '2026-08-22', ceiling: '2026-09-22' });
  });
});

describe('ασφαλιστική ενημερότητα (e-ΕΦΚΑ)', () => {
  it('Ε1 «6 ΜΗΝΕΣ … Μέχρι 20/01/2027» ⇒ έκδοση 21/07/2026 (η τυπωμένη είναι μία ημέρα πριν από το +6 μήνες)', () => {
    expect(readingOf(readClearanceText([INSURANCE_PDFJS]))).toEqual({
      kind: 'insurance-clearance', reader: 'efka-insurance-clearance-text', issuedOn: '2026-07-21', printedValidUntil: '2027-01-20', unread: [],
    });
  });

  it('Ε2 ημερομηνίες με παύλες (αποφάσεις, «16-04-2020») δεν μπερδεύονται με την έκδοση', () => {
    expect(readingOf(readClearanceText([INSURANCE_PDFJS])).issuedOn).toBe('2026-07-21');
  });

  it('Ε3 χωρίς «ΙΣΧΥΕΙ ΕΠΙ … ΜΗΝΕΣ» (π.χ. βεβαίωση οφειλής) ⇒ λήξη μόνο, έκδοση άγνωστη', () => {
    const variant = INSURANCE_PDFJS.replace('ΙΣΧΥΕΙ ΕΠΙ ΕΞΙ (6) ΜΗΝΕΣ ΑΠΟ ΤΗΝ ΕΚΔΟΣΗ ΤΗΣ', 'ΙΣΧΥΕΙ');
    expect(readingOf(readClearanceText([variant]))).toMatchObject({ issuedOn: null, printedValidUntil: '2027-01-20', unread: ['issuedOn'] });
  });
});

describe('πιστοποιητικό ΕΝΦΙΑ (ΑΑΔΕ)', () => {
  it('Ν1 έκδοση = η μοναδική ημερομηνία · λήξη ολογράφως «31 η Δεκεμβρίου 2026»', () => {
    expect(readingOf(readClearanceText(ENFIA_PDFJS_PAGES))).toEqual({
      kind: 'enfia-certificate', reader: 'aade-enfia-certificate-text', issuedOn: '2026-07-22', printedValidUntil: '2026-12-31', unread: [],
    });
  });

  it('Ν2 δεύτερη ημερομηνία στο έντυπο ⇒ η έκδοση δεν διαβάζεται (δεν ξέρουμε ποια)', () => {
    const pages = [ENFIA_PDFJS_PAGES[0].replace('Σελίδα 1', '01/01/2026 Σελίδα 1'), ENFIA_PDFJS_PAGES[1]];
    expect(readingOf(readClearanceText(pages))).toMatchObject({ issuedOn: null, printedValidUntil: '2026-12-31' });
  });
});

describe('άγκυρες', () => {
  it('άγνωστο έντυπο ή σαρωμένη εικόνα (κενό κείμενο) ⇒ not-recognized', () => {
    expect(readClearanceText(['ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΕΝΕΡΓΕΙΑΚΗΣ ΑΠΟΔΟΣΗΣ 01/01/2026'])).toEqual({ kind: 'not-recognized' });
    expect(readClearanceText([''])).toEqual({ kind: 'not-recognized' });
  });

  it('Α1 κάθε αναγνώστης είναι δηλωμένη προέλευση στο `DOCUMENT_TEXT_READERS`', () => {
    const declared: readonly string[] = DOCUMENT_TEXT_READERS;
    expect(Object.values(CLEARANCE_TEXT_READERS).filter((reader) => !declared.includes(reader))).toEqual([]);
  });

  it('🔒 κανένα προσωπικό στοιχείο δεν περνά στην ανάγνωση', () => {
    expect(JSON.stringify(readClearanceText([TAX_PDFJS]))).not.toMatch(/ΔΟΚΙΜΑΣΤΗΣ|000000000/);
  });
});
