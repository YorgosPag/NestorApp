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
  stampTableBorders,
  stampTableCellCursor,
  stampTableModeOutline,
  stampTableFills,
  stampTableText,
  MIN_CELL_TEXT_SCREEN_PX,
  type StampTableContext,
} from '../stamp-table-layout';
// ADR-739 §37 — η ΘΕΣΗ του δείκτη έρχεται από τη γεωμετρία· εδώ επαληθεύεται ότι το μελάνι
// τη ρωτά αντί να τη γράψει δεύτερη φορά.
import { tableModeOutlineRectMm } from '../../../../bim/table/table-indicator-geometry';
import { LINETYPE_ISO_CATALOG } from '../../../../config/linetype-iso-catalog';
import type { TableBorderSegment } from '../../../../bim/table/table-layout-types';
import { createPaintLog, createRc, paintedInk, type PaintLog } from './table-paint-recorder';
import { TABLE_CELL_CURSOR, TABLE_MODE_OUTLINE } from '../../../../config/color-config';
import type { TableCellLayout } from '../../../../bim/table/table-layout-types';
import type { TableCellStyle } from '../../../../bim/table/table-style';
import type { TableColumnId, TableRowId } from '../../../../types/table';

const PHASE = '#00ff00';
const INK = '#111111';
const FILL = '#dddddd';

const style = (fillColorHex?: string): TableCellStyle => ({
  textHeightMm: 3,
  textColorHex: INK,
  fillColorHex,
  bold: false,
  italic: false,
  underline: false,
  align: 'ML',
  margins: { hMm: 1, vMm: 1 },
});

function cell(
  text: string,
  fillColorHex?: string,
  id: { rowId: string; colId: string } = { rowId: 'r1', colId: 'c1' },
): TableCellLayout {
  return {
    rowId: id.rowId as TableRowId,
    colId: id.colId as TableColumnId,
    rect: { x: 0, y: 0, w: 40, h: 8 },
    style: style(fillColorHex),
    hAlign: 'left',
    text: {
      position: { x: 1, y: 6 },
      text,
      heightMm: 3,
      colorHex: INK,
      hAlign: 'left',
      bold: false,
      italic: false,
      underline: false,
    },
    rowSpan: 1,
    colSpan: 1,
  };
}

describe('stamp-table-layout — το χρώμα φάσης βάφει τη σιλουέτα, όχι το μελάνι', () => {
  it('στο hover το ΓΕΜΙΣΜΑ παίρνει το χρώμα φάσης (ο πίνακας φωτίζεται ομοιόμορφα)', () => {
    const log: PaintLog = createPaintLog();
    stampTableFills(createRc(log, { phaseColor: PHASE }), [cell('ΚΕΦΑΛΙΔΑ', FILL)]);

    expect(log.fills).toEqual([PHASE]);
  });

  it('χωρίς φάση, το γέμισμα κρατά το χρώμα του στυλ', () => {
    const log: PaintLog = createPaintLog();
    stampTableFills(createRc(log), [cell('ΚΕΦΑΛΙΔΑ', FILL)]);

    expect(log.fills).toEqual([FILL]);
  });

  /**
   * ⛔ ΤΟ ΚΡΙΣΙΜΟ: το κελί **με** γέμισμα. Πριν τη διόρθωση το μελάνι έπαιρνε κι αυτό το
   * `PHASE`, δηλαδή γράμματα αόρατα πάνω σε πλακάκι του ίδιου χρώματος.
   */
  it('στο hover το ΚΕΙΜΕΝΟ κελιού ΜΕ γέμισμα κρατά το δικό του χρώμα — δεν εξαφανίζεται', () => {
    const log: PaintLog = createPaintLog();
    stampTableText(createRc(log, { phaseColor: PHASE }), [cell('Περιγραφή', FILL)]);

    expect(paintedInk(log)).toEqual([{ text: 'Περιγραφή', color: INK }]);
    expect(log.texts[0].color).not.toBe(PHASE);
  });

  it('στο hover το ΚΕΙΜΕΝΟ κελιού ΧΩΡΙΣ γέμισμα κρατά κι αυτό το χρώμα του', () => {
    const log: PaintLog = createPaintLog();
    stampTableText(createRc(log, { phaseColor: PHASE }), [cell('ΑΣΔΦ')]);

    expect(paintedInk(log)).toEqual([{ text: 'ΑΣΔΦ', color: INK }]);
  });

  /**
   * Η **ασυμμετρία** ήταν το ορατό αποτύπωμα του σφάλματος: κεφαλίδα χωρίς γράμματα,
   * σειρές δεδομένων με γράμματα. Μετά τη διόρθωση τα δύο κελιά βάφονται **ίδια**.
   */
  it('κελί με και χωρίς γέμισμα γράφονται με το ΙΔΙΟ μελάνι στην ίδια φάση', () => {
    const log: PaintLog = createPaintLog();
    stampTableText(createRc(log, { phaseColor: PHASE }), [cell('ΜΕ', FILL), cell('ΧΩΡΙΣ')]);

    expect(log.texts.map((t) => t.color)).toEqual([INK, INK]);
  });

  it('το LOD εξακολουθεί να κόβει το κείμενο κάτω από το κατώφλι — η διόρθωση δεν το ακύρωσε', () => {
    const log: PaintLog = createPaintLog();
    // 3mm × pxPerMm < MIN_CELL_TEXT_SCREEN_PX ⇒ κανένα glyph.
    const rc = createRc(log, {
      phaseColor: PHASE,
      pxPerMm: (MIN_CELL_TEXT_SCREEN_PX - 1) / 3 / 2,
    });

    expect(stampTableText(rc, [cell('αόρατο', FILL)])).toBe(false);
    expect(log.texts).toEqual([]);
  });
});

