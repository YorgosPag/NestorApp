/**
 * ADR-739 Φ.Δ βήμα 5 — **ο κανόνας περικοπής**, μονάδα προς μονάδα.
 *
 * Ο μετρητής είναι **ενεθειμένος και ντετερμινιστικός** (`0.6 × ύψος` ανά χαρακτήρα), για τον
 * ίδιο λόγο που τον ενίει και το `table-layout.test.ts`: ο πραγματικός
 * (`measureTextAdvanceWorld`) πέφτει σε άλλη βαθμίδα ανάλογα με το αν υπάρχει
 * γραμματοσειρά/DOM, άρα τα αριθμητικά πλάτη δεν θα ήταν συγκρίσιμα μεταξύ περιβαλλόντων.
 * **Όχι** δεύτερη υλοποίηση μέτρησης (N.18).
 *
 * Η ισοτιμία των τεσσάρων backends ελέγχεται χωριστά, με τον **πραγματικό** μετρητή:
 * `table-cell-clipping.test.ts`.
 */

import {
  CELL_CLIP_ELLIPSIS,
  CELL_CLIP_NUMERIC_FILL,
  DEFAULT_TABLE_CELL_OVERFLOW,
  resolveCellOverflow,
  resolveVisibleCellText,
} from '../table-cell-overflow';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableCellStyle } from '../table-style';
import type { TableCellOverflow } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/** Ντετερμινιστικός μετρητής: κάθε χαρακτήρας 0.6 × ύψος· bold δεν αλλάζει πλάτος. */
const measure: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

const HEIGHT_MM = 10;
/** Πλάτος ενός χαρακτήρα με τον παραπάνω μετρητή — ο ΕΝΑΣ αριθμός των υπολογισμών εδώ. */
const CHAR_MM = HEIGHT_MM * 0.6;

const STYLE: TableCellStyle = {
  textHeightMm: HEIGHT_MM,
  textColorHex: '#111111',
  bold: false,
  align: 'ML',
  margins: { hMm: 0, vMm: 0 },
};

function visible(
  text: string,
  availableWidthMm: number,
  extra?: { readonly numeric?: boolean; readonly overflow?: TableCellOverflow },
): { readonly text: string; readonly clipped: boolean } {
  return resolveVisibleCellText({
    text,
    availableWidthMm,
    style: STYLE,
    overflow: extra?.overflow ?? DEFAULT_TABLE_CELL_OVERFLOW,
    numeric: extra?.numeric ?? false,
    measure,
  });
}

/** Το πλάτος ενός αποτελέσματος, με τον ίδιο μετρητή — για τον καθολικό έλεγχο «δεν ξεχειλίζει». */
function widthOf(text: string): number {
  return measure(text, HEIGHT_MM, {});
}

// ── Ό,τι χωράει μένει ανέγγιχτο ─────────────────────────────────────────────

describe('resolveVisibleCellText — ό,τι χωράει δεν αγγίζεται', () => {
  it('κείμενο που χωράει επιστρέφεται αυτούσιο, χωρίς σήμανση περικοπής', () => {
    expect(visible('ABC', CHAR_MM * 5)).toEqual({ text: 'ABC', clipped: false });
  });

  it('κείμενο που χωράει ΑΚΡΙΒΩΣ (πλάτος === διαθέσιμο) δεν κόβεται — το όριο είναι κλειστό', () => {
    // Το `<=` vs `<` εδώ είναι η διαφορά ανάμεσα σε «γεμάτο κελί» και «κελί με αποσιωπητικά
    // χωρίς λόγο»: κάθε στήλη `hug` μετριέται ώστε το περιεχόμενο να χωρά ΑΚΡΙΒΩΣ.
    expect(visible('ABC', CHAR_MM * 3)).toEqual({ text: 'ABC', clipped: false });
  });

  it('κενό κελί δεν είναι περικομμένο — είναι κενό', () => {
    expect(visible('', 1)).toEqual({ text: '', clipped: false });
  });
});

// ── Περικοπή κειμένου ───────────────────────────────────────────────────────

