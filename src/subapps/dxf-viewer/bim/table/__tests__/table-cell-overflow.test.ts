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
  type VisibleCellText,
} from '../table-cell-overflow';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableCellStyle } from '../table-style';
import type { TableCellOverflow, TableCellTextRun } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/**
 * Ντετερμινιστικός μετρητής: κάθε χαρακτήρας `0.6 × ύψος`, **και τα έντονα διπλάσια**.
 *
 * 🔴 ADR-753 Φ2 — ο πολλαπλασιαστής των έντονων δεν είναι διακόσμηση: χωρίς αυτόν κάθε test
 * μορφοποίησης ανά χαρακτήρα θα ήταν **πράσινο κατά σύμπτωση**, γιατί ομοιογενής και
 * ετερογενής μέτρηση θα έδιναν τον ίδιο αριθμό. Ακριβώς το σχήμα των δύο μεταλλάξεων που
 * επέζησαν στη Φ1 (§8): δείγμα που δεν **διακρίνει** τις εκδοχές δεν είναι φύλακας.
 *
 * Τα υπάρχοντα tests δεν περνούν ποτέ `bold: true`, άρα μένουν αριθμητικά αμετάβλητα.
 */
const measure: TableTextMeasurer = (text, heightMm, style) =>
  text.length * heightMm * 0.6 * (style.bold === true ? 2 : 1);

const HEIGHT_MM = 10;
/** Πλάτος ενός χαρακτήρα με τον παραπάνω μετρητή — ο ΕΝΑΣ αριθμός των υπολογισμών εδώ. */
const CHAR_MM = HEIGHT_MM * 0.6;

const STYLE: TableCellStyle = {
  textHeightMm: HEIGHT_MM,
  textColorHex: '#111111',
  bold: false,
  italic: false,
  underline: false,
  align: 'ML',
  margins: { hMm: 0, vMm: 0 },
};

/** Ό,τι δίνει η μηχανή, ακέραιο — μαζί με τα τμήματα του ADR-753 Φ2. */
function visibleFull(
  text: string,
  availableWidthMm: number,
  extra?: {
    readonly numeric?: boolean;
    readonly overflow?: TableCellOverflow;
    readonly runs?: readonly TableCellTextRun[];
    readonly style?: TableCellStyle;
  },
): VisibleCellText {
  return resolveVisibleCellText({
    text,
    availableWidthMm,
    style: extra?.style ?? STYLE,
    overflow: extra?.overflow ?? DEFAULT_TABLE_CELL_OVERFLOW,
    numeric: extra?.numeric ?? false,
    runs: extra?.runs,
    measure,
  });
}

/**
 * Μόνο η **απόφαση περικοπής**, χωρίς τα τμήματα.
 *
 * Τα τμήματα (ADR-753 Φ2) είναι πάντα παρόντα και δοκιμάζονται χωριστά· εδώ θα ήταν θόρυβος
 * σε κάθε `toEqual` και θα έκρυβαν το ερώτημα που αυτά τα tests φυλάνε — «τι φαίνεται».
 */