// ── ADR-739 Φ.Δ βήμα 3 — η παράλειψη του κελιού υπό επεξεργασία ────────────

/**
 * Το «διπλό κείμενο» του στιγμιότυπου (Giorgio 2026-08-01): με ανοιχτό επεξεργαστή, ο
 * καμβάς εξακολουθούσε να ζωγραφίζει το **δεσμευμένο** κείμενο του κελιού, ενώ το
 * `<input>` έδειχνε το **πρόχειρο** — δύο κείμενα, το ένα πάνω στο άλλο.
 *
 * Το κρίσιμο ρίσκο δεν είναι «παραλείπει;» αλλά **«παραλείπει ΜΟΝΟ αυτό;»**: μια
 * υλοποίηση που συγκρίνει μόνο `rowId` (ή μόνο `colId`) περνά ένα αφελές test με ένα
 * κελί και σβήνει **ολόκληρη τη γραμμή** στον πραγματικό πίνακα.
 */
describe('stampTableText — το κελί υπό επεξεργασία δεν ζωγραφίζεται', () => {
  const A = { rowId: 'r1', colId: 'c1' };
  const B = { rowId: 'r1', colId: 'c2' };
  const C = { rowId: 'r2', colId: 'c1' };

  it('χωρίς `skip` ζωγραφίζονται ΟΛΑ — η προϋπάρχουσα συμπεριφορά μένει ακέραιη', () => {
    const log: PaintLog = createPaintLog();
    stampTableText(createRc(log), [cell('Α', undefined, A), cell('Β', undefined, B)]);

    expect(log.texts.map((x) => x.text)).toEqual(['Α', 'Β']);
  });

  it('παραλείπει ΜΟΝΟ το κελί του `skip` — ίδια γραμμή και ίδια στήλη επιβιώνουν', () => {
    const log: PaintLog = createPaintLog();
    stampTableText(
      createRc(log),
      [cell('Α', undefined, A), cell('Β', undefined, B), cell('Γ', undefined, C)],
      A,
    );

    // Το «Β» μοιράζεται τη γραμμή, το «Γ» τη στήλη: αν έλειπε κάποιο, η σύγκριση θα ήταν
    // μερική (μόνο rowId ή μόνο colId) και ο πίνακας θα άδειαζε κατά γραμμές/στήλες.
    expect(log.texts.map((x) => x.text)).toEqual(['Β', 'Γ']);
  });

  it('`skip` σε κελί που δεν υπάρχει στο πέρασμα ⇒ καμία παράλειψη', () => {
    const log: PaintLog = createPaintLog();
    stampTableText(createRc(log), [cell('Α', undefined, A)], { rowId: 'r9', colId: 'c9' });

    expect(log.texts.map((x) => x.text)).toEqual(['Α']);
  });

  it('`null` ⇒ ίδιο με «κανένα skip» (η κατάσταση πλοήγησης)', () => {
    const log: PaintLog = createPaintLog();
    stampTableText(createRc(log), [cell('Α', undefined, A)], null);

    expect(log.texts.map((x) => x.text)).toEqual(['Α']);
  });

  it('το ΓΕΜΙΣΜΑ του κελιού υπό επεξεργασία ΔΕΝ παραλείπεται — παραλείπεται μόνο το μελάνι', () => {
    const log: PaintLog = createPaintLog();
    stampTableFills(createRc(log), [cell('Α', FILL, A)]);

    // Το κελί πρέπει να συνεχίσει να μοιάζει με κελί όσο το επεξεργάζεσαι· μόνο τα γράμματα
    // αλλάζουν ιδιοκτήτη (από τον καμβά στο `<input>`).
    expect(log.fills).toEqual([FILL]);
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
    const log: PaintLog = createPaintLog();
    stampTableCellCursor(createRc(log), RECT);

    expect(log.strokes).toHaveLength(1);
    expect(log.strokes[0].color).toBe(TABLE_CELL_CURSOR.colorHex);
    expect(log.strokes[0].lineWidth).toBe(TABLE_CELL_CURSOR.lineWidthPx);
  });

  it('περνά και τις ΤΕΣΣΕΡΙΣ γωνίες από το `toScreen` — όχι `strokeRect` σε άξονες οθόνης', () => {
    const log: PaintLog = createPaintLog();
    // Στροφή 90°: αν ο ζωγράφος υπέθετε άξονες οθόνης, τα σημεία θα έμεναν ορθογώνια.
    const rc = createRc(log, { toScreen: (u, v) => ({ x: -v, y: u }) });
    stampTableCellCursor(rc, RECT);

    expect(log.strokes[0].points).toEqual([
      { x: -10, y: 5 },
      { x: -10, y: 25 },
      { x: -18, y: 25 },
      { x: -18, y: 5 },
    ]);
  });

  it('ΔΕΝ δέχεται το χρώμα φάσης — ο δρομέας είναι δείκτης διεπαφής, όχι κατάσταση οντότητας', () => {
    const log: PaintLog = createPaintLog();
    stampTableCellCursor(createRc(log, { phaseColor: PHASE }), RECT);

    expect(log.strokes[0].color).toBe(TABLE_CELL_CURSOR.colorHex);
    expect(log.strokes[0].color).not.toBe(PHASE);
  });
});

