/**
 * ADR-755 — **η εγγραφή των συγχωνεύσεων**: οι τέσσερις εντολές του Excel.
 *
 * ## 🔑 ΓΙΑΤΙ ΤΟ ΔΕΥΤΕΡΟ ΕΠΙΠΕΔΟ ΕΙΝΑΙ ΕΔΩ ΥΠΟΧΡΕΩΤΙΚΟ, ΟΧΙ ΚΑΛΗ ΣΥΝΗΘΕΙΑ
 * Το `merges` είχε **οκτώ** αναγνώστες και **μηδέν** γραφείς πριν από αυτή τη φάση: η δομή
 * ήταν συνεπής με τον εαυτό της και μονίμως κενή. Ένα test που επαληθεύει μόνο ότι γράφτηκε
 * ένα `CellSpan` στο αντικείμενο θα έβαφε πράσινη **ακριβώς** τη νεκρή διαδρομή που το ADR-755
 * υπάρχει για να ζωντανέψει — «κάλυψη σε νεκρό δίδυμο δεν είναι κάλυψη».
 *
 * Γι' αυτό κάθε εντολή ελέγχεται σε **δύο** επίπεδα, όπως και οι διαγώνιοι:
 *  1. **Στο μοντέλο** — ποιο span γράφτηκε, ποιο κελί άδειασε, τι *δεν* γράφτηκε.
 *  2. **Στην οθόνη** — μέσω πραγματικού `resolveTableModel` + `layoutTable`, δηλαδή της ίδιας
 *     διαδρομής που τροφοδοτεί καμβά / PDF / DXF.
 */

import { layoutTable } from '../table-layout';
import { resolveTableModel } from '../table-model-helpers';
import {
  TABLE_MERGE_COMMANDS,
  TABLE_MERGE_PRIMARY_COMMAND,
  applyTableMergeCommand,
  tableMergeDiscardedCells,
  tableMergeState,
  type TableMergeCommandId,
} from '../table-range-merge-ops';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableCellLayout, TableTextMeasurer } from '../table-layout-types';
import type {
  CellSpan,
  PersistedTableModel,
  TableCellAlign,
  TableCellEntry,
  TableColumn,
  TableRow,
} from '../../../types/table';
import type { TableCellRangeBounds } from '../table-cell-range';

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

const W = 10;
const H = 6;
/** Η στοίχιση που «ισχύει σήμερα» στην άγκυρα — κάθετα **κορυφή**, ώστε να φανεί αν χαθεί. */
const CURRENT_ALIGN: TableCellAlign = 'TL';

function persisted(
  rowCount: number,
  colCount: number,
  options: {
    readonly merges?: readonly CellSpan[];
    readonly cells?: readonly TableCellEntry[];
  } = {},
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
  return { columns, rows, cells: options.cells ?? [], merges: options.merges ?? [] };
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
  id: TableMergeCommandId,
  align: TableCellAlign = CURRENT_ALIGN,
): PersistedTableModel {
  return applyTableMergeCommand(model, b, id, align);
}

function text(rowId: string, colId: string, value: string): TableCellEntry {
  return [rowId, colId, { kind: 'text', value }];
}

/** Ό,τι φτάνει πραγματικά στον ζωγράφο — μέσω της ζωντανής διαδρομής. */
function paintedCells(model: PersistedTableModel): readonly TableCellLayout[] {
  return layoutTable(resolveTableModel(model), STANDARD, { measureText }).cells;
}

function cellAt(model: PersistedTableModel, rowId: string, colId: string): TableCellEntry | undefined {
  return model.cells.find(([r, c]) => r === rowId && c === colId);
}

// ── Το μητρώο ───────────────────────────────────────────────────────────────

