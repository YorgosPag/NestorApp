/**
 * 🔴 ADR-753 Φ2 — **πού κάθεται κάθε ομοιογενές τμήμα του κειμένου ενός κελιού.**
 *
 * Το `table-cell-run-ops.test.ts` κλειδώνει *ποιοι χαρακτήρες* έχουν ποιο στυλ. Εδώ
 * κλειδώνεται το δεύτερο μισό — *σε ποιο mm* — και ειδικά η απόφαση που είναι αόρατη σε κάθε
 * στιγμιότυπο: **άθροισμα ανά τμήμα, με το στυλ του καθενός**, όχι μία μέτρηση.
 *
 * ## Γιατί ο μετρητής έχει ΔΥΟ ιδιότητες, και όχι μία
 * Το μάθημα του §8: δύο μεταλλάξεις της Φ1 επέζησαν επειδή κάθε δείγμα γεννιόταν από τον ίδιο
 * δρόμο, άρα δεν **διέκρινε** τις εκδοχές. Εδώ ο μετρητής είναι φτιαγμένος να διακρίνει:
 *
 *  1. **Τα έντονα είναι διπλάσια** — χωρίς αυτό, ομοιογενής και ετερογενής μέτρηση δίνουν τον
 *     ίδιο αριθμό και κάθε test θα ήταν πράσινο κατά σύμπτωση.
 *  2. **Το ζεύγος `AB` κερδίζει 0,3mm μέσα στην ίδια κλήση** — μιμείται kerning, ώστε να
 *     φαίνεται πότε το ζεύγος διατηρείται (μέσα σε τμήμα) και πότε χάνεται (πάνω στο όριο).
 *
 * @see bim/table/table-cell-styled-spans.ts
 */

import { layoutTable } from '../table-layout';
import { createTableModel } from '../table-model-helpers';
import {
  fittingPrefixLengthAcrossSpans,
  hasStyledSpans,
  resolveCellStyledSpans,
  styledPrefixWidthMm,
  styledSpansWidthMm,
  type CellStyledSpansInput,
} from '../table-cell-styled-spans';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableCellStyle, TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type { TableCell, TableCellTextRun, TableColumn, TableRow } from '../../../types/table';
import { installStubFontPair } from '../../../text-engine/fonts/__tests__/_stub-font';
import { measureTextAdvanceVerdict } from '../../../text-engine/fonts/text-advance';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

const HEIGHT_MM = 10;
/** Πλάτος ενός απλού χαρακτήρα — ο ΕΝΑΣ αριθμός των υπολογισμών εδώ. */
const U = HEIGHT_MM * 0.6;

/** `0.6 × ύψος` ανά χαρακτήρα, **έντονα διπλάσια**. */
const measure: TableTextMeasurer = (text, heightMm, style) =>
  text.length * heightMm * 0.6 * (style.bold === true ? 2 : 1);

/**
 * 🔴 Ο μετρητής που **σπάει την αθροιστικότητα**: κάθε ζεύγος `AB` κερδίζει 0,3mm — αλλά
 * **μόνο όταν οι δύο χαρακτήρες μετρηθούν στην ίδια κλήση**, όπως ακριβώς ένα πραγματικό
 * ζεύγος kerning.
 */
const kerned: TableTextMeasurer = (text, heightMm, style) =>
  measure(text, heightMm, style) - (text.match(/AB/g)?.length ?? 0) * 0.3;

const STYLE: TableCellStyle = {
  textHeightMm: HEIGHT_MM,
  textColorHex: '#111111',
  bold: false,
  italic: false,
  underline: false,
  align: 'ML',
  indentLevel: 0,
  margins: { hMm: 0, vMm: 0 },
};

const BOLD = (start: number, end: number): TableCellTextRun => ({
  start,
  end,
  style: { bold: true },
});

const spansOf = (over: Partial<CellStyledSpansInput> & { readonly text: string }) =>
  resolveCellStyledSpans({ style: STYLE, measure, ...over });

// ── Η αναλλοίωτη που κρατά το ADR-751 ανέπαφο ───────────────────────────────

