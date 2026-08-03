/**
 * 🔴 **Λαβές ύψους γραμμής** (Giorgio 2026-08-04) — το δίχτυ της νέας χειρονομίας.
 *
 * Το ADR-739 §8 **απαγόρευε** ρητά αυτές τις λαβές, με επιχείρημα απόδοσης: «500 γραμμές ⇒
 * 500 λαβές ζωγραφισμένες και hit-tested ανά καρέ». Το επιχείρημα αφορούσε το **πλήθος**,
 * όχι τον άξονα — και ίσχυε ήδη ασυζήτητα για τις στήλες (`MAX_TABLE_COLUMN_COUNT` = 256).
 * Η άρση του δεν είναι χαλάρωση: μπήκε φράγμα `MAX_AXIS_EDGE_GRIPS` **και στους δύο** άξονες.
 *
 * Τρία πράγματα ελέγχονται, και κανένα δεν είναι διακοσμητικό:
 *  1. **Το φράγμα φράζει πραγματικά** — και ανά άξονα, όχι συνολικά.
 *  2. **Η αριθμητική είναι κατοπτρική της στήλης** — η γραμμή ΠΑΝΩ από το όριο κρατά την
 *     αλλαγή, οι επόμενες ολισθαίνουν, και το ελάχιστο ύψος φράζει.
 *  3. **Η λαβή κάθεται στην ΑΡΙΣΤΕΡΗ ακμή** (`u = 0`), εκτός του χώρου των ζωνών (§27.11).
 */

import {
  applyTableGripDrag,
  getTableGrips,
  resizeTableRowAboveEdge,
  MAX_AXIS_EDGE_GRIPS,
  TABLE_ROW_KIND,
  TABLE_COLUMN_KIND,
} from '../table-entity-grips';
import { computeTableEntityGeometry, tableWorldToFrame } from '../table-entity-geometry';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { MIN_TABLE_ROW_HEIGHT_MM } from '../../../types/table-entity';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
});

/** 2 στήλες × 3 γραμμές των 8mm, άγκυρα στο (100, 200) — ο πίνακας πέφτει προς τα κάτω. */
function makeEntity(rowCount = 3, colCount = 2): TableEntity {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c}`,
    sizing: { kind: 'fixed', widthMm: 20 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r}`,
    rowClass: r === 0 ? 'header' : 'data',
    heightMm: 8,
  }));
  return {
    id: 'tbl_rows',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 100, y: 200 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(createTableModel({ columns, rows })),
  };
}

const rowGrips = (entity: TableEntity) =>
  getTableGrips(entity).filter((g) => g.gripKind?.kind === TABLE_ROW_KIND);

const heightOf = (model: TableEntity['model'], rowId: string): number | undefined =>
  model.rows.find((r) => r.id === rowId)?.heightMm;

// ── 1. Οι λαβές υπάρχουν, και ΜΟΝΟ στα εσωτερικά όρια ───────────────────────

describe('λαβές ύψους γραμμής — πού γεννιούνται', () => {
  it('μία ανά ΕΣΩΤΕΡΙΚΟ όριο: 3 γραμμές ⇒ 2 λαβές (όχι 3, όχι 4)', () => {
    // Η πάνω ακμή είναι η **άγκυρα** (την κινεί το `table-corner-nw`) και η κάτω **προκύπτει**
    // από τα ύψη — καμία από τις δύο δεν είναι ανεξάρτητος βαθμός ελευθερίας.
    expect(rowGrips(makeEntity(3))).toHaveLength(2);
    expect(rowGrips(makeEntity(1))).toHaveLength(0);
  });

  it('🔴 κάθονται στην ΑΡΙΣΤΕΡΗ ακμή (u = 0) — έξω από τον χώρο των ζωνών του δείκτη', () => {
    const entity = makeEntity(3);
    const geo = computeTableEntityGeometry(entity, 1, 'mm');
    const frames = rowGrips(entity).map((g) => tableWorldToFrame(entity, g.position, geo.mmToWorld));
    expect(frames.map((f) => f.u)).toEqual([0, 0]);
    // Τα εσωτερικά όρια των 8mm γραμμών: 8 και 16.
    expect(frames.map((f) => f.v)).toEqual([8, 16]);
  });

  it('🔴 ΤΟ ΦΡΑΓΜΑ: πάνω από το όριο οι λαβές του άξονα φεύγουν ΟΛΕΣ, όχι οι μισές', () => {
    // Μισές λαβές είναι χειρότερες από καμία: ο χρήστης δεν μπορεί να μαντέψει ποιες λείπουν.
    const justUnder = makeEntity(MAX_AXIS_EDGE_GRIPS + 1); // ⇒ ακριβώς MAX εσωτερικά όρια
    expect(rowGrips(justUnder)).toHaveLength(MAX_AXIS_EDGE_GRIPS);

    const over = makeEntity(MAX_AXIS_EDGE_GRIPS + 2);
    expect(rowGrips(over)).toHaveLength(0);
  });

  it('🔴 το φράγμα είναι ΑΝΑ ΑΞΟΝΑ: πίνακας με πολλές γραμμές κρατά τις λαβές στηλών του', () => {
    const tall = makeEntity(MAX_AXIS_EDGE_GRIPS + 2, 3);
    expect(rowGrips(tall)).toHaveLength(0);
    expect(getTableGrips(tall).filter((g) => g.gripKind?.kind === TABLE_COLUMN_KIND))
      .toHaveLength(2);
  });

  it('🔴 οι δείκτες λαβών μένουν ΣΥΝΕΧΟΜΕΝΟΙ όταν ο ένας άξονας κόβεται από το φράγμα', () => {
    // Ο δείκτης είναι το κλειδί με το οποίο ο engine ταιριάζει ζωγραφισμένη με πιασμένη λαβή:
    // ένα σταθερό offset «μετά τις λαβές στηλών» θα άφηνε τρύπα όποτε το φράγμα κόβει.
    const grips = getTableGrips(makeEntity(3, MAX_AXIS_EDGE_GRIPS + 2));
    expect(grips.map((g) => g.gripIndex)).toEqual(grips.map((_, i) => i));
  });
});

