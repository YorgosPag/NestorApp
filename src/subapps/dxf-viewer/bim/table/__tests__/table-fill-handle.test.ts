/**
 * 🔴 ADR-754 **Γ4** — **η λαβή συμπλήρωσης**: ποια κελιά υπόσχεται, και τι γράφει.
 *
 * Δύο πράγματα κλειδώνουν εδώ και το δεύτερο είναι ο λόγος που το Γ1 και το Γ2 γράφτηκαν μαζί:
 *
 * 1. **Ένας άξονας, ποτέ δύο.** Η διαγώνια σύρση διαλέγει· δεν γεμίζει ορθογώνιο.
 * 2. 🔑 **Το `$` αποφασίζει ποιες αναφορές ακολουθούν.** Χωρίς αυτό η συμπλήρωση θα μετατόπιζε
 *    **πάντα**, και ο χρήστης δεν θα είχε κανέναν τρόπο να πει «αυτό το κελί όχι» — δηλαδή
 *    ολόκληρη η κλασική χρήση «επί σταθερό συντελεστή» θα ήταν αδύνατη.
 *
 * ⚠️ **Πλέγμα 5×5, όπως κάθε test αυτού του ADR** (§1.2).
 */

import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import { cellInputText, writeCellInput } from '../formula/table-formula-engine';
import { getPersistedCellText } from '../table-model-helpers';
import { applyTableFill } from '../table-fill-apply';
import {
  resolveTableFillTarget,
  tableFillHandleHitAtFrame,
  tableFillHandleRectMm,
  tableFillPreviewBounds,
  isOnTableFillHandle,
  TABLE_FILL_HANDLE_PX,
  TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX,
} from '../table-fill-handle';
// 🔴 ADR-754 §14 — ο **11ος ρόλος** δείκτη ζει στο διπλανό module, αλλά η προδιαγραφή του είναι
// αυτής της φάσης: δοκιμάζεται εδώ, πάνω στο **ίδιο** 5×5 πλέγμα με τη γεωμετρία που τον τρέφει.
import { tableIndicatorCursorRoleAtFrame } from '../table-indicator-cursor-role';
import {
  tableIndicatorBandsMm,
  TABLE_INDICATOR_GRIP_CLEARANCE_PX,
} from '../table-indicator-geometry';
import type { TableCellRangeBounds } from '../table-cell-range';
import type { TableLayout } from '../table-layout-types';
import { bookOf } from './formula-book-fixture';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

const base = (): PersistedTableModel =>
  toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] }));

/** Γράψε κείμενο/τύπο σε κελί, με δείκτες. */
function type(model: PersistedTableModel, row: number, col: number, text: string) {
  return writeCellInput(bookOf(model),model, ROWS[row].id, COLUMNS[col].id, text).model;
}

const at = (row: number, col: number) => ({ row, col });
const rect = (firstRow: number, lastRow: number, firstCol: number, lastCol: number) =>
  ({ firstRow, lastRow, firstCol, lastCol }) as TableCellRangeBounds;

/** Ο τύπος **όπως τον βλέπει ο χρήστης** στη γραμμή τύπων. */
const formulaAt = (model: PersistedTableModel, row: number, col: number) =>
  cellInputText(bookOf(model),model, ROWS[row].id, COLUMNS[col].id);

/** Η **τιμή** — η απόδειξη ότι ο επαναϋπολογισμός έτρεξε. */
const valueAt = (model: PersistedTableModel, row: number, col: number) =>
  getPersistedCellText(model, ROWS[row].id, COLUMNS[col].id);