describe('χωρίς runs — ΕΝΑ τμήμα, δηλαδή η σημερινή αριθμητική', () => {
  it('παράγεται ακριβώς ένα τμήμα, με το στυλ του κελιού και μηδενική μετατόπιση', () => {
    const spans = spansOf({ text: 'ΑΒΓΔ' });
    expect(spans).toHaveLength(1);
    expect(spans[0]).toEqual({
      text: 'ΑΒΓΔ',
      start: 0,
      end: 4,
      offsetMm: 0,
      advanceMm: 4 * U,
      heightMm: HEIGHT_MM,
      colorHex: '#111111',
      bold: false,
      italic: false,
      underline: false,
    });
  });

  it('🔴 το πλάτος είναι ΤΑΥΤΟΣΗΜΟ με τη μία μέτρηση ολόκληρου του κειμένου — και με kerning', () => {
    // Αυτό είναι το byte-compat: ό,τι υπάρχει σήμερα στον δίσκο μετριέται με την ίδια πράξη.
    const text = 'ABABAB';
    const spans = spansOf({ text, measure: kerned });
    expect(styledSpansWidthMm(spans)).toBeCloseTo(kerned(text, HEIGHT_MM, STYLE), 10);
  });

  it('τα προθέματα είναι τα προθέματα ΤΟΥ ΙΔΙΟΥ string — η σύμβαση του ADR-751', () => {
    const text = 'ABABAB';
    const spans = spansOf({ text, measure: kerned });
    for (let i = 0; i <= text.length; i++) {
      expect(styledPrefixWidthMm(spans, i, kerned)).toBeCloseTo(
        kerned(text.slice(0, i), HEIGHT_MM, STYLE),
        10,
      );
    }
  });

  it('κενό κείμενο δεν παράγει τμήμα — ούτε ένα κενό', () => {
    expect(spansOf({ text: '' })).toEqual([]);
    expect(styledSpansWidthMm([])).toBe(0);
  });

  it('ένα τμήμα ίδιο με το κελί ΔΕΝ είναι μορφοποίηση ανά χαρακτήρα — το πεδίο πρέπει να λείψει', () => {
    expect(hasStyledSpans(spansOf({ text: 'ΑΒΓΔ' }), STYLE)).toBe(false);
    expect(hasStyledSpans([], STYLE)).toBe(false);
  });

  it('🔴 ΕΝΑ τμήμα που διαφέρει από το κελί ΠΡΕΠΕΙ να ταξιδέψει — αλλιώς ο ζωγράφος ξεβάφει', () => {
    // Run που καλύπτει ΟΛΟ το κελί ⇒ ένα τμήμα. Με κριτήριο το πλήθος, το πεδίο θα
    // παραλειπόταν και ο ζωγράφος θα διάβαζε `run.bold === false` — ενώ η στήλη μετρήθηκε
    // για έντονα. Μέτρηση και ζωγραφική θα έλεγαν άλλα.
    const spans = spansOf({ text: 'ΑΒΓΔ', runs: [BOLD(0, 4)] });
    expect(spans).toHaveLength(1);
    expect(hasStyledSpans(spans, STYLE)).toBe(true);
  });
});

// ── Το άθροισμα ετερογενών τμημάτων ─────────────────────────────────────────

