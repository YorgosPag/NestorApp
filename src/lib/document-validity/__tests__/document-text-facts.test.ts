/**
 * ⚓ ADR-915 §20 — ο ΕΝΑΣ πίνακας «είδος → αναγνώστης» και η κρίση «συμφωνεί το έγγραφο με ό,τι υποσχέθηκε το
 * ανέβασμα;». Συνθετικά έντυπα (καμία τιμή από αρχείο πελάτη).
 */

import { DOCUMENT_KINDS } from '@/config/document-validity/document-validity';
import { DOCUMENT_TEXT_READERS } from '@/lib/document-validity/document-facts';
import {
  DOCUMENT_TEXT_READER_OF_KIND,
  documentTextMaxPages,
  documentTextReadersFor,
  judgeDocumentText,
} from '@/lib/document-validity/document-text-facts';
import { peaPagesPdfjs } from '@/lib/energy-certificate/__tests__/pea-text.fixture';
import { ENFIA_PDFJS_PAGES, INSURANCE_PDFJS, TAX_PDFJS } from './clearance-text.fixture';

describe('judgeDocumentText (ADR-915 §20)', () => {
  it('φορολογική που υποσχέθηκε φορολογική ⇒ γεγονότα με την προέλευση του εντύπου', () => {
    expect(judgeDocumentText([TAX_PDFJS], ['tax-clearance'])).toEqual({
      kind: 'read',
      facts: {
        kind: 'tax-clearance', issuedOn: '2026-07-22', printedValidUntil: '2026-08-22', classification: null,
        source: { kind: 'document-text', reader: 'aade-tax-clearance-text' },
      },
    });
  });

  it('ασφαλιστική · ΕΝΦΙΑ ⇒ ο ίδιος αναγνώστης, άλλο είδος', () => {
    expect(judgeDocumentText([INSURANCE_PDFJS], ['insurance-clearance'])).toMatchObject({ kind: 'read', facts: { kind: 'insurance-clearance' } });
    expect(judgeDocumentText(ENFIA_PDFJS_PAGES, ['enfia-certificate'])).toMatchObject({ kind: 'read', facts: { kind: 'enfia-certificate' } });
  });

  it('🔴 ανέβηκε ως ΕΝΦΙΑ, είναι φορολογική ⇒ kind-mismatch — ΚΑΝΕΝΑ γεγονός, ούτε της ετικέτας ούτε του κειμένου', () => {
    expect(judgeDocumentText([TAX_PDFJS], ['enfia-certificate'])).toEqual({ kind: 'kind-mismatch', found: 'tax-clearance' });
  });

  it('αναγνωρισμένο έντυπο χωρίς διασταυρωμένη έκδοση ⇒ issue-date-unread (ποτέ κενή ανάγνωση που υπερισχύει)', () => {
    const twoDates = [`${ENFIA_PDFJS_PAGES[0]} 01/02/2026`, ENFIA_PDFJS_PAGES[1]];
    expect(judgeDocumentText(twoDates, ['enfia-certificate'])).toEqual({ kind: 'issue-date-unread', found: 'enfia-certificate' });
  });

  it('ΠΕΑ ⇒ ο αναγνώστης του ΠΕΑ, με τη δική του προέλευση', () => {
    expect(judgeDocumentText(peaPagesPdfjs(), ['energy-certificate'])).toMatchObject({
      kind: 'read', facts: { kind: 'energy-certificate', source: { kind: 'document-text', reader: 'pea-text' } },
    });
  });

  it('άγνωστο έντυπο · σαρωμένη εικόνα (κενό κείμενο) ⇒ not-recognized', () => {
    expect(judgeDocumentText(['Τιμολόγιο παροχής υπηρεσιών 01/01/2026'], ['tax-clearance'])).toEqual({ kind: 'not-recognized' });
    expect(judgeDocumentText([''], ['tax-clearance', 'energy-certificate'])).toEqual({ kind: 'not-recognized' });
  });
});

describe('ο πίνακας αναγνωστών (ADR-915 §20)', () => {
  it('ένας αναγνώστης για τις τρεις ενημερότητες — καμία διπλή ανάγνωση', () => {
    expect(documentTextReadersFor(['tax-clearance', 'insurance-clearance', 'enfia-certificate'])).toHaveLength(1);
  });

  it('οι σελίδες φτάνουν σε ΚΑΘΕ αναγνώστη · είδος χωρίς αναγνώστη ⇒ τίποτα', () => {
    expect(documentTextMaxPages(documentTextReadersFor(['tax-clearance', 'energy-certificate']))).toBe(4);
    expect(documentTextReadersFor(['building-identity'])).toEqual([]);
    expect(documentTextMaxPages([])).toBe(0);
  });

  it('κάθε είδος του πίνακα είναι είδος του καταλόγου, και κάθε προέλευση που γράφει είναι δηλωμένη', () => {
    for (const kind of Object.keys(DOCUMENT_TEXT_READER_OF_KIND)) expect(DOCUMENT_KINDS).toContain(kind);
    const sources = [judgeDocumentText([TAX_PDFJS], ['tax-clearance']), judgeDocumentText(peaPagesPdfjs(), ['energy-certificate'])];
    for (const verdict of sources) {
      if (verdict.kind !== 'read' || verdict.facts.source.kind !== 'document-text') throw new Error('expected a reading');
      expect(DOCUMENT_TEXT_READERS).toContain(verdict.facts.source.reader);
    }
  });
});