// ──────────────────────────────────────────────────────────────────────────────
// Ποια κελιά υπόσχεται η σύρση
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΕΝΑΣ άξονας, ποτέ δύο', () => {
  const SOURCE = rect(1, 1, 1, 1); // το κελί B2

  it.each([
    [at(3, 1), 'down', rect(2, 3, 1, 1), 'σύρσιμο κάτω'],
    [at(0, 1), 'up', rect(0, 0, 1, 1), 'σύρσιμο πάνω'],
    [at(1, 3), 'right', rect(1, 1, 2, 3), 'σύρσιμο δεξιά'],
    [at(1, 0), 'left', rect(1, 1, 0, 0), 'σύρσιμο αριστερά'],
  ])('%o ⇒ %s (%s)', (pointer, direction, bounds) => {
    expect(resolveTableFillTarget(SOURCE, pointer)).toEqual({ direction, bounds });
  });

  /**
   * 🔑 Η διαγώνια σύρση **δεν** γεμίζει ορθογώνιο. Το χέρι σπάνια κινείται σε τέλεια ευθεία,
   * και ένα διαγώνιο γέμισμα θα έπρεπε να αποφασίσει μόνο του αν το `=B2*C2` ολισθαίνει κατά
   * γραμμή, κατά στήλη ή και τα δύο — τρεις διαφορετικοί αριθμοί, καμία ένδειξη ποιον ήθελε.
   */
  it('🔑 διαγώνια σύρση 3 κάτω / 1 δεξιά ⇒ κερδίζει ΜΟΝΟ ο κατακόρυφος', () => {
    expect(resolveTableFillTarget(SOURCE, at(4, 2))).toEqual({
      direction: 'down',
      bounds: rect(2, 4, 1, 1),
    });
  });

  it('διαγώνια σύρση 1 κάτω / 3 δεξιά ⇒ κερδίζει ΜΟΝΟ ο οριζόντιος', () => {
    expect(resolveTableFillTarget(SOURCE, at(2, 4))).toEqual({
      direction: 'right',
      bounds: rect(1, 1, 2, 4),
    });
  });

  it('στην ισοπαλία κερδίζει ο ΚΑΤΑΚΟΡΥΦΟΣ — η συμπλήρωση προς τα κάτω είναι ο κανόνας', () => {
    expect(resolveTableFillTarget(SOURCE, at(2, 2))?.direction).toBe('down');
  });

  it('🔴 το χέρι ΜΕΣΑ στην πηγή ⇒ null — τίποτα να γεμίσει', () => {
    expect(resolveTableFillTarget(rect(1, 3, 1, 3), at(2, 2))).toBeNull();
  });

  it('η πηγή ΔΕΝ περιλαμβάνεται ποτέ στον στόχο', () => {
    const target = resolveTableFillTarget(rect(0, 1, 0, 0), at(4, 0));
    expect(target?.bounds).toEqual(rect(2, 4, 0, 0));
  });

  it('η προεπισκόπηση είναι η ΕΝΩΣΗ πηγής και στόχου', () => {
    const source = rect(1, 1, 1, 1);
    const target = resolveTableFillTarget(source, at(4, 1))!;
    expect(tableFillPreviewBounds(source, target)).toEqual(rect(1, 4, 1, 1));
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Η γεωμετρία της λαβής
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Διάταξη γραμμένη με το χέρι, **επίτηδες**: το υπό δοκιμή είναι η γεωμετρία της λαβής, όχι
 * ο μετρητής. Στήλες 20 mm, γραμμές 8 mm — αριθμοί που κάνουν κάθε προσδοκία παρακάτω
 * αναγνώσιμη χωρίς αριθμητική.
 */
const LAYOUT: TableLayout = {
  widthMm: 100,
  heightMm: 40,
  columns: COLUMNS.map((column, i) => ({ id: column.id, xMm: i * 20, widthMm: 20 })),
  rows: ROWS.map((row, i) => ({ id: row.id, yMm: i * 8, heightMm: 8 })),
  cells: [],
  borders: [],
};
const PX_PER_MM = 2;

describe('η λαβή κάθεται στην κάτω δεξιά γωνία', () => {
  it('κεντραρισμένη στην κορυφή — μισή μέσα, μισή έξω', () => {
    const handle = tableFillHandleRectMm(LAYOUT, rect(0, 0, 0, 0), PX_PER_MM)!;
    const sideMm = TABLE_FILL_HANDLE_PX / PX_PER_MM;
    // Το κελί A1 είναι 20×8 mm με πάνω-αριστερά στο (0,0) ⇒ η κορυφή του είναι στο (20, 8).
    expect(handle).toEqual({ x: 20 - sideMm / 2, y: 8 - sideMm / 2, w: sideMm, h: sideMm });
  });

  it('ακολουθεί την ΠΕΡΙΟΧΗ, όχι το ενεργό κελί', () => {
    const handle = tableFillHandleRectMm(LAYOUT, rect(0, 1, 0, 1), PX_PER_MM)!;
    expect(handle.x).toBeCloseTo(40 - TABLE_FILL_HANDLE_PX / PX_PER_MM / 2);
    expect(handle.y).toBeCloseTo(16 - TABLE_FILL_HANDLE_PX / PX_PER_MM / 2);
  });

  /** 🔑 Η **οπή** μεγαλώνει, όχι η ζωγραφιά: ένα μεγαλύτερο τετράγωνο θα σκέπαζε κείμενο. */
  it('🔑 πιάνεται και λίγο ΕΞΩ από το τετράγωνο (WCAG 2.5.8)', () => {
    const handle = tableFillHandleRectMm(LAYOUT, rect(0, 0, 0, 0), PX_PER_MM)!;
    expect(isOnTableFillHandle({ u: 20, v: 8 }, handle, PX_PER_MM)).toBe(true);
    // Ένα χιλιοστό έξω από τη ζωγραφιά, μέσα στην οπή.
    expect(isOnTableFillHandle({ u: 20 + 2.5, v: 8 }, handle, PX_PER_MM)).toBe(true);
    // Μακριά: όχι.
    expect(isOnTableFillHandle({ u: 30, v: 8 }, handle, PX_PER_MM)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-754 §13.8 — Η ΟΠΗ ΕΙΝΑΙ ΑΣΥΜΜΕΤΡΗ: μεγαλώνει ΜΟΝΟ προς τα έξω
//
// Ο ιδιοκτήτης το μέτρησε στην οθόνη (04/08): «*το fill handle συγκρούεται με τον σταυρό με τα
// βελάκια*». Αιτία: η οπή διαστελλόταν **ομοιόμορφα** γύρω από **κεντραρισμένη** ζωγραφιά, άρα
// τα 7 px προς τα μέσα έπεφταν πάνω στη ζώνη `range-move` του ADR-739 §36.
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §13.8 η οπή της λαβής ΔΕΝ κλέβει pixel από τη μετακίνηση', () => {
  const HANDLE = tableFillHandleRectMm(LAYOUT, rect(0, 0, 0, 0), PX_PER_MM)!;
  const on = (u: number, v: number) => isOnTableFillHandle({ u, v }, HANDLE, PX_PER_MM);
  /** Η κορυφή του A1 — το σημείο γύρω από το οποίο παίζεται ολόκληρη η διεκδίκηση. */
  const CORNER = { u: 20, v: 8 };
  const inkHalfMm = TABLE_FILL_HANDLE_PX / 2 / PX_PER_MM;
  const outwardMm = TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX / PX_PER_MM;

  /**
   * 🔑 **Η ΖΩΓΡΑΦΙΑ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ.** Ό,τι βάφεται μαύρο πιάνεται — και προς τα μέσα
   * **μόνο** αυτό. Η πάνω-αριστερή κορυφή της ζωγραφιάς είναι το εσώτατο pixel που ανήκει
   * ακόμη στη λαβή· ένα νύχι πιο μέσα και ανήκει στη μετακίνηση.
   */
  it('🔑 ΟΛΗ η ζωγραφιά πιάνεται — και οι τέσσερις κορυφές της', () => {
    expect(on(HANDLE.x, HANDLE.y)).toBe(true);
    expect(on(HANDLE.x + HANDLE.w, HANDLE.y)).toBe(true);
    expect(on(HANDLE.x, HANDLE.y + HANDLE.h)).toBe(true);
    expect(on(HANDLE.x + HANDLE.w, HANDLE.y + HANDLE.h)).toBe(true);
    expect(on(CORNER.u, CORNER.v)).toBe(true);
  });

  /** Προς τα έξω η οπή πληρώνεται **ολόκληρη**: εκεί δείχνει και η ίδια η πράξη. */
  it('προς τα ΕΞΩ (κάτω-δεξιά) πιάνεται ολόκληρη η οπή', () => {
    expect(on(CORNER.u + inkHalfMm + outwardMm, CORNER.v)).toBe(true);
    expect(on(CORNER.u, CORNER.v + inkHalfMm + outwardMm)).toBe(true);
    // Ένα νύχι πιο έξω από την οπή ⇒ τέλος.
    expect(on(CORNER.u + inkHalfMm + outwardMm + 0.01, CORNER.v)).toBe(false);
    expect(on(CORNER.u, CORNER.v + inkHalfMm + outwardMm + 0.01)).toBe(false);
  });

  /**
   * 🔴🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΤΗΣ ΟΘΟΝΗΣ, ΚΛΕΙΔΩΜΕΝΟ.** Πριν τη διόρθωση και τα τέσσερα αυτά σημεία
   * ήταν «λαβή», ενώ ο χρήστης σημάδευε το **περίγραμμα** για να μετακινήσει την περιοχή.
   */
  it('🔴 προς τα ΜΕΣΑ (πάνω-αριστερά) η οπή ΔΕΝ επεκτείνεται — ούτε ένα px', () => {
    const justInside = 0.01;
    expect(on(HANDLE.x - justInside, CORNER.v)).toBe(false);
    expect(on(CORNER.u, HANDLE.y - justInside)).toBe(false);
    // Και σε ολόκληρη τη λωρίδα που ανακτήθηκε (η παλιά συμμετρική οπή έπιανε ως εδώ).
    expect(on(CORNER.u - inkHalfMm - outwardMm, CORNER.v)).toBe(false);
    expect(on(CORNER.u, CORNER.v - inkHalfMm - outwardMm)).toBe(false);
  });

  /**
   * 🔑 **Ο ΔΕΙΚΤΗΣ ΤΟ ΛΕΕΙ ΚΙΟΛΑΣ.** Δεν αρκεί η λαβή να παραιτηθεί — πρέπει το ίδιο pixel να
   * **γυρίσει** στη μετακίνηση, αλλιώς θα είχαμε φτιάξει νεκρή ζώνη. Το `range-move` βγαίνει
   * από τον **ίδιο** δρόμο που ρωτά και το πάτημα (§14.4), άρα η συμφωνία είναι δομική.
   */
  it('🔑 το pixel που ανακτήθηκε δίνει ΞΑΝΑ `range-move` στον δείκτη', () => {
    const BANDS = tableIndicatorBandsMm(PX_PER_MM);
    const rangeRect = { x: 0, y: 0, w: 20, h: 8 }; // το κελί A1
    // Δύο βήματα μέσα από τη ζωγραφιά, πάνω στην κάτω πλευρά και στη δεξιά αντίστοιχα.
    const onBottom = { u: CORNER.u - inkHalfMm - 0.5, v: CORNER.v };
    const onRight = { u: CORNER.u, v: CORNER.v - inkHalfMm - 0.5 };
    for (const point of [onBottom, onRight]) {
      const fill = tableFillHandleHitAtFrame(LAYOUT, point, PX_PER_MM, rect(0, 0, 0, 0));
      expect(fill).toBeNull();
      expect(
        tableIndicatorCursorRoleAtFrame(
          LAYOUT, point, BANDS, rangeRect, undefined, null, 'table-mode', null, fill,
        ),
      ).toBe('range-move');
    }
  });

  /**
   * 🔴 **ΤΟ ΦΡΑΓΜΑ ΠΟΥ ΚΑΝΕΙ ΤΟΝ ΑΡΙΘΜΟ ΣΩΣΤΟ.** Η εξωτερική εμβέλεια της λαβής οφείλει να
   * μένει **μέσα** στη ζώνη του περιγράμματος: μόλις την ξεπεράσει, η λαβή αρχίζει να τρώει το
   * **σώμα** του γειτονικού κελιού — που είναι ο μόνος τρόπος να επιλεγεί εκείνο (§36).
   *
   * Ζει ως test και όχι ως `import` μέσα στη γεωμετρία επίτηδες: η οπή του περιγράμματος φτάνει
   * στους καλούντες ως `bands.gapMm`, τιμή που η καθαρή `isOnTableFillHandle` δεν παραλαμβάνει.
   */
  it('🔴 η εξωτερική εμβέλεια ΔΕΝ ξεπερνά τη ζώνη μετακίνησης (7 ≤ 9 px)', () => {
    const outerReachPx = TABLE_FILL_HANDLE_PX / 2 + TABLE_FILL_HANDLE_OUTWARD_APERTURE_PX;
    expect(outerReachPx).toBeLessThanOrEqual(TABLE_INDICATOR_GRIP_CLEARANCE_PX);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-754 §14 — ο ΕΝΑΣ δρόμος: ποια περιοχή έχει λαβή, και πότε πιάνεται
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 ADR-739 §36.9 — **Η ΣΟΥΙΤΑ ΤΗΣ `tableFillSourceBounds` ΜΕΤΑΚΟΜΙΣΕ** μαζί με τη συνάρτηση,
 * που πλέον λέγεται `tableEffectiveRangeBounds` και ζει στο `table-effective-range.ts`: απέκτησε
 * **τέταρτο** καταναλωτή που δεν αφορά λαβή (τη μετακίνηση περιγράμματος του §36). Δες
 * `__tests__/table-effective-range.test.ts` — **μετακόμιση, όχι αντίγραφο**.
 */

describe('🔴 tableFillHandleHitAtFrame — ο δείκτης και το πάτημα ρωτούν το ΙΔΙΟ', () => {
  const SOURCE = rect(0, 0, 0, 0); // το κελί A1 ⇒ λαβή στην κορυφή (20, 8)

  it('πάνω στη λαβή ⇒ χτύπημα, με το ΙΔΙΟ ορθογώνιο που ζωγραφίζεται', () => {
    const hit = tableFillHandleHitAtFrame(LAYOUT, { u: 20, v: 8 }, PX_PER_MM, SOURCE);
    expect(hit?.rectMm).toEqual(tableFillHandleRectMm(LAYOUT, SOURCE, PX_PER_MM));
  });

  it('μέσα στην οπή αλλά έξω από τη ζωγραφιά ⇒ χτύπημα (WCAG 2.5.8)', () => {
    expect(tableFillHandleHitAtFrame(LAYOUT, { u: 22.5, v: 8 }, PX_PER_MM, SOURCE)).not.toBeNull();
  });

  it('μακριά ⇒ null', () => {
    expect(tableFillHandleHitAtFrame(LAYOUT, { u: 30, v: 8 }, PX_PER_MM, SOURCE)).toBeNull();
  });

  /** 🔑 Η μία γραμμή που κωδικοποιεί το «η λαβή σιωπά σε γραφή» (§13.5, Excel parity). */
  it('🔑 χωρίς πηγή ⇒ null — καμία λαβή, καμία γεωμετρία', () => {
    expect(tableFillHandleHitAtFrame(LAYOUT, { u: 20, v: 8 }, PX_PER_MM, null)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-754 §14 — ο 11ος ρόλος δείκτη: ο λεπτός μαύρος σταυρός
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 §14 ο δείκτης της λαβής — και η ΣΕΙΡΑ που τον κάνει ορατό', () => {
  const BANDS = tableIndicatorBandsMm(PX_PER_MM);
  const SOURCE = rect(0, 0, 0, 0);
  /** Η λαβή του A1, ήδη απαντημένη — όπως ακριβώς τη δίνει ο `tableIndicatorProbeAtWorld`. */
  const hitAt = (u: number, v: number, source: TableCellRangeBounds | null = SOURCE) =>
    tableFillHandleHitAtFrame(LAYOUT, { u, v }, PX_PER_MM, source);

  it('πάνω στη λαβή ⇒ `fill-handle`', () => {
    expect(
      tableIndicatorCursorRoleAtFrame(
        LAYOUT, { u: 20, v: 8 }, BANDS, null, undefined, null, 'table-mode', null, hitAt(20, 8),
      ),
    ).toBe('fill-handle');
  });

  /**
   * 🔴 **ΠΡΑΓΜΑΤΙΚΗ ΔΙΕΚΔΙΚΗΣΗ, ΟΧΙ ΔΗΛΩΣΗ.** Η λαβή κάθεται πάνω στην κορυφή του περιγράμματος
   * της επιλογής, δηλαδή **μέσα** στη ζώνη σύλληψής του. Το ίδιο σημείο, χωρίς την απάντηση της
   * λαβής, δίνει `range-move` — άρα χωρίς την προτεραιότητα ο χρήστης θα έβλεπε δείκτη
   * μετακίνησης πάνω σε χερούλι συμπλήρωσης: ο δείκτης θα έλεγε **λάθος** πράγμα, όχι απλώς
   * τίποτα.
   */
  it('🔴 νικά το `range-move` στο ΙΔΙΟ pixel — αλλιώς ο δείκτης λέει λάθος πράγμα', () => {
    const rangeRect = { x: 0, y: 0, w: 20, h: 8 };
    const args = [LAYOUT, { u: 20, v: 8 }, BANDS, rangeRect] as const;
    expect(tableIndicatorCursorRoleAtFrame(...args)).toBe('range-move');
    expect(
      tableIndicatorCursorRoleAtFrame(...args, undefined, null, 'table-mode', null, hitAt(20, 8)),
    ).toBe('fill-handle');
  });

  /**
   * 🔴 **ΠΑΝΩ ΑΠΟ ΤΟΝ ΦΥΛΑΚΑ `insideGrid`, ΚΑΙ ΕΙΝΑΙ ΟΥΣΙΩΔΕΣ.** Η λαβή είναι κεντραρισμένη στην
   * κορυφή, άρα **μισή έξω** από το πλέγμα εξ ορισμού· όταν η επιλογή αγγίζει την τελευταία
   * στήλη —η συνηθέστερη συμπλήρωση όλων— το μισό αυτό πέφτει έξω από το `widthMm`. Ο φρουρός
   * του πατήματος δεν ρωτά πλέγμα· αν ο δείκτης ρωτούσε, θα σιωπούσε ακριβώς στη μισή λαβή που
   * το κλικ πιάνει κανονικά.
   */
  it('🔴 ΕΞΩ από το πλέγμα (τελευταία στήλη) ⇒ πάλι `fill-handle`', () => {
    const last = rect(4, 4, 4, 4); // E5 ⇒ λαβή στην κορυφή (100, 40) = η γωνία του πίνακα
    const outside = { u: 101, v: 41 }; // μέσα στην οπή, έξω από το πλέγμα
    expect(tableIndicatorCursorRoleAtFrame(LAYOUT, outside, BANDS)).toBeNull();
    expect(
      tableIndicatorCursorRoleAtFrame(
        LAYOUT, outside, BANDS, null, undefined, null, 'table-mode', null,
        hitAt(outside.u, outside.v, last),
      ),
    ).toBe('fill-handle');
  });

  it('εκτός λειτουργίας πίνακα ⇒ καμία λαβή, ό,τι κι αν βρήκε η σάρωση', () => {
    expect(
      tableIndicatorCursorRoleAtFrame(
        LAYOUT, { u: 20, v: 8 }, BANDS, null, undefined, null, 'selection', null, hitAt(20, 8),
      ),
    ).toBeNull();
  });

  it('το οπλισμένο ⊖ της διαγραφής κρατά την προτεραιότητά του', () => {
    const remove = { phase: 'armed', hit: { axis: 'column', index: 0, colId: 'c1' } } as never;
    expect(
      tableIndicatorCursorRoleAtFrame(
        LAYOUT, { u: 20, v: 8 }, BANDS, null, undefined, null, 'table-mode', remove, hitAt(20, 8),
      ),
    ).toBe('delete-control');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Τι γράφεται
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **ADR-828 — ΑΥΤΟ ΤΟ describe ΑΛΛΑΞΕ ΝΟΗΜΑ, ΚΑΙ Η ΑΛΛΑΓΗ ΕΙΝΑΙ Η ΛΕΙΤΟΥΡΓΙΑ.**
 *
 * Μέχρι το ADR-828, πηγή `10, 20` προς τα κάτω έδινε `10 20 10 20` — επανάληψη μοτίβου. Ήταν
 * **δηλωμένη** απόφαση (η κεφαλίδα του `table-fill-apply.ts` την τεκμηρίωνε ρητά ως «ό,τι δεν
 * μπορεί να εκπλήξει»), όχι σφάλμα. Τώρα τα ίδια δύο κελιά **δηλώνουν βήμα** και η σειρά
 * συνεχίζεται, όπως στο Excel.
 *
 * Η επανάληψη μοτίβου **δεν χάθηκε**: μετακόμισε στο `mode: 'copy'`, και εξακολουθεί να είναι
 * η προεπιλογή για ό,τι δεν δείχνει διάταξη. Και οι δύο συμπεριφορές ελέγχονται εδώ, ώστε
 * καμία να μη χαθεί σιωπηλά.
 */
describe('🔑 μοτίβο και σειρά', () => {
  it('ADR-828: πηγή δύο κελιών ⇒ ΣΕΙΡΑ 30 40 50', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 1, 0, '20');

    const next = applyTableFill(bookOf(model),model, rect(0, 1, 0, 0), {
      direction: 'down',
      bounds: rect(2, 4, 0, 0),
    });

    expect([2, 3, 4].map((r) => valueAt(next, r, 0))).toEqual(['30', '40', '50']);
  });

  it('🔑 mode «copy» διατηρεί την ΠΡΟ-828 επανάληψη: 10 20 10', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 1, 0, '20');

    const next = applyTableFill(bookOf(model),
      model,
      rect(0, 1, 0, 0),
      { direction: 'down', bounds: rect(2, 4, 0, 0) },
      'copy',
    );

    expect([2, 3, 4].map((r) => valueAt(next, r, 0))).toEqual(['10', '20', '10']);
  });

  /** 🔑 Το υπόλοιπο πρέπει να μένει θετικό, αλλιώς ο δείκτης-πηγή βγαίνει εκτός ορθογωνίου. */
  it('🔑 προς τα ΠΑΝΩ το μοτίβο συνεχίζει ανάποδα (mode «copy»)', () => {
    let model = type(base(), 3, 0, '10');
    model = type(model, 4, 0, '20');

    const next = applyTableFill(bookOf(model),
      model,
      rect(3, 4, 0, 0),
      { direction: 'up', bounds: rect(0, 2, 0, 0) },
      'copy',
    );

    // r2 ← r4 (`20`), r1 ← r3 (`10`), r0 ← r4 (`20`)
    expect([0, 1, 2].map((r) => valueAt(next, r, 0))).toEqual(['20', '10', '20']);
  });

  it('🔑 ADR-828: προς τα ΠΑΝΩ η σειρά ΕΞΑΓΕΤΑΙ ανάστροφα — 0, −10, −20', () => {
    let model = type(base(), 3, 0, '10');
    model = type(model, 4, 0, '20');

    const next = applyTableFill(bookOf(model),model, rect(3, 4, 0, 0), {
      direction: 'up',
      bounds: rect(0, 2, 0, 0),
    });

    // r3 είναι η θέση 0· άρα r2 = −1 ⇒ 0, r1 = −2 ⇒ −10, r0 = −3 ⇒ −20.
    expect([0, 1, 2].map((r) => valueAt(next, r, 0))).toEqual(['-20', '-10', '0']);
  });

  it('🎯 ΤΟ ΑΙΤΗΜΑ, από άκρη σε άκρη: ΙΑΝΟΥΑΡΙΟΣ ⇒ ΦΕΒΡΟΥΑΡΙΟΣ, ΜΑΡΤΙΟΣ, ΑΠΡΙΛΙΟΣ', () => {
    const model = type(base(), 0, 0, 'ΙΑΝΟΥΑΡΙΟΣ');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), {
      direction: 'down',
      bounds: rect(1, 3, 0, 0),
    });

    expect([1, 2, 3].map((r) => valueAt(next, r, 0))).toEqual([
      'ΦΕΒΡΟΥΑΡΙΟΣ',
      'ΜΑΡΤΙΟΣ',
      'ΑΠΡΙΛΙΟΣ',
    ]);
  });

  it('🎯 ΤΟ ΑΙΤΗΜΑ: ΔΕΥΤΕΡΑ ⇒ ΤΡΙΤΗ, ΤΕΤΑΡΤΗ', () => {
    const model = type(base(), 0, 0, 'ΔΕΥΤΕΡΑ');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), {
      direction: 'down',
      bounds: rect(1, 2, 0, 0),
    });

    expect([1, 2].map((r) => valueAt(next, r, 0))).toEqual(['ΤΡΙΤΗ', 'ΤΕΤΑΡΤΗ']);
  });

  it('🔴 καθαρό κείμενο εξακολουθεί να ΑΝΤΙΓΡΑΦΕΤΑΙ — η προεπιλογή δεν έγινε επιθετική', () => {
    const model = type(base(), 0, 0, 'Δοκός');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), {
      direction: 'down',
      bounds: rect(1, 2, 0, 0),
    });

    expect([1, 2].map((r) => valueAt(next, r, 0))).toEqual(['Δοκός', 'Δοκός']);
  });

  it('🔴 ΕΝΑΣ αριθμός αντιγράφεται· με mode «series» γίνεται βήμα 1', () => {
    const model = type(base(), 0, 0, '10');
    const bounds = { direction: 'down' as const, bounds: rect(1, 2, 0, 0) };

    expect([1, 2].map((r) => valueAt(applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), bounds), r, 0))).toEqual(
      ['10', '10'],
    );
    expect(
      [1, 2].map((r) =>
        valueAt(applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), bounds, 'series'), r, 0),
      ),
    ).toEqual(['11', '12']);
  });

  /** 🔴 Το νεκρό καρφί του ADR-828 §4: γέμισμα που δεν αλλάζει τίποτα δεν γεννά βήμα undo. */
  it('🔴 αμετάβλητο γέμισμα επιστρέφει το ΙΔΙΟ μοντέλο by-reference', () => {
    let model = type(base(), 0, 0, 'Δοκός');
    model = type(model, 1, 0, 'Δοκός');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), {
      direction: 'down',
      bounds: rect(1, 1, 0, 0),
    });

    expect(next).toBe(model);
  });

  it('η ΠΗΓΗ μένει ακέραιη', () => {
    const model = type(base(), 0, 0, '10');
    const next = applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), {
      direction: 'down',
      bounds: rect(1, 2, 0, 0),
    });
    expect(valueAt(next, 0, 0)).toBe('10');
  });

  it('κενό γέμισμα ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo για το τίποτα)', () => {
    const model = base();
    expect(applyTableFill(bookOf(model),model, rect(0, 0, 0, 0), { direction: 'down', bounds: rect(1, 2, 0, 0) }))
      .toBe(model);
  });
});

