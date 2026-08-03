/**
 * ADR-750 Φ5, απόφαση **Α2** — οι διαγώνιες γραμμές κελιού.
 *
 * Δύο επίπεδα απόδειξης, όπως και στις ακμές (`table-range-border-ops.test.ts`):
 *
 * 1. **Στο μοντέλο** — ποιο κελί απέκτησε τι, και τι *δεν* γράφτηκε.
 * 2. **Στην οθόνη** — μέσω πραγματικού `resolveTableModel` + `layoutTable`, δηλαδή της ίδιας
 *    διαδρομής που τροφοδοτεί καμβά / PDF / DXF. Χωρίς το δεύτερο, ένα test λέει «το πεδίο
 *    γράφτηκε» και ποτέ «ο χρήστης βλέπει γραμμή».
 */

import { layoutTable } from '../table-layout';
import { resolveTableModel } from '../table-model-helpers';
import { tableLayoutToPrimitives } from '../table-layout-to-primitives';
import {
  TABLE_DIAGONAL_COMMANDS,
  applyTableDiagonalCommand,
  hasTableRangeDiagonals,
  type TableDiagonalCommandId,
} from '../table-cell-diagonal-ops';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableBorderSegment, TableTextMeasurer } from '../table-layout-types';
import type { CellSpan, PersistedTableModel, TableColumn, TableRow } from '../../../types/table';
import type { TableBorderSpec } from '../../../types/table-edges';
import type { TableCellRangeBounds } from '../table-cell-range';

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

const W = 10;
const H = 6;

/** Το μολύβι του χρήστη — εμφανώς διαφορετικό από ό,τι λέει το στυλ (`#666666`, 0.25mm). */
const PEN: TableBorderSpec = { visible: true, colorHex: '#ff00ff', widthMm: 0.25 };

function persisted(
  rowCount: number,
  colCount: number,
  merges: readonly CellSpan[] = [],
): PersistedTableModel {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: W },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: H,
  }));
  return { columns, rows, cells: [], merges };
}

function bounds(
  firstRow: number,
  lastRow: number,
  firstCol: number,
  lastCol: number,
): TableCellRangeBounds {
  return { firstRow, lastRow, firstCol, lastCol };
}

function apply(
  model: PersistedTableModel,
  b: TableCellRangeBounds,
  id: TableDiagonalCommandId,
  pencil: TableBorderSpec = PEN,
): PersistedTableModel {
  return applyTableDiagonalCommand(model, b, id, pencil);
}

/** Ό,τι θα ζωγραφιστεί πραγματικά — μέσω της ζωντανής διαδρομής. */
function paintedDiagonals(model: PersistedTableModel): readonly TableBorderSegment[] {
  const layout = layoutTable(resolveTableModel(model), STANDARD, { measureText });
  return layout.cells.flatMap((cell) => cell.diagonals ?? []);
}

// ── Το μητρώο ───────────────────────────────────────────────────────────────

