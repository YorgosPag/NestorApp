/**
 * Το κοινό μοντέλο κειμένου σελίδας (ADR-949 Α-2): η ένωση του server, οι οπτικές γραμμές, η κρίση «διαβάζεται;».
 */

import { E9_A_PAGES, ENFIA_BROKEN_FONT_PAGES } from '@/lib/document-validity/__tests__/e9-text.fixture';

import { hasReadableText, linesOf, pageTextOf, positionedPageOf, type PdfPositionedPage } from '../pdf-page-text';

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

describe('positionedPageOf (ADR-920 §14.11 Ζ3 — ίδια μετατροπή σε συσκευή και server)', () => {
  /** Viewport σελίδας 100 × 200: αναστροφή y, όπως το pdf.js σε κλίμακα 1 χωρίς περιστροφή. */
  const viewport = { width: 100, height: 200, convertToViewportPoint: (x: number, y: number) => [x, 200 - y] };

  it('θέση ΟΘΟΝΗΣ από τον πίνακα του pdf.js· κενά κομμάτια και κομμάτια χωρίς θέση πετιούνται', () => {
    const page = positionedPageOf(3, viewport, [
      { str: 'Α', transform: [1, 0, 0, 1, 10, 150], width: 6, height: 8 },
      { str: '   ', transform: [1, 0, 0, 1, 0, 0], width: 1, height: 1 },
      { str: 'Β' },
      { transform: [1, 0, 0, 1, 0, 0] },
    ]);
    expect(page).toEqual({ page: 3, width: 100, height: 200, items: [{ s: 'Α', x: 10, y: 50, w: 6, h: 8 }] });
  });
});