describe('με runs — άθροισμα τμημάτων, καθένα με ΤΟ ΔΙΚΟ ΤΟΥ στυλ', () => {
  const text = 'AABBCC';

  it('τρία τμήματα, με σωρευτικές μετατοπίσεις', () => {
    const spans = spansOf({ text, runs: [BOLD(2, 4)] });
    expect(spans.map((s) => [s.text, s.offsetMm, s.advanceMm, s.bold])).toEqual([
      ['AA', 0, 2 * U, false],
      ['BB', 2 * U, 4 * U, true],
      ['CC', 6 * U, 2 * U, false],
    ]);
  });

  it('🔴 το σύνολο ΔΕΝ είναι η μέτρηση ολόκληρου του κειμένου με το στυλ του κελιού', () => {
    // Ο φύλακας της μετάλλαξης «μέτρα τα πάντα με το στυλ του κελιού»: εκείνη η εκδοχή δίνει
    // 6U και είναι απολύτως εύλογη στο μάτι. Η διαφορά υπάρχει ΜΟΝΟ επειδή ο μετρητής των
    // tests τιμά τα έντονα — γι' αυτό η ιδιότητα του μετρητή δεν είναι διακόσμηση.
    const spans = spansOf({ text, runs: [BOLD(2, 4)] });
    expect(styledSpansWidthMm(spans)).toBeCloseTo(8 * U, 10);
    expect(measure(text, HEIGHT_MM, STYLE)).toBeCloseTo(6 * U, 10);
  });

  it('η τυπογραφία κληρονομείται πεδίο-πεδίο: ό,τι δεν λέει το run το λέει το κελί', () => {
    const spans = spansOf({
      text: 'ΑΒΓΔ',
      runs: [{ start: 1, end: 3, style: { textColorHex: '#ff0000', textHeightMm: 20 } }],
    });
    expect(spans[1]).toMatchObject({
      colorHex: '#ff0000',
      heightMm: 20,
      // Δεν τα ανέφερε το run ⇒ έρχονται από το κελί, όχι από κάποια δεύτερη προεπιλογή.
      bold: false,
      italic: false,
      underline: false,
    });
  });

  it('`fontFamily: null` σβήνει την οικογένεια του κελιού — η τρίτη κατάσταση, ρητά', () => {
    const withFamily: TableCellStyle = { ...STYLE, fontFamily: 'Arial' };
    const spans = resolveCellStyledSpans({
      text: 'ΑΒΓΔ',
      runs: [{ start: 0, end: 2, style: { fontFamily: null } }],
      style: withFamily,
      measure,
    });
    expect(spans[0].fontFamily).toBeUndefined();
    expect(spans[1].fontFamily).toBe('Arial');
  });
});

// ── Kerning: διατηρείται ΜΕΣΑ, χάνεται ΠΑΝΩ στο όριο ────────────────────────

describe('🔴 kerning — η μοναδική πραγματική απώλεια, και το πού ακριβώς συμβαίνει', () => {
  it('ομοιογενές κείμενο κρατά ΚΑΘΕ ζεύγος, και το ζεύγος του ορίου', () => {
    // 'AABB' έχει ένα ζεύγος 'AB', ακριβώς πάνω στο μελλοντικό όριο.
    expect(kerned('AABB', HEIGHT_MM, STYLE)).toBeCloseTo(4 * U - 0.3, 10);
    expect(styledSpansWidthMm(spansOf({ text: 'AABB', measure: kerned }))).toBeCloseTo(
      4 * U - 0.3,
      10,
    );
  });

  it('όριο στυλ ΠΑΝΩ στο ζεύγος: το ζεύγος χάνεται — και δεν μπορεί να ανακτηθεί', () => {
    // Δύο `fillText` με άλλη γραμματοσειρά δεν έχουν κοινό ζεύγος να μετρηθεί. Το test το
    // δηλώνει ως **αναμενόμενο**, ώστε να μην «διορθωθεί» ποτέ σιωπηλά σε κάτι που η
    // ζωγραφική δεν μπορεί να εκτελέσει.
    const spans = spansOf({ text: 'AABB', runs: [BOLD(2, 4)], measure: kerned });
    expect(styledSpansWidthMm(spans)).toBeCloseTo(2 * U + 4 * U, 10);
  });

  it('ζεύγος ΜΕΣΑ σε τμήμα διατηρείται κανονικά', () => {
    // 'ABAB' με το δεύτερο μισό έντονο: κάθε μισό κρατά το δικό του ζεύγος.
    const spans = spansOf({ text: 'ABAB', runs: [BOLD(2, 4)], measure: kerned });
    expect(spans[0].advanceMm).toBeCloseTo(2 * U - 0.3, 10);
    expect(spans[1].advanceMm).toBeCloseTo(4 * U - 0.3, 10);
  });
});

// ── Συγχώνευση ίσων γειτόνων ────────────────────────────────────────────────