describe('resolveVisibleCellText — περικοπή κειμένου με αποσιωπητικά', () => {
  it('κόβει και προσθέτει «…», κρατώντας ΤΑ ΠΑΝΤΑ μέσα στο διαθέσιμο πλάτος', () => {
    // 5 χαρακτήρες χώρος ⇒ 4 γράμματα + το «…».
    const got = visible('ABCDEFGH', CHAR_MM * 5);
    expect(got).toEqual({ text: `ABCD${CELL_CLIP_ELLIPSIS}`, clipped: true });
    expect(widthOf(got.text)).toBeLessThanOrEqual(CHAR_MM * 5);
  });

  it('🔴 ΠΟΤΕ δεν ξεπερνά το διαθέσιμο πλάτος — για ΚΑΘΕ πλάτος από 0 έως 20 χαρακτήρες', () => {
    // Ο καθολικός έλεγχος. Ένα μεμονωμένο παράδειγμα θα ήταν πράσινο ακόμα κι αν ο δείκτης
    // προστίθετο ΜΕΤΑ τη μέτρηση (το κλασικό σφάλμα) — αυτό εδώ όχι.
    const source = 'ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ ΠΟΛΥ ΜΑΚΡΙΑ';
    for (let chars = 0; chars <= 20; chars++) {
      const available = CHAR_MM * chars;
      const got = visible(source, available);
      expect(widthOf(got.text)).toBeLessThanOrEqual(available);
    }
  });

  it('το κενό στο σημείο κοπής πέφτει — «ΑΒΓ …» θα έδειχνε σαν να λείπει λέξη', () => {
    // 5 χαρακτήρες χώρος ⇒ πρόθεμα 4 = «ABC », που κουρεύεται σε «ABC».
    expect(visible('ABC DEF', CHAR_MM * 5).text).toBe(`ABC${CELL_CLIP_ELLIPSIS}`);
  });

  it('κόβει σε ΧΑΡΑΚΤΗΡΑ, όχι σε λέξη — μια κομμένη λέξη δείχνει περισσότερα από καμία', () => {
    // Κοπή ανά λέξη (Figma) θα έδινε «…» σκέτο, πετώντας 6 γράμματα που χωρούσαν.
    expect(visible('ΑΝΤΙΠΑΡΟΧΗ ΕΡΓΟΥ', CHAR_MM * 7).text).toBe(`ΑΝΤΙΠΑ${CELL_CLIP_ELLIPSIS}`);
  });

  it('όταν δεν χωρά ούτε ο δείκτης, γίνεται σκέτη κοπή — μισό γράμμα > κενό κελί', () => {
    expect(visible('ABCD', CHAR_MM).text).toBe('A');
  });

  it('μηδενικό ή αρνητικό ωφέλιμο πλάτος ⇒ τίποτα ορατό, αλλά ΔΗΛΩΜΕΝΟ ως περικοπή', () => {
    // Στήλη στενότερη από τα περιθώριά της. Το `clipped: true` είναι που ξεχωρίζει το
    // «κρύβω δεδομένα» από το «κενό κελί» — ο καλών δεν έχει άλλον τρόπο να το μάθει.
    expect(visible('ΚΑΤΙ', 0)).toEqual({ text: '', clipped: true });
    expect(visible('ΚΑΤΙ', -5)).toEqual({ text: '', clipped: true });
  });
});

// ── Αριθμοί ─────────────────────────────────────────────────────────────────

describe('resolveVisibleCellText — ο αριθμός γίνεται «###», ποτέ κομμένος αριθμός', () => {
  it('γεμίζει το διαθέσιμο πλάτος με «#», χωρίς να το ξεπερνά', () => {
    const got = visible('123456789', CHAR_MM * 4, { numeric: true });
    expect(got).toEqual({ text: CELL_CLIP_NUMERIC_FILL.repeat(4), clipped: true });
    expect(widthOf(got.text)).toBeLessThanOrEqual(CHAR_MM * 4);
  });

  it('🔴 ΚΑΝΕΝΑ ψηφίο του αριθμού δεν επιβιώνει — «12…» θα διαβαζόταν ως ΑΛΛΟΣ αριθμός', () => {
    const got = visible('123456789', CHAR_MM * 4, { numeric: true });
    expect(got.text).not.toMatch(/\d/);
    expect(got.text).not.toContain(CELL_CLIP_ELLIPSIS);
  });

  it('αριθμός που ΧΩΡΑΕΙ μένει αριθμός — το «###» είναι μόνο για το ξεχείλισμα', () => {
    expect(visible('123', CHAR_MM * 5, { numeric: true })).toEqual({ text: '123', clipped: false });
  });
});

// ── Η επίλυση κελί → στήλη → προεπιλογή ────────────────────────────────────

describe('resolveCellOverflow — ίδια σειρά προτεραιότητας με τη στοίχιση', () => {
  it('σιωπή παντού ⇒ η προεπιλογή', () => {
    expect(resolveCellOverflow(undefined, undefined)).toBe(DEFAULT_TABLE_CELL_OVERFLOW);
  });

  it('η στήλη ισχύει όταν το κελί σιωπά', () => {
    expect(resolveCellOverflow(undefined, 'clip')).toBe('clip');
  });

  it('το κελί νικά τη στήλη', () => {
    expect(resolveCellOverflow('clip', 'clip')).toBe('clip');
  });

  it('🔴 άγνωστη τιμή (αρχείο από μελλοντική έκδοση) ⇒ προεπιλογή, ΠΟΤΕ κατάρρευση', () => {
    // Το `PersistedTableModel` περνά από `JSON.parse`: δεν υπάρχει καμία εγγύηση τύπου στην
    // άλλη άκρη. Ένας πίνακας αποθηκευμένος με μελλοντικό `'wrap'` πρέπει να ανοίγει.
    const fromFuture = 'wrap' as TableCellOverflow;
    expect(resolveCellOverflow(fromFuture, undefined)).toBe(DEFAULT_TABLE_CELL_OVERFLOW);
    expect(resolveCellOverflow(undefined, fromFuture)).toBe(DEFAULT_TABLE_CELL_OVERFLOW);
  });
});