// ── 2. Η αριθμητική — κατοπτρική της στήλης ─────────────────────────────────

describe('resizeTableRowAboveEdge — ποια γραμμή κρατά την αλλαγή', () => {
  it('η γραμμή ΠΑΝΩ από το όριο παίρνει το νέο ύψος· οι υπόλοιπες ΔΕΝ αγγίζονται', () => {
    const entity = makeEntity(3);
    const model = resizeTableRowAboveEdge(entity, 1, 20);
    expect(model).not.toBeNull();
    expect(heightOf(model!, 'r0')).toBe(20); // 20mm από την πάνω ακμή (yMm = 0)
    expect(heightOf(model!, 'r1')).toBe(8);
    expect(heightOf(model!, 'r2')).toBe(8);
  });

  it('το δεύτερο όριο μετρά από το ΔΙΚΟ του `yMm`, όχι από την κορυφή', () => {
    // Όριο 2 στα v = 16· σύρσιμο στα 30 ⇒ η `r1` (που ξεκινά στα 8) γίνεται 22, όχι 30.
    const model = resizeTableRowAboveEdge(makeEntity(3), 2, 30);
    expect(heightOf(model!, 'r1')).toBe(22);
    expect(heightOf(model!, 'r0')).toBe(8);
  });

  it('🔴 φράζεται στο ΕΛΑΧΙΣΤΟ ύψος — σύρσιμο προς τα πάνω δεν εκμηδενίζει τη γραμμή', () => {
    const model = resizeTableRowAboveEdge(makeEntity(3), 1, -50);
    expect(heightOf(model!, 'r0')).toBe(MIN_TABLE_ROW_HEIGHT_MM);
  });

  it('δείκτης εκτός εύρους ⇒ `null` — ο καλών δεν εφευρίσκει τίποτα', () => {
    expect(resizeTableRowAboveEdge(makeEntity(3), 0, 20)).toBeNull();
    expect(resizeTableRowAboveEdge(makeEntity(3), 99, 20)).toBeNull();
  });

  it('επιστρέφει ΝΕΟ αντικείμενο μοντέλου — η ταυτότητα ΕΙΝΑΙ η έκδοση (ακύρωση μνήμης)', () => {
    const entity = makeEntity(3);
    const model = resizeTableRowAboveEdge(entity, 1, 20);
    expect(model).not.toBe(entity.model);
    expect(model!.columns).toBe(entity.model.columns); // ό,τι δεν άλλαξε μένει ΤΟ ΙΔΙΟ
  });
});

// ── 3. Το σύρσιμο της λαβής ─────────────────────────────────────────────────

describe('applyTableGripDrag — `table-row-edge`', () => {
  it('σύρσιμο ΚΑΤΩ μεγαλώνει τη γραμμή από πάνω (ο άξονας y της σκηνής δείχνει πάνω)', () => {
    const entity = makeEntity(3);
    // Η λαβή του πρώτου εσωτερικού ορίου: (100, 192) στη σκηνή. Σύρσιμο 6 μονάδες κάτω.
    const patch = applyTableGripDrag(TABLE_ROW_KIND, entity, { x: 100, y: 192 }, { x: 0, y: -6 });
    expect(heightOf(patch.model!, 'r0')).toBe(14);
  });

  it('η ΟΡΙΖΟΝΤΙΑ συνιστώσα αγνοείται — η λαβή έχει έναν βαθμό ελευθερίας', () => {
    const entity = makeEntity(3);
    const patch = applyTableGripDrag(TABLE_ROW_KIND, entity, { x: 100, y: 192 }, { x: 40, y: 0 });
    expect(heightOf(patch.model!, 'r0')).toBe(8);
  });

  it('🔴 διαλέγει το ΠΛΗΣΙΕΣΤΕΡΟ όριο στη θέση της λαβής, όχι πάντα το πρώτο', () => {
    const entity = makeEntity(3);
    // Η λαβή του ΔΕΥΤΕΡΟΥ ορίου: (100, 184). Χωρίς σωστή αντιστοίχιση θα άλλαζε η `r0`.
    const patch = applyTableGripDrag(TABLE_ROW_KIND, entity, { x: 100, y: 184 }, { x: 0, y: -4 });
    expect(heightOf(patch.model!, 'r1')).toBe(12);
    expect(heightOf(patch.model!, 'r0')).toBe(8);
  });
});