describe('γειτονικά τμήματα με ΙΣΑ επιλυμένα μετρικά γίνονται ένα', () => {
  it('🔴 run που δηλώνει `bold: false` σε μη έντονο κελί ΔΕΝ είναι τμήμα', () => {
    const spans = spansOf({
      text: 'AABB',
      runs: [{ start: 1, end: 3, style: { bold: false } }],
      measure: kerned,
    });
    expect(spans).toHaveLength(1);
    // Και επειδή είναι ένα τμήμα, το ζεύγος kerning επιστρέφει: το «βάψε και ξέβαψε» δεν
    // αφήνει μόνιμο αποτύπωμα στη στοίχιση. Χωρίς συγχώνευση θα ήταν 4U (τρία τμήματα).
    expect(styledSpansWidthMm(spans)).toBeCloseTo(4 * U - 0.3, 10);
  });

  it('δύο διαδοχικά runs με το ίδιο στυλ δίνουν ΕΝΑ τμήμα', () => {
    const spans = spansOf({ text: 'AABBCC', runs: [BOLD(0, 2), BOLD(2, 4)] });
    expect(spans.map((s) => s.text)).toEqual(['AABB', 'CC']);
  });

  it('πραγματική διαφορά ΔΕΝ συγχωνεύεται', () => {
    const spans = spansOf({ text: 'AABB', runs: [BOLD(0, 2)] });
    expect(spans).toHaveLength(2);
  });
});

// ── Το σημάδι του πίνακα δεν είναι κείμενο του χρήστη ────────────────────────

describe('`runsLimit` — τα αποσιωπητικά παίρνουν το στυλ του ΚΕΛΙΟΥ', () => {
  it('🔴 ο δείκτης «εδώ κόπηκε» ΔΕΝ κληρονομεί τα έντονα του τελευταίου γράμματος', () => {
    const spans = spansOf({ text: 'AB…', runs: [BOLD(0, 3)], runsLimit: 2 });
    expect(spans.map((s) => [s.text, s.bold])).toEqual([
      ['AB', true],
      ['…', false],
    ]);
  });

  it('χωρίς όριο, το run θα κάλυπτε και τον δείκτη — η εκδοχή που απορρίφθηκε', () => {
    // Ο ίδιος φύλακας από την ανάποδη: αν το `runsLimit` αγνοηθεί, το «…» γίνεται έντονο.
    const spans = spansOf({ text: 'AB…', runs: [BOLD(0, 3)] });
    expect(spans).toHaveLength(1);
    expect(spans[0].bold).toBe(true);
  });

  it('`runsLimit: 0` (το `####`) ⇒ κανένας χαρακτήρας δεν είναι του χρήστη', () => {
    const spans = spansOf({ text: '####', runs: [BOLD(0, 4)], runsLimit: 0 });
    expect(spans).toHaveLength(1);
    expect(spans[0].bold).toBe(false);
  });
});

// ── Πλάτος προθέματος ────────────────────────────────────────────────────────

describe('styledPrefixWidthMm — η γενίκευση του `measure(text.slice(0, k))`', () => {
  const text = 'AABBCC';
  const spans = spansOf({ text, runs: [BOLD(2, 4)] });

  it.each([
    [0, 0],
    [1, U],
    [2, 2 * U],
    // Μέσα στο έντονο τμήμα: το πρόθεμα μετριέται ΜΕ ΤΑ ΕΝΤΟΝΑ. Με το στυλ του κελιού θα
    // έδινε 3U — ο φύλακας της μετάλλαξης «χρησιμοποίησε το στυλ του κελιού».
    [3, 2 * U + 2 * U],
    [4, 6 * U],
    [6, 8 * U],
  ])('πρόθεμα %i χαρακτήρων ⇒ %f', (index, expected) => {
    expect(styledPrefixWidthMm(spans, index, measure)).toBeCloseTo(expected, 10);
  });

  it('δείκτης πέρα από το τέλος δίνει το σύνολο, ποτέ σφάλμα', () => {
    expect(styledPrefixWidthMm(spans, 99, measure)).toBeCloseTo(8 * U, 10);
    expect(styledPrefixWidthMm(spans, -3, measure)).toBe(0);
  });

  it('μονοτονία: κάθε επιπλέον χαρακτήρας δεν στενεύει ποτέ το πρόθεμα', () => {
    // Η προϋπόθεση που κάνει τη δυαδική αναζήτηση του χάρακα σωστή σε ετερογενές κείμενο.
    for (let i = 1; i <= text.length; i++) {
      expect(styledPrefixWidthMm(spans, i, measure)).toBeGreaterThanOrEqual(
        styledPrefixWidthMm(spans, i - 1, measure),
      );
    }
  });
});

