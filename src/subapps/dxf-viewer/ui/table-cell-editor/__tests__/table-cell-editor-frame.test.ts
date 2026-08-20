/**
 * ADR-739 Φ.Δ βήμα 3 — **το κελί ως κουτί οθόνης**.
 *
 * Κάθε αριθμός εδώ είναι υπολογισμένος στο χέρι από τον ορισμό, όχι διαβασμένος από την
 * υλοποίηση. Τα τρία ρίσκα που στοχεύει, με τη σειρά που πονάνε:
 *
 *  1. **Η γραμμή βάσης.** Το `<input>` κεντράρει το κουτί γραμμής του· ο καμβάς τοποθετεί
 *     βάση απόλυτα. Αν η αντιστροφή είναι λάθος, το κείμενο **αναπηδά** τη στιγμή του
 *     διπλού κλικ. Ο έλεγχος δεν κοιτά τις γεμίσεις — **ανασυνθέτει** τη βάση από αυτές,
 *     με τον ίδιο τύπο που εφαρμόζει ο browser, και τη συγκρίνει με τον στόχο.
 *  2. **Το πρόσημο της περιστροφής.** Σε πίνακα με `angleRad = 0` κάθε πρόσημο περνά.
 *  3. **Η κλίμακα.** Ένα κουτί που δεν πολλαπλασιάζεται με το `pxPerMm` δείχνει σωστό σε
 *     ένα μόνο επίπεδο zoom — ακριβώς το ελάττωμα των σταθερών 140×24.
 */

import {
  computeTableCellEditorFrame,
  cellTextStartPx,
  type TableCellEditorFrame,
} from '../table-cell-editor-frame';
import { tableCellFont } from '../../../rendering/entities/table/stamp-table-layout';
import type { CellFontBandPx } from '../table-cell-text-metrics';
import type { TableCellEditTarget } from '../../../bim/table/table-cell-edit-session';
import type { TableCellStyle } from '../../../bim/table/table-style';
import type { TableCellAlign } from '../../../types/table';
import type { TextAlign } from '../../../bim/structural/detail-sheet/detail-sheet-types';
// 🔴 ADR-786 §4 — η ΜΙΑ απάντηση «ποιο face, ποιο em, ποιο shorthand», και το stub face που
// κάνει τη διαφορά ύψους/em ορατή στο jsdom (χωρίς αυτό η μετατροπή είναι ταυτοτική).
import { tableTextFont } from '../../../bim/table/table-text-font';
import { installStubFont, stubEmSize } from '../../../text-engine/fonts/__tests__/_stub-font';
import type { TableColumnId, TableRowId } from '../../../types/table';

const CANVAS_BG = '#101010';
const INK = '#eeeeee';

/** Ζώνη με **ασύμμετρα** ascent/descent: συμμετρική ζώνη κρύβει σφάλμα στον όρο `(A−D)/2`. */
const BAND: CellFontBandPx = { ascentPx: 18, descentPx: 6 };
const bandOf = (): CellFontBandPx => BAND;

const style = (over: Partial<TableCellStyle> = {}): TableCellStyle => ({
  textHeightMm: 4,
  textColorHex: INK,
  bold: false,
  italic: false,
  underline: false,
  align: 'ML' as TableCellAlign,
  indentLevel: 0,
  margins: { hMm: 2, vMm: 1 },
  ...over,
});

/** Κελί 40 × 10 mm· η βάση δίνεται ρητά ώστε τα tests να μη μαντεύουν τη διάταξη. */
function target(over: Partial<TableCellEditTarget> = {}): TableCellEditTarget {
  return {
    rowId: 'r1' as TableRowId,
    colId: 'c1' as TableColumnId,
    text: '',
    anchorWorldPoint: { x: 0, y: 0 },
    rectMm: { x: 0, y: 0, w: 40, h: 10 },
    style: style(),
    hAlign: 'left',
    // §59 Δ2 — καμία εσοχή στη βάση: κάθε test που δεν τη ζητά ρητά οφείλει να δίνει
    // **byte-ταυτόσημο** κουτί με πριν τη φάση.
    indentMm: 0,
    baselineFromTopMm: 7,
    ...over,
  };
}

function frameOf(over: Partial<TableCellEditTarget> = {}, pxPerMm = 5, angleRad = 0) {
  return computeTableCellEditorFrame({
    target: target(over),
    pxPerMm,
    angleRad,
    resolveBand: bandOf,
    backgroundHex: CANVAS_BG,
  });
}

/**
 * Η βάση όπως την **παράγει ο browser** από τις γεμίσεις: το κουτί γραμμής κεντράρεται στο
 * content box (ή, ισοδύναμα, το `line-height` ισούται με το content box — δες την κεφαλίδα
 * του `table-cell-editor-frame.ts`), και η βάση κάθεται στο μέσο του `(A − D)`.
 */