/**
 * 🔴 ADR-739 §37 — **ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΛΕΙΤΟΥΡΓΙΑΣ ΔΕΝ ΠΑΤΑ ΠΑΝΩ ΣΤΟΝ ΠΙΝΑΚΑ.**
 *
 * Ο δείκτης είχε **μηδέν** tests μέχρι τις 04/08 — και ήταν ακριβώς αυτός που έκρυβε την
 * περίμετρο. Το ρίσκο που πιάνει το πρώτο test είναι το μόνο που μετρά: κάποιος να
 * «απλοποιήσει» ξαναδίνοντας στον ζωγράφο το ωμό ορθογώνιο του πλέγματος.
 *
 * ⚠️ Η **θέση** δοκιμάζεται εξαντλητικά στο `table-mode-outline-geometry.test.ts` (πένα ×
 * zoom). Εδώ ελέγχεται μόνο ότι το μελάνι **ρωτά** τη γεωμετρία και δεν την ξαναγράφει.
 */
describe('stampTableModeOutline — ο δείκτης «βρίσκεσαι μέσα σε αυτόν τον πίνακα»', () => {
  const GRID = { x: 0, y: 0, w: 40, h: 16 };
  const PEN_MM = 0.13;

  it('🔴 χαράσσει ΕΞΩ από το πλέγμα — ποτέ πάνω στην περίμετρό του', () => {
    const log: PaintLog = createPaintLog();
    stampTableModeOutline(createRc(log), GRID, PEN_MM);

    const xs = log.strokes[0].points.map((p) => p.x);
    const ys = log.strokes[0].points.map((p) => p.y);
    expect(Math.min(...xs)).toBeLessThan(GRID.x);
    expect(Math.min(...ys)).toBeLessThan(GRID.y);
    expect(Math.max(...xs)).toBeGreaterThan(GRID.x + GRID.w);
    expect(Math.max(...ys)).toBeGreaterThan(GRID.y + GRID.h);
  });

  it('🔴 ρωτά τη ΓΕΩΜΕΤΡΙΑ — δεν ξαναγράφει τη μετατόπιση', () => {
    const log: PaintLog = createPaintLog();
    const rc = createRc(log);
    stampTableModeOutline(rc, GRID, PEN_MM);

    const expected = tableModeOutlineRectMm(GRID, rc.pxPerMm, PEN_MM);
    expect(Math.min(...log.strokes[0].points.map((p) => p.x))).toBeCloseTo(expected.x);
    expect(Math.min(...log.strokes[0].points.map((p) => p.y))).toBeCloseTo(expected.y);
  });

  it('παχύτερο μολύβι περιμέτρου ⇒ ΜΕΓΑΛΥΤΕΡΟ ορθογώνιο (η κλάση, όχι το δείγμα)', () => {
    const thin: PaintLog = createPaintLog();
    const thick: PaintLog = createPaintLog();
    stampTableModeOutline(createRc(thin), GRID, PEN_MM);
    // ⚠️ ADR-756 — η χοντρή πένα πρέπει να είναι **πάνω** από τη θέση ανάπαυσης του δείκτη.
    // Ήταν `1` mm: όσο το πάχος κλιμακωνόταν με το zoom, στα 10 px/mm έδινε 10 px και
    // κέρδιζε άνετα· με σταθερό πάχος 1 mm = 3,8 px, δηλαδή ο δακτύλιος λαβών εξακολουθεί
    // να νικά και η σύγκριση θα ήταν **κενή** (και οι δύο πλευρές ίδιες).
    stampTableModeOutline(createRc(thick), GRID, 2);

    expect(Math.min(...thick.strokes[0].points.map((p) => p.x))).toBeLessThan(
      Math.min(...thin.strokes[0].points.map((p) => p.x)),
    );
  });

  it('είναι ΔΙΑΚΕΚΟΜΜΕΝΟ και στο χρώμα/πάχος του δρομέα — «εδώ βρίσκεσαι» vs «εδώ πάει το πλήκτρο»', () => {
    const log: PaintLog = createPaintLog();
    stampTableModeOutline(createRc(log), GRID, PEN_MM);

    expect(log.strokes[0].dashPx).toEqual([...TABLE_MODE_OUTLINE.dashPx]);
    expect(log.strokes[0].color).toBe(TABLE_CELL_CURSOR.colorHex);
    expect(log.strokes[0].lineWidth).toBe(TABLE_CELL_CURSOR.lineWidthPx);
  });

  it('περνά και τις ΤΕΣΣΕΡΙΣ γωνίες από το `toScreen` — ο πίνακας περιστρέφεται', () => {
    const log: PaintLog = createPaintLog();
    const rc = createRc(log, { toScreen: (u, v) => ({ x: -v, y: u }) });
    stampTableModeOutline(rc, GRID, PEN_MM);

    const r = tableModeOutlineRectMm(GRID, rc.pxPerMm, PEN_MM);
    expect(log.strokes[0].points).toEqual([
      { x: -r.y, y: r.x },
      { x: -r.y, y: r.x + r.w },
      { x: -(r.y + r.h), y: r.x + r.w },
      { x: -(r.y + r.h), y: r.x },
    ]);
  });

  it('ΔΕΝ δέχεται το χρώμα φάσης — δείκτης διεπαφής, όχι κατάσταση οντότητας', () => {
    const log: PaintLog = createPaintLog();
    stampTableModeOutline(createRc(log, { phaseColor: PHASE }), GRID, PEN_MM);

    expect(log.strokes[0].color).not.toBe(PHASE);
  });
});

