/**
 * ADR-739 §19.8 — Ο ζωγράφος του πίνακα: **τι δέχεται και τι ΔΕΝ δέχεται το χρώμα φάσης.**
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 * Το `stamp-table-layout.ts` είχε **μηδενική** κάλυψη — και ακριβώς εκεί ζούσε ένα ελάττωμα
 * που **κανένα** από τα 323 tests του `bim/table` δεν μπορούσε να δει: εκείνα ελέγχουν τη
 * **διάταξη** (πού πέφτει το κείμενο), όχι το **μελάνι** (με τι χρώμα γράφεται). Το σφάλμα
 * ήταν αποκλειστικά στο μελάνι, άρα ήταν δομικά αόρατο.
 *
 * ## Το ελάττωμα που κλειδώνει (επαληθευμένο στην οθόνη, 2026-07-31)
 * Στο hover το `phaseColor` έβαφε **και** το γέμισμα **και** το κείμενο με το ίδιο χρώμα.
 * Σε κελί **με** `fillColorHex` αυτό σημαίνει ίδιο φόντο και ίδιο μελάνι: η γραμμή
 * κεφαλίδων έχανε τα «Α/Α · Περιγραφή · Ποσότητα» και γινόταν μονόχρωμο πλακάκι, ενώ οι
 * σειρές δεδομένων (χωρίς γέμισμα) κρατούσαν τα γράμματά τους. **Η ασυμμετρία ήταν το
 * αποτύπωμα** — γι' αυτό ο έλεγχος παρακάτω δοκιμάζει και τις δύο περιπτώσεις μαζί: ένα
 * test μόνο σε κελί χωρίς γέμισμα θα ήταν πράσινο και **πριν** τη διόρθωση.
 *
 * @see rendering/entities/table/stamp-table-layout.ts — ο ζωγράφος
 */

import {
  stampTableCellCursor,
  stampTableFills,
  stampTableText,
  MIN_CELL_TEXT_SCREEN_PX,
  type StampTableContext,
} from '../stamp-table-layout';
import { TABLE_CELL_CURSOR } from '../../../../config/color-config';
import type { TableCellLayout } from '../../../../bim/table/table-layout-types';
import type { TableCellStyle } from '../../../../bim/table/table-style';
import type { TableColumnId, TableRowId } from '../../../../types/table';

const PHASE = '#00ff00';
const INK = '#111111';
const FILL = '#dddddd';

/** Μία διαδρομή που χαράχτηκε: με τι μολύβι και σε ποια σημεία **οθόνης**. */
interface StrokeRecord {
  readonly color: string;
  readonly lineWidth: number;
  readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>;
}

/** Καταγράφει κάθε `fillStyle` τη στιγμή που χρησιμοποιείται — όχι στο τέλος. */
interface PaintLog {
  readonly fills: string[];
  readonly texts: Array<{ readonly text: string; readonly color: string }>;
  readonly strokes: StrokeRecord[];
}