// ── Ο χάρακας πάνω σε ετερογενές κείμενο ────────────────────────────────────

describe('fittingPrefixLengthAcrossSpans — πόσοι χαρακτήρες χωρούν', () => {
  const text = 'AABBCC';
  const spans = spansOf({ text, runs: [BOLD(2, 4)] });

  it('🔴 τα έντονα γεμίζουν τον χώρο γρηγορότερα — ο ομοιογενής χάρακας θα έλεγε 5', () => {
    // Σωρευτικά: [0, U, 2U, 4U, 6U, 7U, 8U]. Σε 5U χωρούν 3 χαρακτήρες.
    expect(fittingPrefixLengthAcrossSpans(spans, 5 * U, measure)).toBe(3);
    // Η ίδια ερώτηση αγνοώντας τα έντονα θα απαντούσε 5 — δηλαδή θα ζωγράφιζε πάνω στο
    // περίγραμμα, ακριβώς το ελάττωμα που το `table-cell-overflow.ts` υπάρχει για να λύσει.
    expect(Math.floor((5 * U) / U)).toBe(5);
  });

  it('χωρά ολόκληρο ⇒ όλο το μήκος· δεν χωρά τίποτα ⇒ μηδέν', () => {
    expect(fittingPrefixLengthAcrossSpans(spans, 8 * U, measure)).toBe(6);
    expect(fittingPrefixLengthAcrossSpans(spans, 0, measure)).toBe(0);
    expect(fittingPrefixLengthAcrossSpans([], 100, measure)).toBe(0);
  });

  it('το όριο είναι κλειστό — «χωράει ακριβώς» δεν κόβεται', () => {
    expect(fittingPrefixLengthAcrossSpans(spans, 2 * U, measure)).toBe(2);
  });
});

// ── Ολοκλήρωση: φτάνει στο TableCellLayout, με τον ΠΡΑΓΜΑΤΙΚΟ μετρητή ───────

