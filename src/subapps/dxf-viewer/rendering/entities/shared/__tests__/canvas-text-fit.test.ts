/**
 * ADR-736 Φ2 — `fitCanvasTextToWidth`: ένα όνομα αρχείου δεν ξεχειλίζει ΠΟΤΕ πάνω στο σχέδιο.
 *
 * Το πλάτος μετριέται με ντετερμινιστικό stub (6px/χαρακτήρα) — το jsdom δεν έχει πραγματικές
 * μετρικές γραμματοσειράς, οπότε ένα «αληθινό» measureText θα έκανε τα κατώφλια αναληθή.
 */

import { fitCanvasTextToWidth } from '../canvas-text-fit';

const CHAR_PX = 6;

/** Context που μετρά 6px ανά χαρακτήρα και μετρά ΠΟΣΕΣ φορές ρωτήθηκε (κόστος = ADR-040). */
function stubCtx(): { ctx: CanvasRenderingContext2D; measurements: () => number } {
  let count = 0;
  const ctx = {
    measureText: (text: string) => {
      count++;
      return { width: text.length * CHAR_PX };
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, measurements: () => count };
}

describe('fitCanvasTextToWidth', () => {
  it('επιστρέφει το κείμενο ΑΥΤΟΥΣΙΟ όταν χωρά (καμία περιττή αλλοίωση)', () => {
    const { ctx } = stubCtx();
    expect(fitCanvasTextToWidth(ctx, 'a.jpg', 5 * CHAR_PX)).toBe('a.jpg');
  });

  it('κόβει με αποσιωπητικά και ΣΕΒΕΤΑΙ το όριο — τα αποσιωπητικά μετρούν κι αυτά', () => {
    const { ctx } = stubCtx();
    const fitted = fitCanvasTextToWidth(ctx, 'abcdefghij', 5 * CHAR_PX);
    // 5 χαρακτήρες χωρούν συνολικά ⇒ 4 γράμματα + «…». Η κλασική αστοχία εδώ είναι να κοπεί
    // στους 5 χαρακτήρες ΚΑΙ μετά να προστεθεί το «…» ⇒ 6 → υπερχείλιση κατά ένα glyph.
    expect(fitted).toBe('abcd…');
    expect(fitted).not.toBeNull();
    expect((fitted as string).length * CHAR_PX).toBeLessThanOrEqual(5 * CHAR_PX);
  });

  it('χρησιμοποιεί ΕΝΑ glyph U+2026, όχι τρεις τελείες (αλλιώς μετριέται λάθος)', () => {
    const { ctx } = stubCtx();
    const fitted = fitCanvasTextToWidth(ctx, 'abcdefghij', 5 * CHAR_PX) as string;
    expect(fitted.endsWith('…')).toBe(true);
    expect(fitted.endsWith('...')).toBe(false);
  });

  it('επιστρέφει null όταν δεν χωρούν ούτε τα αποσιωπητικά — «μη ζωγραφίσεις» αντί για σκουπίδι', () => {
    const { ctx } = stubCtx();
    expect(fitCanvasTextToWidth(ctx, 'abcdefghij', CHAR_PX - 1)).toBeNull();
  });

  it('επιστρέφει null σε κενό κείμενο ή μη θετικό πλάτος', () => {
    const { ctx } = stubCtx();
    expect(fitCanvasTextToWidth(ctx, '', 100)).toBeNull();
    expect(fitCanvasTextToWidth(ctx, 'a.jpg', 0)).toBeNull();
    expect(fitCanvasTextToWidth(ctx, 'a.jpg', -10)).toBeNull();
  });

  it('χειρίζεται ελληνικά ονόματα (το πραγματικό δείγμα είναι ελληνικό)', () => {
    const { ctx } = stubCtx();
    const greek = 'Διανομή Ευόσμου φύλλο 1.JPG';
    expect(fitCanvasTextToWidth(ctx, greek, greek.length * CHAR_PX)).toBe(greek);
    expect(fitCanvasTextToWidth(ctx, greek, 8 * CHAR_PX)).toBe('Διανομή…');
  });

  it('είναι ΛΟΓΑΡΙΘΜΙΚΟ στο μήκος — όχι μία μέτρηση ανά χαρακτήρα (ADR-040 hot path)', () => {
    // Αφελής σάρωση σε 300 χαρακτήρες = ~300 `measureText` ανά ετικέτα ανά frame. Το φράγμα
    // είναι γενναιόδωρο (log2(300) ≈ 9, συν 2 αρχικοί έλεγχοι) αλλά αποκλείει την O(n) οπισθοδρόμηση.
    const { ctx, measurements } = stubCtx();
    fitCanvasTextToWidth(ctx, 'x'.repeat(300), 20 * CHAR_PX);
    expect(measurements()).toBeLessThan(20);
  });
});
