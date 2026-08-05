/**
 * 🔴 ADR-739 §50 — **Η ΥΠΟΧΡΕΩΣΗ ΕΠΑΝΑΫΠΟΛΟΓΙΣΜΟΥ, ΩΣ ΙΔΙΟΤΗΤΑ ΚΑΙ ΟΧΙ ΩΣ ΛΙΣΤΑ ΚΛΗΣΕΩΝ.**
 *
 * ## Τι φυλάει αυτό το αρχείο
 * Τέσσερις φορές συνέβη το ίδιο ελάττωμα: κάποιος έγραψε **περιεχόμενο** κελιών και δεν
 * ξαναϋπολόγισε — επικόλληση (§47), `Delete` σε περιοχή (§47), καθάρισμα (§47), και τελικά
 * **συγχώνευση** (§47.5). Το σύμπτωμα ήταν κάθε φορά ταυτόσημο και πάντα σιωπηλό: ένας τύπος
 * που διάβαζε τα κελιά εξακολουθούσε να δείχνει την **προηγούμενη** τιμή του — στην οθόνη,
 * στην εξαγωγή και στο DXF. Κανένα gate δεν το έβλεπε, γιατί παράγει **λάθος νούμερα** σε
 * πίνακα ποσοτήτων, όχι εξαίρεση.
 *
 * ## 🔑 Γιατί ΔΕΝ αρκούσε να διορθωθεί το τέταρτο δείγμα
 * Η αιτία δεν ήταν απροσεξία — ήταν ο **τύπος επιστροφής**. Γραφέας που δίνει
 * `PersistedTableModel` δίνει κάτι πλήρως χρησιμοποιήσιμο, οπότε δεν υπάρχει καμία στιγμή
 * όπου κάτι να ρωτήσει τον καλούντα «τελείωσες;». Ο τύπος {@link PendingCellWrites} κάνει το
 * **πέμπτο δείγμα μη εκφράσιμο** — και εδώ αποδεικνύεται ότι η ιδιότητα ισχύει για **κάθε**
 * σημείο εισόδου που γράφει περιεχόμενο, όχι για όσα θυμήθηκε κάποιος να ελέγξει.
 *
 * ⚠️ Το κριτήριο είναι **ανά διαδρομή, όχι ανά αρχείο**: το `contacts-query.service.ts` του
 * CHECK 3.35 είχε 6 συναρτήσεις, 5 σωστές και 1 όχι. Γι' αυτό κάθε διαδρομή έχει δικό της
 * `it`, με **τον ίδιο** τύπο-μάρτυρα και **την ίδια** ερώτηση.
 *
 * @see bim/table/table-cell-content.ts — ο τύπος και οι δύο όψεις του γραφέα
 * @see bim/table/formula/table-formula-engine.ts — `commitCellWrites`, το ΜΟΝΟ ξετύλιγμα
 */

import { clearPersistedCells, resolveTableModel, setPersistedCellText } from '../table-model-helpers';
import { commitCellWrites, writeCellInput } from '../formula/table-formula-engine';
import { applyTableMergeCommand } from '../table-range-merge-ops';
import { clearTableRange, pasteTsvIntoTable } from '../table-range-clipboard';
import { applyTableFill } from '../table-fill-apply';
import { setTableRangeDiagonals } from '../table-cell-diagonal-ops';
import { layoutTable } from '../table-layout';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { TableTextMeasurer } from '../table-layout-types';
import type {
  PersistedTableModel,
  TableCellAlign,
  TableCellEntry,
  TableColumn,
  TableColumnId,
  TableRow,
  TableRowId,
} from '../../../types/table';
import type { TableCellRangeBounds } from '../table-cell-range';

const measureText: TableTextMeasurer = (text, heightMm) => text.length * heightMm * 0.6;
const ANCHOR_ALIGN: TableCellAlign = 'TL';

const STANDARD: TableStyle = (() => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD);
  if (!style) throw new Error('missing preset: standard');
  return style;
})();

/**
 * Πίνακας 4 × 2 όπου το **`B1` αθροίζει τη στήλη A** (`=SUM(A1:A3)`).
 *
 * Ο μάρτυρας είναι πάντα το `B1`: κάθε πράξη παρακάτω αγγίζει κάποιο από τα `A1:A3`, οπότε
 * αν ο επαναϋπολογισμός παραλειφθεί, το άθροισμα μένει **`60`** ενώ τα δεδομένα του δεν
 * υπάρχουν πια. Είναι ακριβώς το σφάλμα του §47/§47.5, στο μικρότερο δυνατό μέγεθος.
 */