function visible(
  text: string,
  availableWidthMm: number,
  extra?: { readonly numeric?: boolean; readonly overflow?: TableCellOverflow },
): { readonly text: string; readonly clipped: boolean } {
  const { text: shown, clipped } = visibleFull(text, availableWidthMm, extra);
  return { text: shown, clipped };
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

// ── Μορφοποίηση ανά χαρακτήρα (ADR-753 Φ2) ─────────────────────────────────

describe('🔴 ADR-753 Φ2 — η περικοπή μετρά ΤΑ ΤΜΗΜΑΤΑ, όχι μία γραμματοσειρά', () => {
  const BOLD_ALL: readonly TableCellTextRun[] = [{ start: 0, end: 6, style: { bold: true } }];
  /** Το πραγματικό πλάτος ενός αποτελέσματος — άθροισμα των τμημάτων που παρήγαγε η μηχανή. */
  const shownWidth = (got: VisibleCellText): number =>
    got.spans.reduce((sum, span) => sum + span.advanceMm, 0);

  it('έντονο κείμενο κόβεται ΝΩΡΙΤΕΡΑ — ο ομοιογενής χάρακας θα άφηνε διπλάσια γράμματα', () => {
    // Χώρος 5 χαρακτήρων· τα έντονα πιάνουν διπλό πλάτος, ο δείκτης μετριέται με το κελί.
    // Διαθέσιμο 5U − δείκτης 1U = 4U ⇒ χωρούν 2 έντονα γράμματα.
    const got = visibleFull('AAAAAA', CHAR_MM * 5, { runs: BOLD_ALL });
    expect(got.text).toBe(`AA${CELL_CLIP_ELLIPSIS}`);
    // Η εκδοχή που αγνοεί τα runs θα έδινε «AAAA…» — δηλαδή 9U σε κελί 5U, ζωγραφισμένα
    // πάνω στο περίγραμμα: ακριβώς το ελάττωμα για το οποίο γράφτηκε αυτό το αρχείο.
    expect(visible('AAAAAA', CHAR_MM * 5).text).toBe(`AAAA${CELL_CLIP_ELLIPSIS}`);
  });

  it('🔴 ΠΟΤΕ δεν ξεπερνά το διαθέσιμο πλάτος — για ΚΑΘΕ πλάτος, με μικτή μορφοποίηση', () => {
    // Ο ίδιος καθολικός έλεγχος με το ομοιογενές κείμενο, στον ετερογενή δρόμο. Ένα
    // μεμονωμένο παράδειγμα θα ήταν πράσινο ακόμη κι αν το `runsLimit` έλειπε.
    const runs: readonly TableCellTextRun[] = [{ start: 2, end: 5, style: { bold: true } }];
    for (let chars = 0; chars <= 20; chars++) {
      const available = CHAR_MM * chars;
      const got = visibleFull('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ', available, { runs });
      expect(shownWidth(got)).toBeLessThanOrEqual(available + 1e-9);
    }
  });

  it('ο δείκτης «…» παίρνει το στυλ του ΚΕΛΙΟΥ, όχι του τελευταίου γράμματος', () => {
    const got = visibleFull('AAAAAA', CHAR_MM * 5, { runs: BOLD_ALL });
    expect(got.spans.map((s) => [s.text, s.bold])).toEqual([
      ['AA', true],
      [CELL_CLIP_ELLIPSIS, false],
    ]);
  });

  it('το `####` δεν κληρονομεί τίποτα — αντικαθιστά ολόκληρη την τιμή', () => {
    const got = visibleFull('123456789', CHAR_MM * 4, { numeric: true, runs: BOLD_ALL });
    expect(got.text).toBe(CELL_CLIP_NUMERIC_FILL.repeat(4));
    expect(got.spans).toHaveLength(1);
    expect(got.spans[0].bold).toBe(false);
  });

  it('κείμενο που χωράει κρατά τα τμήματά του ακέραια', () => {
    const got = visibleFull('AABB', CHAR_MM * 20, { runs: [{ start: 2, end: 4, style: { bold: true } }] });
    expect(got.clipped).toBe(false);
    expect(got.spans.map((s) => [s.text, s.bold, s.offsetMm])).toEqual([
      ['AA', false, 0],
      ['BB', true, 2 * CHAR_MM],
    ]);
  });

  it('χωρίς runs υπάρχει ΠΑΝΤΑ ένα τμήμα — και καλύπτει ΟΛΟ το ορατό κείμενο, μαζί με τον δείκτη', () => {
    // Το byte-compat της υπογράμμισης: όσο το ορατό κείμενο είναι ένα τμήμα, το `advanceMm`
    // του run μετρά «κεφαλή + …» σε ΜΙΑ κλήση, όπως πριν το ADR-753.
    const got = visibleFull('ABCDEFGH', CHAR_MM * 5);
    expect(got.spans).toHaveLength(1);
    expect(got.spans[0].text).toBe(got.text);
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
    // άλλη άκρη. Ένας πίνακας με μελλοντική τιμή πρέπει να **ανοίγει**.
    //
    // ⚠️ Μέχρι το §58 το παράδειγμα εδώ ήταν το `'wrap'` — και έπαψε να ισχύει τη στιγμή που
    // το `'wrap'` απέκτησε μηχανή. Το δείγμα είναι πλέον τιμή που **δεν** σχεδιάζεται.
    const fromFuture = 'justify' as TableCellOverflow;
    expect(resolveCellOverflow(fromFuture, undefined)).toBe(DEFAULT_TABLE_CELL_OVERFLOW);
    expect(resolveCellOverflow(undefined, fromFuture)).toBe(DEFAULT_TABLE_CELL_OVERFLOW);
  });

  it('🔴 ADR-739 §58 — οι δύο νέες τιμές είναι ΕΚΤΕΛΕΣΙΜΕΣ, όχι απλώς δηλωμένες', () => {
    // Αν αυτό γυρίσει σε `'clip'`, κάποιος έσβησε την τιμή από το `SUPPORTED_OVERFLOW` και
    // κάθε αναδίπλωση του έργου πέφτει **σιωπηλά** σε περικοπή — ακριβώς το «ψέμα του τύπου»
    // που προειδοποιεί το `types/table.ts`. Συνέβη **μία φορά** γράφοντας το §58: η τιμή
    // μπήκε στο union και ξεχάστηκε από το σύνολο, και κανένα άλλο test δεν το είδε.
    expect(resolveCellOverflow('wrap', undefined)).toBe('wrap');
    expect(resolveCellOverflow('shrink', undefined)).toBe('shrink');
  });
});