function createCtx(log: PaintLog): CanvasRenderingContext2D {
  let fillStyle = '';
  let path: Array<{ x: number; y: number }> = [];
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    strokeStyle: '',
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    lineWidth: 1,
    save: (): void => undefined,
    restore: (): void => undefined,
    beginPath: (): void => {
      path = [];
    },
    closePath: (): void => undefined,
    moveTo: (x: number, y: number): void => {
      path.push({ x, y });
    },
    lineTo: (x: number, y: number): void => {
      path.push({ x, y });
    },
    stroke: (): void => {
      log.strokes.push({ color: ctx.strokeStyle, lineWidth: ctx.lineWidth, points: [...path] });
    },
    setLineDash: (): void => undefined,
    fill: (): void => {
      log.fills.push(fillStyle);
    },
    fillText: (text: string): void => {
      log.texts.push({ text, color: fillStyle });
    },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function createRc(log: PaintLog, phaseColor?: string): StampTableContext {
  return {
    ctx: createCtx(log),
    toScreen: (u, v) => ({ x: u, y: v }),
    // Αρκετά μεγάλο ώστε το LOD να μην κόψει το κείμενο (δες MIN_CELL_TEXT_SCREEN_PX).
    pxPerMm: 10,
    phaseColor,
  };
}

const style = (fillColorHex?: string): TableCellStyle => ({
  textHeightMm: 3,
  textColorHex: INK,
  fillColorHex,
  bold: false,
  align: 'middleLeft',
  margins: { leftMm: 1, rightMm: 1, topMm: 1, bottomMm: 1 },
});

function cell(text: string, fillColorHex?: string): TableCellLayout {
  return {
    rowId: 'r1' as TableRowId,
    colId: 'c1' as TableColumnId,
    rect: { x: 0, y: 0, w: 40, h: 8 },
    style: style(fillColorHex),
    text: {
      position: { x: 1, y: 6 },
      text,
      heightMm: 3,
      colorHex: INK,
      hAlign: 'left',
      bold: false,
    },
    rowSpan: 1,
    colSpan: 1,
  };
}

describe('stamp-table-layout — το χρώμα φάσης βάφει τη σιλουέτα, όχι το μελάνι', () => {
  it('στο hover το ΓΕΜΙΣΜΑ παίρνει το χρώμα φάσης (ο πίνακας φωτίζεται ομοιόμορφα)', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    stampTableFills(createRc(log, PHASE), [cell('ΚΕΦΑΛΙΔΑ', FILL)]);

    expect(log.fills).toEqual([PHASE]);
  });

  it('χωρίς φάση, το γέμισμα κρατά το χρώμα του στυλ', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    stampTableFills(createRc(log), [cell('ΚΕΦΑΛΙΔΑ', FILL)]);

    expect(log.fills).toEqual([FILL]);
  });

  /**
   * ⛔ ΤΟ ΚΡΙΣΙΜΟ: το κελί **με** γέμισμα. Πριν τη διόρθωση το μελάνι έπαιρνε κι αυτό το
   * `PHASE`, δηλαδή γράμματα αόρατα πάνω σε πλακάκι του ίδιου χρώματος.
   */
  it('στο hover το ΚΕΙΜΕΝΟ κελιού ΜΕ γέμισμα κρατά το δικό του χρώμα — δεν εξαφανίζεται', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    stampTableText(createRc(log, PHASE), [cell('Περιγραφή', FILL)]);

    expect(log.texts).toEqual([{ text: 'Περιγραφή', color: INK }]);
    expect(log.texts[0].color).not.toBe(PHASE);
  });

  it('στο hover το ΚΕΙΜΕΝΟ κελιού ΧΩΡΙΣ γέμισμα κρατά κι αυτό το χρώμα του', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    stampTableText(createRc(log, PHASE), [cell('ΑΣΔΦ')]);

    expect(log.texts).toEqual([{ text: 'ΑΣΔΦ', color: INK }]);
  });

  /**
   * Η **ασυμμετρία** ήταν το ορατό αποτύπωμα του σφάλματος: κεφαλίδα χωρίς γράμματα,
   * σειρές δεδομένων με γράμματα. Μετά τη διόρθωση τα δύο κελιά βάφονται **ίδια**.
   */
  it('κελί με και χωρίς γέμισμα γράφονται με το ΙΔΙΟ μελάνι στην ίδια φάση', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    stampTableText(createRc(log, PHASE), [cell('ΜΕ', FILL), cell('ΧΩΡΙΣ')]);

    expect(log.texts.map((t) => t.color)).toEqual([INK, INK]);
  });

  it('το LOD εξακολουθεί να κόβει το κείμενο κάτω από το κατώφλι — η διόρθωση δεν το ακύρωσε', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    const rc: StampTableContext = {
      ...createRc(log, PHASE),
      // 3mm × pxPerMm < MIN_CELL_TEXT_SCREEN_PX ⇒ κανένα glyph.
      pxPerMm: (MIN_CELL_TEXT_SCREEN_PX - 1) / 3 / 2,
    };

    expect(stampTableText(rc, [cell('αόρατο', FILL)])).toBe(false);
    expect(log.texts).toEqual([]);
  });
});

// ── ADR-739 Φ.Δ βήμα 2 — ο δρομέας κελιού ──────────────────────────────────

/**
 * Ο δρομέας είναι το **μόνο** στοιχείο διεπαφής που ζωγραφίζεται μέσα στον πίνακα, και
 * γι' αυτό δοκιμάζεται χωριστά από τη σιλουέτα: παίζει με διαφορετικούς κανόνες.
 *
 * Τα δύο ρίσκα που πιάνει:
 *  1. Να γραφτεί με `strokeRect` σε άξονες οθόνης — φαίνεται σωστό σε πίνακα με
 *     `angleRad = 0` και **κρέμεται λοξά** στον περιστραμμένο, δηλαδή σε ό,τι δεν κοιτά
 *     ποτέ κανείς σε ένα γρήγορο έλεγχο.
 *  2. Να δεχτεί το `phaseColor` — τότε ο δρομέας θα γινόταν κίτρινος στο hover και ο
 *     χρήστης δεν θα ξεχώριζε «η οντότητα φωτίζεται» από «αυτό το κελί δέχεται πληκτρολόγηση».
 */
describe('stampTableCellCursor — το ορθογώνιο του τρέχοντος κελιού', () => {
  const RECT = { x: 5, y: 10, w: 20, h: 8 };

  it('χαράσσει ΜΙΑ διαδρομή με το χρώμα και το πάχος του δρομέα', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    stampTableCellCursor(createRc(log), RECT);

    expect(log.strokes).toHaveLength(1);
    expect(log.strokes[0].color).toBe(TABLE_CELL_CURSOR.colorHex);
    expect(log.strokes[0].lineWidth).toBe(TABLE_CELL_CURSOR.lineWidthPx);
  });

  it('περνά και τις ΤΕΣΣΕΡΙΣ γωνίες από το `toScreen` — όχι `strokeRect` σε άξονες οθόνης', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    // Στροφή 90°: αν ο ζωγράφος υπέθετε άξονες οθόνης, τα σημεία θα έμεναν ορθογώνια.
    const rc: StampTableContext = { ...createRc(log), toScreen: (u, v) => ({ x: -v, y: u }) };
    stampTableCellCursor(rc, RECT);

    expect(log.strokes[0].points).toEqual([
      { x: -10, y: 5 },
      { x: -10, y: 25 },
      { x: -18, y: 25 },
      { x: -18, y: 5 },
    ]);
  });

  it('ΔΕΝ δέχεται το χρώμα φάσης — ο δρομέας είναι δείκτης διεπαφής, όχι κατάσταση οντότητας', () => {
    const log: PaintLog = { fills: [], texts: [], strokes: [] };
    stampTableCellCursor(createRc(log, PHASE), RECT);

    expect(log.strokes[0].color).toBe(TABLE_CELL_CURSOR.colorHex);
    expect(log.strokes[0].color).not.toBe(PHASE);
  });
});