describe('η διάταξη κουβαλά τα τμήματα — καμία ένεση', () => {
  const style: TableStyle = BUILTIN_TABLE_STYLES.find(
    (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
  )!;
  const column: TableColumn = {
    id: 'c1',
    sizing: { kind: 'fixed', widthMm: 90 },
    valueType: 'text',
    align: 'left',
  };
  const row: TableRow = { id: 'r1', rowClass: 'data' };

  // 🔴 ADR-799 — **ΤΟ ΟΡΓΑΝΟ ΠΡΕΠΕΙ ΝΑ ΒΛΕΠΕΙ ΤΟ ΣΤΥΛ, ΑΛΛΙΩΣ Η ΑΓΚΥΡΑ ΔΕΝ ΜΕΤΡΑ ΤΙΠΟΤΑ.**
  // Αυτό το describe είναι το μόνο που ΔΕΝ ενίεται μετρητή: ρωτά τον πραγματικό, μέσω
  // `layoutTable`. Μέχρι τις 24/08 έπαιρνε tier 2 (`ctx.measureText`) από το native canvas του
  // jsdom· το `19fbc2cc` το αφαίρεσε (αλυσίδα CVE `tar`, ADR-598 G2) και **οι τρεις ισχυρισμοί
  // παρακάτω κοκκίνισαν σωστά**: στο tier 3 η μονοδιάστημη προσέγγιση δέχεται `(text, height)`
  // και **τίποτε άλλο**, άρα έντονο και απλό έδιναν ΤΑΥΤΟΣΗΜΟ αριθμό.
  // Το ζεύγος όψεων επαναφέρει tier 1 **και για τα δύο σκέλη** — ντετερμινιστικά, χωρίς native
  // εξάρτηση και χωρίς μετρικές που αλλάζουν ανά λειτουργικό (μοντέλο `FlutterTest` / `Ahem`).
  let restoreFaces: () => void = () => {};
  beforeAll(() => { restoreFaces = installStubFontPair(0.6, 0.75); });
  afterAll(() => restoreFaces());


  const runFor = (cell: TableCell) =>
    layoutTable(
      createTableModel({ columns: [column], rows: [row], cells: [['r1', 'c1', cell]] }),
      style,
    ).cells[0]?.texts[0];

  it('🔴 κελί ΧΩΡΙΣ runs δεν αποκτά το πεδίο καθόλου — σχήμα αμετάβλητο', () => {
    const run = runFor({ kind: 'text', value: 'ΠΕΡΙΓΡΑΦΗ' });
    expect(run).toBeDefined();
    expect(run && 'spans' in run).toBe(false);
  });

  it('κελί με μορφοποίηση ανά χαρακτήρα φτάνει με τα τμήματά του', () => {
    const run = runFor({ kind: 'text', value: 'ΤΕΣΤ', runs: [BOLD(0, 2)] });
    expect(run?.spans).toHaveLength(2);
    expect(run?.spans?.[0]).toMatchObject({ text: 'ΤΕ', start: 0, end: 2, bold: true });
    expect(run?.spans?.[1]).toMatchObject({ text: 'ΣΤ', start: 2, end: 4, bold: false });
    // Οι μετατοπίσεις είναι σωρευτικές και θετικές — χωρίς καρφωμένη τιμή, γιατί εδώ μετρά
    // ο πραγματικός μετρητής.
    expect(run?.spans?.[0].offsetMm).toBe(0);
    expect(run?.spans?.[1].offsetMm).toBeGreaterThan(0);
  });

  it('run που δεν αλλάζει τίποτα ⇒ ένα τμήμα ⇒ το πεδίο πάλι λείπει', () => {
    const run = runFor({
      kind: 'text',
      value: 'ΤΕΣΤ',
      runs: [{ start: 0, end: 2, style: { bold: false } }],
    });
    expect(run && 'spans' in run).toBe(false);
  });

  it('🔴 η υπογράμμιση του στυλ καλύπτει το ΑΘΡΟΙΣΜΑ των τμημάτων, όχι μία μέτρηση', () => {
    // Ο τύπος του `TableTextRun` εγγυάται `advanceMm` όπου `underline: true`. Με ετερογενή
    // τμήματα η μία μέτρηση θα έδινε **κοντύτερη** γραμμή από τα γράμματα που υπογραμμίζει.
    const underlined: TableStyle = {
      ...style,
      rowClasses: {
        ...style.rowClasses,
        data: { ...style.rowClasses.data, underline: true },
      },
    };
    const runOf = (cell: TableCell) =>
      layoutTable(
        createTableModel({ columns: [column], rows: [row], cells: [['r1', 'c1', cell]] }),
        underlined,
      ).cells[0]?.texts[0];

    // ⚠️ **ΔΙΟΡΘΩΣΗ ADR-799.** Αυτό το σχόλιο έλεγε «μετρημένο με τον πραγματικό μετρητή
    // (opentype, tier 1): στο “ΤΕΣΤ” τα έντονα είναι στενότερα (6,222 vs 6,267)· στο
    // “ΠΕΡΙΓΡΑΦΗ” διαφέρουν 14,415 vs 14,089». Οι αριθμοί ήταν **αληθινοί**, από τις
    // πραγματικές όψεις — και **δεν ισχύουν εδώ**: το describe εγκαθιστά ζεύγος όψεων
    // δοκιμής, όπου το έντονο είναι ομοιόμορφα 25% πλατύτερο.
    //
    // 🔑 **Η ΓΝΩΣΗ ΟΜΩΣ ΜΕΝΕΙ, ΓΙΑΤΙ ΕΙΝΑΙ ΤΟ ΟΡΙΟ ΤΟΥ ΟΡΓΑΝΟΥ**: στην πραγματική
    // γραμματοσειρά τα έντονα **δεν είναι πάντα πλατύτερα**, είναι **αλλιώς** πλατιά, ανά
    // glyph. Άρα καμία λύση δεν επιτρέπεται να υποθέσει σταθερό πολλαπλασιαστή βάρους — και
    // η μονοτονία του ζεύγους δοκιμής είναι **σύμβαση του οργάνου**, όχι ιδιότητα των
    // γραμματοσειρών. Αυτό που κρίνει η άγκυρα είναι η **διάταξη** («έφτασε το στυλ στον
    // μετρητή;»), όχι η γραμματοσειρά.
    const plain = runOf({ kind: 'text', value: 'ΠΕΡΙΓΡΑΦΗ' });
    const bolded = runOf({ kind: 'text', value: 'ΠΕΡΙΓΡΑΦΗ', runs: [BOLD(0, 5)] });
    expect(bolded?.spans).toHaveLength(2);
    expect(plain?.underline).toBe(true);
    expect(bolded?.underline).toBe(true);
    const widthOfSpans = (r: typeof bolded) =>
      (r?.spans ?? []).reduce((sum, span) => sum + span.advanceMm, 0);

    // Το ίδιο το αναλλοίωτο: η γραμμή έχει το μήκος των τμημάτων που υπογραμμίζει.
    expect(bolded && bolded.underline && bolded.advanceMm).toBeCloseTo(widthOfSpans(bolded), 10);
    // Και είναι όντως ΑΛΛΟΣ αριθμός από το ομοιογενές — αλλιώς το test θα ήταν πράσινο
    // ό,τι κι αν έκανε ο κώδικας.
    expect(bolded && bolded.underline && bolded.advanceMm).not.toBeCloseTo(
      (plain?.underline && plain.advanceMm) as number,
      6,
    );
  });

  it('🔴 τα δύο επίπεδα συνθέτονται: ο σύνδεσμος μετακινείται όταν πλαταίνει ό,τι προηγείται', () => {
    // Ο σύνδεσμος δεν ξέρει τι είναι τα runs — ρωτά μόνο «πόσο πλατείς είναι οι πρώτοι k
    // χαρακτήρες». Αν η απάντηση αγνοούσε τα έντονα, η μπλε υπογράμμιση θα κάθιζε αριστερά
    // από τα ψηφία που υπογραμμίζει: το ακριβές ελάττωμα που το ADR-751 έλυσε.
    const linkOf = (cell: TableCell) => runFor(cell)?.links?.[0];
    const plain = linkOf({ kind: 'text', value: 'Τηλ: 2310788493' });
    const heavy = linkOf({
      kind: 'text',
      value: 'Τηλ: 2310788493',
      runs: [BOLD(0, 5)],
    });
    expect(plain?.href).toBe('tel:2310788493');
    expect(heavy?.href).toBe('tel:2310788493');
    expect(heavy?.offsetMm).toBeGreaterThan(plain?.offsetMm as number);
    // Το ίδιο το τμήμα δεν αλλάζει πλάτος — τα ψηφία δεν έγιναν έντονα.
    expect(heavy?.advanceMm).toBeCloseTo(plain?.advanceMm as number, 10);
  });

  // ── ADR-799: το ΟΡΓΑΝΟ, όχι μόνο ο αριθμός ──────────────────────────────
  it('🔴 ΚΑΙ ΤΑ ΔΥΟ σκέλη μετριούνται στη ΒΑΘΜΙΔΑ ΠΕΡΙΓΡΑΜΜΑΤΩΝ — αλλιώς η σύγκριση είναι άκυρη', () => {
    // Χωρίς αυτό, οι τρεις ισχυρισμοί από πάνω μπορούν να γίνουν πράσινοι συγκρίνοντας
    // **opentype με μονοδιάστημη**: δύο διαφορετικά όργανα δίνουν διαφορετικό αριθμό, οπότε
    // κάθε `toBeGreaterThan` περνά — για λόγο που δεν έχει σχέση με το αν η διάταξη προώθησε
    // ποτέ το στυλ. Η άγκυρα απαιτεί **το ίδιο** όργανο και στα δύο σκέλη.
    const plain = measureTextAdvanceVerdict('ΠΕΡΙΓΡΑΦΗ', HEIGHT_MM, { bold: false });
    const bold = measureTextAdvanceVerdict('ΠΕΡΙΓΡΑΦΗ', HEIGHT_MM, { bold: true });
    expect(plain.kind).toBe('glyph');
    expect(bold.kind).toBe('glyph');
    expect(plain.kind === 'glyph' && plain.face).toBe('Liberation Sans');
    expect(bold.kind === 'glyph' && bold.face).toBe('Liberation Sans Bold');
    // Και οι δύο όψεις είναι όντως ΔΙΑΚΡΙΤΕΣ — ένα ζεύγος με ίδιο λόγο θα άφηνε κάθε
    // ισχυρισμό πλάτους πράσινο ό,τι κι αν έκανε ο κώδικας.
    expect(bold.world).toBeGreaterThan(plain.world);
  });

  it('🔴 τα έντονα μεγαλώνουν τη στήλη `hug` — η μέτρηση φτάνει στο πλάτος', () => {
    const hug: TableColumn = { ...column, sizing: { kind: 'hug' } };
    const widthOf = (cell: TableCell) =>
      layoutTable(
        createTableModel({ columns: [hug], rows: [row], cells: [['r1', 'c1', cell]] }),
        style,
      ).columns[0].widthMm;

    const plain = widthOf({ kind: 'text', value: 'ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ' });
    const bolded = widthOf({ kind: 'text', value: 'ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ', runs: [BOLD(0, 9)] });
    expect(bolded).toBeGreaterThan(plain);
  });
});

// ── ADR-799: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — τι συμβαίνει όταν το όργανο ΔΕΝ βλέπει το στυλ ──

describe('ο μετρητής ΛΕΕΙ σε ποια βαθμίδα απάντησε — και το tier 3 είναι τυφλό στο στυλ', () => {
  // ⚠️ Αυτό το describe ΔΕΝ εγκαθιστά όψεις, **επίτηδες**. Είναι η ζωντανή αναπαραγωγή της
  // κατάστασης που στις 24/08 κοκκίνισε τρεις ισχυρισμούς — και η απόδειξη ότι το ζεύγος
  // όψεων από πάνω **κάνει διαφορά**. Χωρίς αυτό, το «με το ζεύγος βγαίνουν σωστά» θα
  // μπορούσε να είναι πράσινο επειδή **δεν υπήρξε ποτέ βλάβη**.

  it('🔴 χωρίς φορτωμένη όψη, ΕΝΤΟΝΟ και ΑΠΛΟ δίνουν ΤΑΥΤΟΣΗΜΟ αριθμό', () => {
    const plain = measureTextAdvanceVerdict('ΠΕΡΙΓΡΑΦΗ', HEIGHT_MM, { bold: false });
    const bold = measureTextAdvanceVerdict('ΠΕΡΙΓΡΑΦΗ', HEIGHT_MM, { bold: true });
    expect(bold.world).toBe(plain.world);
  });

  it('🔴 και το ΛΕΕΙ: `nominal`, με ΟΝΟΜΑΤΑ των αξόνων που πετάχτηκαν', () => {
    // Αυτό ακριβώς έλειπε πριν το ADR-799: η συνάρτηση απαντούσε απόλυτα εύλογο αριθμό και
    // **κανείς δεν μπορούσε να ρωτήσει** αν τίμησε το αίτημα. Η αποτυχία ήταν άφωνη.
    const v = measureTextAdvanceVerdict('ΠΕΡΙΓΡΑΦΗ', HEIGHT_MM, {
      bold: true,
      italic: true,
      fontFamily: 'arial',
    });
    expect(v.kind).toBe('nominal');
    expect(v.kind === 'nominal' && [...v.dropped].sort()).toEqual(['bold', 'family', 'italic']);
  });

  it('αίτημα ΧΩΡΙΣ άξονες στυλ δεν «πέταξε» τίποτα — καμία ψεύτικη καταγγελία', () => {
    // Το `dropped` ονομάζει ό,τι **ζητήθηκε** και δεν τιμήθηκε. Ένα σκέτο μήκος/ύψος δεν
    // ζητά τίποτα που η μονοδιάστημη προσέγγιση να μην μπορεί να δώσει.
    const v = measureTextAdvanceVerdict('ΠΕΡΙΓΡΑΦΗ', HEIGHT_MM);
    expect(v.kind).toBe('nominal');
    expect(v.kind === 'nominal' && v.dropped).toEqual([]);
  });
});