function withSum(): PersistedTableModel {
  // ⚠️ `valueType: 'text'` επίτηδες: από το ADR-760 το `'number'` ενεργοποιεί **μορφοποίηση**
  // (2 δεκαδικά), οπότε ο μάρτυρας του καμβά θα έλεγε `40,00`. Αυτό το αρχείο ελέγχει τον
  // **επαναϋπολογισμό** — δεν επιτρέπεται να πέφτει κόκκινο επειδή άλλαξε η εμφάνιση.
  const columns: TableColumn[] = [
    { id: 'cA', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'right' },
    { id: 'cB', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'right' },
  ];
  const rows: TableRow[] = ['r1', 'r2', 'r3', 'r4'].map((id) => ({
    id,
    rowClass: 'data',
    heightMm: 6,
  }));
  const cells: TableCellEntry[] = [
    ['r1', 'cA', { kind: 'text', value: 10 }],
    ['r2', 'cA', { kind: 'text', value: 20 }],
    ['r3', 'cA', { kind: 'text', value: 30 }],
  ];
  const base: PersistedTableModel = { columns, rows, cells, merges: [] };
  return commitCellWrites(writeCellInput(base, 'r1', 'cB', '=SUM(A1:A3)'));
}

/** Η **αποθηκευμένη** τιμή του μάρτυρα — αυτό που ταξιδεύει σε εξαγωγή και DXF. */
function sumValue(model: PersistedTableModel): unknown {
  return model.cells.find(([r, c]) => r === 'r1' && c === 'cB')?.[2].value;
}

/** Η τιμή του μάρτυρα **όπως ζωγραφίζεται** — μέσα από τη μία μηχανή διάταξης. */
function sumOnCanvas(model: PersistedTableModel): string | undefined {
  const layout = layoutTable(resolveTableModel(model), STANDARD, { measureText });
  const cell = layout.cells.find((c) => c.rowId === 'r1' && c.colId === 'cB');
  return cell?.text?.text;
}

const at = (rowId: TableRowId, colId: TableColumnId) => ({ rowId, colId });
const rangeOf = (
  firstRow: number,
  lastRow: number,
  firstCol: number,
  lastCol: number,
): TableCellRangeBounds => ({ firstRow, lastRow, firstCol, lastCol });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Ο τύπος-μάρτυρας: τι δηλώνει ο γραφέας ότι έγραψε
// ─────────────────────────────────────────────────────────────────────────────

