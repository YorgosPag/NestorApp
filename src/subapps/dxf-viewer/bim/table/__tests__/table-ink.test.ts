/**
 * ADR-739 §38 — **το αυτόματο μελάνι του κελιού**: ο κανόνας, ο εγκλωβισμός, οι δύο επιφάνειες.
 *
 * ## 🔴 Γιατί ΚΑΘΕ test εδώ δίνει το φόντο ως ΟΡΙΣΜΑ
 * Σε jsdom το `resolveDxfCanvasBackgroundHex()` δεν βρίσκει ποτέ CSS μεταβλητή και πέφτει
 * **πάντα** στο σκούρο default. Ένα suite που άφηνε τη μηχανή να το ρωτήσει μόνη της θα
 * δοκίμαζε **μόνο** την κατεύθυνση «σκούρο → λευκό» και θα έμενε ολόκληρο πράσινο με σπασμένη
 * την «λευκό → μαύρο» — δηλαδή ακριβώς την κατεύθυνση που φεύγει στον πελάτη ως **τυπωμένο
 * χαρτί** και δεν αναιρείται. Το `backdropHex` / `surfaceHex` είναι όρισμα γι' αυτόν ακριβώς
 * τον λόγο, και τα tests το εκμεταλλεύονται.
 *
 * @see bim/table/table-ink.ts
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §38
 */

import {
  AUTOMATIC_TABLE_INK,
  isAutomaticTableInk,
  liveTableSurfaceHex,
  resolveTableBorderInk,
  resolveTableCellStyleInk,
  resolveTableInk,
  TABLE_PAPER_HEX,
  tableCellBackdrop,
} from '../table-ink';
import { layoutTable } from '../table-layout';
import { HIDDEN_TABLE_EDGE } from '../table-edge-model';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableCellStyle, TableStyle } from '../table-style';
import { createTableModel } from '../table-model-helpers';
import { parseHex, contrastRatio } from '../../../config/color-math';
import {
  _clearAdaptiveColorCache,
  adaptColorForSurface,
  adaptEntityColorForCanvas,
  maxContrastInk,
  MIN_ENTITY_CONTRAST,
} from '../../../config/adaptive-entity-color';
import { resolveDxfCanvasBackgroundHex } from '../../../config/color-config';
import type { TableBorderSpec } from '../../../types/table-edges';
import {
  clearPrintColorPolicy,
  setPrintColorPolicy,
} from '../../../config/print-color-policy';
import type { TableModel } from '../../../types/table';
import type { TableTextMeasurer } from '../table-layout-types';

/** Το προεπιλεγμένο θέμα καμβά — `nestorApp1`, όπου το παλιό `#111111` μετρήθηκε 1,27:1. */
const DARK_CANVAS = '#1d283a';

const STANDARD: TableStyle =
  BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD)!;

/**
 * Το χρώμα πλέγματος του `standard`, **διαβασμένο από το preset** — ποτέ αντιγραμμένο literal.
 *
 * Ένα `'#666666'` γραμμένο εδώ θα ήταν δεύτερη πηγή αλήθειας: αν κάποιος άλλαζε τη σταθερά, το
 * test θα συνέχιζε να μετρά το **παλιό** χρώμα και θα έμενε πράσινο ενώ το πραγματικό πλέγμα θα
 * είχε ξαναπέσει κάτω από το κατώφλι — δηλαδή ακριβώς το «0 = κανείς δεν κοίταξε».
 */
const STANDARD_GRID_HEX_UNDER_TEST: string =
  STANDARD.rowClasses.data.borders.insideH.colorHex;

function cellStyle(overrides: Partial<TableCellStyle> = {}): TableCellStyle {
  return {
    textHeightMm: 2.8,
    textColorHex: AUTOMATIC_TABLE_INK,
    bold: false,
    italic: false,
    underline: false,
    align: 'ML',
    indentLevel: 0,
    margins: { hMm: 2, vMm: 1.5 },
    ...overrides,
  };
}

/** Ντετερμινιστικός μετρητής — ίδια σύμβαση με το `table-layout.test.ts` (N.18: ένεση, όχι 2η υλοποίηση). */
const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