/**
 * 🔴 ADR-750 Φ5 — **η διακεκομμένη περνά από το SSoT, όχι από δεύτερο πολλαπλασιασμό.**
 *
 * Το ελάττωμα ήταν λανθάνον με τον ακριβή τρόπο που ο N.11/N.12 ονομάζουν «0 = κανείς δεν
 * κοίταξε»: το `stampTableBorders` μετέτρεπε μόνο του `dashMm → px` με σκέτο πολλαπλασιασμό,
 * και **κανένα** preset δεν παρήγαγε ποτέ `dashMm` — άρα η γραμμή δεν εκτελέστηκε ούτε μία
 * φορά σε πραγματικά δεδομένα. Μόλις η Φ5 έδωσε στον χρήστη επιλογέα στυλ γραμμής, το μοτίβο
 * άρχισε να έρχεται από τον κατάλογο, όπου **τα κενά είναι αρνητικά**.
 *
 * Η συνέπεια δεν θα ήταν σφάλμα: το `setLineDash` με έστω ένα αρνητικό μήκος **αγνοεί ολόκληρη
 * την κλήση**, οπότε η «διακεκομμένη» θα ζωγραφιζόταν συμπαγής και ο χρήστης θα έβλεπε την
 * επιλογή του να μην κάνει τίποτα, σιωπηλά.
 */