function reconstructedBaselinePx(f: TableCellEditorFrame, band: CellFontBandPx): number {
  const content = f.heightPx - f.paddingTopPx - f.paddingBottomPx;
  return f.paddingTopPx + content / 2 + (band.ascentPx - band.descentPx) / 2;
}

describe('computeTableCellEditorFrame — μέγεθος και κλίμακα', () => {
  it('το κουτί είναι ΤΟ ΚΕΛΙ: rect × pxPerMm, όχι σταθερές οθόνης', () => {
    const f = frameOf({}, 5);
    expect(f.widthPx).toBe(200); // 40mm × 5
    expect(f.heightPx).toBe(50); // 10mm × 5
  });

  it('ζουμάρει: διπλάσιο `pxPerMm` ⇒ διπλάσιο κουτί ΚΑΙ διπλάσια γραμματοσειρά', () => {
    const a = frameOf({}, 5);
    const b = frameOf({}, 10);
    expect(b.widthPx).toBe(a.widthPx * 2);
    expect(b.heightPx).toBe(a.heightPx * 2);
    expect(b.font).toBe(tableCellFont(40, false)); // 4mm × 10
    expect(a.font).toBe(tableCellFont(20, false)); // 4mm × 5
  });

  it('η γραμματοσειρά είναι ΤΟ ΙΔΙΟ αλφαριθμητικό που θέτει ο ζωγράφος στο `ctx.font`', () => {
    expect(frameOf({ style: style({ bold: true }) }).font).toBe(tableCellFont(20, true));
  });

  it('οι οριζόντιες γεμίσεις είναι τα περιθώρια του κελιού, και οι δύο ίδιες', () => {
    const f = frameOf({}, 5);
    expect(f.paddingLeftPx).toBe(10); // 2mm × 5
    expect(f.paddingRightPx).toBe(10);
  });
});

describe('computeTableCellEditorFrame — η περιστροφή', () => {
  it('CSS ακτίνια = ΑΝΤΙΘΕΤΑ της σκηνής (αναστροφή y)', () => {
    expect(frameOf({}, 5, Math.PI / 6).rotationRad).toBeCloseTo(-Math.PI / 6, 12);
  });

  it('χωρίς γωνία ⇒ ακριβώς 0, καμία «σχεδόν μηδενική» κλίση', () => {
    expect(frameOf({}, 5, 0).rotationRad).toBe(-0);
  });
});

/**
 * ⛔ ΤΟ ΚΡΙΣΙΜΟ. Και οι τρεις κατακόρυφες ζώνες δοκιμάζονται μαζί: με στόχο κοντά στο
 * κέντρο μόνο το ένα σκέλος του τύπου εκτελείται, και το άλλο μένει αδοκίμαστο.
 */
describe('computeTableCellEditorFrame — η γραμμή βάσης πέφτει ΑΚΡΙΒΩΣ στον στόχο', () => {
  it.each([
    ['κάτω από το κέντρο (ζώνη bottom)', 9],
    ['στο κέντρο', 5],
    ['πάνω από το κέντρο (ζώνη top)', 2.5],
  ])('%s', (_label, baselineFromTopMm) => {
    const f = frameOf({ baselineFromTopMm }, 5);
    expect(reconstructedBaselinePx(f, BAND)).toBeCloseTo(baselineFromTopMm * 5, 9);
  });

  it('μόνο ΜΙΑ από τις δύο κατακόρυφες γεμίσεις είναι μη μηδενική — καμία δεν είναι αρνητική', () => {
    for (const baselineFromTopMm of [2, 5, 9]) {
      const f = frameOf({ baselineFromTopMm }, 5);
      expect(f.paddingTopPx).toBeGreaterThanOrEqual(0);
      expect(f.paddingBottomPx).toBeGreaterThanOrEqual(0);
      expect(Math.min(f.paddingTopPx, f.paddingBottomPx)).toBe(0);
    }
  });

  it('το `line-height` ισούται με το content box — η εγγύηση που κάνει τον τύπο ανεξάρτητο μηχανής', () => {
    const f = frameOf({ baselineFromTopMm: 8 }, 5);
    expect(f.lineHeightPx).toBeCloseTo(f.heightPx - f.paddingTopPx - f.paddingBottomPx, 9);
  });

  it('ακραίος στόχος (βάση πάνω από το ύψος της γραμματοσειράς) ⇒ περιορισμός, ΠΟΤΕ μηδενικό ύψος', () => {
    const f = frameOf({ baselineFromTopMm: 0 }, 5);
    expect(f.lineHeightPx).toBeGreaterThan(0);
    expect(f.paddingBottomPx).toBeLessThanOrEqual(f.heightPx);
  });
});

