/**
 * ADR-923 §5.10.4 Β1 — κίνηση δρομέα + επιλογή του γενικού πλέγματος (Excel).
 */
import { edgeOf, gridCursorAt, moveGridCursor, type GridCell } from '../grid-navigation';
import {
  cellsOfRange,
  clampSelection,
  collapsedSelection,
  extendSelection,
  extendSelectionTo,
  moveSelection,
  rangeOfSelection,
  selectColumn,
  selectWholeGrid,
} from '../grid-selection';

const size = { rows: 4, cols: 3 };
const ctx = { size };

describe('moveGridCursor', () => {
  it('βέλη μένουν μέσα στα όρια — στην άκρη δεν κινούνται (null)', () => {
    expect(moveGridCursor(gridCursorAt({ row: 0, col: 0 }), 'up', ctx)).toBeNull();
    expect(moveGridCursor(gridCursorAt({ row: 0, col: 0 }), 'right', ctx)).toEqual({ row: 0, col: 1, anchorCol: 1 });
  });

  it('Tab αναδιπλώνει στην επόμενη γραμμή και κρατά τη στήλη αγκύρωσης · Enter επιστρέφει σε αυτήν (Excel)', () => {
    const start = gridCursorAt({ row: 0, col: 1 });
    const tab1 = moveGridCursor(start, 'next', ctx)!;
    const tab2 = moveGridCursor(tab1, 'next', ctx)!;
    expect(tab2).toEqual({ row: 1, col: 0, anchorCol: 1 });
    expect(moveGridCursor(tab2, 'commitDown', ctx)).toEqual({ row: 2, col: 1, anchorCol: 1 });
  });

  it('Shift+Tab στην αρχή του πλέγματος δεν κινείται · Tab στο τέλος δεν κινείται', () => {
    expect(moveGridCursor(gridCursorAt({ row: 0, col: 0 }), 'previous', ctx)).toBeNull();
    expect(moveGridCursor(gridCursorAt({ row: 3, col: 2 }), 'next', ctx)).toBeNull();
  });

  it('Home/End/Ctrl+Home/Ctrl+End/PageDown', () => {
    const at = gridCursorAt({ row: 2, col: 1 });
    expect(moveGridCursor(at, 'rowStart', ctx)).toMatchObject({ row: 2, col: 0 });
    expect(moveGridCursor(at, 'rowEnd', ctx)).toMatchObject({ row: 2, col: 2 });
    expect(moveGridCursor(at, 'gridStart', ctx)).toMatchObject({ row: 0, col: 0 });
    expect(moveGridCursor(at, 'gridEnd', ctx)).toMatchObject({ row: 3, col: 2 });
    expect(moveGridCursor(gridCursorAt({ row: 0, col: 0 }), 'pageDown', { size, pageRows: 2 })).toMatchObject({ row: 2 });
  });

  it('κενό πλέγμα ⇒ καμία κίνηση', () => {
    expect(moveGridCursor(gridCursorAt({ row: 0, col: 0 }), 'down', { size: { rows: 0, cols: 3 } })).toBeNull();
  });
});

describe('edgeOf — Ctrl+βέλος του Excel (άκρη δεδομένων, όχι άκρη πλέγματος)', () => {
  // στήλη 0: γεμάτα 0..2, κενό 3..5, γεμάτο 6, κενό 7
  const filled = new Set([0, 1, 2, 6]);
  const isEmpty = (cell: GridCell) => !filled.has(cell.row);
  const tall = { rows: 8, cols: 1 };
  const down = { row: 1, col: 0 };

  it('από γεμάτο με γεμάτο γείτονα ⇒ το τελευταίο γεμάτο της σειράς', () => {
    expect(edgeOf({ row: 0, col: 0 }, down, tall, isEmpty)).toEqual({ row: 2, col: 0 });
  });
  it('από το τέλος της σειράς ⇒ το επόμενο γεμάτο, πάνω από το κενό', () => {
    expect(edgeOf({ row: 2, col: 0 }, down, tall, isEmpty)).toEqual({ row: 6, col: 0 });
  });
  it('μετά το τελευταίο γεμάτο ⇒ η άκρη του πλέγματος', () => {
    expect(edgeOf({ row: 6, col: 0 }, down, tall, isEmpty)).toEqual({ row: 7, col: 0 });
  });
  it('χωρίς ανιχνευτή κενού ⇒ άκρη πλέγματος', () => {
    expect(edgeOf({ row: 0, col: 0 }, down, tall)).toEqual({ row: 7, col: 0 });
  });
});

describe('επιλογή', () => {
  it('Shift+βέλος κουνά μόνο την εστία · απλό βέλος μαζεύει την επιλογή στον δρομέα', () => {
    const start = collapsedSelection({ row: 1, col: 1 });
    const grown = extendSelection(extendSelection(start, 'down', ctx), 'right', ctx);
    expect(rangeOfSelection(grown)).toEqual({ top: 1, left: 1, bottom: 2, right: 2 });
    expect(grown.cursor).toMatchObject({ row: 1, col: 1 });
    const moved = moveSelection(grown, 'left', ctx);
    expect(rangeOfSelection(moved)).toEqual({ top: 1, left: 0, bottom: 1, right: 0 });
  });

  it('εύρος προς τα πάνω-αριστερά κανονικοποιείται · κελιά γραμμή-γραμμή', () => {
    const selection = extendSelectionTo(collapsedSelection({ row: 2, col: 2 }), { row: 1, col: 1 });
    expect(rangeOfSelection(selection)).toEqual({ top: 1, left: 1, bottom: 2, right: 2 });
    expect(cellsOfRange(rangeOfSelection(selection))).toEqual([
      { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 1 }, { row: 2, col: 2 },
    ]);
  });

  it('κίνηση σε άκρη με πολλαπλή επιλογή ⇒ μαζεύεται στον δρομέα (όχι «κολλημένη» επιλογή)', () => {
    const grown = extendSelection(collapsedSelection({ row: 0, col: 0 }), 'down', ctx);
    expect(rangeOfSelection(moveSelection(grown, 'up', ctx))).toEqual({ top: 0, left: 0, bottom: 0, right: 0 });
  });

  it('Ctrl+A = ΟΛΟ το πλέγμα, το ενεργό κελί μένει εκεί που ήταν · κεφαλίδα στήλης · περιορισμός μετά από διαγραφή', () => {
    const all = selectWholeGrid(collapsedSelection({ row: 1, col: 1 }), size);
    expect(rangeOfSelection(all)).toEqual({ top: 0, left: 0, bottom: 3, right: 2 });
    expect(all.cursor).toMatchObject({ row: 1, col: 1 });
    expect(rangeOfSelection(selectColumn(2, size))).toEqual({ top: 0, left: 2, bottom: 3, right: 2 });
    const tail = collapsedSelection({ row: 3, col: 2 });
    expect(clampSelection(tail, { rows: 2, cols: 3 }).cursor).toMatchObject({ row: 1, col: 2 });
    expect(clampSelection(tail, size)).toBe(tail);
  });
});
