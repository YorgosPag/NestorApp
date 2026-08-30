/**
 * 🔴 ADR-739 §48.12 — **Η ΑΠΟΣΥΡΣΗ ΤΟΥ ΠΕΡΙΓΡΑΜΜΑΤΟΣ, ΣΤΗΝ ΠΡΑΓΜΑΤΙΚΗ ΚΑΛΩΔΙΩΣΗ.**
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — «πράσινο που σήμαινε δεν κοίταξα»
 * Το §48.12 είχε **15 πράσινα tests** και **δεν δούλευε ζωντανά**. Ο λόγος είναι ολόκληρος σε
 * μία γραμμή: όλα καλούσαν `stampTableSelection(rc, RANGE, ACTIVE, true)` — με το `true`
 * **γραμμένο στο χέρι**. Επικύρωναν ότι *ο ζωγράφος υπακούει στη σημαία*, πράγμα αληθές· δεν
 * ρώτησαν ποτέ **ποιος και πώς υπολογίζει τη σημαία**, που ήταν ακριβώς το σπασμένο.
 *
 * Εδώ δεν γράφεται πουθενά `true`. Κάθε test ξεκινά από **κατάσταση δρομέα** και διασχίζει την
 * ίδια αλυσίδα με το ζωντανό καρέ:
 *
 * ```
 *   cursor → tableFrameSelectionView → tableFrameEffectiveRange → tableCopyMarqueeCoversRange
 * ```
 *
 * ## Το test που θα είχε πιάσει το σφάλμα
 * Είναι το «ΕΝΑ ΚΕΛΙ». Με επιλεγμένη *περιοχή* η απόσυρση δούλευε ήδη· έσπαγε **μόνο** χωρίς
 * επιλογή, όπου το `tableFrameSelectionView` επιστρέφει `null` και το περίγραμμα το ζωγραφίζει
 * ο **δρομέας**. Ένα test που δοκίμαζε μόνο το εύκολο σενάριο ήταν πράσινο και άχρηστο.
 *
 * @see rendering/entities/table/table-frame-cursor-view.ts — `tableFrameEffectiveRange`
 * @see bim/table/table-effective-range.ts — ο ΕΝΑΣ ορισμός, κοινός με την αντιγραφή
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §48.12
 */

import { tableCopyMarqueeCoversRange } from '../stamp-table-copy-marquee';
import { stampTableFillHandleOverlay } from '../table-formula-overlays';
import { tableFrameEffectiveRange, tableFrameSelectionView } from '../table-frame-cursor-view';
import { createPaintLog, createRc } from './table-paint-recorder';
import { computeTableEntityGeometryLive } from '../../../../bim/table/table-entity-geometry';
import { resolveTableSelectionBounds } from '../../../../bim/table/table-cell-range';
import { tableEffectiveRangeBounds } from '../../../../bim/table/table-effective-range';
import {
  createTableModel,
  resolveTableModel,
  toPersistedTableModel,
} from '../../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../../bim/table/table-style-presets';
import { useDrawingScaleStore } from '../../../../state/drawing-scale-store';
import type { TableCellRangeBounds } from '../../../../bim/table/table-cell-range';
import type { TableCopyMarqueeState } from '../../../../state/table-copy-marquee-store';
import type { TableCellCursorState } from '../../../../state/table-cell-cursor-store';
import type { TableColumn, TableRow, CellSpan } from '../../../../types/table';
import type { TableEntity } from '../../../../types/table-entity';
import { tableWorksheetFields } from '../../../../bim/table/__tests__/make-table-entity';
import { activeTableModel } from '../../../../bim/table/table-worksheet-resolve';

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

function entityWith(merges: CellSpan[] = []): TableEntity {
  return {
    id: 'tbl_suppression',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    ...tableWorksheetFields(toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS, merges }))),
  };
}

const ENTITY = entityWith();

/** Δρομέας σε κελί, με ή χωρίς ανοιχτή επιλογή. */
function cursorAt(
  rowId: string,
  colId: string,
  selection?: { toRowId: string; toColId: string },
): TableCellCursorState {
  return {
    entityId: ENTITY.id,
    position: { rowId, colId },
    mode: 'nav',
    selection: selection
      ? { from: { rowId, colId }, to: { rowId: selection.toRowId, colId: selection.toColId }, kind: 'range' }
      : undefined,
  } as unknown as TableCellCursorState;
}

/**
 * 🔴 **Ό,τι ΑΚΡΙΒΩΣ κάνει το `currentBounds()` του `use-table-range-actions.ts` στο `Ctrl+C`.**
 *
 * Δύο γραμμές, και οι δύο από τα ίδια SSoT modules που καλεί η παραγωγή. Αν κάποιος αλλάξει τη
 * μία πλευρά, το τελευταίο test αυτού του αρχείου («ΤΑΥΤΟΤΗΤΑ») κοκκινίζει.
 */
