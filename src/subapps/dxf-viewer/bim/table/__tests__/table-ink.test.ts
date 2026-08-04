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
  resolveTableCellStyleInk,
  resolveTableInk,
  TABLE_PAPER_HEX,
  tableCellBackdrop,
} from '../table-ink';
import { layoutTable } from '../table-layout';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableCellStyle, TableStyle } from '../table-style';
import { createTableModel } from '../table-model-helpers';
import { parseHex, contrastRatio } from '../../../config/color-math';
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

function cellStyle(overrides: Partial<TableCellStyle> = {}): TableCellStyle {
  return {
    textHeightMm: 2.8,
    textColorHex: AUTOMATIC_TABLE_INK,
    bold: false,
    italic: false,
    underline: false,
    align: 'ML',
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
      if (cell.text) {
        expect(parseHex(cell.text.colorHex)).not.toBeNull();
        expect(isAutomaticTableInk(cell.text.colorHex)).toBe(false);
      }
    }
  }

  it('σε ΟΘΟΝΗ — και το χρώμα είναι λευκό', () => {
    expectEveryColorIsRealHex(DARK_CANVAS);
    const layout = layoutTable(model, STANDARD, { surfaceHex: DARK_CANVAS, measureText });
    expect(layout.cells[0].text?.colorHex).toBe('#ffffff');
  });

  it('σε ΧΑΡΤΙ — και το χρώμα είναι μαύρο', () => {
    expectEveryColorIsRealHex(TABLE_PAPER_HEX);
    const layout = layoutTable(model, STANDARD, { surfaceHex: TABLE_PAPER_HEX, measureText });
    expect(layout.cells[0].text?.colorHex).toBe('#000000');
  });

  it('🔴 ΧΩΡΙΣ επιφάνεια ⇒ χαρτί: η προεπιλογή δείχνει προς την ασφαλή πλευρά', () => {
    expectEveryColorIsRealHex(TABLE_PAPER_HEX);
    expect(layoutTable(model, STANDARD, { measureText }).cells[0].text?.colorHex).toBe('#000000');
  });

  it('το ΚΕΛΙ και το RUN συμφωνούν πάντα — ένας κόμβος επίλυσης, όχι δύο', () => {
    for (const surface of [DARK_CANVAS, TABLE_PAPER_HEX]) {
      for (const cell of layoutTable(model, STANDARD, { surfaceHex: surface, measureText }).cells) {
        if (cell.text) expect(cell.text.colorHex).toBe(cell.style.textColorHex);
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
