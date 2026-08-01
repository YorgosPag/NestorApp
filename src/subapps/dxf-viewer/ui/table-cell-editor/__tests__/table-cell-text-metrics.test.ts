/**
 * ADR-739 Φ.Δ βήμα 3 — **η μία μηχανή μέτρησης** του in-cell επεξεργαστή.
 *
 * Σε jsdom δεν υπάρχει καμβάς 2D, άρα εκτελείται ο **δεύτερος βαθμός**: οι κεντρικές
 * ονομαστικές αναλογίες. Αυτό δεν είναι περιορισμός των tests — είναι ακριβώς ο δρόμος που
 * τρέχει σε SSR και σε worker, και ο μόνος που μπορεί να **σπάσει σιωπηλά**: αν κάποιος τον
 * αφαιρέσει, ο επεξεργαστής θα έβγαζε `NaN` γεμίσεις σε κάθε περιβάλλον χωρίς DOM, δηλαδή
 * κουτί χωρίς ύψος. Ο πρώτος βαθμός (πραγματικά μετρικά γραμματοσειράς) επαληθεύεται
 * ζωντανά στον browser — δες τη σημείωση του ADR-739 §21.
 */

import {
  cellCaretIndexAtPx,
  cellFontBandPx,
  cellTextWidthPx,
  __resetTableCellTextMetricsForTests,
} from '../table-cell-text-metrics';
import { TEXT_METRICS_RATIOS } from '../../../config/text-rendering-config';

beforeEach(() => __resetTableCellTextMetricsForTests());

const FONT_20 = '20px arial';
const FONT_40 = '40px arial';

describe('cellFontBandPx — η κατακόρυφη ζώνη', () => {
  it('χωρίς καμβά πέφτει στις κεντρικές αναλογίες, ΠΟΤΕ σε NaN', () => {
    const band = cellFontBandPx(FONT_20);
    expect(band.ascentPx).toBeCloseTo(20 * TEXT_METRICS_RATIOS.ASCENT_RATIO, 9);
    expect(band.descentPx).toBeCloseTo(20 * TEXT_METRICS_RATIOS.DESCENT_RATIO, 9);
  });

  /**
   * ⛔ Το ρίσκο απόδοσης, όχι ορθότητας: σε **κάθε καρέ zoom** το μέγεθος αλλάζει. Αν η
   * απομνημόνευση είχε κλειδί το πλήρες αλφαριθμητικό, θα αστοχούσε σε κάθε καρέ και ο
   * `Map` θα μεγάλωνε όσο κρατά το zoom. Η γραμμικότητα είναι το τεκμήριο ότι το κλειδί
   * είναι κανονικοποιημένο ως προς το μέγεθος.
   */
  it('είναι ΓΡΑΜΜΙΚΗ ως προς το μέγεθος — μία μέτρηση εξυπηρετεί κάθε κλίμακα', () => {
    const small = cellFontBandPx(FONT_20);
    const large = cellFontBandPx(FONT_40);
    expect(large.ascentPx).toBeCloseTo(small.ascentPx * 2, 9);
    expect(large.descentPx).toBeCloseTo(small.descentPx * 2, 9);
  });

  it('το βάρος είναι μέρος της ταυτότητας — `bold` δεν μοιράζεται εγγραφή με `normal`', () => {
    // Χωρίς καμβά οι τιμές συμπίπτουν· αυτό που ελέγχεται είναι ότι το ερώτημα ΓΙΝΕΤΑΙ
    // ξεχωριστά (καμία εξαίρεση, καμία μόλυνση εγγραφής).
    expect(cellFontBandPx('bold 20px arial')).toEqual(cellFontBandPx(FONT_20));
  });
});

describe('cellCaretIndexAtPx — σε ποιο γράμμα έγινε το κλικ', () => {
  const TEXT = 'Περιγραφή';
  const width = (s: string): number => cellTextWidthPx(s, FONT_20);

  it('κενό κείμενο ⇒ 0', () => {
    expect(cellCaretIndexAtPx('', FONT_20, 123)).toBe(0);
  });

  it('αριστερά από την αρχή ⇒ 0, ποτέ αρνητικό', () => {
    expect(cellCaretIndexAtPx(TEXT, FONT_20, -50)).toBe(0);
  });

  it('πέρα από το τέλος ⇒ το μήκος του κειμένου', () => {
    expect(cellCaretIndexAtPx(TEXT, FONT_20, width(TEXT) + 500)).toBe(TEXT.length);
  });

  /**
   * Το «πλησιέστερο όριο χαρακτήρα» είναι η συμπεριφορά κάθε επεξεργαστή: κλικ στο **δεξί
   * μισό** ενός γράμματος βάζει τον κέρσορα ΜΕΤΑ από αυτό. Μια υλοποίηση «ποιος χαρακτήρας
   * περιέχει το σημείο» δίνει μονίμως έναν δείκτη λιγότερο στο δεξί μισό.
   */
  it('κλικ στο ΑΡΙΣΤΕΡΟ μισό του 4ου γράμματος ⇒ κέρσορας ΠΡΙΝ από αυτό', () => {
    const left = width(TEXT.slice(0, 3));
    const right = width(TEXT.slice(0, 4));
    expect(cellCaretIndexAtPx(TEXT, FONT_20, left + (right - left) * 0.2)).toBe(3);
  });

  it('κλικ στο ΔΕΞΙ μισό του 4ου γράμματος ⇒ κέρσορας ΜΕΤΑ από αυτό', () => {
    const left = width(TEXT.slice(0, 3));
    const right = width(TEXT.slice(0, 4));
    expect(cellCaretIndexAtPx(TEXT, FONT_20, left + (right - left) * 0.8)).toBe(4);
  });

  it('ο δείκτης μεγαλώνει μονότονα με τη μετατόπιση — καμία αναπήδηση', () => {
    const indices = [0, 0.25, 0.5, 0.75, 1].map((f) =>
      cellCaretIndexAtPx(TEXT, FONT_20, width(TEXT) * f),
    );
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]);
    }
    expect(indices[indices.length - 1]).toBe(TEXT.length);
  });
});