function boundsCopiedByCtrlC(
  entity: TableEntity,
  cursor: TableCellCursorState,
): TableCellRangeBounds | null {
  const model = resolveTableModel(activeTableModel(entity));
  const selectionBounds = cursor.selection
    ? resolveTableSelectionBounds(model, cursor.selection)
    : null;
  return tableEffectiveRangeBounds(model, cursor.position, selectionBounds);
}

function marqueeAfterCtrlC(
  entity: TableEntity,
  cursor: TableCellCursorState,
): TableCopyMarqueeState {
  const bounds = boundsCopiedByCtrlC(entity, cursor);
  if (!bounds) throw new Error('το σενάριο απαιτεί ορίσιμη περιοχή');
  return { entityId: entity.id, bounds, modelRef: activeTableModel(entity), startedAtMs: 0 };
}

/** Η ίδια διαδρομή που τρέχει ο `TableRenderer.drawTable` για ΑΥΤΟ το καρέ. */
function outlineSuppressedInFrame(entity: TableEntity, cursor: TableCellCursorState, marquee: TableCopyMarqueeState | null): boolean {
  const layout = computeTableEntityGeometryLive(entity).layout;
  const selection = tableFrameSelectionView(entity, cursor, layout);
  const effectiveRange = tableFrameEffectiveRange(entity, cursor, selection?.bounds);
  return tableCopyMarqueeCoversRange(entity, marquee, effectiveRange);
}

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
});

describe('🔴 ADR-739 §48.12 — το περίγραμμα αποσύρεται μπροστά στα μυρμήγκια', () => {
  it('ΒΑΣΗ — χωρίς πρόχειρο το περίγραμμα ΜΕΝΕΙ (αλλιώς τα υπόλοιπα είναι πράσινα δωρεάν)', () => {
    expect(outlineSuppressedInFrame(ENTITY, cursorAt('r1', 'c1', { toRowId: 'r2', toColId: 'c2' }), null)).toBe(false);
  });

  it('ΠΕΡΙΟΧΗ επιλεγμένη + Ctrl+C ⇒ αποσύρεται', () => {
    const cursor = cursorAt('r1', 'c1', { toRowId: 'r2', toColId: 'c2' });
    expect(outlineSuppressedInFrame(ENTITY, cursor, marqueeAfterCtrlC(ENTITY, cursor))).toBe(true);
  });

  it('🔴 ΕΝΑ ΚΕΛΙ (καμία επιλογή) + Ctrl+C ⇒ αποσύρεται — ΑΥΤΟ ΗΤΑΝ ΤΟ ΣΠΑΣΜΕΝΟ', () => {
    // Χωρίς επιλογή το `stampTableSelection` δεν καλείται καν· το περίγραμμα το γράφει ο
    // δρομέας. Πριν τη διόρθωση εδώ έβγαινε `false` και ο χρήστης έβλεπε συμπαγή γραμμή 2 px
    // ακριβώς πάνω στη διαδρομή των μυρμηγκιών — δηλαδή «δεν άλλαξε τίποτε».
    const cursor = cursorAt('r1', 'c1');
    expect(tableFrameSelectionView(ENTITY, cursor, computeTableEntityGeometryLive(ENTITY).layout)).toBeNull();
    expect(outlineSuppressedInFrame(ENTITY, cursor, marqueeAfterCtrlC(ENTITY, cursor))).toBe(true);
  });

  it('ΕΝΕΡΓΟ ΚΕΛΙ ΜΕΣΑ ΣΕ ΣΥΓΧΩΝΕΥΣΗ ⇒ κουμπώνει ΚΑΙ στις δύο πλευρές, άρα αποσύρεται', () => {
    // Το κούμπωμα είναι ο πιο εύθραυστος κρίκος: αν η μία πλευρά κουμπώσει και η άλλη όχι, τα
    // όρια διαφέρουν σιωπηλά και η απόσυρση παύει — χωρίς κανένα σφάλμα πουθενά.
    const merged = entityWith([{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 1, colSpan: 2 }]);
    const cursor = { ...cursorAt('r1', 'c1'), entityId: merged.id } as TableCellCursorState;
    const marquee = marqueeAfterCtrlC(merged, cursor);
    expect(marquee.bounds).toEqual({ firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 1 });
    expect(outlineSuppressedInFrame(merged, cursor, marquee)).toBe(true);
  });

  it('ΑΛΛΗ περιοχή στο πρόχειρο ⇒ το περίγραμμα ΜΕΝΕΙ', () => {
    const copied = marqueeAfterCtrlC(ENTITY, cursorAt('r1', 'c1'));
    expect(outlineSuppressedInFrame(ENTITY, cursorAt('r2', 'c2'), copied)).toBe(false);
  });

  it('ΜΠΑΓΙΑΤΙΚΗ έκδοση μοντέλου ⇒ ΜΕΝΕΙ — αλλιώς ο χρήστης έμενε με ΚΑΜΙΑ γραμμή', () => {
    // Ο ζωγράφος των μυρμηγκιών σιωπά σε μπαγιάτικο `modelRef`. Αν η απόσυρση δεν περνούσε από
    // τον ΙΔΙΟ φρουρό, θα έσβηνε περίγραμμα για χάρη μυρμηγκιών που δεν ζωγραφίζονται πουθενά.
    const cursor = cursorAt('r1', 'c1');
    const stale = { ...marqueeAfterCtrlC(ENTITY, cursor), modelRef: {} as TableEntity['model'] };
    expect(outlineSuppressedInFrame(ENTITY, cursor, stale)).toBe(false);
  });

  it('ΑΛΛΟΣ πίνακας στο πρόχειρο ⇒ ΜΕΝΕΙ — δύο πίνακες δεν μοιράζονται πρόχειρο', () => {
    const cursor = cursorAt('r1', 'c1');
    const other = { ...marqueeAfterCtrlC(ENTITY, cursor), entityId: 'tbl_allos' };
    expect(outlineSuppressedInFrame(ENTITY, cursor, other)).toBe(false);
  });
});