describe('computeTableCellEditorFrame — χρώματα', () => {
  it('κελί ΜΕ γέμισμα κρατά το δικό του', () => {
    expect(frameOf({ style: style({ fillColorHex: '#abcdef' }) }).backgroundHex).toBe('#abcdef');
  });

  it('κελί ΧΩΡΙΣ γέμισμα παίρνει το φόντο του καμβά — αδιαφανές, ώστε να σκεπάσει το raster', () => {
    expect(frameOf().backgroundHex).toBe(CANVAS_BG);
  });

  it('το μελάνι είναι του κελιού', () => {
    expect(frameOf().colorHex).toBe(INK);
  });
});

describe('cellTextStartPx — πού ξεκινά το κείμενο (για τον κέρσορα του κλικ)', () => {
  const W = 200;
  const PAD = 10;
  const base = frameOf({}, 5);

  const withAlign = (textAlign: TextAlign): TableCellEditorFrame => ({ ...base, textAlign });

  it('αριστερά ⇒ το αριστερό περιθώριο, ανεξάρτητα από το πλάτος του κειμένου', () => {
    expect(cellTextStartPx(withAlign('left'), 40)).toBe(PAD);
    expect(cellTextStartPx(withAlign('left'), 150)).toBe(PAD);
  });

  it('δεξιά ⇒ μετακινείται με το πλάτος του κειμένου', () => {
    expect(cellTextStartPx(withAlign('right'), 40)).toBe(W - PAD - 40);
  });

  it('κέντρο ⇒ αγνοεί τα περιθώρια, όπως και ο καμβάς (`anchorXMm` = rect.x + w/2)', () => {
    expect(cellTextStartPx(withAlign('center'), 40)).toBe((W - 40) / 2);
  });
});

// ── 🔴 ADR-786 §4 — Η ΑΝΑΛΛΟΙΩΤΗ Α2: καμβάς ≡ επεξεργαστής ──────────────────
//
// ⚠️ **Οι δύο άγκυρες παραπάνω (`tableCellFont(40,…)` / `tableCellFont(20,…)`) ΔΕΝ κρίνουν
// αυτό το ερώτημα, και είναι σημαντικό να ειπωθεί**: στο jsdom δεν υπάρχει φορτωμένη
// γραμματοσειρά, οπότε «ύψος κεφαλαίου» και «em» είναι ο ίδιος αριθμός και το `40` περνά είτε
// ο κώδικας κάνει τη μετατροπή είτε όχι. Έμειναν πράσινες σε ολόκληρη τη διάρκεια του
// ελαττώματος. Ό,τι ακολουθεί εγκαθιστά ρητά face με cap/em = 0,8, ώστε οι δύο αριθμοί να
// **χωρίσουν** και η ερώτηση να αποκτήσει απάντηση.

describe('🔴 ADR-786 Α2 — ο επεξεργαστής ανοίγει με ΤΗΝ ΙΔΙΑ γραμματοσειρά που ζωγραφίζει ο καμβάς', () => {
  /** 4 mm × 5 px/mm = 20 px ύψος **κεφαλαίου** — η είσοδος της διάταξης. */
  const CAP_PX = 20;

  describe('με φορτωμένο face', () => {
    let restore: () => void;
    beforeAll(() => { restore = installStubFont(0.6, 'arial'); });
    afterAll(() => restore());

    it('το shorthand είναι ΑΥΤΟΥΣΙΟ αυτό που θέτει ο ζωγράφος στο `ctx.font`', () => {
      expect(frameOf({}, 5).font).toBe(tableTextFont(CAP_PX, false, false).css);
    });

    it('🔴 το `--tce-em` κουβαλά **em**, όχι ύψος κεφαλαίου', () => {
      const frame = frameOf({}, 5);
      expect(frame.fontSizePx).toBeCloseTo(stubEmSize(CAP_PX), 9);
      // Ο παρονομαστής: με τον σπασμένο κώδικα εδώ έβγαινε ακριβώς το ύψος κεφαλαίου, δηλαδή
      // γράμματα ~29% μικρότερα από τον καμβά — η αναπήδηση στο διπλό κλικ (§4, `190357`).
      expect(frame.fontSizePx).not.toBeCloseTo(CAP_PX, 6);
    });

    it('η αναλλοίωτη επιβιώνει του zoom: διπλάσιο `pxPerMm` ⇒ διπλάσιο em, ίδιο face', () => {
      expect(frameOf({}, 10).fontSizePx).toBeCloseTo(frameOf({}, 5).fontSizePx * 2, 9);
      expect(frameOf({}, 10).font).toBe(tableTextFont(CAP_PX * 2, false, false).css);
    });
  });

  it('ΤΟ ΟΡΓΑΝΟ — χωρίς face η ίδια άγκυρα είναι πράσινη με ΚΑΘΕ κώδικα', () => {
    // Γραμμένο ρητά ώστε ο επόμενος να μη «διορθώσει» τα `installStubFont` ως περιττά.
    expect(frameOf({}, 5).fontSizePx).toBe(CAP_PX);
  });
});