describe('το μητρώο των τεσσάρων', () => {
  it('έχει ακριβώς τέσσερις εντολές, με μοναδικές ταυτότητες', () => {
    const ids = TABLE_DIAGONAL_COMMANDS.map((c) => c.id);
    expect(ids).toEqual(['down', 'up', 'cross', 'clear']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('🔑 κάθε συνδυασμός των δύο διαγωνίων είναι εκφράσιμος — και μόνο μία φορά', () => {
    // Τέσσερις εντολές για τέσσερις καταστάσεις: καμία διπλή, καμία που λείπει. Το Excel
    // εκθέτει δύο διακόπτες επειδή ζει σε modal με «ΟΚ»· εδώ κάθε πάτημα εκτελείται αμέσως.
    const states = TABLE_DIAGONAL_COMMANDS.map((c) => `${c.down}${c.up}`);
    expect(new Set(states).size).toBe(4);
  });
});

// ── Στο μοντέλο ─────────────────────────────────────────────────────────────

describe('Α2 — τι γράφεται στο κελί', () => {
  it('«↘» γράφει ΜΟΝΟ την `down`, με το μολύβι του χρήστη', () => {
    const next = apply(persisted(2, 2), bounds(0, 0, 0, 0), 'down');
    const cell = (next.cells ?? [])[0];
    expect(cell[0]).toBe('r1');
    expect(cell[1]).toBe('c1');
    expect(cell[2].diagonal).toEqual({ down: PEN });
  });

  it('«↗» γράφει ΜΟΝΟ την `up` — τα ονόματα είναι του OOXML, χωρίς μεταφραστή', () => {
    const next = apply(persisted(2, 2), bounds(0, 0, 0, 0), 'up');
    expect((next.cells ?? [])[0][2].diagonal).toEqual({ up: PEN });
  });

  it('«σταυρός» γράφει και τις δύο, με το ΙΔΙΟ μολύβι', () => {
    const next = apply(persisted(2, 2), bounds(0, 0, 0, 0), 'cross');
    expect((next.cells ?? [])[0][2].diagonal).toEqual({ down: PEN, up: PEN });
  });

  it('🔴 «Χωρίς διαγώνιες» ΑΦΑΙΡΕΙ το πεδίο — ποτέ κενό αντικείμενο', () => {
    // Ένα `{}` θα επιβίωνε σε κάθε `JSON.stringify`: ο «καθαρισμένος» πίνακας θα διέφερε από
    // εκείνον που δεν είχε ποτέ διαγώνιο — diff, βήμα undo και αποθήκευση για μηδέν διαφορά.
    const withCross = apply(persisted(2, 2), bounds(0, 0, 0, 0), 'cross');
    const cleared = apply(withCross, bounds(0, 0, 0, 0), 'clear');
    const cell = (cleared.cells ?? [])[0][2];
    expect(cell.diagonal).toBeUndefined();
    expect('diagonal' in cell).toBe(false);
  });

  it('🔑 «Χωρίς διαγώνιες» σε ΚΑΘΑΡΗ περιοχή δεν γεννά κελιά-φαντάσματα', () => {
    // Χωρίς αυτό, ένα «Χωρίς διαγώνιες» πάνω σε επιλογή 500×8 θα έγραφε 4.000 κενές εγγραφές
    // και ένα βήμα undo για το τίποτα.
    const model = persisted(3, 3);
    const next = apply(model, bounds(0, 2, 0, 2), 'clear');
    expect(next).toBe(model);
    expect(next.cells).toHaveLength(0);
  });

  it('ίδια εντολή δεύτερη φορά ⇒ ΤΟ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const once = apply(persisted(2, 2), bounds(0, 0, 0, 0), 'cross');
    expect(apply(once, bounds(0, 0, 0, 0), 'cross')).toBe(once);
  });

  it('ΑΛΛΟ μολύβι, ίδια διαγώνιος ⇒ ΝΕΟ μοντέλο (αλλιώς η αλλαγή δεν φαίνεται ποτέ)', () => {
    const once = apply(persisted(2, 2), bounds(0, 0, 0, 0), 'down');
    const twice = apply(once, bounds(0, 0, 0, 0), 'down', { ...PEN, colorHex: '#00ff00' });
    expect(twice).not.toBe(once);
    expect((twice.cells ?? [])[0][2].diagonal?.down?.colorHex).toBe('#00ff00');
  });

  it('🔑 δεν πειράζει τίποτα άλλο του κελιού — κείμενο και κλείδωμα επιβιώνουν', () => {
    const base: PersistedTableModel = {
      ...persisted(2, 2),
      cells: [['r1', 'c1', { kind: 'text', value: 'Α/Α', locked: true }]],
    };
    const next = apply(base, bounds(0, 0, 0, 0), 'down');
    expect((next.cells ?? [])[0][2]).toEqual({
      kind: 'text',
      value: 'Α/Α',
      locked: true,
      diagonal: { down: PEN },
    });
  });

  it('κρατά τη σειρά γραμμή × στήλη — δύο διαδρομές, ταυτόσημο JSON', () => {
    // Ο μαζικός γραφέας συγχωνεύει τα νέα κελιά με κατάταξη, όχι με `push` στο τέλος.
    const a = apply(apply(persisted(2, 2), bounds(1, 1, 1, 1), 'down'), bounds(0, 0, 0, 0), 'down');
    const b = apply(apply(persisted(2, 2), bounds(0, 0, 0, 0), 'down'), bounds(1, 1, 1, 1), 'down');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect((a.cells ?? []).map(([r, c]) => `${r}:${c}`)).toEqual(['r1:c1', 'r2:c2']);
  });

  it('μπαγιάτικα όρια κόβονται αντί να ρίξουν σφάλμα', () => {
    const next = apply(persisted(2, 2), bounds(0, 99, 0, 99), 'down');
    expect(next.cells).toHaveLength(4);
  });
});

// ── `canClear` ──────────────────────────────────────────────────────────────

describe('`hasTableRangeDiagonals` — το «canReset» της αφαίρεσης', () => {
  it('καθαρός πίνακας: η εντολή δεν έχει τι να κάνει', () => {
    expect(hasTableRangeDiagonals(persisted(3, 3), bounds(0, 2, 0, 2))).toBe(false);
  });

  it('βλέπει διαγώνιο μέσα στην περιοχή', () => {
    const next = apply(persisted(3, 3), bounds(1, 1, 1, 1), 'up');
    expect(hasTableRangeDiagonals(next, bounds(1, 1, 1, 1))).toBe(true);
  });

  it('🔴 ΔΕΝ βλέπει διαγώνιο ΑΛΛΗΣ περιοχής — αλλιώς θα υποσχόταν ψέματα', () => {
    const next = apply(persisted(3, 3), bounds(0, 0, 0, 0), 'up');
    expect(hasTableRangeDiagonals(next, bounds(2, 2, 2, 2))).toBe(false);
  });

  it('μετά την αφαίρεση ξαναγίνεται `false` — ο κύκλος κλείνει', () => {
    const on = apply(persisted(3, 3), bounds(0, 0, 0, 0), 'cross');
    const off = apply(on, bounds(0, 0, 0, 0), 'clear');
    expect(hasTableRangeDiagonals(off, bounds(0, 0, 0, 0))).toBe(false);
  });

  it('επιβιώνει του ταξιδιού στο αρχείο', () => {
    const next = apply(persisted(3, 3), bounds(0, 0, 0, 0), 'down');
    const roundTripped = JSON.parse(JSON.stringify(next)) as PersistedTableModel;
    expect(hasTableRangeDiagonals(roundTripped, bounds(0, 0, 0, 0))).toBe(true);
  });
});

// ── Στην οθόνη ──────────────────────────────────────────────────────────────

describe('🔑 η γεωμετρία που φτάνει στους τέσσερις ζωγράφους', () => {
  it('η ↘ πάει από την ΠΑΝΩ-ΑΡΙΣΤΕΡΗ στην ΚΑΤΩ-ΔΕΞΙΑ γωνία', () => {
    const segments = paintedDiagonals(apply(persisted(2, 2), bounds(0, 0, 0, 0), 'down'));
    expect(segments).toHaveLength(1);
    expect(segments[0].a).toEqual({ x: 0, y: 0 });
    expect(segments[0].b).toEqual({ x: W, y: H });
  });

  it('🔴 η ↗ τελειώνει στο ΜΙΚΡΟΤΕΡΟ `y` — ο άξονας του πλαισίου δείχνει κάτω', () => {
    // Ακριβώς το σημείο όπου μια εικασία δίνει καθρεφτισμένο σχέδιο.
    const segments = paintedDiagonals(apply(persisted(2, 2), bounds(0, 0, 0, 0), 'up'));
    expect(segments[0].a).toEqual({ x: 0, y: H });
    expect(segments[0].b).toEqual({ x: W, y: 0 });
  });

  it('ο σταυρός δίνει δύο τμήματα που τέμνονται στο κέντρο του κελιού', () => {
    const segments = paintedDiagonals(apply(persisted(2, 2), bounds(0, 0, 0, 0), 'cross'));
    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      expect((segment.a.x + segment.b.x) / 2).toBeCloseTo(W / 2, 10);
      expect((segment.a.y + segment.b.y) / 2).toBeCloseTo(H / 2, 10);
    }
  });

  it('🔑 σε ΣΥΓΧΩΝΕΥΜΕΝΟ κελί, η διαγώνιος διασχίζει ΟΛΗ τη συγχώνευση', () => {
    const merged = persisted(2, 2, [{ rowId: 'r1', colId: 'c1', rowSpan: 2, colSpan: 2 }]);
    const segments = paintedDiagonals(apply(merged, bounds(0, 0, 0, 0), 'down'));
    expect(segments).toHaveLength(1);
    expect(segments[0].b).toEqual({ x: 2 * W, y: 2 * H });
  });

  it('🔴 Α16 — τα ΚΑΛΥΜΜΕΝΑ κελιά γράφονται αλλά ΔΕΝ ζωγραφίζονται…', () => {
    const merged = persisted(2, 2, [{ rowId: 'r1', colId: 'c1', rowSpan: 2, colSpan: 2 }]);
    const next = apply(merged, bounds(0, 1, 0, 1), 'down');
    expect(next.cells).toHaveLength(4);
    expect(paintedDiagonals(next)).toHaveLength(1);
  });

  it('…και ΕΜΦΑΝΙΖΟΝΤΑΙ μόλις λυθεί η συγχώνευση', () => {
    const merged = persisted(2, 2, [{ rowId: 'r1', colId: 'c1', rowSpan: 2, colSpan: 2 }]);
    const next = apply(merged, bounds(0, 1, 0, 1), 'down');
    const unmerged: PersistedTableModel = { ...next, merges: [] };
    expect(paintedDiagonals(unmerged)).toHaveLength(4);
  });

  it('κελί χωρίς διαγώνιο ΔΕΝ αποκτά ρητό κενό πεδίο (ταυτότητα σχήματος)', () => {
    const layout = layoutTable(resolveTableModel(persisted(2, 2)), STANDARD, { measureText });
    for (const cell of layout.cells) expect('diagonals' in cell).toBe(false);
  });

  it('🔑 φτάνουν και στην ΕΞΑΓΩΓΗ — όχι μόνο στην οθόνη', () => {
    const next = apply(persisted(1, 1), bounds(0, 0, 0, 0), 'cross');
    const layout = layoutTable(resolveTableModel(next), STANDARD, { measureText });
    const primitives = tableLayoutToPrimitives(layout);
    // Οι μόνες γραμμές με το μολύβι του χρήστη είναι οι δύο διαγώνιοι.
    const mine = primitives.filter(
      (p) => p.kind === 'line' && p.stroke?.colorHex === PEN.colorHex,
    );
    expect(mine).toHaveLength(2);
  });
});
