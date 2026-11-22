/**
 * Το κοινό μοντέλο κειμένου σελίδας (ADR-949 Α-2): η ένωση του server, οι οπτικές γραμμές, η κρίση «διαβάζεται;».
 */

import { E9_A_PAGES, ENFIA_BROKEN_FONT_PAGES } from '@/lib/document-validity/__tests__/e9-text.fixture';

import { hasReadableText, linesOf, pageTextOf, type PdfPositionedPage } from '../pdf-page-text';

const plain = (pages: readonly PdfPositionedPage[]) => pages.map((page) => page.items.map((item) => item.s).join(' '));

describe('pageTextOf', () => {
  it('κενό ανάμεσα στα κομμάτια, αλλαγή γραμμής όπου το pdf.js σημειώνει τέλος', () => {
    expect(pageTextOf([{ str: 'Α', hasEOL: false }, { str: 'Β', hasEOL: true }, { str: 'Γ' }])).toBe('Α Β\nΓ ');
  });

  it('κομμάτι χωρίς κείμενο (σήμανση περιεχομένου) ⇒ μόνο το διαχωριστικό', () => {
    expect(pageTextOf([{}, { str: 'Χ' }])).toBe(' Χ ');
  });
});

describe('linesOf', () => {
  const page: PdfPositionedPage = {
    page: 1,
    width: 100,
    height: 100,
    items: [
      { s: 'δεξιά', x: 50, y: 10.5, w: 10, h: 7 },
      { s: 'κάτω', x: 0, y: 30, w: 10, h: 7 },
      { s: 'αριστερά', x: 0, y: 10, w: 10, h: 7 },
    ],
  };

  it('ομαδοποιεί κατά y (με ανοχή) και ταξινομεί κατά x', () => {
    expect(linesOf(page).map((line) => line.items.map((item) => item.s))).toEqual([['αριστερά', 'δεξιά'], ['κάτω']]);
  });
});

describe('hasReadableText', () => {
  it('αναγνώσιμο Ε9 ⇒ ναι', () => {
    expect(hasReadableText(plain(E9_A_PAGES))).toBe(true);
  });

  it('κειμενικό PDF με σπασμένη γραμματοσειρά (σύμβολα) ⇒ όχι', () => {
    expect(hasReadableText(plain(ENFIA_BROKEN_FONT_PAGES))).toBe(false);
  });

  it('σαρωμένο (κανένα κείμενο) ⇒ όχι', () => {
    expect(hasReadableText(['', '   '])).toBe(false);
  });
});