describe('🔴 stampTableBorders — το μοτίβο διακεκομμένης (ADR-750 Φ5)', () => {
  const PEN_COLOR = '#ff00ff';

  function segment(dashMm?: readonly number[]): TableBorderSegment {
    return {
      a: { x: 0, y: 0 },
      b: { x: 40, y: 0 },
      spec: { visible: true, colorHex: PEN_COLOR, widthMm: 0.5, ...(dashMm ? { dashMm } : {}) },
    };
  }

  it('🔑 μοτίβο καταλόγου (κενά ΑΡΝΗΤΙΚΑ) φτάνει στον καμβά ΟΛΟ θετικό', () => {
    const log: PaintLog = createPaintLog();
    const pattern = LINETYPE_ISO_CATALOG.Dashed.pattern;
    // Η προϋπόθεση του test: ο κατάλογος όντως μιλά με πρόσημα. Αν πάψει, το test το λέει.
    expect(pattern.some((v) => v < 0)).toBe(true);

    stampTableBorders(createRc(log, { pxPerMm: 2 }), [segment(pattern)]);

    expect(log.strokes).toHaveLength(1);
    expect(log.strokes[0].dashPx).toEqual(pattern.map((v) => Math.abs(v) * 2));
    for (const px of log.strokes[0].dashPx) expect(px).toBeGreaterThan(0);
  });

  it('η κουκκίδα (μήκος 0) ανυψώνεται σε ορατό μήκος αντί να εξαφανιστεί', () => {
    const log: PaintLog = createPaintLog();
    stampTableBorders(createRc(log, { pxPerMm: 2 }), [segment(LINETYPE_ISO_CATALOG.Dot.pattern)]);

    for (const px of log.strokes[0].dashPx) expect(px).toBeGreaterThan(0);
  });

  it('χωρίς `dashMm` η γραμμή μένει συμπαγής — και ΔΕΝ κληρονομεί το μοτίβο της προηγούμενης', () => {
    // Ο έλεγχος της διαρροής: το `save`/`restore` του ζωγράφου πρέπει να επαναφέρει το μοτίβο.
    const log: PaintLog = createPaintLog();
    stampTableBorders(createRc(log, { pxPerMm: 2 }), [
      segment(LINETYPE_ISO_CATALOG.Dashed.pattern),
      segment(),
    ]);

    expect(log.strokes).toHaveLength(2);
    expect(log.strokes[1].dashPx).toEqual([]);
  });

  it('η αόρατη ακμή δεν χαράσσεται καθόλου (ποτέ «γραμμή μηδενικού πάχους»)', () => {
    const log: PaintLog = createPaintLog();
    stampTableBorders(createRc(log), [
      { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, spec: { visible: false, colorHex: PEN_COLOR, widthMm: 0 } },
    ]);

    expect(log.strokes).toEqual([]);
  });
});