/** Δύο γραμμές, δύο κλάσεις — ώστε ο έλεγχος να περνά από περισσότερα από ένα κελιά. */
function sampleModel(): TableModel {
  return createTableModel({
    columns: [{ id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' }],
    rows: [
      { id: 'r0', rowClass: 'header' },
      { id: 'r1', rowClass: 'data' },
    ],
    cells: [
      ['r0', 'c0', { kind: 'text', value: 'Κεφαλίδα' }],
      ['r1', 'c0', { kind: 'text', value: 'Νέστωρ' }],
    ],
  });
}

// ── Ο κανόνας ────────────────────────────────────────────────────────────────

describe('resolveTableInk — ο κανόνας ACI 7', () => {
  it('σκούρο φόντο ⇒ λευκό· λευκό χαρτί ⇒ μαύρο — η ΙΔΙΑ τιμή, δύο απαντήσεις', () => {
    expect(resolveTableInk(AUTOMATIC_TABLE_INK, DARK_CANVAS)).toBe('#ffffff');
    expect(resolveTableInk(AUTOMATIC_TABLE_INK, TABLE_PAPER_HEX)).toBe('#000000');
  });

  it('ρητό χρώμα επιστρέφεται ΑΥΤΟΥΣΙΟ, σε κάθε επιφάνεια', () => {
    for (const surface of [DARK_CANVAS, TABLE_PAPER_HEX, '#808080']) {
      expect(resolveTableInk('#e11d48', surface)).toBe('#e11d48');
    }
  });

  it('🔴 άκυρο φόντο ⇒ μαύρο: αποτυγχάνουμε προς την ΑΝΑΣΤΡΕΨΙΜΗ πλευρά', () => {
    // Από τις δύο σιωπηλές αποτυχίες, το μαύρο σε σκούρη οθόνη το βλέπει ο χρήστης αμέσως·
    // το λευκό σε λευκό χαρτί φεύγει στον πελάτη.
    expect(resolveTableInk(AUTOMATIC_TABLE_INK, 'δεν-είναι-χρώμα')).toBe('#000000');
  });

  it('🔴 διαλέγει το άκρο με τη ΜΕΓΑΛΥΤΕΡΗ αντίθεση — όχι το «κάτω από το μισό»', () => {
    // Η ζώνη 0,179 < L < 0,5, όπου ένα κατώφλι φωτεινότητας 0.5 έδινε λευκό ενώ το μαύρο
    // ξεχωρίζει περισσότερο. Δεν είναι θεωρητική: τα γεμίσματα κελιών είναι αυθαίρετα
    // χρώματα του χρήστη και πέφτουν εκεί μέσα συνέχεια.
    for (const midTone of ['#868686', '#808080', '#7a7a7a']) {
      const ink = resolveTableInk(AUTOMATIC_TABLE_INK, midTone);
      const white = contrastRatio('#ffffff', midTone);
      const black = contrastRatio('#000000', midTone);
      expect(black).toBeGreaterThan(white);
      expect(ink).toBe('#000000');
    }
  });

  it('η επιλογή είναι ΠΑΝΤΑ ο νικητής της αντίθεσης, σε όλο το φάσμα του γκρι', () => {
    for (let v = 0; v <= 255; v += 5) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      const ink = resolveTableInk(AUTOMATIC_TABLE_INK, hex);
      const best = contrastRatio('#ffffff', hex) >= contrastRatio('#000000', hex)
        ? '#ffffff'
        : '#000000';
      expect(ink).toBe(best);
    }
  });
});

// ── Το φόντο του κελιού ──────────────────────────────────────────────────────

describe('tableCellBackdrop — το γέμισμα νικά την επιφάνεια', () => {
  it('κελί με γέμισμα κρίνεται ως προς ΤΟ ΓΕΜΙΣΜΑ, όχι ως προς τον καμβά', () => {
    // Ανοιχτή κεφαλίδα πάνω σε σκούρο καμβά: λευκό μελάνι εκεί είναι το ίδιο ελάττωμα σε
    // μικρογραφία (§19.8: «όποιο κελί έχει γέμισμα, χάνει το κείμενο»).
    expect(tableCellBackdrop('#ededed', DARK_CANVAS)).toBe('#ededed');
    expect(resolveTableInk(AUTOMATIC_TABLE_INK, tableCellBackdrop('#ededed', DARK_CANVAS)))
      .toBe('#000000');
  });

  it('κελί χωρίς γέμισμα πέφτει στην επιφάνεια — και `null` μετράει ως «κανένα»', () => {
    expect(tableCellBackdrop(undefined, DARK_CANVAS)).toBe(DARK_CANVAS);
    expect(tableCellBackdrop(null, DARK_CANVAS)).toBe(DARK_CANVAS);
  });
});

// ── Ο κόμβος επίλυσης ────────────────────────────────────────────────────────

describe('resolveTableCellStyleInk — εκεί πεθαίνει το σεντινέλι', () => {
  it('επιλύει το αυτόματο μελάνι πάνω στο στυλ του κελιού', () => {
    expect(resolveTableCellStyleInk(cellStyle(), DARK_CANVAS).textColorHex).toBe('#ffffff');
    expect(resolveTableCellStyleInk(cellStyle(), TABLE_PAPER_HEX).textColorHex).toBe('#000000');
  });

  it('λαμβάνει υπόψη το γέμισμα του ΙΔΙΟΥ κελιού', () => {
    const style = cellStyle({ fillColorHex: '#ededed' });
    expect(resolveTableCellStyleInk(style, DARK_CANVAS).textColorHex).toBe('#000000');
  });

  it('🔴 μη-σεντινέλι ⇒ Η ΙΔΙΑ ΑΝΑΦΟΡΑ, όχι αντίγραφο', () => {
    // Το `TableCellStyle` ταξιδεύει σε κάθε κελί κάθε καρέ· ένα νέο αντικείμενο ανά κελί θα
    // ήταν δέσμευση χωρίς αντίκρισμα και θα χαλούσε κάθε σύγκριση με `===`.
    const style = cellStyle({ textColorHex: '#222222' });
    expect(resolveTableCellStyleInk(style, DARK_CANVAS)).toBe(style);
  });
});

// ── Ο εγκλωβισμός, μετρημένος στην ΕΞΟΔΟ της μηχανής ─────────────────────────

describe('🔴 εγκλωβισμός: η διάταξη ΔΕΝ βγάζει ποτέ σεντινέλι', () => {
  const model = sampleModel();

  /**
   * 🔴 Ο έλεγχος είναι **εγκυρότητα**, όχι ισότητα — και αυτό είναι όλη η ουσία.
   *
   * Ένα test που συγκρίνει διάταξη με διάταξη (π.χ. οθόνη vs εξαγωγή) είναι **δομικά ανίκανο**
   * να πιάσει διαρροή σεντινελιού: και οι δύο πλευρές θα έγραφαν `'auto'`, η σύγκριση θα ήταν
   * `'auto' === 'auto'` και το suite θα έμενε πράσινο ενώ **κανένα** από τα τέσσερα backends
   * δεν θα ζωγράφιζε σωστά. Η μόνη ερώτηση που πιάνει το ελάττωμα είναι «είναι αυτό χρώμα;».
   */
  function expectEveryColorIsRealHex(surfaceHex: string): void {
    const layout = layoutTable(model, STANDARD, { surfaceHex, measureText });
    expect(layout.cells.length).toBeGreaterThan(0);
    for (const cell of layout.cells) {
      expect(parseHex(cell.style.textColorHex)).not.toBeNull();
      expect(isAutomaticTableInk(cell.style.textColorHex)).toBe(false);
      if (cell.texts[0]) {
        expect(parseHex(cell.texts[0].colorHex)).not.toBeNull();
        expect(isAutomaticTableInk(cell.texts[0].colorHex)).toBe(false);
      }
    }
  }

  it('σε ΟΘΟΝΗ — και το χρώμα είναι λευκό', () => {
    expectEveryColorIsRealHex(DARK_CANVAS);
    const layout = layoutTable(model, STANDARD, { surfaceHex: DARK_CANVAS, measureText });
    expect(layout.cells[0].texts[0]?.colorHex).toBe('#ffffff');
  });

  it('σε ΧΑΡΤΙ — και το χρώμα είναι μαύρο', () => {
    expectEveryColorIsRealHex(TABLE_PAPER_HEX);
    const layout = layoutTable(model, STANDARD, { surfaceHex: TABLE_PAPER_HEX, measureText });
    expect(layout.cells[0].texts[0]?.colorHex).toBe('#000000');
  });

  it('🔴 ΧΩΡΙΣ επιφάνεια ⇒ χαρτί: η προεπιλογή δείχνει προς την ασφαλή πλευρά', () => {
    expectEveryColorIsRealHex(TABLE_PAPER_HEX);
    expect(layoutTable(model, STANDARD, { measureText }).cells[0].texts[0]?.colorHex).toBe('#000000');
  });

  it('το ΚΕΛΙ και το RUN συμφωνούν πάντα — ένας κόμβος επίλυσης, όχι δύο', () => {
    for (const surface of [DARK_CANVAS, TABLE_PAPER_HEX]) {
      for (const cell of layoutTable(model, STANDARD, { surfaceHex: surface, measureText }).cells) {
        if (cell.texts[0]) expect(cell.texts[0].colorHex).toBe(cell.style.textColorHex);
      }
    }
  });
});

// ── Ποια επιφάνεια ισχύει τώρα ───────────────────────────────────────────────

describe('liveTableSurfaceHex — ο έλεγχος εκτύπωσης ΔΕΝ είναι προαιρετικός', () => {
  afterEach(() => clearPrintColorPolicy());

  it('🔴 σε εκτύπωση επιστρέφει ΧΑΡΤΙ, ακόμη κι όταν το θέμα λέει «σκούρο»', () => {
    // Η raster εκτύπωση ξαναχρησιμοποιεί το παραγωγικό pipeline πάνω σε **διάφανο** offscreen
    // καμβά ⇒ η σελίδα είναι λευκή, ενώ το `:root` εξακολουθεί να λέει σκούρο. Χωρίς αυτόν τον
    // έλεγχο ο χρήστης τυπώνει λευκά γράμματα σε λευκό χαρτί.
    setPrintColorPolicy({ style: 'colour', dpi: 300 });
    expect(liveTableSurfaceHex()).toBe(TABLE_PAPER_HEX);
  });

  it('εκτός εκτύπωσης δείχνει στο ζωντανό φόντο του καμβά (σκούρο σε jsdom)', () => {
    clearPrintColorPolicy();
    const surface = liveTableSurfaceHex();
    expect(surface).not.toBe(TABLE_PAPER_HEX);
    expect(parseHex(surface)).not.toBeNull();
  });
});

// ── ΤΟ ΠΛΕΓΜΑ (§38.11) ───────────────────────────────────────────────────────

/**
 * Οι **10 επιφάνειες** που μετρήθηκαν ζωντανά στις 04/08 — τα 9 προκαθορισμένα θέματα καμβά,
 * το προεπιλεγμένο `custom`, και το χαρτί. Γραμμένες εδώ ως **δεδομένα του test**, γιατί το
 * ερώτημα «περνά το πλέγμα το κατώφλι;» πρέπει να απαντηθεί για **κάθε** μία — όχι για όποια
 * έτυχε να ανοίξει ο τελευταίος που κοίταξε.
 *
 * 🔴 Οι πέντε με ✗ ήταν **κάτω** από το κατώφλι πριν το §38.11· η προεπιλογή ήταν από τις
 * χειρότερες. Δες ADR-739 §38.10 για τον πίνακα των μετρήσεων.
 */
const MEASURED_SURFACES: readonly string[] = [
  '#1d283a', // nestorApp1 (ΠΡΟΕΠΙΛΟΓΗ) — ήταν 2,58:1 ✗
  '#161a22', // nestorApp2
  '#000000', // autocadClassic
  '#1a1a1a', // autocadDark
  '#2d3748', // solidworks — ήταν 2,09:1 ✗
  '#232323', // blender — ήταν 2,74:1 ✗
  '#ffffff', // light
  '#5b5b5b', // cinema4d — ήταν 1,18:1 ✗ (το χειρότερο)
  '#1e293b', // custom (default) — ήταν 2,55:1 ✗
  TABLE_PAPER_HEX,
];

describe('resolveTableBorderInk — το πλέγμα προσαρμόζεται ΕΛΑΧΙΣΤΑ, όχι στο άκρο', () => {
  const grid = (colorHex: string, visible = true): TableBorderSpec => ({
    visible,
    colorHex,
    widthMm: 0.13,
  });

  it('🔴 ΤΟ ΕΛΑΤΤΩΜΑ: το #666666 έπεφτε κάτω από το κατώφλι σε 5 από τις 10 επιφάνειες', () => {
    // Το test που **δεν** υπήρχε. Χωρίς αυτό, η μόνη απόδειξη ότι το ελάττωμα ήταν πραγματικό
    // είναι μια γραμμή σε handoff — δηλαδή ακριβώς το σχήμα «μπαγιάτικος αριθμός».
    const failing = MEASURED_SURFACES.filter(
      (s) => contrastRatio(STANDARD_GRID_HEX_UNDER_TEST, s) < MIN_ENTITY_CONTRAST,
    );
    expect(failing).toHaveLength(5);
    expect(failing).toContain('#1d283a'); // η ΠΡΟΕΠΙΛΟΓΗ
    expect(failing).toContain('#5b5b5b'); // cinema4d
  });

  it('🔴 ΜΕΤΑ: κάθε μία από τις 10 επιφάνειες περνά το κατώφλι', () => {
    for (const surface of MEASURED_SURFACES) {
      const out = resolveTableBorderInk(grid(STANDARD_GRID_HEX_UNDER_TEST), surface);
      expect(parseHex(out.colorHex)).not.toBeNull();
      expect(contrastRatio(out.colorHex, surface)).toBeGreaterThanOrEqual(MIN_ENTITY_CONTRAST);
    }
  });

  it('🔴 ΕΛΑΧΙΣΤΗ, ΟΧΙ ΜΕΓΙΣΤΗ — το πλέγμα ΔΕΝ γίνεται λευκό/μαύρο', () => {
    // Αυτό είναι που μας ξεχωρίζει από AutoCAD/Revit, που πηδούν στο άκρο. Ένα πλέγμα στο άκρο
    // γίνεται πιο δυνατό από το κείμενο που περιβάλλει — αντιστροφή της ιεραρχίας ISO 128.
    for (const surface of ['#1d283a', '#5b5b5b', '#232323']) {
      const out = resolveTableBorderInk(grid(STANDARD_GRID_HEX_UNDER_TEST), surface).colorHex;
      expect(out).not.toBe(maxContrastInk(surface));
      expect(out).not.toBe('#ffffff');
      expect(out).not.toBe('#000000');
    }
  });

  it('χρώμα που ΗΔΗ περνά επιστρέφεται με την ΙΔΙΑ αναφορά (fast-path του coalesce)', () => {
    // Δεν είναι μικροβελτιστοποίηση: το `sameBorderSpec` έχει fast-path `a === b`, και ένας
    // 8×500 πίνακας ρωτά ~8.500 ακμές ΑΝΑ ΑΛΛΑΓΗ ΜΟΝΤΕΛΟΥ — δηλαδή ανά πληκτρολόγηση.
    const spec = grid('#ffffff');
    expect(resolveTableBorderInk(spec, '#1d283a')).toBe(spec);
  });

  it('η ΑΟΡΑΤΗ ακμή μένει αυτούσια — η κανονική μορφή του «Χωρίς περίγραμμα» δεν πειράζεται', () => {
    // ADR-750 Α14: δύο ταυτόσημα «Χωρίς περίγραμμα» πρέπει να παράγουν ΙΔΙΑ εγγραφή, αλλιώς
    // βήμα undo + diff αρχείου για μηδενική οπτική διαφορά.
    expect(resolveTableBorderInk(HIDDEN_TABLE_EDGE, '#1d283a')).toBe(HIDDEN_TABLE_EDGE);
  });

  it('🔴 Η ΕΠΙΦΑΝΕΙΑ ΕΙΝΑΙ ΟΡΙΣΜΑ, ΟΧΙ ΜΑΝΤΕΨΙΑ — σκούρο χρώμα σε ΧΑΡΤΙ μένει αυτούσιο', () => {
    /**
     * 🔴 **Το test που πιάνει τη μετάλλαξη M3** (προσαρμογή μέσω `adaptEntityColorForCanvas`,
     * που ρωτά **μόνη της** το ζωντανό CSS αντί να δεχτεί την επιφάνεια).
     *
     * Το χρώμα είναι `#2b2f36` και **όχι** το `#666666` του πλέγματος, και ο λόγος μετρήθηκε:
     * σε jsdom το `resolveDxfCanvasBackgroundHex()` επιστρέφει **`#000000`**, όπου το `#666666`
     * έχει **3,657:1** — δηλαδή περνά **ήδη** το κατώφλι και **δεν προσαρμόζεται**. Άρα η M3
     * είναι εκεί **κυριολεκτικά no-op** και **κανένα** test με το χρώμα του πλέγματος δεν μπορεί
     * να τη δει. Το `#2b2f36` έχει ≈1,6:1 στο μαύρο (προσαρμόζεται) και περνά άνετα στο λευκό
     * (δεν προσαρμόζεται) ⇒ οι δύο επιφάνειες δίνουν **διαφορετική** απάντηση, και μόνο η σωστή
     * δίνει «καμία αλλαγή» στο χαρτί.
     *
     * *(Γενικό μάθημα: μια μετάλλαξη που δεν αλλάζει τιμή δεν αποδεικνύει καλό test — αποδεικνύει
     * ότι το δείγμα ήταν λάθος.)*
     */
    const spec = grid('#2b2f36');
    // Σε **σκούρο** καμβά προσαρμόζεται· σε **λιγότερο σκούρο** αλλιώς. Δύο επιφάνειες, δύο
    // απαντήσεις — αυτό είναι που καταρρέει μόλις η μηχανή αρχίσει να μαντεύει την επιφάνεια.
    expect(resolveTableBorderInk(spec, '#000000').colorHex).not.toBe(
      resolveTableBorderInk(spec, '#5b5b5b').colorHex,
    );
  });

  it('🔴🔴 ΤΟ ΧΑΡΤΙ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΠΟΤΕ — ούτε όταν το χρώμα πέφτει κάτω από το κατώφλι', () => {
    /**
     * Το test που **κοκκίνισε 4 φορές** και είχε δίκιο. Το `#999999` του πίνακα οπλισμών μετρά
     * **2,85:1** σε λευκή σελίδα — κάτω από το κατώφλι — και **παρ' όλα αυτά** πρέπει να τυπωθεί
     * αυτούσιο: είναι **απόφαση του συντάκτη** για λεπτή γραμμή, όχι ελάττωμα.
     *
     * Ο διαχωρισμός: το **σεντινέλι** είναι εντολή («υπολόγισέ το») και εκτελείται και στο
     * χαρτί· ένα **ρητό** χρώμα είναι απόφαση και το έγγραφο τη σέβεται. Αν κάποιος αφαιρέσει
     * τον φρουρό «επιφάνεια === χαρτί», εδώ γίνεται κόκκινο **πριν** φτάσει σε πελάτη.
     */
    const authored = grid('#999999');
    expect(contrastRatio('#999999', TABLE_PAPER_HEX)).toBeLessThan(MIN_ENTITY_CONTRAST);
    expect(resolveTableBorderInk(authored, TABLE_PAPER_HEX)).toBe(authored);
  });

  it('🔴 ΚΑΜΙΑ εγγραφή σεντινελιού: η προσαρμογή δίνει ΠΑΝΤΑ πραγματικό hex', () => {
    // Ο λόγος που δεν χρησιμοποιήθηκε το `AUTOMATIC_TABLE_INK` για τις ακμές: το χρώμα ακμής
    // γράφεται στη βάση (§38.3) και το `sameBorderSpec` θα ένωνε μη αναστρέψιμα.
    for (const surface of MEASURED_SURFACES) {
      const out = resolveTableBorderInk(grid('#2b2f36'), surface);
      expect(isAutomaticTableInk(out.colorHex)).toBe(false);
      expect(parseHex(out.colorHex)).not.toBeNull();
    }
  });
});

describe('το πλέγμα μέσα στη ΔΙΑΤΑΞΗ — ο ίδιος κόμβος με το μελάνι', () => {
  const model = sampleModel();

  it('🔴 σε ΧΑΡΤΙ το πλέγμα μένει ΑΥΤΟΥΣΙΟ — η επιφάνεια είναι ΟΡΙΣΜΑ, όχι μαντεψιά', () => {
    /**
     * Ο έλεγχος είναι **ταυτότητα**, όχι κατώφλι: η εξαγωγή οφείλει να βγάλει **ακριβώς** ό,τι
     * έγραψε ο συντάκτης του στυλ. Ένα «≥ κατώφλι» θα δεχόταν και ένα `≈#707070` — δηλαδή θα
     * έλεγε «εντάξει» σε μηχανή που άλλαξε το **έγγραφο**.
     *
     * Μαζί με το «ΤΟ ΧΑΡΤΙ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΠΟΤΕ» κλειδώνει και τις δύο πλευρές: εκείνο ότι
     * **δεν διορθώνουμε** αυθεντικό χρώμα, αυτό ότι η **πλήρης διαδρομή** (μοντέλο → διάταξη →
     * τμήματα) το παραδίδει άθικτο.
     */
    const layout = layoutTable(model, STANDARD, { surfaceHex: TABLE_PAPER_HEX, measureText });
    expect(layout.borders.length).toBeGreaterThan(0);
    for (const segment of layout.borders) {
      expect(segment.spec.colorHex).toBe(STANDARD_GRID_HEX_UNDER_TEST);
    }
  });

  it('η ΙΔΙΑ διάταξη σε σκούρο καμβά δίνει ΑΛΛΟ πλέγμα — και τα δύο περνούν το κατώφλι', () => {
    const paper = layoutTable(model, STANDARD, { surfaceHex: TABLE_PAPER_HEX, measureText });
    const dark = layoutTable(model, STANDARD, { surfaceHex: DARK_CANVAS, measureText });
    expect(dark.borders[0].spec.colorHex).not.toBe(paper.borders[0].spec.colorHex);
    expect(contrastRatio(dark.borders[0].spec.colorHex, DARK_CANVAS)).toBeGreaterThanOrEqual(
      MIN_ENTITY_CONTRAST,
    );
  });

  it('🔴 ΤΟ ΠΛΕΓΜΑ ΜΕΝΕΙ ΥΠΟΤΕΤΑΓΜΕΝΟ ΣΤΟ ΚΕΙΜΕΝΟ, σε κάθε επιφάνεια', () => {
    // Η ουσία της απόφασης «ελάχιστη αντί μέγιστη»: το κείμενο πάει στο άκρο (ACI 7), το
    // πλέγμα σταματά μόλις περάσει το κατώφλι ⇒ το κείμενο έχει ΠΑΝΤΑ περισσότερη αντίθεση.
    // Αν κάποιος «απλοποιήσει» το πλέγμα σε `maxContrastInk`, εδώ γίνεται ισοπαλία και σπάει.
    for (const surface of [DARK_CANVAS, TABLE_PAPER_HEX, '#5b5b5b']) {
      const layout = layoutTable(model, STANDARD, { surfaceHex: surface, measureText });
      const ink = layout.cells[0].style.textColorHex;
      expect(contrastRatio(ink, surface)).toBeGreaterThan(
        contrastRatio(layout.borders[0].spec.colorHex, surface),
      );
    }
  });
});

describe('adaptColorForSurface — μία μνήμη, δύο πόρτες', () => {
  beforeEach(() => _clearAdaptiveColorCache());

  it('🔴 η ρητή επιφάνεια και το ζωντανό φόντο δίνουν ΤΟ ΙΔΙΟ αποτέλεσμα για το ίδιο φόντο', () => {
    // Ο λόγος που το `adaptEntityColorForCanvas` έγινε delegate και δεν αντιγράφηκε: δύο σώματα
    // του ίδιου κανόνα είναι sibling clone που το CHECK 3.28 πιάνει ανεξάρτητα ονόματος.
    const live = resolveDxfCanvasBackgroundHex();
    expect(adaptColorForSurface('#2b2f36', live)).toBe(adaptEntityColorForCanvas('#2b2f36'));
  });

  it('το memo δεν μπερδεύει δύο επιφάνειες — το κλειδί περιέχει το φόντο', () => {
    const onDark = adaptColorForSurface('#2b2f36', DARK_CANVAS);
    const onPaper = adaptColorForSurface('#2b2f36', TABLE_PAPER_HEX);
    expect(onDark).not.toBe(onPaper);
    expect(adaptColorForSurface('#2b2f36', DARK_CANVAS)).toBe(onDark); // 2η κλήση = memo hit
  });
});