describe('PendingCellWrites — η πέμπτη εγγύηση του γραφέα', () => {
  it('δηλώνει το κελί που άλλαξε', () => {
    const model = withSum();
    const pending = setPersistedCellText(model, 'r2', 'cA', '99');

    expect(pending.written).toEqual([{ rowId: 'r2', colId: 'cA' }]);
    expect(pending.model).not.toBe(model);
  });

  it('ΔΕΝ δηλώνει τίποτα όταν το κείμενο είναι ταυτόσημο — και δίνει το ΙΔΙΟ μοντέλο', () => {
    const model = withSum();
    const pending = setPersistedCellText(model, 'r2', 'cA', '20');

    expect(pending.written).toEqual([]);
    expect(pending.model).toBe(model); // η τέταρτη εγγύηση, ταξιδεμένη μέσα στον τύπο
  });

  it('μαζική εγγραφή δηλώνει ΜΟΝΟ τα κελιά που όντως άλλαξαν, όχι όσα ζητήθηκαν', () => {
    const model = withSum();
    // `r4/cA` είναι ήδη κενό: το άδειασμα δεν έχει τι να κάνει εκεί (αραιός χάρτης).
    const pending = clearPersistedCells(model, [at('r2', 'cA'), at('r4', 'cA')]);

    expect(pending.written).toEqual([{ rowId: 'r2', colId: 'cA' }]);
  });

  it('`commitCellWrites` σε κενή εκκρεμότητα επιστρέφει το ΙΔΙΟ μοντέλο by-reference', () => {
    const model = withSum();
    expect(commitCellWrites({ model, written: [] })).toBe(model);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Η ΙΔΙΟΤΗΤΑ — κάθε διαδρομή που γράφει περιεχόμενο ξαναϋπολογίζει
// ─────────────────────────────────────────────────────────────────────────────

describe('κάθε γραφέας περιεχομένου διαδίδει στους τύπους', () => {
  it('η βάση είναι σωστή: το `B1` αθροίζει 60', () => {
    const model = withSum();
    expect(sumValue(model)).toBe(60);
    expect(sumOnCanvas(model)).toBe('60');
  });

  it('🔴 §47.5 — ΣΥΓΧΩΝΕΥΣΗ που καταπίνει το `A2` ξαναϋπολογίζει το άθροισμα', () => {
    // Η συγχώνευση `A1:A2` αδειάζει το καλυμμένο `A2` (το περιεχόμενο ζει στην άγκυρα).
    // Πριν το §50 το άθροισμα έμενε **60** — δεδομένα που δεν υπάρχουν πια, και στο DXF.
    const merged = applyTableMergeCommand(withSum(), rangeOf(0, 1, 0, 0), 'merge', ANCHOR_ALIGN);

    expect(sumValue(merged)).toBe(40); // 10 + 30 — το 20 καταπόθηκε
    expect(sumOnCanvas(merged)).toBe('40');
  });

  it('ΣΥΓΧΩΝΕΥΣΗ ΚΑΙ ΚΕΝΤΡΑΡΙΣΜΑ — ο επαναϋπολογισμός δεν χάνεται από το δεύτερο πέρασμα', () => {
    const merged = applyTableMergeCommand(
      withSum(),
      rangeOf(0, 1, 0, 0),
      'mergeCenter',
      ANCHOR_ALIGN,
    );

    expect(sumValue(merged)).toBe(40);
    // Και η στοίχιση της άγκυρας όντως γράφτηκε — το δεύτερο πέρασμα δεν θυσιάστηκε.
    const anchor = merged.cells.find(([r, c]) => r === 'r1' && c === 'cA')?.[2];
    expect(anchor?.styleOverride?.align).toBe('TC');
  });

  it('`Delete` σε περιοχή ξαναϋπολογίζει', () => {
    const cleared = clearTableRange(withSum(), rangeOf(1, 2, 0, 0)); // A2:A3
    expect(sumValue(cleared)).toBe(10);
  });

  it('ΕΠΙΚΟΛΛΗΣΗ ξαναϋπολογίζει', () => {
    const pasted = pasteTsvIntoTable(withSum(), at('r1', 'cA'), [['5'], ['5'], ['5']]);
    expect(sumValue(pasted.model)).toBe(15);
  });

  it('ΓΕΜΙΣΜΑ λαβής ξαναϋπολογίζει', () => {
    // Το `A1` (=10) γεμίζει προς τα κάτω μέχρι το `A3`: το άθροισμα γίνεται 30.
    const filled = applyTableFill(withSum(), rangeOf(0, 0, 0, 0), {
      bounds: rangeOf(0, 2, 0, 0),
      axis: 'row',
    });
    expect(sumValue(filled)).toBe(30);
  });

  it('ΜΟΝΗ ΠΛΗΚΤΡΟΛΟΓΗΣΗ ξαναϋπολογίζει', () => {
    const typed = commitCellWrites(writeCellInput(withSum(), 'r2', 'cA', '0'));
    expect(sumValue(typed)).toBe(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Η άλλη όψη — η μορφοποίηση ΔΕΝ χρωστά επαναϋπολογισμό
// ─────────────────────────────────────────────────────────────────────────────

describe('οι γραφείς ΜΟΡΦΟΠΟΙΗΣΗΣ δεν χρωστούν τίποτα', () => {
  it('οι διαγώνιοι επιστρέφουν σκέτο μοντέλο και αφήνουν τις τιμές άθικτες', () => {
    const model = withSum();
    const withDiagonals = setTableRangeDiagonals(model, rangeOf(0, 2, 0, 0), { down: true });

    // Καμία τιμή δεν διαβάζει διαγώνιο ⇒ ο γράφος δεν έχει λόγο να ανοίξει.
    expect(sumValue(withDiagonals)).toBe(60);
    expect(withDiagonals.cells.find(([r, c]) => r === 'r1' && c === 'cA')?.[2].diagonal).toEqual({
      down: true,
    });
  });
});