/**
 * 🔴 **ΕΔΩ ΣΥΝΑΝΤΙΟΥΝΤΑΙ ΤΟ Γ1 ΚΑΙ ΤΟ Γ2.** Αυτό το `describe` είναι ο λόγος που τα δύο
 * γράφτηκαν μαζί: χωρίς το `$`, κάθε γραμμή παρακάτω θα έδινε **λάθος αριθμό σε παραδοτέο**.
 */
describe('🔴 οι τύποι ολισθαίνουν — και το `$` τους κρατά', () => {
  it('🔑 η κλασική συμπλήρωση: «=A1*2» κάτω ⇒ «=A2*2», «=A3*2»', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 1, 0, '20');
    model = type(model, 2, 0, '30');
    model = type(model, 0, 1, '=A1*2');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 1, 1), {
      direction: 'down',
      bounds: rect(1, 2, 1, 1),
    });

    expect(formulaAt(next, 1, 1)).toBe('=A2*2');
    expect(formulaAt(next, 2, 1)).toBe('=A3*2');
    expect([valueAt(next, 1, 1), valueAt(next, 2, 1)]).toEqual(['40', '60']);
  });

  it('🔑 «επί σταθερό συντελεστή»: το «=A1*$A$5» κρατά τον συντελεστή του', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 1, 0, '20');
    model = type(model, 4, 0, '3');
    model = type(model, 0, 1, '=A1*$A$5');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 1, 1), {
      direction: 'down',
      bounds: rect(1, 1, 1, 1),
    });

    expect(formulaAt(next, 1, 1)).toBe('=A2*$A$5');
    expect(valueAt(next, 1, 1)).toBe('60');
  });

  it('η συμπλήρωση ΔΕΞΙΑ ολισθαίνει στήλες', () => {
    let model = type(base(), 0, 0, '10');
    model = type(model, 0, 1, '20');
    model = type(model, 1, 0, '=A1*2');

    const next = applyTableFill(bookOf(model),model, rect(1, 1, 0, 0), {
      direction: 'right',
      bounds: rect(1, 1, 1, 1),
    });

    expect(formulaAt(next, 1, 1)).toBe('=B1*2');
    expect(valueAt(next, 1, 1)).toBe('40');
  });

  it('🔑 μεικτή αναφορά: το «=$A1» δεξιά κρατά τη ΣΤΗΛΗ και ακολουθεί τη γραμμή', () => {
    let model = type(base(), 0, 0, '7');
    model = type(model, 0, 1, '=$A1');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 1, 1), {
      direction: 'right',
      bounds: rect(0, 0, 2, 3),
    });

    expect(formulaAt(next, 0, 2)).toBe('=$A1');
    expect(valueAt(next, 0, 2)).toBe('7');
  });

  it('εκτός πλέγματος ⇒ #REF!, ποτέ σιωπηλή στάθμευση', () => {
    let model = type(base(), 4, 0, '1');
    model = type(model, 0, 1, '=A1');

    const next = applyTableFill(bookOf(model),model, rect(0, 0, 1, 1), {
      direction: 'up',
      bounds: rect(0, 0, 1, 1),
    });
    // Το γέμισμα δεν βγήκε έξω· ο έλεγχος του #REF! ζει ολόκληρος στο `table-formula-offset`.
    expect(formulaAt(next, 0, 1)).toBe('=A1');
  });
});