describe('🔴 §48.12 Η ΛΑΒΗ ΕΠΙΒΙΩΝΕΙ — «μένει μόνο το fill handle»', () => {
  // Η προδιαγραφή έχει **δύο** σκέλη και το δεύτερο δεν ελεγχόταν από πουθενά: όχι απλώς
  // «φεύγει το περίγραμμα», αλλά «φεύγει το περίγραμμα **και μένει η λαβή**». Χωρίς αυτό,
  // μια «απλοποίηση» που σιωπά ολόκληρο το overlay θα ήταν πράσινη — και θα έπαιρνε μαζί της
  // μια **πράξη** (σύρσιμο συμπλήρωσης), όχι μια ένδειξη.
  function handleStrokes(cursor: TableCellCursorState) {
    const log = createPaintLog();
    const layout = computeTableEntityGeometryLive(ENTITY).layout;
    const selection = tableFrameSelectionView(ENTITY, cursor, layout);
    const effectiveRange = tableFrameEffectiveRange(ENTITY, cursor, selection?.bounds);
    stampTableFillHandleOverlay(createRc(log), layout, ENTITY, cursor, effectiveRange);
    return log.strokes;
  }

  it('ΧΩΡΙΣ επιλογή — η λαβή ζωγραφίζεται (το σενάριο του σφάλματος)', () => {
    expect(handleStrokes(cursorAt('r1', 'c1')).length).toBeGreaterThan(0);
  });

  it('ΜΕ επιλογή περιοχής — η λαβή ζωγραφίζεται', () => {
    expect(handleStrokes(cursorAt('r1', 'c1', { toRowId: 'r2', toColId: 'c2' })).length).toBeGreaterThan(0);
  });

  it('ΣΕ ΓΡΑΦΗ — σιωπά (Excel parity: το χερούλι φεύγει μόλις ανοίξει ο επεξεργαστής)', () => {
    const writing = { ...cursorAt('r1', 'c1'), mode: 'edit' } as TableCellCursorState;
    expect(handleStrokes(writing)).toHaveLength(0);
  });
});

describe('🔴 §48.12 ΤΑΥΤΟΤΗΤΑ — αντιγραφή και ζωγραφική ρωτούν την ΙΔΙΑ συνάρτηση', () => {
  // Αυτό είναι το test που κάνει την κλάση σφάλματος **μη εκφράσιμη**. Η απόσυρση συγκρίνει τα
  // όρια που κράτησε το πρόχειρο με τα όρια που ζωγραφίζει το καρέ. Όσο οι δύο πλευρές είχαν
  // ξεχωριστή διατύπωση, η ισότητά τους ήταν σύμπτωση· τώρα είναι ταυτότητα, και εδώ φυλάγεται.
  it.each([
    ['χωρίς επιλογή', cursorAt('r1', 'c1')],
    ['με επιλογή περιοχής', cursorAt('r1', 'c1', { toRowId: 'r2', toColId: 'c2' })],
    ['επιλογή ενός κελιού', cursorAt('r2', 'c2', { toRowId: 'r2', toColId: 'c2' })],
  ])('%s — τα δύο μονοπάτια δίνουν ΤΑ ΙΔΙΑ όρια', (_label, cursor) => {
    const layout = computeTableEntityGeometryLive(ENTITY).layout;
    const selection = tableFrameSelectionView(ENTITY, cursor, layout);
    expect(tableFrameEffectiveRange(ENTITY, cursor, selection?.bounds)).toEqual(
      boundsCopiedByCtrlC(ENTITY, cursor),
    );
  });
});