describe('το μητρώο των τεσσάρων', () => {
  it('έχει ακριβώς τέσσερις εντολές, με μοναδικές ταυτότητες και τη σειρά του Excel', () => {
    const ids = TABLE_MERGE_COMMANDS.map((c) => c.id);
    expect(ids).toEqual(['mergeCenter', 'mergeAcross', 'merge', 'unmerge']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('🔑 η κατάργηση είναι η ΜΟΝΗ που δεν συγχωνεύει — όχι πέμπτος κλάδος', () => {
    const joining = TABLE_MERGE_COMMANDS.filter((c) => c.joins).map((c) => c.id);
    expect(joining).toEqual(['mergeCenter', 'mergeAcross', 'merge']);
  });

  it('η προεπιλογή του κουμπιού υπάρχει στο μητρώο', () => {
    expect(TABLE_MERGE_COMMANDS.some((c) => c.id === TABLE_MERGE_PRIMARY_COMMAND)).toBe(true);
  });
});

// ── Στο μοντέλο ─────────────────────────────────────────────────────────────

describe('τι γράφεται στο μοντέλο', () => {
  it('«Συγχώνευση κελιών» γράφει ΜΙΑ συγχώνευση για όλο το ορθογώνιο', () => {
    const next = apply(persisted(4, 4), bounds(1, 2, 1, 3), 'merge');
    expect(next.merges).toEqual([
      { anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 2, colSpan: 3 },
    ]);
  });

  it('«Συγχώνευση κατά γραμμές» γράφει ΜΙΑ ανά γραμμή — ποτέ ένα ορθογώνιο', () => {
    const next = apply(persisted(4, 4), bounds(1, 2, 1, 3), 'mergeAcross');
    expect(next.merges).toEqual([
      { anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 1, colSpan: 3 },
      { anchorRowId: 'r3', anchorColId: 'c2', rowSpan: 1, colSpan: 3 },
    ]);
  });

  it('🔴 δεν γράφει ΠΟΤΕ συγχώνευση 1×1 — ούτε ως ορθογώνιο ούτε ανά γραμμή', () => {
    // Το `buildMergeIndex` τα αγνοεί ήδη, αλλά γραμμένα θα ταξίδευαν σε κάθε αποθήκευση και
    // θα εμφανίζονταν σε κάθε diff. Η `mergeAcross` πάνω σε ΜΙΑ στήλη είναι φυσιολογική
    // κίνηση χρήστη, όχι ακραία — και θα γεννούσε N άχρηστες εγγραφές.
    const clean = persisted(3, 3);
    // Καθόλου εγγραφή ⇒ ούτε καν νέο αντικείμενο μοντέλου.
    expect(apply(clean, bounds(0, 0, 0, 0), 'merge')).toBe(clean);
    expect(apply(clean, bounds(0, 2, 1, 1), 'mergeAcross')).toBe(clean);
  });

  it('🔴 καθαρίζει κάθε ΤΕΜΝΟΜΕΝΗ συγχώνευση πριν γράψει — ποτέ δύο άγκυρες στα ίδια κελιά', () => {
    // Χωρίς αυτό, το ευρετήριο θα έδινε αποτέλεσμα που εξαρτάται από τη σειρά του πίνακα.
    const withOld = persisted(4, 4, {
      merges: [{ anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 2, colSpan: 2 }],
    });
    const next = apply(withOld, bounds(1, 3, 1, 3), 'merge');
    expect(next.merges).toEqual([
      { anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 3, colSpan: 3 },
    ]);
  });

  it('«Κατάργηση» αφαιρεί κάθε τεμνόμενη συγχώνευση και δεν γράφει καμία', () => {
    const withTwo = persisted(4, 4, {
      merges: [
        { anchorRowId: 'r1', anchorColId: 'c1', rowSpan: 2, colSpan: 2 },
        { anchorRowId: 'r4', anchorColId: 'c4', rowSpan: 1, colSpan: 1 },
      ],
    });
    const next = apply(withTwo, bounds(0, 1, 0, 1), 'unmerge');
    expect(next.merges).toEqual([
      { anchorRowId: 'r4', anchorColId: 'c4', rowSpan: 1, colSpan: 1 },
    ]);
  });

  it('🔴 ΙΔΙΑ εντολή δεύτερη φορά ⇒ ΙΔΙΟ μοντέλο by-reference (κανένα βήμα undo)', () => {
    const once = apply(persisted(3, 3), bounds(0, 1, 0, 1), 'merge');
    expect(apply(once, bounds(0, 1, 0, 1), 'merge')).toBe(once);
  });

  it('«Κατάργηση» χωρίς συγχώνευση ⇒ ΙΔΙΟ μοντέλο by-reference', () => {
    const model = persisted(3, 3);
    expect(apply(model, bounds(0, 1, 0, 1), 'unmerge')).toBe(model);
  });

  it('μπαγιάτικα όρια (γραμμή σβησμένη από undo) κόβονται αντί να ρίξουν σφάλμα', () => {
    const model = persisted(2, 2);
    expect(() => apply(model, bounds(0, 9, 0, 9), 'merge')).not.toThrow();
    expect(apply(model, bounds(5, 9, 5, 9), 'merge')).toBe(model);
  });
});

// ── Το περιεχόμενο ──────────────────────────────────────────────────────────

describe('🔴 μόνο η άγκυρα κρατά περιεχόμενο', () => {
  const filled = (): PersistedTableModel =>
    persisted(3, 3, {
      cells: [text('r1', 'c1', 'άγκυρα'), text('r1', 'c2', 'χάνεται'), text('r2', 'c1', 'κι αυτό')],
    });

  it('αδειάζει τα καλυμμένα κελιά — ποτέ δεδομένο-φάντασμα κάτω από τη συγχώνευση', () => {
    // ⚠️ Αντίθετα από τις διαγωνίους (ADR-750 Α16: «γράφονται όλα, η δομή αποφασίζει τι
    // φαίνεται»): εκείνο είναι μορφοποίηση, αυτό είναι ΠΕΡΙΕΧΟΜΕΝΟ. Κείμενο που ξαναφανερώνεται
    // μήνες μετά σε ένα ξήλωμα δεν βγαίνει σε καμία εξαγωγή και δεν το βρίσκει καμία αναζήτηση.
    const next = apply(filled(), bounds(0, 1, 0, 1), 'merge');
    expect(cellAt(next, 'r1', 'c1')?.[2].value).toBe('άγκυρα');
    expect(cellAt(next, 'r1', 'c2')?.[2].value).toBe('');
    expect(cellAt(next, 'r2', 'c1')?.[2].value).toBe('');
  });

  it('δεν γεννά εγγραφή-φάντασμα για καλυμμένο κελί που ήταν ήδη κενό', () => {
    const next = apply(persisted(3, 3), bounds(0, 1, 0, 1), 'merge');
    expect(next.cells).toEqual([]);
  });

  it('η ΚΑΤΑΡΓΗΣΗ δεν σβήνει τίποτα — το περιεχόμενο ζει ήδη ολόκληρο στην άγκυρα', () => {
    const merged = apply(filled(), bounds(0, 1, 0, 1), 'merge');
    const unmerged = apply(merged, bounds(0, 1, 0, 1), 'unmerge');
    expect(cellAt(unmerged, 'r1', 'c1')?.[2].value).toBe('άγκυρα');
  });
});

describe('η μέτρηση για τον διάλογο', () => {
  const filled = persisted(3, 3, {
    cells: [text('r1', 'c1', 'άγκυρα'), text('r1', 'c2', 'χάνεται'), text('r2', 'c2', 'κενό μετά')],
  });

  it('μετρά ΜΟΝΟ τα καλυμμένα κελιά που έχουν περιεχόμενο', () => {
    // `r1c1` είναι άγκυρα (μένει)· `r1c2` και `r2c2` καλύπτονται και έχουν κείμενο.
    expect(tableMergeDiscardedCells(filled, bounds(0, 1, 0, 1), 'merge')).toBe(2);
  });

  it('κενά καλυμμένα κελιά δεν μετράνε — δεν υπάρχει τίποτα να χαθεί', () => {
    expect(tableMergeDiscardedCells(persisted(3, 3), bounds(0, 1, 0, 1), 'merge')).toBe(0);
  });

  it('🔑 η ΚΑΤΑΡΓΗΣΗ δεν χάνει ποτέ τίποτα ⇒ 0, άρα δεν ρωτά ποτέ', () => {
    const merged = apply(filled, bounds(0, 1, 0, 1), 'merge');
    expect(tableMergeDiscardedCells(merged, bounds(0, 1, 0, 1), 'unmerge')).toBe(0);
  });

  it('η μέτρηση συμφωνεί με την εκτέλεση — ίδιο σχέδιο, όχι δεύτερος υπολογισμός', () => {
    const before = filled.cells.filter(([, , cell]) => cell.value !== '').length;
    const counted = tableMergeDiscardedCells(filled, bounds(0, 1, 0, 1), 'merge');
    const after = apply(filled, bounds(0, 1, 0, 1), 'merge')
      .cells.filter(([, , cell]) => cell.value !== '').length;
    expect(before - after).toBe(counted);
  });
});

// ── Η στοίχιση ──────────────────────────────────────────────────────────────

describe('🔑 «και κεντράρισμα» αγγίζει ΜΟΝΟ την οριζόντια συνιστώσα', () => {
  it('κρατά την κάθετη ζώνη της τρέχουσας στοίχισης', () => {
    // Το `TableCellAlign` είναι ΜΙΑ τιμή 9 θέσεων: γράφοντας σκέτο `'MC'` θα σέρναμε μαζί μια
    // κάθετη απόφαση που κανείς δεν ζήτησε — μια κεφαλίδα με στοίχιση κορυφής θα κατέβαινε.
    const next = apply(persisted(3, 3), bounds(0, 0, 0, 1), 'mergeCenter', 'TL');
    expect(cellAt(next, 'r1', 'c1')?.[2].styleOverride?.align).toBe('TC');
  });

  it('η ίδια εντολή με κάθετη «μέση» δίνει MC — η ζώνη έρχεται από το στυλ, δεν μαντεύεται', () => {
    const next = apply(persisted(3, 3), bounds(0, 0, 0, 1), 'mergeCenter', 'ML');
    expect(cellAt(next, 'r1', 'c1')?.[2].styleOverride?.align).toBe('MC');
  });

  it('οι άλλες τρεις εντολές ΔΕΝ αγγίζουν τη στοίχιση', () => {
    for (const id of ['merge', 'mergeAcross', 'unmerge'] as const) {
      const next = apply(persisted(3, 3), bounds(0, 0, 0, 1), id);
      expect(cellAt(next, 'r1', 'c1')?.[2].styleOverride?.align).toBeUndefined();
    }
  });
});

// ── Η κατάσταση του κουμπιού ────────────────────────────────────────────────

describe('η κατάσταση που βλέπει το χειριστήριο', () => {
  it('περιοχή ≥ 2 κελιών χωρίς συγχώνευση: μπορεί να συγχωνεύσει, τίποτα να καταργήσει', () => {
    expect(tableMergeState(persisted(3, 3), bounds(0, 1, 0, 1))).toEqual({
      merged: false,
      canMerge: true,
    });
  });

  it('🔑 ένα κελί ΜΕΣΑ σε συγχώνευση δηλώνει `merged` — εκεί το κουμπί δείχνει πατημένο', () => {
    const merged = apply(persisted(3, 3), bounds(0, 1, 0, 1), 'merge');
    expect(tableMergeState(merged, bounds(1, 1, 1, 1)).merged).toBe(true);
  });

  it('μεμονωμένο ελεύθερο κελί: καμία από τις τέσσερις δεν έχει νόημα', () => {
    expect(tableMergeState(persisted(3, 3), bounds(0, 0, 0, 0))).toEqual({
      merged: false,
      canMerge: false,
    });
  });
});

// ── Στην οθόνη ──────────────────────────────────────────────────────────────

describe('🔑 στην ΟΘΟΝΗ — η ζωντανή διαδρομή, όχι μόνο το πεδίο', () => {
  it('η συγχώνευση κάνει τα καλυμμένα κελιά να ΜΗΝ εκπέμπονται καθόλου', () => {
    const before = paintedCells(persisted(3, 3));
    const after = paintedCells(apply(persisted(3, 3), bounds(0, 1, 0, 1), 'merge'));
    expect(before).toHaveLength(9);
    // 9 − 3 καλυμμένα (r1c2, r2c1, r2c2) = 6 ορατά.
    expect(after).toHaveLength(6);
  });

  it('η άγκυρα καταλαμβάνει ΟΛΟΚΛΗΡΟ το ορθογώνιο — πλάτος και ύψος', () => {
    const painted = paintedCells(apply(persisted(3, 3), bounds(0, 1, 0, 1), 'merge'));
    const anchor = painted.find((cell) => cell.rowId === 'r1' && cell.colId === 'c1');
    expect(anchor?.rowSpan).toBe(2);
    expect(anchor?.colSpan).toBe(2);
    expect(anchor?.rect.w).toBeCloseTo(W * 2);
    expect(anchor?.rect.h).toBeCloseTo(H * 2);
  });

  it('🔴 η ΚΑΤΑΡΓΗΣΗ επαναφέρει και τα εννέα κελιά στην οθόνη', () => {
    const merged = apply(persisted(3, 3), bounds(0, 1, 0, 1), 'merge');
    expect(paintedCells(apply(merged, bounds(0, 1, 0, 1), 'unmerge'))).toHaveLength(9);
  });

  it('«κατά γραμμές» δίνει ΔΥΟ φαρδιά κελιά, όχι ένα ψηλό', () => {
    const next = apply(persisted(3, 3), bounds(0, 1, 0, 2), 'mergeAcross');
    const painted = paintedCells(next);
    const wide = painted.filter((cell) => cell.colSpan === 3);
    expect(wide).toHaveLength(2);
    expect(wide.every((cell) => cell.rowSpan === 1)).toBe(true);
  });

  it('🔑 το κεντράρισμα φτάνει ως τον ζωγράφο — όχι μόνο ως το πεδίο', () => {
    const next = apply(persisted(3, 3), bounds(0, 0, 0, 2), 'mergeCenter', 'ML');
    const anchor = paintedCells(next).find((cell) => cell.rowId === 'r1' && cell.colId === 'c1');
    expect(anchor?.hAlign).toBe('center');
  });
});
